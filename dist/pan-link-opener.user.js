// ==UserScript==
// @name        Pan Link Opener
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Recognize cloud-drive links and extraction codes, then open or fill them after user action.
// @match       http://*/*
// @match       https://*/*
// @exclude-match https://accounts.google.com/*
// @exclude-match https://login.microsoftonline.com/*
// @run-at      document-end
// @inject-into auto
// @noframes
// @grant       GM_openInTab
// ==/UserScript==

(() => {
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
  function createButton(action) {
    const button = document.createElement("button");
    injectVmKitUiStyle();
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    return button;
  }
  function confirmAction(message, action) {
    if (window.confirm(message)) {
      action();
    }
  }

  // userscripts/pan-link-opener/src/pan-parser.ts
  var providers = [
    {
      provider: "baidu",
      label: "Baidu Netdisk",
      pattern: /https?:\/\/(?:pan|yun)\.baidu\.com\/(?:s\/[\w~-]+|share\/[^\s"'<>]+)/i
    },
    {
      provider: "aliyun",
      label: "Aliyun Drive",
      pattern: /https?:\/\/(?:www\.)?(?:aliyundrive|alipan)\.com\/s\/[A-Za-z0-9]+/i
    },
    {
      provider: "weiyun",
      label: "Tencent Weiyun",
      pattern: /https?:\/\/share\.weiyun\.com\/[A-Za-z0-9]+/i
    },
    {
      provider: "lanzou",
      label: "Lanzou",
      pattern: /https?:\/\/(?:[\w-]+\.)?lanzou[a-z]?\.com\/[^\s"'<>]+/i
    },
    {
      provider: "tianyi",
      label: "Cloud 189",
      pattern: /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code=)?[A-Za-z0-9]+/i
    },
    {
      provider: "caiyun",
      label: "China Mobile Cloud",
      pattern: /https?:\/\/(?:caiyun|yun)\.139\.com\/(?:m\/i|w\/i\/|web\/|front\/#\/detail)[^\s"'<>]*/i
    },
    {
      provider: "xunlei",
      label: "Xunlei Cloud",
      pattern: /https?:\/\/pan\.xunlei\.com\/s\/[\w-]{10,}/i
    },
    {
      provider: "quark",
      label: "Quark Cloud",
      pattern: /https?:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9-]+/i
    },
    {
      provider: "pan123",
      label: "123 Pan",
      pattern: /https?:\/\/(?:www\.)?123pan\.com\/s\/[A-Za-z0-9-]+/i
    },
    {
      provider: "pan360",
      label: "360 Cloud",
      pattern: /https?:\/\/(?:yunpan|cloud)\.360\.cn\/[^\s"'<>]+/i
    },
    {
      provider: "115",
      label: "115 Cloud",
      pattern: /https?:\/\/(?:115\.com|anxia\.com)\/s\/[A-Za-z0-9]+/i
    },
    {
      provider: "cowtransfer",
      label: "CowTransfer",
      pattern: /https?:\/\/(?:cowtransfer\.com|c-t\.work)\/s\/[A-Za-z0-9]+/i
    },
    {
      provider: "ctfile",
      label: "CTFile",
      pattern: /https?:\/\/(?:www\.)?(?:ctfile|474b)\.com\/[^\s"'<>]+/i
    },
    {
      provider: "flowus",
      label: "FlowUs",
      pattern: /https?:\/\/flowus\.cn\/[^\s"'<>]+\/share\/[a-f0-9-]{36}/i
    },
    {
      provider: "chrome-web-store",
      label: "Chrome Web Store",
      pattern: /https?:\/\/chromewebstore\.google\.com\/detail\/[^\s"'<>]+/i
    },
    {
      provider: "edge-addons",
      label: "Edge Add-ons",
      pattern: /https?:\/\/microsoftedge\.microsoft\.com\/addons\/detail\/[^\s"'<>]+/i
    },
    {
      provider: "firefox-addons",
      label: "Firefox Add-ons",
      pattern: /https?:\/\/addons\.mozilla\.org\/[^\s"'<>]+/i
    }
  ];
  function parseExtractionCode(text) {
    return text.match(/(?:[?#&](?:p|pwd)=)([A-Za-z0-9]{3,8})/i)?.[1] ?? text.match(/(?:提取|访问|取件|密)\s*(?:码|碼)?\s*[:：= ]\s*([A-Za-z0-9]{3,8})/i)?.[1] ?? text.match(/(?:key|password|pwd)\s*[:：=]\s*([A-Za-z0-9]{3,8})/i)?.[1];
  }
  function findPanLinks(text) {
    const matches = [];
    const seen = /* @__PURE__ */ new Set();
    const code = parseExtractionCode(text);
    for (const provider of providers) {
      for (const match of text.matchAll(new RegExp(provider.pattern.source, "gi"))) {
        const url = normalizeUrl(match[0]);
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);
        const item = {
          provider: provider.provider,
          label: provider.label,
          url
        };
        if (code) {
          item.code = code;
        }
        matches.push(item);
      }
    }
    return matches;
  }
  function appendExtractionCode(match) {
    if (!match.code) {
      return match.url;
    }
    const separator = match.url.includes("?") ? "&" : "?";
    return `${match.url}${separator}pwd=${encodeURIComponent(match.code)}#${encodeURIComponent(match.code)}`;
  }
  function normalizeUrl(url) {
    return url.replace(/[),.，。]+$/u, "");
  }

  // userscripts/pan-link-opener/src/main.ts
  var scriptId = "pan-link-opener";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    fillKnownExtractionCode();
    renderSelectedLinkBar();
    log.debug("route ready", location.href);
  }
  function fillKnownExtractionCode() {
    const code = parseExtractionCode(
      `${location.search} ${decodeURIComponent(location.hash.slice(1))}`
    );
    if (!code) {
      return;
    }
    const input = document.querySelector(
      '#accessCode, .share-access-code, input[type="password"], input[name="pwd"], input[placeholder*="\u63D0\u53D6"], input[placeholder*="\u8BBF\u95EE"]'
    );
    if (!input || input.value) {
      return;
    }
    input.value = code;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function renderSelectedLinkBar() {
    if (document.getElementById("vm-pan-link-opener")) {
      return;
    }
    const bar = createButton({
      label: "\u6253\u5F00\u9009\u4E2D\u7F51\u76D8\u94FE\u63A5",
      onClick: openSelectedPanLink
    });
    bar.id = "vm-pan-link-opener";
    bar.classList.add("vm-kit-floating-button");
    bar.hidden = !findPanLinks(window.getSelection()?.toString() ?? "").length;
    document.body.append(bar);
    document.addEventListener("selectionchange", syncSelectedLinkButton);
  }
  function syncSelectedLinkButton() {
    const bar = document.getElementById("vm-pan-link-opener");
    if (!bar) {
      return;
    }
    bar.hidden = !findPanLinks(window.getSelection()?.toString() ?? "").length;
  }
  function openSelectedPanLink() {
    const selectedText = window.getSelection()?.toString() ?? "";
    const match = findPanLinks(selectedText)[0];
    if (!match) {
      window.alert("\u672A\u8BC6\u522B\u5230\u7F51\u76D8\u94FE\u63A5");
      return;
    }
    confirmAction(`\u6253\u5F00 ${match.label} \u94FE\u63A5\uFF1F`, () => {
      GM_openInTab(appendExtractionCode(match), { active: true });
    });
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
//# sourceMappingURL=pan-link-opener.user.js.map
