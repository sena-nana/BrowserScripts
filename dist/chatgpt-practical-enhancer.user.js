// ==UserScript==
// @name        ChatGPT 实用增强
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     35.0.0-clean
// @description 保持会话、阻止跟踪、敏感内容脱敏、宽屏阅读、精简首页、自动继续生成、复用我的消息、侧边栏摘要。
// @match       https://chatgpt.com/*
// @match       https://chat.openai.com/*
// @run-at      document-start
// @inject-into page
// @noframes
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_xmlhttpRequest
// @grant       unsafeWindow
// @connect     chatgpt.com
// @connect     chat.openai.com
// ==/UserScript==

(() => {
  // userscripts/chatgpt-practical-enhancer/src/main-legacy.js
  (() => {
    "use strict";
    const win = typeof unsafeWindow === "undefined" ? window : unsafeWindow;
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const sidebarSelector = "nav.flex:not(#stage-sidebar-tiny-bar)";
    const promptSelector = "form.w-full #prompt-textarea";
    const defaultSensitiveRules = [
      "18888888888",
      "https://securiy-domain.com",
      "([\\w-]+(\\.[\\w-]+)*)@163\\.com",
      "my-secret-username"
    ].join("\n");
    const trackingUrlPattern = /gravatar\.com|browser-intake-datadoghq\.com|\.wp\.com|intercomcdn\.com|sentry\.io|sentry_key=|intercom\.io|featuregates\.org|statsigapi\.net|google-analytics\.com|googletagmanager\.com|\/v1\/initialize|\/messenger\/|\/rgstr|\/v1\/sdk_exception|\/ces\/v1\/telemetry\/intake|\/ces\/statsc\/flush|\/ces\/v1\/(?:t|p|i|m)(?:\?|$)|\/backend-api\/beacons\//i;
    const trackingScriptPattern = /widget\.intercom\.io|googletagmanager\.com|google-analytics\.com/i;
    const getValue = (key, fallback) => GM_getValue(key, fallback);
    const setValue = (key, value) => GM_setValue(key, value);
    const features = [
      {
        id: "keep",
        type: "action",
        title: "\u4FDD\u6301\u4F1A\u8BDD\u95F4\u9694",
        desc: "\u5B9A\u65F6\u8BF7\u6C42\u4F1A\u8BDD\u72B6\u6001\uFF0C\u964D\u4F4E\u9875\u9762\u95F2\u7F6E\u5931\u6548\u6982\u7387"
      },
      {
        id: "data",
        type: "action",
        title: "\u654F\u611F\u5185\u5BB9\u8131\u654F",
        desc: "\u53D1\u9001\u524D\u6309\u89C4\u5219\u79FB\u9664\u8F93\u5165\u6846\u91CC\u7684\u654F\u611F\u5185\u5BB9"
      },
      {
        id: "tracking",
        key: "k_intercepttracking",
        type: "toggle",
        title: "\u963B\u6B62\u8DDF\u8E2A\u8BF7\u6C42",
        desc: "\u62E6\u622A\u5E38\u89C1\u7EDF\u8BA1\u3001\u57CB\u70B9\u3001\u5BA2\u670D\u811A\u672C\u8BF7\u6C42"
      },
      {
        id: "wide",
        key: "k_largescreen",
        type: "toggle",
        title: "\u5BBD\u5C4F\u9605\u8BFB",
        desc: "\u653E\u5BBD\u804A\u5929\u5185\u5BB9\u548C\u8F93\u5165\u533A\u7684\u6700\u5927\u5BBD\u5EA6"
      },
      {
        id: "clean",
        key: "k_cleanlyhome",
        type: "toggle",
        title: "\u7CBE\u7B80\u9996\u9875",
        desc: "\u9690\u85CF\u9996\u9875\u63A8\u8350\u3001\u63D0\u793A\u548C\u90E8\u5206\u5E72\u6270\u5143\u7D20"
      },
      {
        id: "continue",
        key: "k_speakcompletely",
        type: "toggle",
        title: "\u81EA\u52A8\u7EE7\u7EED\u751F\u6210",
        desc: "\u51FA\u73B0\u7EE7\u7EED\u751F\u6210\u6309\u94AE\u65F6\u81EA\u52A8\u70B9\u51FB"
      },
      {
        id: "reuse",
        key: "k_clonechat",
        type: "toggle",
        title: "\u590D\u7528\u6211\u7684\u6D88\u606F",
        desc: "\u7ED9\u81EA\u5DF1\u7684\u6D88\u606F\u6DFB\u52A0\u590D\u7528\u6309\u94AE\uFF0C\u4E00\u952E\u586B\u56DE\u8F93\u5165\u6846"
      },
      {
        id: "history",
        key: "k_everchanging",
        type: "toggle",
        title: "\u4FA7\u8FB9\u680F\u663E\u793A\u65F6\u95F4\u548C\u6458\u8981",
        desc: "\u5728\u5386\u53F2\u4F1A\u8BDD\u5217\u8868\u663E\u793A\u66F4\u65B0\u65F6\u95F4\u548C\u6700\u8FD1\u56DE\u590D\u6458\u8981"
      }
    ];
    class ConversationStore {
      constructor() {
        this.dbName = "ChatGPTUtilityPanel";
        this.storeName = "conversations";
      }
      open() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: "id" });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      async withStore(mode, fn) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, mode);
          const store2 = tx.objectStore(this.storeName);
          const result = fn(store2);
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        });
      }
      async get(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, "readonly");
          const request = tx.objectStore(this.storeName).get(id);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
          tx.oncomplete = () => db.close();
        });
      }
      put(record) {
        if (!record?.id) return Promise.resolve();
        return this.withStore("readwrite", (store2) => store2.put(record));
      }
      delete(id) {
        if (!id) return Promise.resolve();
        return this.withStore("readwrite", (store2) => store2.delete(id));
      }
    }
    const store = new ConversationStore();
    const parseUrl = (value) => {
      try {
        return new URL(String(value || ""), location.origin);
      } catch {
        return null;
      }
    };
    const isTrackingRequest = (value) => {
      const url = String(value || "");
      if (!url) return false;
      if (trackingUrlPattern.test(url)) return true;
      const parsed = parseUrl(url);
      return parsed ? trackingUrlPattern.test(`${parsed.hostname}${parsed.pathname}${parsed.search}`) : false;
    };
    const html = (value) => {
      const div = document.createElement("div");
      div.textContent = String(value || "");
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
      const node = document.createElement("div");
      node.className = "kcg-toast";
      node.textContent = message;
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 2200);
    };
    const setPromptText = (text) => {
      const prompt = $(promptSelector);
      if (!prompt) return false;
      prompt.focus();
      if ("value" in prompt) {
        prompt.value = text;
      } else {
        prompt.textContent = "";
        if (!document.execCommand?.("insertText", false, text)) {
          prompt.textContent = text;
        }
      }
      prompt.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
      );
      return true;
    };
    const getPromptText = (prompt) => {
      if (!prompt) return "";
      return "value" in prompt ? prompt.value : prompt.innerText || prompt.textContent || "";
    };
    const sanitizeText = (text) => {
      let output = String(text || "");
      const matches = [];
      const rules = String(getValue("k_datasecblocklist", defaultSensitiveRules) || "").split(/\r?\n/).map((rule) => rule.trim()).filter(Boolean);
      for (const ruleText of rules) {
        try {
          const rule = new RegExp(ruleText, "g");
          const found = output.match(rule) || [];
          for (const item of found) {
            if (!matches.includes(item)) matches.push(item);
          }
          output = output.replace(rule, "");
        } catch {
        }
      }
      return { text: output, matches };
    };
    const bindSensitiveScanner = () => {
      const prompt = $(promptSelector);
      if (!prompt || prompt.dataset.kcgSensitiveBound === "true") return;
      prompt.dataset.kcgSensitiveBound = "true";
      const scan = () => {
        const result = sanitizeText(getPromptText(prompt));
        if (!result.matches.length) return;
        setPromptText(result.text);
        toast(`\u5DF2\u79FB\u9664 ${result.matches.length} \u6761\u654F\u611F\u5185\u5BB9`);
      };
      prompt.addEventListener("input", scan);
      prompt.addEventListener("paste", () => setTimeout(scan, 0));
    };
    const showDialog = ({ title, body, inputType, value, onSave }) => {
      const overlay = document.createElement("div");
      overlay.className = "kcg-dialog";
      overlay.innerHTML = `
            <div class="kcg-dialog-panel" role="dialog" aria-modal="true">
                <div class="kcg-dialog-title">${html(title)}</div>
                ${body ? `<div class="kcg-dialog-body">${html(body)}</div>` : ""}
                ${inputType === "textarea" ? `<textarea class="kcg-dialog-input" rows="8">${html(value || "")}</textarea>` : `<input class="kcg-dialog-input" value="${html(value || "")}">`}
                <div class="kcg-dialog-actions">
                    <button type="button" data-action="cancel">\u53D6\u6D88</button>
                    <button type="button" data-action="save">\u4FDD\u5B58</button>
                </div>
            </div>
        `;
      const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", onEsc);
      };
      function onEsc(event) {
        if (event.key === "Escape" && overlay.isConnected) {
          close();
        }
      }
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.dataset.action === "cancel") close();
        if (event.target.dataset.action === "save") {
          onSave?.($(".kcg-dialog-input", overlay).value);
          close();
        }
      });
      document.addEventListener("keydown", onEsc);
      document.body.appendChild(overlay);
      $(".kcg-dialog-input", overlay)?.focus();
    };
    const createPanel = () => {
      if ($("#kcg-panel")) return;
      const panel = document.createElement("div");
      panel.id = "kcg-panel";
      panel.className = "kcg-panel kcg-hidden";
      panel.innerHTML = `
            <div class="kcg-panel-card" role="dialog" aria-modal="true">
                <div class="kcg-panel-head">
                    <strong>ChatGPT \u5B9E\u7528\u589E\u5F3A</strong>
                    <button type="button" data-close="true">\xD7</button>
                </div>
                <div class="kcg-panel-list"></div>
            </div>
        `;
      const list = $(".kcg-panel-list", panel);
      for (const item of features) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "kcg-row";
        row.dataset.featureId = item.id;
        row.innerHTML = `
                <span>
                    <strong>${html(item.title)}</strong>
                    <small>${html(item.desc)}</small>
                </span>
                ${item.type === "toggle" ? '<i class="kcg-switch"></i>' : "<em>\u8BBE\u7F6E</em>"}
            `;
        list.appendChild(row);
      }
      panel.addEventListener("click", (event) => {
        if (event.target === panel || event.target.dataset.close === "true") {
          closePanel();
          return;
        }
        const row = event.target.closest(".kcg-row");
        if (!row) return;
        const item = features.find((feature) => feature.id === row.dataset.featureId);
        if (!item) return;
        if (item.id === "keep") {
          closePanel();
          showDialog({
            title: "\u4FDD\u6301\u4F1A\u8BDD\u95F4\u9694",
            body: "\u5355\u4F4D\uFF1A\u79D2\u3002\u5EFA\u8BAE\u4E0D\u8981\u4F4E\u4E8E 50\u3002",
            inputType: "input",
            value: String(getKeepInterval()),
            onSave: (value) => {
              const seconds = Math.max(10, parseInt(value, 10) || 50);
              setValue("k_interval", seconds);
              restartKeepAlive();
              toast(`\u4FDD\u6301\u4F1A\u8BDD\u95F4\u9694\u5DF2\u8BBE\u4E3A ${seconds} \u79D2`);
            }
          });
          return;
        }
        if (item.id === "data") {
          closePanel();
          showDialog({
            title: "\u654F\u611F\u5185\u5BB9\u89C4\u5219",
            body: "\u6BCF\u884C\u4E00\u6761\u89C4\u5219\uFF0C\u547D\u4E2D\u5185\u5BB9\u4F1A\u4ECE\u8F93\u5165\u6846\u79FB\u9664\u3002",
            inputType: "textarea",
            value: getValue("k_datasecblocklist", defaultSensitiveRules),
            onSave: (value) => {
              setValue("k_datasecblocklist", String(value || ""));
              toast("\u654F\u611F\u5185\u5BB9\u89C4\u5219\u5DF2\u4FDD\u5B58");
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
        if (item.type !== "toggle") continue;
        const row = $(`#kcg-panel [data-feature-id="${item.id}"]`);
        row?.classList.toggle("kcg-on", getValue(item.key, false) === true);
      }
    };
    const openPanel = () => {
      createPanel();
      $("#kcg-panel")?.classList.remove("kcg-hidden");
      syncPanelState();
    };
    const closePanel = () => $("#kcg-panel")?.classList.add("kcg-hidden");
    const mountButton = () => {
      if ($("#kcg-entry")) return;
      const button = document.createElement("button");
      button.id = "kcg-entry";
      button.type = "button";
      button.textContent = "\u589E\u5F3A";
      button.addEventListener("click", openPanel);
      const sidebar = $(sidebarSelector);
      if (sidebar) {
        sidebar.insertBefore(button, sidebar.firstChild);
      } else {
        button.classList.add("kcg-floating");
        document.body.appendChild(button);
      }
    };
    const keepSession = () => {
      const url = new URL("/api/auth/session", location.origin).toString();
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { "Content-Type": "application/json" }
      });
    };
    const getKeepInterval = () => Math.max(10, parseInt(getValue("k_interval", 50), 10) || 50);
    let keepTimer = null;
    const restartKeepAlive = () => {
      clearInterval(keepTimer);
      keepTimer = setInterval(keepSession, getKeepInterval() * 1e3);
    };
    const clickContinue = () => {
      if (!getValue("k_speakcompletely", false)) return;
      const buttons = $$("button");
      const target = buttons.find(
        (button) => /继续生成|Continue generating|Continue/i.test(button.innerText || button.ariaLabel || "")
      );
      if (target && target.dataset.kcgClicked !== "true") {
        target.dataset.kcgClicked = "true";
        target.click();
      }
    };
    const applyReuseButtons = () => {
      if (!getValue("k_clonechat", false)) {
        $$(".kcg-reuse").forEach((node) => node.remove());
        return;
      }
      $$('main div[data-message-author-role="user"]').forEach((message) => {
        if ($(".kcg-reuse", message)) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "kcg-reuse";
        button.textContent = "\u590D\u7528";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const content = $(".whitespace-pre-wrap", message) || message;
          setPromptText((content.innerText || content.textContent || "").trim());
        });
        message.style.position = "relative";
        message.appendChild(button);
      });
    };
    const formatHistoryTime = (value) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const today = /* @__PURE__ */ new Date();
      if (date.toDateString() === today.toDateString()) {
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      }
      return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    };
    const flattenText = (value) => {
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value.map(flattenText).join(" ");
      if (typeof value === "object")
        return flattenText(value.text || value.content || value.parts || "");
      return String(value);
    };
    const pickPreviewMessage = (payload) => {
      const current = payload?.mapping?.[payload?.current_node]?.message;
      if (current?.author?.role === "assistant") return current;
      return Object.values(payload?.mapping || {}).map((node) => node?.message).filter((message) => message?.author?.role === "assistant").sort((a, b) => Number(b.create_time || 0) - Number(a.create_time || 0))[0];
    };
    const buildConversationRecord = (payload, fallbackId) => {
      if (!payload || typeof payload !== "object") return null;
      const id = payload.conversation_id || payload.id || fallbackId;
      if (!id) return null;
      const preview = pickPreviewMessage(payload);
      const updateTime = payload.update_time || payload.create_time || Date.now();
      return {
        id,
        title: payload.title || "",
        update_time: new Date(Number(updateTime) < 10 ** 10 ? Number(updateTime) * 1e3 : updateTime),
        last: flattenText(preview?.content?.parts || preview?.content).replace(/\s+/g, " ").trim().slice(0, 120),
        model: preview?.metadata?.model_slug || preview?.metadata?.default_model_slug || ""
      };
    };
    const conversationIdFromUrl = (url) => {
      const match = String(url || "").match(/\/conversation\/([^/?#]+)/);
      return match?.[1] || "";
    };
    const conversationIdFromPage = () => {
      const match = location.pathname.match(/\/c\/([^/?#]+)/);
      return match?.[1] || "";
    };
    const decorateSidebar = debounce(async () => {
      if (!getValue("k_everchanging", false)) {
        $$(".kcg-history-extra").forEach((node) => node.remove());
        return;
      }
      for (const link of $$(`${sidebarSelector} a[href*="/c/"]`)) {
        const match = link.href.match(/\/c\/([^/?#]+)/);
        const id = match?.[1];
        if (!id) continue;
        const record = await store.get(id);
        if (!record) continue;
        const text = [formatHistoryTime(record.update_time), record.last || record.model].filter(Boolean).join(" \xB7 ");
        if (!text) continue;
        let extra = $(".kcg-history-extra", link);
        if (!extra) {
          extra = document.createElement("div");
          extra.className = "kcg-history-extra";
          link.appendChild(extra);
        }
        extra.textContent = text;
      }
    }, 180);
    const updateCurrentConversation = debounce(async () => {
      if (!getValue("k_everchanging", false)) return;
      const id = conversationIdFromPage();
      if (!id) return;
      const assistants = $$('main [data-message-author-role="assistant"]');
      const last = assistants.at(-1);
      if (!last) return;
      const old = await store.get(id) || {};
      await store.put({
        id,
        title: old.title || document.title.replace(/^ChatGPT\s*[-–]\s*/, ""),
        update_time: /* @__PURE__ */ new Date(),
        last: (last.innerText || last.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        model: old.model || ""
      });
      decorateSidebar();
    }, 800);
    const handleConversationResponse = (url, method, response) => {
      if (!getValue("k_everchanging", false)) return;
      const urlText = String(url || "");
      const cloned = response.clone();
      if (/\/backend-api\/conversations\?.*offset=/.test(urlText)) {
        cloned.json().then(async (data) => {
          if (!Array.isArray(data?.items)) return;
          await Promise.all(
            data.items.map(
              (item) => store.put({
                id: item.id,
                title: item.title || "",
                update_time: new Date(item.update_time || Date.now()),
                last: "",
                model: ""
              })
            )
          );
          decorateSidebar();
        }).catch(() => {
        });
        return;
      }
      if (/\/backend-api\/conversation\/[^/?#]+/.test(urlText)) {
        cloned.json().then(async (data) => {
          const id = conversationIdFromUrl(urlText);
          if (method === "PATCH" && (data?.is_visible === false || data?.is_archived === true || data?.is_hidden === true)) {
            await store.delete(id);
            decorateSidebar();
            return;
          }
          if (method === "GET") {
            const record = buildConversationRecord(data, id);
            if (record) {
              await store.put(record);
              decorateSidebar();
            }
          }
        }).catch(() => {
        });
        return;
      }
      if (/\/backend-api\/f\/conversation/.test(urlText) && method === "POST") {
        setTimeout(updateCurrentConversation, 2500);
      }
    };
    const hookNetwork = () => {
      if (win.fetch && win.fetch.kcgCleanHooked !== true) {
        const rawFetch = win.fetch.bind(win);
        const hookedFetch = (...args) => {
          const request = args[0] instanceof Request ? args[0] : null;
          const url = request ? request.url : String(args[0] || "");
          const method = String(args[1]?.method || request?.method || "GET").toUpperCase();
          if (getValue("k_intercepttracking", false) && isTrackingRequest(url)) {
            return Promise.resolve(new Response(null, { status: 204, statusText: "No Content" }));
          }
          return rawFetch(...args).then((response) => {
            handleConversationResponse(url, method, response);
            return response;
          });
        };
        hookedFetch.kcgCleanHooked = true;
        win.fetch = hookedFetch;
      }
      if (navigator.sendBeacon && navigator.sendBeacon.kcgCleanHooked !== true) {
        const rawSendBeacon = navigator.sendBeacon.bind(navigator);
        const hookedSendBeacon = (url, data) => {
          if (getValue("k_intercepttracking", false) && isTrackingRequest(url)) return true;
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
        XHR.prototype.open = function(method, url, ...rest) {
          this.kcgUrl = String(url || "");
          return rawOpen.call(this, method, url, ...rest);
        };
        XHR.prototype.send = function(...args) {
          if (getValue("k_intercepttracking", false) && isTrackingRequest(this.kcgUrl)) {
            this.abort();
            return void 0;
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
        if (script?.tagName === "SCRIPT" && trackingScriptPattern.test(script.src || "")) {
          script.remove();
        }
      };
      $$("script").forEach(block);
      if (trackingObserver || !document.documentElement) return;
      trackingObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === "SCRIPT") block(node);
            node.querySelectorAll?.("script").forEach(block);
          }
        }
      });
      trackingObserver.observe(document.documentElement, { childList: true, subtree: true });
    };
    const applyFeature = (id, enabled) => {
      if (id === "wide") document.body.classList.toggle("kcg-wide", enabled);
      if (id === "clean") document.body.classList.toggle("kcg-clean", enabled);
      if (id === "reuse") applyReuseButtons();
      if (id === "history") decorateSidebar();
      if (id === "tracking") setTrackingScriptBlocker(enabled);
    };
    const applySavedOptions = () => {
      for (const item of features) {
        if (item.type === "toggle") applyFeature(item.id, getValue(item.key, false) === true);
      }
    };
    const addStyle = () => {
      if ($("#kcg-style")) return;
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
      if (style) style.id = "kcg-style";
    };
    const boot = () => {
      if (!document.body) return;
      addStyle();
      mountButton();
      createPanel();
      bindSensitiveScanner();
      hookNetwork();
      applySavedOptions();
      restartKeepAlive();
      const observe = debounce(() => {
        mountButton();
        bindSensitiveScanner();
        clickContinue();
        applyReuseButtons();
        updateCurrentConversation();
        decorateSidebar();
      }, 120);
      new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
      setInterval(() => {
        clickContinue();
        bindSensitiveScanner();
      }, 1e3);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  })();
})();
//# sourceMappingURL=chatgpt-practical-enhancer.user.js.map
