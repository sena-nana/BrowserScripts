(() => {
  'use strict';

  const win = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const sidebarSelector = 'nav.flex:not(#stage-sidebar-tiny-bar)';
  const promptSelector = 'form.w-full #prompt-textarea';
  const defaultSensitiveRules = [
    '18888888888',
    'https://securiy-domain.com',
    '([\\w-]+(\\.[\\w-]+)*)@163\\.com',
    'my-secret-username'
  ].join('\n');

  const trackingUrlPattern =
    /gravatar\.com|browser-intake-datadoghq\.com|\.wp\.com|intercomcdn\.com|sentry\.io|sentry_key=|intercom\.io|featuregates\.org|statsigapi\.net|google-analytics\.com|googletagmanager\.com|\/v1\/initialize|\/messenger\/|\/rgstr|\/v1\/sdk_exception|\/ces\/v1\/telemetry\/intake|\/ces\/statsc\/flush|\/ces\/v1\/(?:t|p|i|m)(?:\?|$)|\/backend-api\/beacons\//i;
  const trackingScriptPattern = /widget\.intercom\.io|googletagmanager\.com|google-analytics\.com/i;

  const settingsCache = new Map();
  const getValue = (key, fallback) => {
    if (!settingsCache.has(key)) settingsCache.set(key, GM_getValue(key, fallback));
    return settingsCache.get(key);
  };
  const setValue = (key, value) => {
    settingsCache.set(key, value);
    GM_setValue(key, value);
    if (key === 'k_datasecblocklist') compileSensitiveRules(value);
  };

  const features = [
    {
      id: 'keep',
      type: 'action',
      title: '保持会话间隔',
      desc: '定时请求会话状态，降低页面闲置失效概率'
    },
    {
      id: 'data',
      type: 'action',
      title: '敏感内容脱敏',
      desc: '发送前按规则移除输入框里的敏感内容'
    },
    {
      id: 'tracking',
      key: 'k_intercepttracking',
      type: 'toggle',
      title: '阻止跟踪请求',
      desc: '拦截常见统计、埋点、客服脚本请求'
    },
    {
      id: 'wide',
      key: 'k_largescreen',
      type: 'toggle',
      title: '宽屏阅读',
      desc: '放宽聊天内容和输入区的最大宽度'
    },
    {
      id: 'clean',
      key: 'k_cleanlyhome',
      type: 'toggle',
      title: '精简首页',
      desc: '隐藏首页推荐、提示和部分干扰元素'
    },
    {
      id: 'continue',
      key: 'k_speakcompletely',
      type: 'toggle',
      title: '自动继续生成',
      desc: '出现继续生成按钮时自动点击'
    },
    {
      id: 'reuse',
      key: 'k_clonechat',
      type: 'toggle',
      title: '复用我的消息',
      desc: '给自己的消息添加复用按钮，一键填回输入框'
    },
    {
      id: 'history',
      key: 'k_everchanging',
      type: 'toggle',
      title: '侧边栏显示时间和摘要',
      desc: '在历史会话列表显示更新时间和最近回复摘要'
    }
  ];

  class ConversationStore {
    constructor() {
      this.dbName = 'ChatGPTUtilityPanel';
      this.storeName = 'conversations';
      this.dbPromise = null;
      this.cache = new Map();
    }

    open() {
      if (this.dbPromise) return this.dbPromise;

      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
            this.cache.clear();
          };
          resolve(db);
        };
        request.onerror = () => {
          this.dbPromise = null;
          reject(request.error);
        };
      });
      return this.dbPromise;
    }

    async withStore(mode, fn) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, mode);
        const store = tx.objectStore(this.storeName);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      });
    }

    async get(id) {
      if (this.cache.has(id)) return this.cache.get(id);
      const records = await this.getMany([id]);
      return records.get(id) || null;
    }

    async getMany(ids) {
      const records = new Map();
      const missing = [];

      for (const id of ids) {
        if (!id) continue;
        if (this.cache.has(id)) records.set(id, this.cache.get(id));
        else missing.push(id);
      }

      if (!missing.length) return records;

      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const objectStore = tx.objectStore(this.storeName);

        for (const id of missing) {
          const request = objectStore.get(id);
          request.onsuccess = () => {
            const record = request.result || null;
            this.cache.set(id, record);
            if (record) records.set(id, record);
          };
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      return records;
    }

    put(record) {
      if (!record?.id) return Promise.resolve();
      this.cache.set(record.id, record);
      return this.withStore('readwrite', (store) => store.put(record));
    }

    delete(id) {
      if (!id) return Promise.resolve();
      this.cache.delete(id);
      return this.withStore('readwrite', (store) => store.delete(id));
    }
  }

  const store = new ConversationStore();

  const parseUrl = (value) => {
    try {
      return new URL(String(value || ''), location.origin);
    } catch {
      return null;
    }
  };

  const isTrackingRequest = (value) => {
    const url = String(value || '');
    if (!url) return false;
    if (trackingUrlPattern.test(url)) return true;
    const parsed = parseUrl(url);
    return parsed
      ? trackingUrlPattern.test(`${parsed.hostname}${parsed.pathname}${parsed.search}`)
      : false;
  };

  const html = (value) => {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
  };

  const debounce = (fn, delay = 150) => {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const toast = (message) => {
    const node = document.createElement('div');
    node.className = 'kcg-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2200);
  };

  const setPromptText = (text) => {
    const prompt = $(promptSelector);
    if (!prompt) return false;

    prompt.focus();
    if ('value' in prompt) {
      prompt.value = text;
    } else {
      prompt.textContent = '';
      if (!document.execCommand?.('insertText', false, text)) {
        prompt.textContent = text;
      }
    }

    prompt.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
    );
    return true;
  };

  const getPromptText = (prompt) => {
    if (!prompt) return '';
    return 'value' in prompt ? prompt.value : prompt.innerText || prompt.textContent || '';
  };

  let sensitiveRulesSource = null;
  let sensitiveRules = [];

  const compileSensitiveRules = (value = getValue('k_datasecblocklist', defaultSensitiveRules)) => {
    const source = String(value || '');
    if (source === sensitiveRulesSource) return sensitiveRules;

    sensitiveRulesSource = source;
    sensitiveRules = source
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter(Boolean)
      .map((ruleText) => {
        try {
          return new RegExp(ruleText, 'g');
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return sensitiveRules;
  };

  const sanitizeText = (text) => {
    let output = String(text || '');
    const matches = [];

    for (const rule of compileSensitiveRules()) {
      rule.lastIndex = 0;
      const found = output.match(rule) || [];
      for (const item of found) {
        if (!matches.includes(item)) matches.push(item);
      }
      rule.lastIndex = 0;
      output = output.replace(rule, '');
    }

    return { text: output, matches };
  };

  let composingPrompt = false;

  const bindSensitiveScanner = () => {
    const prompt = $(promptSelector);
    if (!prompt || prompt.dataset.kcgSensitiveBound === 'true') return;

    prompt.dataset.kcgSensitiveBound = 'true';
    const scan = () => {
      if (composingPrompt) return;
      const result = sanitizeText(getPromptText(prompt));
      if (!result.matches.length) return;
      setPromptText(result.text);
      toast(`已移除 ${result.matches.length} 条敏感内容`);
    };
    const scanSoon = debounce(scan, 120);

    prompt.addEventListener('input', scanSoon);
    prompt.addEventListener('paste', () => setTimeout(scan, 0));
    prompt.addEventListener('compositionstart', () => {
      composingPrompt = true;
    });
    prompt.addEventListener('compositionend', () => {
      composingPrompt = false;
      scanSoon();
    });
  };

  const showDialog = ({ title, body, inputType, value, onSave }) => {
    const overlay = document.createElement('div');
    overlay.className = 'kcg-dialog';
    overlay.innerHTML = `
            <div class="kcg-dialog-panel" role="dialog" aria-modal="true">
                <div class="kcg-dialog-title">${html(title)}</div>
                ${body ? `<div class="kcg-dialog-body">${html(body)}</div>` : ''}
                ${
                  inputType === 'textarea'
                    ? `<textarea class="kcg-dialog-input" rows="8">${html(value || '')}</textarea>`
                    : `<input class="kcg-dialog-input" value="${html(value || '')}">`
                }
                <div class="kcg-dialog-actions">
                    <button type="button" data-action="cancel">取消</button>
                    <button type="button" data-action="save">保存</button>
                </div>
            </div>
        `;

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    };

    function onEsc(event) {
      if (event.key === 'Escape' && overlay.isConnected) {
        close();
      }
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.dataset.action === 'cancel') close();
      if (event.target.dataset.action === 'save') {
        onSave?.($('.kcg-dialog-input', overlay).value);
        close();
      }
    });
    document.addEventListener('keydown', onEsc);

    document.body.appendChild(overlay);
    $('.kcg-dialog-input', overlay)?.focus();
  };

  const createPanel = () => {
    if ($('#kcg-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'kcg-panel';
    panel.className = 'kcg-panel kcg-hidden';
    panel.innerHTML = `
            <div class="kcg-panel-card" role="dialog" aria-modal="true">
                <div class="kcg-panel-head">
                    <strong>ChatGPT 实用增强</strong>
                    <button type="button" data-close="true">×</button>
                </div>
                <div class="kcg-panel-list"></div>
            </div>
        `;

    const list = $('.kcg-panel-list', panel);
    for (const item of features) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'kcg-row';
      row.dataset.featureId = item.id;
      row.innerHTML = `
                <span>
                    <strong>${html(item.title)}</strong>
                    <small>${html(item.desc)}</small>
                </span>
                ${item.type === 'toggle' ? '<i class="kcg-switch"></i>' : '<em>设置</em>'}
            `;
      list.appendChild(row);
    }

    panel.addEventListener('click', (event) => {
      if (event.target === panel || event.target.dataset.close === 'true') {
        closePanel();
        return;
      }

      const row = event.target.closest('.kcg-row');
      if (!row) return;

      const item = features.find((feature) => feature.id === row.dataset.featureId);
      if (!item) return;

      if (item.id === 'keep') {
        closePanel();
        showDialog({
          title: '保持会话间隔',
          body: '单位：秒。建议不要低于 50。',
          inputType: 'input',
          value: String(getKeepInterval()),
          onSave: (value) => {
            const seconds = Math.max(10, parseInt(value, 10) || 50);
            setValue('k_interval', seconds);
            restartKeepAlive();
            toast(`保持会话间隔已设为 ${seconds} 秒`);
          }
        });
        return;
      }

      if (item.id === 'data') {
        closePanel();
        showDialog({
          title: '敏感内容规则',
          body: '每行一条规则，命中内容会从输入框移除。',
          inputType: 'textarea',
          value: getValue('k_datasecblocklist', defaultSensitiveRules),
          onSave: (value) => {
            setValue('k_datasecblocklist', String(value || ''));
            toast('敏感内容规则已保存');
          }
        });
        return;
      }

      const next = !getValue(item.key, false);
      setValue(item.key, next);
      applyFeature(item.id, next);
      syncPanelState();
    });

    document.body.appendChild(panel);
    syncPanelState();
  };

  const syncPanelState = () => {
    for (const item of features) {
      if (item.type !== 'toggle') continue;
      const row = $(`#kcg-panel [data-feature-id="${item.id}"]`);
      row?.classList.toggle('kcg-on', getValue(item.key, false) === true);
    }
  };

  const openPanel = () => {
    createPanel();
    $('#kcg-panel')?.classList.remove('kcg-hidden');
    syncPanelState();
  };

  const closePanel = () => $('#kcg-panel')?.classList.add('kcg-hidden');

  const mountButton = () => {
    let button = $('#kcg-entry');

    if (!button) {
      button = document.createElement('button');
      button.id = 'kcg-entry';
      button.type = 'button';
      button.textContent = '增强';
      button.addEventListener('click', openPanel);
    }

    const sidebar = $(sidebarSelector);
    if (sidebar) {
      button.classList.remove('kcg-floating');
      sidebar.insertBefore(button, sidebar.firstChild);
    } else if (!button.isConnected) {
      button.classList.add('kcg-floating');
      document.body.appendChild(button);
    }
  };

  const keepSession = () => {
    const url = new URL('/api/auth/session', location.origin).toString();
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const getKeepInterval = () => Math.max(10, parseInt(getValue('k_interval', 50), 10) || 50);
  let keepTimer = null;

  const restartKeepAlive = () => {
    clearInterval(keepTimer);
    keepTimer = setInterval(keepSession, getKeepInterval() * 1000);
  };

  const isElement = (node) => node?.nodeType === 1;

  const forAddedElements = (nodes, selector, callback) => {
    for (const node of nodes) {
      if (!isElement(node)) continue;
      if (node.matches?.(selector)) callback(node);
      node.querySelectorAll?.(selector).forEach(callback);
    }
  };

  const clickContinue = (root = document) => {
    if (!getValue('k_speakcompletely', false)) return;

    const buttons = root.matches?.('button') ? [root] : $$('button', root);
    const target = buttons.find((button) =>
      /继续生成|Continue generating|Continue/i.test(button.innerText || button.ariaLabel || '')
    );
    if (target && target.dataset.kcgClicked !== 'true') {
      target.dataset.kcgClicked = 'true';
      target.click();
    }
  };

  const addReuseButton = (message) => {
    if ($('.kcg-reuse', message)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kcg-reuse';
    button.textContent = '复用';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const content = $('.whitespace-pre-wrap', message) || message;
      setPromptText((content.innerText || content.textContent || '').trim());
    });

    message.style.position = 'relative';
    message.appendChild(button);
  };

  const applyReuseButtons = () => {
    if (!getValue('k_clonechat', false)) {
      $$('.kcg-reuse').forEach((node) => node.remove());
      return;
    }

    $$('main div[data-message-author-role="user"]').forEach(addReuseButton);
  };

  const formatHistoryTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const flattenText = (value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(flattenText).join(' ');
    if (typeof value === 'object')
      return flattenText(value.text || value.content || value.parts || '');
    return String(value);
  };

  const pickPreviewMessage = (payload) => {
    const current = payload?.mapping?.[payload?.current_node]?.message;
    if (current?.author?.role === 'assistant') return current;

    return Object.values(payload?.mapping || {})
      .map((node) => node?.message)
      .filter((message) => message?.author?.role === 'assistant')
      .sort((a, b) => Number(b.create_time || 0) - Number(a.create_time || 0))[0];
  };

  const buildConversationRecord = (payload, fallbackId) => {
    if (!payload || typeof payload !== 'object') return null;

    const id = payload.conversation_id || payload.id || fallbackId;
    if (!id) return null;

    const preview = pickPreviewMessage(payload);
    const updateTime = payload.update_time || payload.create_time || Date.now();

    return {
      id,
      title: payload.title || '',
      update_time: new Date(Number(updateTime) < 10 ** 10 ? Number(updateTime) * 1000 : updateTime),
      last: flattenText(preview?.content?.parts || preview?.content)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120),
      model: preview?.metadata?.model_slug || preview?.metadata?.default_model_slug || ''
    };
  };

  const conversationIdFromUrl = (url) => {
    const match = String(url || '').match(/\/conversation\/([^/?#]+)/);
    return match?.[1] || '';
  };

  const conversationIdFromPage = () => {
    const match = location.pathname.match(/\/c\/([^/?#]+)/);
    return match?.[1] || '';
  };

  const sidebarLinkState = new WeakMap();

  const decorateSidebar = debounce(async () => {
    if (!getValue('k_everchanging', false)) {
      $$('.kcg-history-extra').forEach((node) => node.remove());
      return;
    }

    const links = $$(`${sidebarSelector} a[href*="/c/"]`);
    const linkEntries = [];
    const ids = [];

    for (const link of links) {
      const match = link.href.match(/\/c\/([^/?#]+)/);
      const id = match?.[1];
      if (!id) continue;
      linkEntries.push([link, id]);
      ids.push(id);
    }

    const records = await store.getMany(ids);

    for (const [link, id] of linkEntries) {
      const record = records.get(id);
      if (!record) continue;

      const text = [formatHistoryTime(record.update_time), record.last || record.model]
        .filter(Boolean)
        .join(' · ');
      if (!text) continue;
      if (sidebarLinkState.get(link) === text) continue;

      let extra = $('.kcg-history-extra', link);
      if (!extra) {
        extra = document.createElement('div');
        extra.className = 'kcg-history-extra';
        link.appendChild(extra);
      }
      extra.textContent = text;
      sidebarLinkState.set(link, text);
    }
  }, 180);

  let lastConversationFingerprint = '';

  const findAssistantMessage = (candidate) =>
    candidate?.closest?.('[data-message-author-role="assistant"]') ||
    (candidate?.matches?.('[data-message-author-role="assistant"]') ? candidate : null) ||
    $$('main [data-message-author-role="assistant"]').at(-1);

  const updateCurrentConversation = debounce(async (candidate) => {
    if (!getValue('k_everchanging', false)) return;

    const id = conversationIdFromPage();
    if (!id) return;

    const last = findAssistantMessage(candidate);
    if (!last) return;

    const summary = (last.innerText || last.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    const fingerprint = `${id}:${summary}`;
    if (!summary || fingerprint === lastConversationFingerprint) return;
    lastConversationFingerprint = fingerprint;

    const old = (await store.get(id)) || {};
    await store.put({
      id,
      title: old.title || document.title.replace(/^ChatGPT\s*[-–]\s*/, ''),
      update_time: new Date(),
      last: summary,
      model: old.model || ''
    });
    decorateSidebar();
  }, 800);

  const conversationListPattern = /\/backend-api\/conversations\?.*offset=/;
  const conversationDetailPattern = /\/backend-api\/conversation\/[^/?#]+/;
  const conversationFallbackPattern = /\/backend-api\/f\/conversation/;

  const shouldHandleConversationResponse = (url, method) => {
    if (!getValue('k_everchanging', false)) return false;

    const urlText = String(url || '');
    return (
      conversationListPattern.test(urlText) ||
      conversationDetailPattern.test(urlText) ||
      (method === 'POST' && conversationFallbackPattern.test(urlText))
    );
  };

  const handleConversationResponse = (url, method, response) => {
    if (!getValue('k_everchanging', false)) return;

    const urlText = String(url || '');

    if (conversationListPattern.test(urlText)) {
      const cloned = response.clone();
      cloned
        .json()
        .then(async (data) => {
          if (!Array.isArray(data?.items)) return;
          await Promise.all(
            data.items.map((item) =>
              store.put({
                id: item.id,
                title: item.title || '',
                update_time: new Date(item.update_time || Date.now()),
                last: '',
                model: ''
              })
            )
          );
          decorateSidebar();
        })
        .catch(() => {});
      return;
    }

    if (conversationDetailPattern.test(urlText)) {
      const cloned = response.clone();
      cloned
        .json()
        .then(async (data) => {
          const id = conversationIdFromUrl(urlText);

          if (
            method === 'PATCH' &&
            (data?.is_visible === false || data?.is_archived === true || data?.is_hidden === true)
          ) {
            await store.delete(id);
            decorateSidebar();
            return;
          }

          if (method === 'GET') {
            const record = buildConversationRecord(data, id);
            if (record) {
              await store.put(record);
              decorateSidebar();
            }
          }
        })
        .catch(() => {});
      return;
    }

    if (conversationFallbackPattern.test(urlText) && method === 'POST') {
      setTimeout(updateCurrentConversation, 2500);
    }
  };

  const hookNetwork = () => {
    if (win.fetch && win.fetch.kcgCleanHooked !== true) {
      const rawFetch = win.fetch.bind(win);

      const hookedFetch = (...args) => {
        const request = args[0] instanceof Request ? args[0] : null;
        const url = request ? request.url : String(args[0] || '');
        const method = String(args[1]?.method || request?.method || 'GET').toUpperCase();

        if (getValue('k_intercepttracking', false) && isTrackingRequest(url)) {
          return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
        }

        return rawFetch(...args).then((response) => {
          if (shouldHandleConversationResponse(url, method)) {
            handleConversationResponse(url, method, response);
          }
          return response;
        });
      };

      hookedFetch.kcgCleanHooked = true;
      win.fetch = hookedFetch;
    }

    if (navigator.sendBeacon && navigator.sendBeacon.kcgCleanHooked !== true) {
      const rawSendBeacon = navigator.sendBeacon.bind(navigator);
      const hookedSendBeacon = (url, data) => {
        if (getValue('k_intercepttracking', false) && isTrackingRequest(url)) return true;
        return rawSendBeacon(url, data);
      };
      hookedSendBeacon.kcgCleanHooked = true;
      navigator.sendBeacon = hookedSendBeacon;
    }

    const XHR = win.XMLHttpRequest;
    if (XHR?.prototype && XHR.prototype.kcgCleanHooked !== true) {
      XHR.prototype.kcgCleanHooked = true;
      const rawOpen = XHR.prototype.open;
      const rawSend = XHR.prototype.send;

      XHR.prototype.open = function (method, url, ...rest) {
        this.kcgUrl = String(url || '');
        return rawOpen.call(this, method, url, ...rest);
      };

      XHR.prototype.send = function (...args) {
        if (getValue('k_intercepttracking', false) && isTrackingRequest(this.kcgUrl)) {
          this.abort();
          return undefined;
        }
        return rawSend.apply(this, args);
      };
    }
  };

  let trackingObserver = null;

  const setTrackingScriptBlocker = (enabled) => {
    if (!enabled) {
      trackingObserver?.disconnect();
      trackingObserver = null;
      return;
    }

    const block = (script) => {
      if (script?.tagName === 'SCRIPT' && trackingScriptPattern.test(script.src || '')) {
        script.remove();
      }
    };

    $$('script').forEach(block);

    if (trackingObserver) return;
    const roots = [document.head, document.body].filter(Boolean);
    if (!roots.length) return;

    trackingObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'SCRIPT') {
            block(node);
            continue;
          }
          if (mutation.target === document.head || node.tagName === 'HEAD') {
            node.querySelectorAll?.('script').forEach(block);
          }
        }
      }
    });
    for (const root of roots) {
      trackingObserver.observe(root, {
        childList: true,
        subtree: root === document.head
      });
    }
  };

  const managedObservers = new Map();

  const stopManagedObserver = (key) => {
    managedObservers.get(key)?.observer.disconnect();
    managedObservers.delete(key);
  };

  const observeManaged = (key, root, callback, options = { childList: true, subtree: true }) => {
    if (!root) {
      stopManagedObserver(key);
      return false;
    }

    const current = managedObservers.get(key);
    if (current?.root === root) return false;

    stopManagedObserver(key);
    const observer = new MutationObserver(callback);
    observer.observe(root, options);
    managedObservers.set(key, { root, observer });
    return true;
  };

  const setContinueObserver = (enabled) => {
    if (!enabled) {
      stopManagedObserver('continue');
      return;
    }

    const root = $('main') || document.body;
    if (
      observeManaged('continue', root, (mutations) => {
        for (const mutation of mutations) {
          forAddedElements(mutation.addedNodes, 'button', clickContinue);
        }
      })
    ) {
      clickContinue(root);
    }
  };

  const setReuseObserver = (enabled) => {
    if (!enabled) {
      stopManagedObserver('reuse');
      $$('.kcg-reuse').forEach((node) => node.remove());
      return;
    }

    if (
      observeManaged('reuse', $('main'), (mutations) => {
        for (const mutation of mutations) {
          forAddedElements(
            mutation.addedNodes,
            'div[data-message-author-role="user"]',
            addReuseButton
          );
        }
      })
    ) {
      applyReuseButtons();
    }
  };

  const setHistoryObservers = (enabled) => {
    if (!enabled) {
      stopManagedObserver('history-sidebar');
      stopManagedObserver('history-main');
      $$('.kcg-history-extra').forEach((node) => node.remove());
      return;
    }

    if (observeManaged('history-sidebar', $(sidebarSelector), decorateSidebar)) {
      decorateSidebar();
    }

    if (
      observeManaged(
        'history-main',
        $('main'),
        (mutations) => {
          let candidate = null;
          for (const mutation of mutations) {
            const target = isElement(mutation.target)
              ? mutation.target.closest?.('[data-message-author-role="assistant"]')
              : mutation.target.parentElement?.closest?.('[data-message-author-role="assistant"]');
            if (target) candidate = target;
            forAddedElements(
              mutation.addedNodes,
              '[data-message-author-role="assistant"]',
              (node) => {
                candidate = node;
              }
            );
          }
          if (candidate) updateCurrentConversation(candidate);
        },
        { childList: true, subtree: true, characterData: true }
      )
    ) {
      updateCurrentConversation();
    }
  };
  const syncFeatureObservers = () => {
    setContinueObserver(getValue('k_speakcompletely', false) === true);
    setReuseObserver(getValue('k_clonechat', false) === true);
    setHistoryObservers(getValue('k_everchanging', false) === true);
  };

  const applyFeature = (id, enabled) => {
    if (id === 'wide') document.body.classList.toggle('kcg-wide', enabled);
    if (id === 'clean') document.body.classList.toggle('kcg-clean', enabled);
    if (id === 'continue') setContinueObserver(enabled);
    if (id === 'reuse') setReuseObserver(enabled);
    if (id === 'history') setHistoryObservers(enabled);
    if (id === 'tracking') setTrackingScriptBlocker(enabled);
  };

  const applySavedOptions = () => {
    for (const item of features) {
      if (item.type === 'toggle') applyFeature(item.id, getValue(item.key, false) === true);
    }
  };

  const addStyle = () => {
    if ($('#kcg-style')) return;

    const style = GM_addStyle(`
            #kcg-entry {
                margin: .5rem;
                padding: .5rem .75rem;
                border: 1px solid rgba(0,0,0,.12);
                border-radius: .5rem;
                background: var(--main-surface-primary, #fff);
                color: var(--text-primary, #111);
                font-size: .875rem;
                cursor: pointer;
            }
            #kcg-entry.kcg-floating {
                position: fixed;
                left: 1rem;
                bottom: 1rem;
                z-index: 2147483000;
                box-shadow: 0 8px 24px rgba(0,0,0,.16);
            }
            .kcg-panel {
                position: fixed;
                inset: 0;
                z-index: 2147483001;
                display: grid;
                place-items: center;
                background: rgba(0,0,0,.28);
                padding: 1rem;
            }
            .kcg-hidden {
                display: none !important;
            }
            .kcg-panel-card, .kcg-dialog-panel {
                width: min(42rem, 100%);
                max-height: min(48rem, calc(100vh - 2rem));
                overflow: auto;
                border: 1px solid rgba(0,0,0,.12);
                border-radius: .75rem;
                background: var(--main-surface-primary, #fff);
                color: var(--text-primary, #111);
                box-shadow: 0 18px 48px rgba(0,0,0,.22);
            }
            .kcg-panel-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: .85rem 1rem;
                border-bottom: 1px solid rgba(0,0,0,.1);
            }
            .kcg-panel-head button {
                width: 2rem;
                height: 2rem;
                border: 0;
                background: transparent;
                color: inherit;
                font-size: 1.4rem;
                cursor: pointer;
            }
            .kcg-panel-list {
                display: grid;
                gap: .45rem;
                padding: .8rem;
            }
            .kcg-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: .8rem;
                width: 100%;
                padding: .7rem .75rem;
                border: 1px solid rgba(0,0,0,.1);
                border-radius: .5rem;
                background: transparent;
                color: inherit;
                text-align: left;
                cursor: pointer;
            }
            .kcg-row:hover {
                background: rgba(127,127,127,.08);
            }
            .kcg-row span {
                display: grid;
                gap: .18rem;
                min-width: 0;
            }
            .kcg-row small {
                color: var(--text-secondary, #666);
                font-size: .76rem;
                line-height: 1.35;
            }
            .kcg-row em {
                flex: 0 0 auto;
                color: var(--text-secondary, #666);
                font-style: normal;
                font-size: .78rem;
            }
            .kcg-switch {
                width: 2.15rem;
                height: 1.25rem;
                border-radius: 999px;
                background: rgba(127,127,127,.35);
                position: relative;
                flex: 0 0 auto;
            }
            .kcg-switch::after {
                content: "";
                position: absolute;
                width: .95rem;
                height: .95rem;
                left: .15rem;
                top: .15rem;
                border-radius: 50%;
                background: #fff;
                transition: transform .16s ease;
            }
            .kcg-on .kcg-switch {
                background: #10a37f;
            }
            .kcg-on .kcg-switch::after {
                transform: translateX(.9rem);
            }
            .kcg-dialog {
                position: fixed;
                inset: 0;
                z-index: 2147483002;
                display: grid;
                place-items: center;
                padding: 1rem;
                background: rgba(0,0,0,.34);
            }
            .kcg-dialog-panel {
                padding: 1rem;
            }
            .kcg-dialog-title {
                font-weight: 700;
                margin-bottom: .45rem;
            }
            .kcg-dialog-body {
                margin-bottom: .75rem;
                color: var(--text-secondary, #666);
                font-size: .86rem;
            }
            .kcg-dialog-input {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid rgba(0,0,0,.16);
                border-radius: .5rem;
                padding: .65rem .7rem;
                background: var(--main-surface-primary, #fff);
                color: inherit;
                font: inherit;
            }
            .kcg-dialog-actions {
                display: flex;
                justify-content: flex-end;
                gap: .5rem;
                margin-top: .8rem;
            }
            .kcg-dialog-actions button {
                border: 1px solid rgba(0,0,0,.14);
                border-radius: .45rem;
                padding: .45rem .8rem;
                background: transparent;
                color: inherit;
                cursor: pointer;
            }
            .kcg-dialog-actions button[data-action="save"] {
                background: #10a37f;
                border-color: #10a37f;
                color: #fff;
            }
            .kcg-toast {
                position: fixed;
                left: 50%;
                bottom: 1.5rem;
                transform: translateX(-50%);
                z-index: 2147483003;
                padding: .55rem .8rem;
                border-radius: .5rem;
                background: rgba(0,0,0,.82);
                color: #fff;
                font-size: .86rem;
            }
            .kcg-wide section.text-token-text-primary > div > div,
            .kcg-wide #thread-bottom > div > div > div {
                max-width: min(90rem, calc(100vw - 8rem)) !important;
            }
            .kcg-wide form.w-full {
                max-width: 100% !important;
            }
            .kcg-clean main .text-token-text-primary .mb-5.font-medium,
            .kcg-clean form.w-full .grow .bottom-full,
            .kcg-clean ${sidebarSelector} .mb-4,
            .kcg-clean main .text-token-text-primary .mx-3.items-stretch,
            .kcg-clean main .shadow-xxs,
            .kcg-clean main form .text-token-text-secondary,
            .kcg-clean main div.text-center > span {
                display: none !important;
            }
            .kcg-reuse {
                position: absolute;
                right: .25rem;
                top: .25rem;
                z-index: 2;
                border: 1px solid rgba(0,0,0,.12);
                border-radius: .4rem;
                padding: .2rem .45rem;
                background: var(--main-surface-primary, #fff);
                color: var(--text-secondary, #666);
                font-size: .72rem;
                cursor: pointer;
                opacity: .78;
            }
            .kcg-reuse:hover {
                opacity: 1;
            }
            .kcg-history-extra {
                margin-top: .12rem;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--text-secondary, #666);
                font-size: .72rem;
                line-height: 1.2;
            }
        `);
    if (style) style.id = 'kcg-style';
  };

  const domBindingSelector = `${sidebarSelector}, ${promptSelector}, main, form.w-full`;

  const touchesDomBindings = (nodes) => {
    for (const node of nodes) {
      if (!isElement(node)) continue;
      if (node.matches?.(domBindingSelector) || node.querySelector?.(domBindingSelector)) {
        return true;
      }
    }
    return false;
  };

  const boot = () => {
    if (!document.body) return;

    compileSensitiveRules();
    addStyle();
    mountButton();
    createPanel();
    bindSensitiveScanner();
    hookNetwork();
    applySavedOptions();
    restartKeepAlive();

    const syncDomBindings = debounce(() => {
      mountButton();
      bindSensitiveScanner();
      syncFeatureObservers();
    }, 120);

    observeManaged('dom-discovery', document.body, (mutations) => {
      for (const mutation of mutations) {
        if (touchesDomBindings(mutation.addedNodes) || touchesDomBindings(mutation.removedNodes)) {
          syncDomBindings();
          return;
        }
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
