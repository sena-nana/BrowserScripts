// ==UserScript==
// @name        Bilibili Space Manager
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Read-only Bilibili space follow and dynamic management helpers.
// @match       https://space.bilibili.com/*
// @run-at      document-end
// @inject-into auto
// @noframes
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @connect     api.bilibili.com
// ==/UserScript==

(() => {
  // packages/vm-kit/src/clipboard.ts
  function copyText(text) {
    const value = String(text);
    const gmSetClipboard = globalThis.GM_setClipboard;
    if (typeof gmSetClipboard === "function") {
      gmSetClipboard(value);
      return;
    }
    void navigator.clipboard?.writeText(value);
  }
  function copyWithNotice(text, message = "\u5DF2\u590D\u5236") {
    copyText(text);
    window.alert(message);
  }

  // packages/vm-kit/src/logger.ts
  function createLogger(namespace, options = {}) {
    const prefix = `[vm:${namespace}]`;
    return {
      debug: (...args) => {
        if (options.debug) {
          console.debug(prefix, ...args);
        }
      },
      info: (...args) => console.info(prefix, ...args),
      warn: (...args) => console.warn(prefix, ...args),
      error: (...args) => console.error(prefix, ...args)
    };
  }

  // packages/vm-kit/src/network.ts
  function gmRequest(options) {
    const request = globalThis.GM_xmlhttpRequest;
    if (typeof request !== "function") {
      return Promise.reject(new Error("GM_xmlhttpRequest is not available"));
    }
    return new Promise((resolve, reject) => {
      const details = {
        method: options.method ?? "GET",
        url: options.url,
        onload: (response) => {
          resolve({
            status: response.status,
            response: response.response,
            responseText: response.responseText ?? "",
            finalUrl: response.finalUrl ?? options.url
          });
        },
        onerror: (error) => reject(error),
        ontimeout: () => reject(new Error(`GM_xmlhttpRequest timed out: ${options.url}`))
      };
      if (options.headers) {
        details.headers = options.headers;
      }
      if (options.data) {
        details.data = options.data;
      }
      if (options.timeout !== void 0) {
        details.timeout = options.timeout;
      }
      if (options.responseType !== void 0) {
        details.responseType = options.responseType;
      }
      request(details);
    });
  }

  // packages/vm-kit/src/spa.ts
  function onUrlChange(callback) {
    let stopped = false;
    let lastUrl = location.href;
    const cleanups = [];
    const run2 = () => {
      if (stopped || location.href === lastUrl) {
        return;
      }
      lastUrl = location.href;
      callback(new URL(lastUrl));
    };
    callback(new URL(lastUrl));
    const addListener = (type) => {
      window.addEventListener(type, run2);
      cleanups.push(() => window.removeEventListener(type, run2));
    };
    addListener("popstate");
    addListener("hashchange");
    const patchHistory = (methodName) => {
      const original = history[methodName];
      history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        queueMicrotask(run2);
        return result;
      };
      cleanups.push(() => {
        history[methodName] = original;
      });
    };
    patchHistory("pushState");
    patchHistory("replaceState");
    const maybeNavigation = globalThis.navigation;
    if (maybeNavigation) {
      maybeNavigation.addEventListener("navigatesuccess", run2);
      cleanups.push(() => maybeNavigation.removeEventListener("navigatesuccess", run2));
    }
    const observer = new MutationObserver(run2);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    cleanups.push(() => observer.disconnect());
    return () => {
      stopped = true;
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    };
  }

  // packages/vm-kit/src/style.ts
  function injectStyle(css, id) {
    if (!css.trim()) {
      return void 0;
    }
    if (id) {
      const existing = document.getElementById(id);
      if (existing instanceof HTMLStyleElement) {
        existing.textContent = css;
        return existing;
      }
    }
    const gmAddStyle = globalThis.GM_addStyle;
    if (typeof gmAddStyle === "function") {
      const style2 = gmAddStyle(css);
      if (id && style2 instanceof HTMLStyleElement) {
        style2.id = id;
      }
      return style2 instanceof HTMLStyleElement ? style2 : void 0;
    }
    const style = document.createElement("style");
    if (id) {
      style.id = id;
    }
    style.textContent = css;
    document.head.append(style);
    return style;
  }

  // packages/vm-kit/src/ui.ts
  var uiStyleId = "vm-kit-ui-style";
  function injectVmKitUiStyle() {
    if (document.getElementById(uiStyleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = uiStyleId;
    style.textContent = `
    .vm-kit-floating-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483000;
      display: grid;
      gap: 8px;
      width: min(280px, calc(100vw - 32px));
      border: 1px solid #d0d7de;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      color: #24292f;
      font: 12px/1.4 system-ui, sans-serif;
      box-shadow: 0 8px 24px rgb(31 35 40 / 16%);
    }
    .vm-kit-floating-panel button,
    .vm-kit-floating-panel a,
    .vm-kit-floating-button {
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 6px 9px;
      background: #f6f8fa;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-decoration: none;
    }
    .vm-kit-floating-panel button:hover,
    .vm-kit-floating-panel a:hover,
    .vm-kit-floating-button:hover {
      background: #eef1f4;
    }
    .vm-kit-floating-button {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483000;
      box-shadow: 0 8px 24px rgb(31 35 40 / 16%);
    }
  `;
    document.head.append(style);
  }
  function ensureFloatingPanel(options) {
    injectVmKitUiStyle();
    const existing = document.getElementById(options.id);
    if (existing instanceof HTMLDivElement) {
      return existing;
    }
    const panel = document.createElement("div");
    panel.id = options.id;
    panel.className = ["vm-kit-floating-panel", options.className].filter(Boolean).join(" ");
    (options.parent ?? document.body).append(panel);
    return panel;
  }
  function createButton(action) {
    const button = document.createElement("button");
    injectVmKitUiStyle();
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    return button;
  }
  function createLink(action) {
    injectVmKitUiStyle();
    const link = document.createElement("a");
    link.href = action.href;
    link.textContent = action.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  // userscripts/bilibili-space-manager/src/style.css
  var style_default = ".vm-bilibili-space-manager {\n  color: #24292f;\n}\n\n.vm-bilibili-space-manager-title {\n  font-weight: 700;\n}\n\n.vm-bilibili-space-manager-summary {\n  color: #57606a;\n}\n\n.vm-bilibili-space-manager-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.vm-bilibili-space-manager button,\n.vm-bilibili-space-manager a {\n  color: inherit;\n}\n";

  // userscripts/bilibili-space-manager/src/main.ts
  var scriptId = "bilibili-space-manager";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    renderPanel();
    log.debug("route ready", location.href);
  }
  function getSpaceUid() {
    return location.pathname.match(/^\/(\d+)/)?.[1] ?? null;
  }
  function renderPanel() {
    const uid = getSpaceUid();
    if (!uid) {
      return;
    }
    const panel = ensureFloatingPanel({
      id: "vm-bilibili-space-manager",
      className: "vm-bilibili-space-manager"
    });
    const title = document.createElement("div");
    title.className = "vm-bilibili-space-manager-title";
    title.textContent = `UID ${uid}`;
    const summary = document.createElement("div");
    summary.className = "vm-bilibili-space-manager-summary";
    summary.textContent = "\u52A0\u8F7D\u5173\u6CE8\u6982\u89C8";
    const actions = document.createElement("div");
    actions.className = "vm-bilibili-space-manager-actions";
    actions.replaceChildren(
      createButton({ label: "\u590D\u5236 UID", onClick: () => copyWithNotice(uid) }),
      createButton({ label: "\u590D\u5236\u5F53\u524D\u9875\u6761\u76EE", onClick: copyVisibleCards }),
      createLink({ label: "\u52A8\u6001", href: `https://space.bilibili.com/${uid}/dynamic` }),
      createLink({ label: "\u6536\u85CF", href: `https://space.bilibili.com/${uid}/favlist` })
    );
    panel.replaceChildren(title, summary, actions);
    loadRelationSummary(uid, summary);
  }
  async function loadRelationSummary(uid, target) {
    try {
      const response = await gmRequest({
        method: "GET",
        url: `https://api.bilibili.com/x/relation/stat?vmid=${encodeURIComponent(uid)}`,
        responseType: "json"
      });
      const data = response.response?.data;
      target.textContent = data && typeof data.following === "number" ? `\u5173\u6CE8 ${data.following} / \u7C89\u4E1D ${data.follower}` : "\u6982\u89C8\u4E0D\u53EF\u7528";
    } catch {
      target.textContent = "\u6982\u89C8\u52A0\u8F7D\u5931\u8D25";
    }
  }
  function copyVisibleCards() {
    const items = [
      ...document.querySelectorAll(
        ".bili-video-card, .fav-video-list li, .bili-dyn-list__item"
      )
    ].map((node) => {
      const title = node.querySelector(
        ".bili-video-card__info--tit, .title, .bili-dyn-title, .bili-dyn-content__orig__desc"
      )?.textContent?.trim() ?? node.textContent?.trim();
      const link = node.querySelector(
        'a[href*="/video/"], a[href*="/opus/"], a[href*="/dynamic/"]'
      );
      const href = link ? new URL(link.href, location.origin).href : "";
      const bv = href.match(/\/video\/(BV[\w]+)/)?.[1] ?? href.match(/[?&]bvid=(BV[\w]+)/)?.[1];
      return [title, bv, href].filter(Boolean).join(" | ");
    }).filter((text) => Boolean(text));
    if (!items.length) {
      window.alert("\u5F53\u524D\u9875\u9762\u6CA1\u6709\u53EF\u590D\u5236\u6761\u76EE");
      return;
    }
    copyWithNotice(items.slice(0, 80).join("\n"));
  }
  var stopUrlWatcher = onUrlChange(() => run());
  if (false) {
    installDebugBridge(scriptId, {
      rerun: run,
      state: () => ({
        uid: getSpaceUid(),
        url: location.href
      }),
      stop: stopUrlWatcher
    });
  }
})();
//# sourceMappingURL=bilibili-space-manager.user.js.map
