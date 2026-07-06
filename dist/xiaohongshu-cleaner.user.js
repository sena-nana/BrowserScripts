// ==UserScript==
// @name        Xiaohongshu Cleaner
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Reduce Xiaohongshu login popups, app prompts, ads, and copy restrictions.
// @match       https://www.xiaohongshu.com/*
// @run-at      document-start
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
  function bindSelectedTextCopy() {
    document.addEventListener(
      "copy",
      (event) => {
        const text = window.getSelection()?.toString();
        if (!text) {
          return;
        }
        event.stopImmediatePropagation();
        event.preventDefault();
        event.clipboardData?.setData("text/plain", text);
        copyText(text);
      },
      true
    );
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

  // userscripts/xiaohongshu-cleaner/src/style.css
  var style_default = ".login-container,\n.login-modal,\n.download-app,\n.launch-app-container,\n.reds-sticky,\n.ad-container,\n.engage-bar-style,\n.bottom-input,\n.mask:has(.login-container),\n.mask:has(.download-app) {\n  display: none !important;\n}\n\nbody,\n.note-content,\n.desc,\n.content,\n.comment-item {\n  user-select: text !important;\n}\n\n.note-container,\n.feeds-container {\n  max-width: min(1120px, calc(100vw - 24px)) !important;\n}\n";

  // userscripts/xiaohongshu-cleaner/src/main.ts
  var scriptId = "xiaohongshu-cleaner";
  var log = createLogger(scriptId, { debug: false });
  var copyBound = false;
  var appWakeupBlockerBound = false;
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    restoreCopy();
    dismissBlockingOverlays();
    normalizeLinks();
    bindAppWakeupBlocker();
    log.debug("route ready", location.href);
  }
  function restoreCopy() {
    if (copyBound) {
      return;
    }
    copyBound = true;
    bindSelectedTextCopy();
  }
  function dismissBlockingOverlays() {
    document.querySelectorAll(
      ".login-container, .login-modal, .mask, .download-app, .launch-app-container, .red-captcha"
    ).forEach((node) => {
      if (/登录|打开|下载|验证|扫码/.test(node.textContent ?? "")) {
        node.hidden = true;
      }
    });
  }
  function normalizeLinks() {
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("xhsdiscover://") || href.startsWith("xhs://")) {
        link.removeAttribute("href");
        return;
      }
      const url = new URL(link.href, location.origin);
      const redirect = url.searchParams.get("redirect") ?? url.searchParams.get("target");
      if (redirect?.startsWith("https://www.xiaohongshu.com/")) {
        link.href = redirect;
      }
    });
  }
  function bindAppWakeupBlocker() {
    if (appWakeupBlockerBound) {
      return;
    }
    appWakeupBlockerBound = true;
    document.addEventListener(
      "click",
      (event) => {
        const link = event.target?.closest?.(
          "a[href]"
        );
        const href = link?.getAttribute("href") ?? "";
        if (href.startsWith("xhsdiscover://") || href.startsWith("xhs://")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
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
//# sourceMappingURL=xiaohongshu-cleaner.user.js.map
