// ==UserScript==
// @name        ChatGPT 实用增强
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     35.1.0-clean
// @description 保持会话、阻止跟踪、敏感内容脱敏、宽屏阅读、精简首页、自动继续生成、复用我的消息、长对话单轮显示、侧边栏摘要。
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
  // userscripts/chatgpt-practical-enhancer/src/main.js
  (() => {
    "use strict";
    const win = typeof unsafeWindow === "undefined" ? window : unsafeWindow;
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const sidebarSelector = "nav.flex:not(#stage-sidebar-tiny-bar)";
    const promptSelector = "form.w-full #prompt-textarea";
    const messageRoleSelector = "[data-message-author-role]";
    const messageSelector = `main ${messageRoleSelector}`;
    const defaultSensitiveRules = [
      "18888888888",
      "https://securiy-domain.com",
      "([\\w-]+(\\.[\\w-]+)*)@163\\.com",
      "my-secret-username"
    ].join("\n");
    const trackingUrlPattern = /gravatar\.com|browser-intake-datadoghq\.com|\.wp\.com|intercomcdn\.com|sentry\.io|sentry_key=|intercom\.io|featuregates\.org|statsigapi\.net|google-analytics\.com|googletagmanager\.com|\/v1\/initialize|\/messenger\/|\/rgstr|\/v1\/sdk_exception|\/ces\/v1\/telemetry\/intake|\/ces\/statsc\/flush|\/ces\/v1\/(?:t|p|i|m)(?:\?|$)|\/backend-api\/beacons\//i;
    const trackingScriptPattern = /widget\.intercom\.io|googletagmanager\.com|google-analytics\.com/i;
    const settingsCache = /* @__PURE__ */ new Map();
    const getValue = (key, fallback) => {
      if (!settingsCache.has(key)) settingsCache.set(key, GM_getValue(key, fallback));
      return settingsCache.get(key);
    };
    const setValue = (key, value) => {
      settingsCache.set(key, value);
      GM_setValue(key, value);
      if (key === "k_datasecblocklist") compileSensitiveRules(value);
    };
    const features = [
      {
        id: "keep",
        type: "action",
        title: "\u4FDD\u6301\u4F1A\u8BDD",
        desc: "\u542F\u7528\u540E\u5B9A\u65F6\u68C0\u67E5\u4F1A\u8BDD\u72B6\u6001"
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
      },
      {
        id: "turn-reader",
        key: "k_turnreader",
        type: "toggle",
        title: "\u957F\u5BF9\u8BDD\u5355\u8F6E\u663E\u793A",
        desc: "\u957F\u5BF9\u8BDD\u4E2D\u53EA\u663E\u793A\u5F53\u524D\u95EE\u7B54\u8F6E\uFF0C\u53EF\u7528\u4E0A\u4E00\u8F6E\u548C\u4E0B\u4E00\u8F6E\u5207\u6362"
      }
    ];
    class ConversationStore {
      constructor() {
        this.dbName = "ChatGPTUtilityPanel";
        this.storeName = "conversations";
        this.dbPromise = null;
        this.cache = /* @__PURE__ */ new Map();
      }
      open() {
        if (this.dbPromise) return this.dbPromise;
        this.dbPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open(this.dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: "id" });
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
          const store2 = tx.objectStore(this.storeName);
          const result = fn(store2);
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
        const records = /* @__PURE__ */ new Map();
        const missing = [];
        for (const id of ids) {
          if (!id) continue;
          if (this.cache.has(id)) records.set(id, this.cache.get(id));
          else missing.push(id);
        }
        if (!missing.length) return records;
        const db = await this.open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, "readonly");
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
        return this.withStore("readwrite", (store2) => store2.put(record));
      }
      async putMany(records) {
        const validRecords = records.filter((record) => record?.id);
        if (!validRecords.length) return;
        for (const record of validRecords) {
          this.cache.set(record.id, record);
        }
        await this.withStore("readwrite", (objectStore) => {
          for (const record of validRecords) {
            objectStore.put(record);
          }
        });
      }
      delete(id) {
        if (!id) return Promise.resolve();
        this.cache.delete(id);
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
      return "value" in prompt ? prompt.value : prompt.textContent || prompt.innerText || "";
    };
    let sensitiveRulesSource = null;
    let sensitiveRules = [];
    const compileSensitiveRules = (value = getValue("k_datasecblocklist", defaultSensitiveRules)) => {
      const source = String(value || "");
      if (source === sensitiveRulesSource) return sensitiveRules;
      sensitiveRulesSource = source;
      sensitiveRules = source.split(/\r?\n/).map((rule) => rule.trim()).filter(Boolean).map((ruleText) => {
        try {
          return new RegExp(ruleText, "g");
        } catch {
          return null;
        }
      }).filter(Boolean);
      return sensitiveRules;
    };
    const sanitizeText = (text) => {
      let output = String(text || "");
      const matches = [];
      for (const rule of compileSensitiveRules()) {
        rule.lastIndex = 0;
        const found = output.match(rule) || [];
        for (const item of found) {
          if (!matches.includes(item)) matches.push(item);
        }
        rule.lastIndex = 0;
        output = output.replace(rule, "");
      }
      return { text: output, matches };
    };
    let composingPrompt = false;
    const bindSensitiveScanner = () => {
      const prompt = $(promptSelector);
      if (!prompt || prompt.dataset.kcgSensitiveBound === "true") return;
      prompt.dataset.kcgSensitiveBound = "true";
      const scan = () => {
        if (composingPrompt) return;
        const result = sanitizeText(getPromptText(prompt));
        if (!result.matches.length) return;
        setPromptText(result.text);
        toast(`\u5DF2\u79FB\u9664 ${result.matches.length} \u6761\u654F\u611F\u5185\u5BB9`);
      };
      const scanSoon = debounce(scan, 120);
      prompt.addEventListener("input", scanSoon);
      prompt.addEventListener("paste", () => setTimeout(scan, 0));
      prompt.addEventListener("compositionstart", () => {
        composingPrompt = true;
      });
      prompt.addEventListener("compositionend", () => {
        composingPrompt = false;
        scanSoon();
      });
    };
    const showDialog = ({ title, body, inputType, value, content, focusSelector, onSave }) => {
      const overlay = document.createElement("div");
      overlay.className = "kcg-dialog";
      overlay.innerHTML = `
            <div class="kcg-dialog-panel" role="dialog" aria-modal="true">
                <div class="kcg-dialog-title">${html(title)}</div>
                ${body ? `<div class="kcg-dialog-body">${html(body)}</div>` : ""}
                ${content || (inputType === "textarea" ? `<textarea class="kcg-dialog-input" rows="8">${html(value || "")}</textarea>` : `<input class="kcg-dialog-input" value="${html(value || "")}">`)}
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
          onSave?.($(".kcg-dialog-input", overlay)?.value, overlay);
          close();
        }
      });
      document.addEventListener("keydown", onEsc);
      document.body.appendChild(overlay);
      $(focusSelector || ".kcg-dialog-input", overlay)?.focus();
    };
    const showKeepAliveDialog = () => {
      showDialog({
        title: "\u4FDD\u6301\u4F1A\u8BDD",
        content: `
                <label class="kcg-check">
                    <input class="kcg-keep-enabled" type="checkbox" ${isKeepAliveEnabled() ? "checked" : ""}>
                    <span>\u542F\u7528\u4FDD\u6301\u4F1A\u8BDD</span>
                </label>
                <label class="kcg-field">
                    <span>\u95F4\u9694\u79D2\u6570</span>
                    <input class="kcg-dialog-input kcg-keep-interval" value="${html(String(getKeepInterval()))}" inputmode="numeric">
                </label>
            `,
        focusSelector: ".kcg-keep-interval",
        onSave: (_, overlay) => {
          const nextEnabled = $(".kcg-keep-enabled", overlay)?.checked === true;
          const seconds = Math.max(10, parseInt($(".kcg-keep-interval", overlay)?.value, 10) || 50);
          setValue("k_keepalive", nextEnabled);
          setValue("k_interval", seconds);
          restartKeepAlive();
          syncPanelState();
          toast(nextEnabled ? `\u4FDD\u6301\u4F1A\u8BDD\u5DF2\u5F00\u542F\uFF0C\u6BCF ${seconds} \u79D2\u68C0\u67E5\u4E00\u6B21` : "\u4FDD\u6301\u4F1A\u8BDD\u5DF2\u5173\u95ED");
        }
      });
    };
    const getFeatureDesc = (item) => {
      if (item.id !== "keep") return item.desc;
      if (!isKeepAliveEnabled()) return `\u5DF2\u5173\u95ED\uFF0C\u95F4\u9694\u4FDD\u7559\u4E3A ${getKeepInterval()} \u79D2`;
      return `\u5DF2\u5F00\u542F\uFF0C\u6BCF ${getKeepInterval()} \u79D2\u68C0\u67E5\u4E00\u6B21`;
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
                    <small>${html(getFeatureDesc(item))}</small>
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
          showKeepAliveDialog();
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
        const row = $(`#kcg-panel [data-feature-id="${item.id}"]`);
        if (!row) continue;
        $("small", row)?.replaceChildren(document.createTextNode(getFeatureDesc(item)));
        if (item.type === "toggle")
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
      let button = $("#kcg-entry");
      if (!button) {
        button = document.createElement("button");
        button.id = "kcg-entry";
        button.type = "button";
        button.textContent = "\u589E\u5F3A";
        button.addEventListener("click", openPanel);
      }
      const sidebar = $(sidebarSelector);
      if (sidebar) {
        button.classList.remove("kcg-floating");
        sidebar.insertBefore(button, sidebar.firstChild);
      } else if (!button.isConnected) {
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
    const isKeepAliveEnabled = () => getValue("k_keepalive", false) === true;
    let keepTimer = null;
    const restartKeepAlive = () => {
      clearInterval(keepTimer);
      keepTimer = null;
      if (!isKeepAliveEnabled()) return;
      keepTimer = setInterval(keepSession, getKeepInterval() * 1e3);
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
      if (!getValue("k_speakcompletely", false)) return;
      const buttons = root.matches?.("button") ? [root] : $$("button", root);
      const target = buttons.find(
        (button) => /继续生成|Continue generating|Continue/i.test(button.ariaLabel || button.textContent || "")
      );
      if (target && target.dataset.kcgClicked !== "true") {
        target.dataset.kcgClicked = "true";
        target.click();
      }
    };
    const addReuseButton = (message) => {
      if ($(".kcg-reuse", message)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kcg-reuse";
      button.textContent = "\u590D\u7528";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const content = $(".whitespace-pre-wrap", message) || message;
        setPromptText((content.textContent || content.innerText || "").trim());
      });
      message.style.position = "relative";
      message.appendChild(button);
    };
    const applyReuseButtons = () => {
      if (!getValue("k_clonechat", false)) {
        $$(".kcg-reuse").forEach((node) => node.remove());
        return;
      }
      $$('main div[data-message-author-role="user"]').forEach(addReuseButton);
    };
    const turnReaderState = {
      turns: [],
      index: -1,
      followLatest: true,
      route: ""
    };
    const buildConversationTurns = () => {
      const turns = [];
      let current = null;
      for (const message of $$(messageSelector)) {
        const role = message.getAttribute("data-message-author-role");
        if (role === "user") {
          current = { messages: [message], startsWithUser: true };
          turns.push(current);
          continue;
        }
        if (role !== "assistant") continue;
        if (current?.startsWithUser) {
          current.messages.push(message);
          continue;
        }
        current = { messages: [message], startsWithUser: false };
        turns.push(current);
      }
      return turns;
    };
    const getTurnReaderRoute = () => `${location.pathname}${location.search}`;
    const clampTurnIndex = (index, turns) => {
      if (!turns.length) return -1;
      return Math.min(Math.max(index, 0), turns.length - 1);
    };
    const ensureTurnReaderControls = () => {
      let controls = $("#kcg-turn-reader");
      if (controls) return controls;
      controls = document.createElement("div");
      controls.id = "kcg-turn-reader";
      controls.className = "kcg-turn-reader";
      controls.innerHTML = `
            <button type="button" data-action="prev">\u4E0A\u4E00\u8F6E</button>
            <span class="kcg-turn-reader-count">0 / 0</span>
            <button type="button" data-action="next">\u4E0B\u4E00\u8F6E</button>
        `;
      controls.addEventListener("click", (event) => {
        const action = event.target?.dataset?.action;
        if (action === "prev") setTurnReaderIndex(turnReaderState.index - 1, true);
        if (action === "next") setTurnReaderIndex(turnReaderState.index + 1, true);
      });
      document.body.appendChild(controls);
      return controls;
    };
    const syncTurnReaderControls = () => {
      const controls = ensureTurnReaderControls();
      const count = $(".kcg-turn-reader-count", controls);
      const prev = $('[data-action="prev"]', controls);
      const next = $('[data-action="next"]', controls);
      const total = turnReaderState.turns.length;
      const current = turnReaderState.index >= 0 ? turnReaderState.index + 1 : 0;
      if (count) count.textContent = `${current} / ${total}`;
      if (prev) prev.disabled = turnReaderState.index <= 0;
      if (next) next.disabled = turnReaderState.index < 0 || turnReaderState.index >= total - 1;
    };
    const clearTurnReaderVisibility = () => {
      $$(".kcg-turn-hidden").forEach((message) => message.classList.remove("kcg-turn-hidden"));
    };
    const getTurnVisibilityNode = (message) => {
      let node = message;
      while (node.parentElement && !node.parentElement.matches?.("main")) {
        const parent = node.parentElement;
        const messageRoles = parent.querySelectorAll(messageRoleSelector);
        if (messageRoles.length !== 1 || messageRoles[0] !== message) break;
        node = parent;
      }
      return node;
    };
    const applyTurnReaderVisibility = (scrollActive = false) => {
      if (!getValue("k_turnreader", false)) return;
      const activeTurn = turnReaderState.turns[turnReaderState.index];
      const activeMessages = new Set(activeTurn?.messages || []);
      const knownVisibilityNodes = /* @__PURE__ */ new Set();
      for (const turn of turnReaderState.turns) {
        for (const message of turn.messages) {
          const visibilityNode = getTurnVisibilityNode(message);
          knownVisibilityNodes.add(visibilityNode);
          visibilityNode.classList.toggle("kcg-turn-hidden", !activeMessages.has(message));
        }
      }
      $$(".kcg-turn-hidden").forEach((node) => {
        if (!knownVisibilityNodes.has(node)) node.classList.remove("kcg-turn-hidden");
      });
      document.body.classList.toggle("kcg-turn-reader-active", turnReaderState.turns.length > 0);
      syncTurnReaderControls();
      if (scrollActive && activeTurn?.messages[0]?.isConnected) {
        activeTurn.messages[0].scrollIntoView({ block: "start" });
      }
    };
    function setTurnReaderIndex(index, scrollActive = false) {
      turnReaderState.index = clampTurnIndex(index, turnReaderState.turns);
      turnReaderState.followLatest = turnReaderState.index >= 0 && turnReaderState.index >= turnReaderState.turns.length - 1;
      applyTurnReaderVisibility(scrollActive);
    }
    const rebuildTurnReader = ({ forceLatest = false, scrollActive = false } = {}) => {
      if (!getValue("k_turnreader", false)) return;
      const previousTurn = turnReaderState.turns[turnReaderState.index];
      const previousAnchor = previousTurn?.messages[0] || null;
      const previousFollowLatest = turnReaderState.followLatest;
      const route = getTurnReaderRoute();
      const routeChanged = turnReaderState.route !== route;
      const turns = buildConversationTurns();
      turnReaderState.route = route;
      turnReaderState.turns = turns;
      if (!turns.length) {
        turnReaderState.index = -1;
        turnReaderState.followLatest = true;
        clearTurnReaderVisibility();
        syncTurnReaderControls();
        return;
      }
      let nextIndex = -1;
      if (forceLatest || routeChanged || previousFollowLatest) {
        nextIndex = turns.length - 1;
      } else if (previousAnchor) {
        nextIndex = turns.findIndex((turn) => turn.messages.includes(previousAnchor));
      }
      if (nextIndex < 0) nextIndex = turnReaderState.index;
      turnReaderState.index = clampTurnIndex(nextIndex, turns);
      turnReaderState.followLatest = turnReaderState.index >= turns.length - 1;
      applyTurnReaderVisibility(scrollActive || forceLatest || routeChanged);
    };
    const scheduleTurnReaderRebuild = debounce((forceLatest = false) => {
      rebuildTurnReader({ forceLatest });
    }, 80);
    const hasAddedUserMessage = (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!isElement(node)) continue;
          if (node.matches?.('div[data-message-author-role="user"]')) return true;
          if (node.querySelector?.('div[data-message-author-role="user"]')) return true;
        }
      }
      return false;
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
    const firstValue = (...values) => values.find((value) => value != null && String(value).trim() !== "");
    const pickField = (object, fields) => firstValue(...fields.map((field) => object?.[field]));
    const textFields = [
      "text",
      "value",
      "content",
      "parts",
      "message",
      "summary",
      "preview",
      "snippet"
    ];
    const conversationIdFields = [
      "conversation_id",
      "conversationId",
      "conversation_uuid",
      "conversationUuid"
    ];
    const routeConversationIdFields = conversationIdFields.concat([
      "current_conversation_id",
      "currentConversationId",
      "parent_conversation_id",
      "parentConversationId",
      "conversation"
    ]);
    const dateFields = [
      "update_time",
      "updated_time",
      "updated_at",
      "updateTime",
      "updatedAt",
      "last_updated",
      "lastUpdated",
      "create_time",
      "created_time",
      "created_at",
      "createTime",
      "createdAt"
    ];
    const previewFields = [
      "last",
      "summary",
      "preview",
      "snippet",
      "last_message",
      "lastMessage",
      "latest_message",
      "latestMessage"
    ];
    const modelFields = ["model", "model_slug", "default_model_slug"];
    const historyContainers = [
      "node",
      "conversation",
      "items",
      "conversations",
      "conversation_items",
      "conversation_history",
      "conversationHistory",
      "data",
      "edges",
      "nodes",
      "response",
      "results",
      "history",
      "threads",
      "chats"
    ];
    const historyContextPattern = /conversation|history|thread|chat|edge|node|item|data|result/i;
    const historyUrlPattern = /conversation|conversations|history|thread|threads|chat|chats|\/backend-api\/(?:c\/|conversation|conversations)/i;
    const fallbackWrapperPattern = /^(data|result|response)$/i;
    const flattenText = (value, seen = /* @__PURE__ */ new WeakSet()) => {
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (Array.isArray(value)) return value.map((item) => flattenText(item, seen)).join(" ");
      if (typeof value !== "object") return "";
      if (seen.has(value)) return "";
      seen.add(value);
      return flattenText(pickField(value, textFields), seen);
    };
    const cleanPreviewText = (value) => flattenText(value).replace(/\s+/g, " ").trim().slice(0, 120);
    const normalizeHistoryDate = (value) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
      if (typeof value === "number" && Number.isFinite(value)) {
        if (value <= 0) return null;
        return new Date(value < 10 ** 10 ? value * 1e3 : value);
      }
      if (typeof value === "string" && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric <= 0) return null;
        const date = Number.isFinite(numeric) ? new Date(numeric < 10 ** 10 ? numeric * 1e3 : numeric) : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      }
      return null;
    };
    const normalizeConversationId = (value) => {
      if (value == null) return "";
      const id = String(value).trim();
      return id && !/[/?#\s]/.test(id) ? id : "";
    };
    const conversationIdFromUrl = (url) => {
      const parsed = parseUrl(url);
      if (!parsed) return "";
      for (const key of routeConversationIdFields) {
        const id = normalizeConversationId(parsed.searchParams.get(key));
        if (id) return id;
      }
      const match = parsed.pathname.match(/(?:^|\/)(?:c|conversation)\/([^/?#]+)/i);
      return normalizeConversationId(match?.[1]);
    };
    const hasConversationRecordSignal = (payload) => {
      if (!payload || typeof payload !== "object") return false;
      return Boolean(
        payload.mapping || payload.current_node || Array.isArray(payload.messages) || payload.conversation || pickField(payload, dateFields) || pickField(payload, previewFields) || pickField(payload, modelFields) || payload.title
      );
    };
    const readConversationId = (payload, options = {}) => {
      const { fallbackId = "", allowGenericId = false } = typeof options === "string" ? { fallbackId: options } : options;
      const explicitId = normalizeConversationId(
        firstValue(
          pickField(payload, conversationIdFields),
          payload?.metadata?.conversation_id,
          payload?.metadata?.conversationId,
          payload?.conversation?.conversation_id,
          payload?.conversation?.conversationId
        )
      );
      if (explicitId) return explicitId;
      const nestedId = normalizeConversationId(payload?.conversation?.id);
      if (nestedId) return nestedId;
      const genericId = allowGenericId ? normalizeConversationId(firstValue(payload?.id, payload?.uuid)) : "";
      return genericId || normalizeConversationId(fallbackId);
    };
    const readHistoryDate = (payload) => normalizeHistoryDate(pickField(payload, dateFields));
    const messageTime = (message) => normalizeHistoryDate(pickField(message, dateFields))?.getTime() || 0;
    const messageRole = (message) => String(
      firstValue(message?.author?.role, pickField(message, ["role"]), message?.sender?.role) || ""
    );
    const collectMessages = (payload) => {
      const messages = [];
      if (payload?.current_node && payload?.mapping?.[payload.current_node]?.message) {
        messages.push(payload.mapping[payload.current_node].message);
      }
      if (payload?.mapping && typeof payload.mapping === "object") {
        messages.push(
          ...Object.values(payload.mapping).map((node) => node?.message).filter(Boolean)
        );
      }
      for (const value of [payload?.messages, payload?.message, payload?.conversation?.messages]) {
        if (Array.isArray(value)) messages.push(...value);
        else if (value && typeof value === "object") messages.push(value);
      }
      return messages;
    };
    const pickPreviewMessage = (payload) => {
      let latest = null;
      let latestTime = -1;
      for (const message of collectMessages(payload)) {
        if (messageRole(message) !== "assistant") continue;
        const time = messageTime(message);
        if (!latest || time >= latestTime) {
          latest = message;
          latestTime = time;
        }
      }
      return latest;
    };
    const buildConversationRecord = (payload, options = {}) => {
      if (!payload || typeof payload !== "object") return null;
      const id = readConversationId(payload, options);
      if (!id) return null;
      const preview = pickPreviewMessage(payload);
      const last = cleanPreviewText(
        firstValue(
          pickField(payload, previewFields),
          preview?.content?.parts,
          preview?.content,
          preview?.message
        )
      );
      const updateTime = readHistoryDate(payload) || (preview ? normalizeHistoryDate(messageTime(preview)) : null);
      if (!updateTime && !last && !payload.title && !preview) return null;
      return {
        id,
        title: String(firstValue(payload.title, payload.name) || ""),
        update_time: updateTime || /* @__PURE__ */ new Date(),
        last,
        model: String(
          firstValue(pickField(payload, modelFields), pickField(preview?.metadata, modelFields)) || ""
        )
      };
    };
    const extractConversationRecords = (payload, fallbackId = "") => {
      if (!payload || typeof payload !== "object") return [];
      const records = /* @__PURE__ */ new Map();
      const seen = /* @__PURE__ */ new WeakSet();
      const addRecord = (record) => {
        const current = records.get(record.id) || {};
        records.set(record.id, {
          id: record.id,
          title: record.title || current.title || "",
          update_time: record.update_time || current.update_time || /* @__PURE__ */ new Date(),
          last: record.last || current.last || "",
          model: record.model || current.model || ""
        });
      };
      const visit = (value, depth, contextKey = "", scopedFallbackId = "") => {
        if (!value || depth > 6 || records.size > 80) return;
        if (Array.isArray(value)) {
          for (const item of value) visit(item, depth + 1, contextKey);
          return;
        }
        if (typeof value !== "object" || seen.has(value)) return;
        seen.add(value);
        const record = buildConversationRecord(value, {
          fallbackId: scopedFallbackId,
          allowGenericId: hasConversationRecordSignal(value) && (depth === 0 || historyContextPattern.test(contextKey))
        });
        if (record && (historyContextPattern.test(contextKey) || value.mapping || value.messages || value.conversation_id || value.conversationId)) {
          addRecord(record);
        }
        for (const key of historyContainers) {
          if (key in value) {
            const child = value[key];
            const childFallbackId = scopedFallbackId && !Array.isArray(child) && (key === "conversation" || fallbackWrapperPattern.test(key)) ? scopedFallbackId : "";
            visit(child, depth + 1, key, childFallbackId);
          }
        }
      };
      visit(payload, 0, "", fallbackId);
      return Array.from(records.values());
    };
    const conversationIdFromPage = () => conversationIdFromUrl(location.href);
    const sidebarLinkState = /* @__PURE__ */ new WeakMap();
    const sidebarConversationLinkSelector = ':is(a[href*="/c/"], a[href*="/conversation/"])';
    const clearSidebarExtra = (link) => {
      $(".kcg-history-extra", link)?.remove();
      sidebarLinkState.delete(link);
    };
    const decorateSidebar = debounce(async () => {
      if (!getValue("k_everchanging", false)) {
        $$(".kcg-history-extra").forEach((node) => node.remove());
        return;
      }
      const links = $$(`${sidebarSelector} ${sidebarConversationLinkSelector}`);
      const linkEntries = [];
      const ids = [];
      for (const link of links) {
        const id = conversationIdFromUrl(link.href);
        if (!id) continue;
        linkEntries.push([link, id]);
        ids.push(id);
      }
      const records = await store.getMany(ids);
      for (const [link, id] of linkEntries) {
        const record = records.get(id);
        if (!record) {
          clearSidebarExtra(link);
          continue;
        }
        const text = [formatHistoryTime(record.update_time), record.last || record.model].filter(Boolean).join(" \xB7 ");
        if (!text) {
          clearSidebarExtra(link);
          continue;
        }
        if (sidebarLinkState.get(link) === text) continue;
        let extra = $(".kcg-history-extra", link);
        if (!extra) {
          extra = document.createElement("div");
          extra.className = "kcg-history-extra";
          link.appendChild(extra);
        }
        extra.textContent = text;
        sidebarLinkState.set(link, text);
      }
    }, 180);
    let lastConversationFingerprint = "";
    const findLastAssistantMessage = () => {
      const messages = document.querySelectorAll('main [data-message-author-role="assistant"]');
      return messages[messages.length - 1] || null;
    };
    const findAssistantMessage = (candidate) => candidate?.closest?.('[data-message-author-role="assistant"]') || (candidate?.matches?.('[data-message-author-role="assistant"]') ? candidate : null) || findLastAssistantMessage();
    const hasSidebarLinkChange = (mutations) => {
      for (const mutation of mutations) {
        for (const nodes of [mutation.addedNodes, mutation.removedNodes]) {
          for (const node of nodes) {
            if (!isElement(node)) continue;
            if (node.matches?.(sidebarConversationLinkSelector) || node.querySelector?.(sidebarConversationLinkSelector)) {
              return true;
            }
          }
        }
      }
      return false;
    };
    const updateCurrentConversation = debounce(async (candidate, preferredId = "") => {
      if (!getValue("k_everchanging", false)) return;
      const routeId = conversationIdFromPage();
      const id = normalizeConversationId(preferredId) || routeId;
      if (preferredId && routeId && routeId !== id) return;
      if (!id) return;
      const last = findAssistantMessage(candidate);
      if (!last) return;
      const summary = (last.textContent || last.innerText || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const fingerprint = `${id}:${summary}`;
      if (!summary || fingerprint === lastConversationFingerprint) return;
      lastConversationFingerprint = fingerprint;
      const old = await store.get(id) || {};
      await store.put({
        id,
        title: old.title || document.title.replace(/^ChatGPT\s*[-–]\s*/, ""),
        update_time: /* @__PURE__ */ new Date(),
        last: summary,
        model: old.model || ""
      });
      decorateSidebar();
    }, 800);
    const shouldHandleConversationResponse = (url) => {
      if (!getValue("k_everchanging", false)) return false;
      const parsed = parseUrl(url);
      if (parsed?.origin !== location.origin) return false;
      const target = `${parsed.pathname}${parsed.search}`;
      return historyUrlPattern.test(target) || Boolean(conversationIdFromUrl(parsed.toString()));
    };
    const handleConversationResponse = (url, method, response) => {
      if (!getValue("k_everchanging", false)) return;
      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType && !contentType.toLowerCase().includes("json")) return;
      const fallbackId = conversationIdFromUrl(url);
      response.clone().json().then(async (data) => {
        const id = readConversationId(data, { allowGenericId: hasConversationRecordSignal(data) }) || fallbackId;
        if (id && (method === "DELETE" || data?.is_visible === false || data?.is_archived === true || data?.is_hidden === true)) {
          await store.delete(id);
          decorateSidebar();
          return;
        }
        const records = extractConversationRecords(data, fallbackId);
        if (!records.length) {
          if (method === "POST" && id) {
            setTimeout(() => updateCurrentConversation(null, id), 2500);
          }
          return;
        }
        const oldRecords = await store.getMany(records.map((record) => record.id));
        await store.putMany(
          records.map((record) => {
            const old = oldRecords.get(record.id) || {};
            return {
              ...record,
              title: record.title || old.title || "",
              last: record.last || old.last || "",
              model: record.model || old.model || "",
              update_time: record.update_time || old.update_time || /* @__PURE__ */ new Date()
            };
          })
        );
        decorateSidebar();
      }).catch(() => {
      });
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
            if (shouldHandleConversationResponse(url)) {
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
    const ensureNetworkHooks = () => {
      if (getValue("k_intercepttracking", false) === true || getValue("k_everchanging", false) === true) {
        hookNetwork();
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
      if (trackingObserver) return;
      const roots = [document.head, document.body].filter(Boolean);
      if (!roots.length) return;
      trackingObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === "SCRIPT") {
              block(node);
              continue;
            }
            if (mutation.target === document.head || node.tagName === "HEAD") {
              node.querySelectorAll?.("script").forEach(block);
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
    const managedObservers = /* @__PURE__ */ new Map();
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
        stopManagedObserver("continue");
        return;
      }
      const root = $("main") || document.body;
      if (observeManaged("continue", root, (mutations) => {
        for (const mutation of mutations) {
          forAddedElements(mutation.addedNodes, "button", clickContinue);
        }
      })) {
        clickContinue(root);
      }
    };
    const setReuseObserver = (enabled) => {
      if (!enabled) {
        stopManagedObserver("reuse");
        $$(".kcg-reuse").forEach((node) => node.remove());
        return;
      }
      if (observeManaged("reuse", $("main"), (mutations) => {
        for (const mutation of mutations) {
          forAddedElements(
            mutation.addedNodes,
            'div[data-message-author-role="user"]',
            addReuseButton
          );
        }
      })) {
        applyReuseButtons();
      }
    };
    const setHistoryObservers = (enabled) => {
      if (!enabled) {
        stopManagedObserver("history-sidebar");
        stopManagedObserver("history-main");
        $$(".kcg-history-extra").forEach((node) => node.remove());
        return;
      }
      if (observeManaged("history-sidebar", $(sidebarSelector), (mutations) => {
        if (hasSidebarLinkChange(mutations)) decorateSidebar();
      })) {
        decorateSidebar();
      }
      if (observeManaged(
        "history-main",
        $("main"),
        (mutations) => {
          let candidate = null;
          for (const mutation of mutations) {
            const target = isElement(mutation.target) ? mutation.target.closest?.('[data-message-author-role="assistant"]') : mutation.target.parentElement?.closest?.('[data-message-author-role="assistant"]');
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
      )) {
        updateCurrentConversation();
      }
    };
    const resetTurnReader = () => {
      stopManagedObserver("turn-reader");
      clearTurnReaderVisibility();
      $("#kcg-turn-reader")?.remove();
      document.body.classList.remove("kcg-turn-reader-active");
      turnReaderState.turns = [];
      turnReaderState.index = -1;
      turnReaderState.followLatest = true;
      turnReaderState.route = "";
    };
    const setTurnReaderObserver = (enabled) => {
      if (!enabled) {
        resetTurnReader();
        return;
      }
      const root = $("main");
      if (!root) {
        stopManagedObserver("turn-reader");
        return;
      }
      ensureTurnReaderControls();
      if (observeManaged(
        "turn-reader",
        root,
        (mutations) => {
          scheduleTurnReaderRebuild(turnReaderState.followLatest || hasAddedUserMessage(mutations));
        },
        { childList: true, subtree: true }
      )) {
        rebuildTurnReader({ forceLatest: true, scrollActive: true });
      }
    };
    const syncFeatureObservers = () => {
      setContinueObserver(getValue("k_speakcompletely", false) === true);
      setReuseObserver(getValue("k_clonechat", false) === true);
      setHistoryObservers(getValue("k_everchanging", false) === true);
      setTurnReaderObserver(getValue("k_turnreader", false) === true);
    };
    const applyFeature = (id, enabled) => {
      if ((id === "tracking" || id === "history") && enabled) ensureNetworkHooks();
      if (id === "wide") document.body.classList.toggle("kcg-wide", enabled);
      if (id === "clean") document.body.classList.toggle("kcg-clean", enabled);
      if (id === "continue") setContinueObserver(enabled);
      if (id === "reuse") setReuseObserver(enabled);
      if (id === "history") setHistoryObservers(enabled);
      if (id === "turn-reader") setTurnReaderObserver(enabled);
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
            .kcg-check, .kcg-field {
                display: grid;
                gap: .4rem;
                margin-bottom: .75rem;
                color: inherit;
                font-size: .9rem;
            }
            .kcg-check {
                grid-template-columns: auto 1fr;
                align-items: center;
            }
            .kcg-check input {
                width: 1rem;
                height: 1rem;
                margin: 0;
            }
            .kcg-field span {
                color: var(--text-secondary, #666);
                font-size: .8rem;
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
            .kcg-turn-hidden {
                display: none !important;
            }
            .kcg-turn-reader {
                position: fixed;
                left: 50%;
                bottom: 5.25rem;
                transform: translateX(-50%);
                z-index: 2147483000;
                display: none;
                align-items: center;
                gap: .5rem;
                padding: .4rem;
                border: 1px solid rgba(0,0,0,.12);
                border-radius: .6rem;
                background: var(--main-surface-primary, #fff);
                color: var(--text-primary, #111);
                box-shadow: 0 8px 24px rgba(0,0,0,.14);
            }
            .kcg-turn-reader-active .kcg-turn-reader {
                display: flex;
            }
            .kcg-turn-reader button {
                border: 1px solid rgba(0,0,0,.12);
                border-radius: .45rem;
                padding: .35rem .65rem;
                background: transparent;
                color: inherit;
                font-size: .8rem;
                cursor: pointer;
            }
            .kcg-turn-reader button:disabled {
                cursor: default;
                opacity: .45;
            }
            .kcg-turn-reader-count {
                min-width: 4rem;
                text-align: center;
                color: var(--text-secondary, #666);
                font-size: .8rem;
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
      bindSensitiveScanner();
      applySavedOptions();
      restartKeepAlive();
      const syncDomBindings = debounce(() => {
        mountButton();
        bindSensitiveScanner();
        syncFeatureObservers();
      }, 120);
      observeManaged("dom-discovery", document.body, (mutations) => {
        for (const mutation of mutations) {
          if (touchesDomBindings(mutation.addedNodes) || touchesDomBindings(mutation.removedNodes)) {
            syncDomBindings();
            return;
          }
        }
      });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  })();
})();
//# sourceMappingURL=chatgpt-practical-enhancer.user.js.map
