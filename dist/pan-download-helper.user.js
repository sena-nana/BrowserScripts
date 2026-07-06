// ==UserScript==
// @name        Pan Download Helper
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description User-triggered cloud-drive command and link copy helpers without token or cookie scraping.
// @match       https://pan.baidu.com/*
// @match       https://yun.baidu.com/*
// @match       https://www.aliyundrive.com/*
// @match       https://www.alipan.com/*
// @match       https://cloud.189.cn/*
// @match       https://pan.xunlei.com/*
// @match       https://pan.quark.cn/*
// @match       https://yun.139.com/*
// @match       https://caiyun.139.com/*
// @run-at      document-end
// @inject-into auto
// @noframes
// @grant       GM_addStyle
// @grant       GM_setClipboard
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

  // userscripts/pan-download-helper/src/style.css
  var style_default = ".vm-pan-download-helper {\n  display: flex;\n  gap: 6px;\n}\n\n.vm-pan-download-helper button {\n  background: #0969da;\n  color: #fff;\n}\n\n.vm-pan-download-helper button:hover {\n  background: #0757b6;\n}\n";

  // userscripts/pan-download-helper/src/main.ts
  var scriptId = "pan-download-helper";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    renderHelper();
    log.debug("route ready", location.href);
  }
  function renderHelper() {
    if (document.getElementById("vm-pan-download-helper")) {
      return;
    }
    const panel = ensureFloatingPanel({
      id: "vm-pan-download-helper",
      className: "vm-pan-download-helper"
    });
    const copyLink = createButton({ label: "\u590D\u5236\u9875\u9762\u4E0B\u8F7D\u94FE\u63A5", onClick: copyVisibleDownloadLink });
    const copyCurl = createButton({ label: "\u590D\u5236 cURL \u547D\u4EE4", onClick: () => copyCommand("curl") });
    const copyAria = createButton({ label: "\u590D\u5236 aria2 \u547D\u4EE4", onClick: () => copyCommand("aria2") });
    panel.replaceChildren(copyLink, copyCurl, copyAria);
  }
  function findVisibleDownloadLinks() {
    const anchors = [...document.querySelectorAll("a[href]")];
    return anchors.filter((anchor) => {
      const href = anchor.href;
      const text = anchor.textContent ?? "";
      return /^https?:\/\//.test(href) && /下载|download|保存|dlink/i.test(`${text} ${href}`);
    }).map((anchor, index) => ({
      filename: deriveFilename(anchor, index),
      url: anchor.href
    }));
  }
  function deriveFilename(anchor, index) {
    return anchor.download || anchor.getAttribute("title")?.trim() || anchor.textContent?.trim().replace(/\s+/g, " ") || `download-${index + 1}.bin`;
  }
  function copyVisibleDownloadLink() {
    const links = findVisibleDownloadLinks();
    if (!links.length) {
      window.alert("\u5F53\u524D\u9875\u9762\u6CA1\u6709\u627E\u5230\u660E\u786E\u7684\u4E0B\u8F7D\u94FE\u63A5");
      return;
    }
    copyWithNotice(links.map((link) => link.url).join("\n"), "\u5DF2\u590D\u5236\u4E0B\u8F7D\u94FE\u63A5");
  }
  function copyCommand(kind) {
    const links = findVisibleDownloadLinks();
    if (!links.length) {
      window.alert("\u5F53\u524D\u9875\u9762\u6CA1\u6709\u627E\u5230\u660E\u786E\u7684\u4E0B\u8F7D\u94FE\u63A5");
      return;
    }
    copyWithNotice(links.map((link) => buildCommand(kind, link)).join("\n"), "\u5DF2\u590D\u5236\u547D\u4EE4");
  }
  function buildCommand(kind, link) {
    return kind === "curl" ? `curl -L -C - ${quote(link.url)} -o ${quote(link.filename)}` : `aria2c -o ${quote(link.filename)} ${quote(link.url)}`;
  }
  function quote(value) {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  var stopUrlWatcher = onUrlChange(() => run());
  if (false) {
    installDebugBridge(scriptId, {
      rerun: run,
      state: () => ({
        url: location.href
      }),
      stop: stopUrlWatcher
    });
  }
})();
//# sourceMappingURL=pan-download-helper.user.js.map
