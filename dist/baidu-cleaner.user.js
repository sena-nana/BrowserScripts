// ==UserScript==
// @name        Baidu Cleaner
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Clean common Baidu search, Baike, Zhidao, Wenku, and Tieba distractions.
// @match       https://*.baidu.com/*
// @run-at      document-start
// @inject-into auto
// @noframes
// @grant       GM_addStyle
// ==/UserScript==

(() => {
  // packages/vm-kit/src/dom.ts
  function observeDocument(callback, options = { childList: true, subtree: true }) {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, options);
    return () => observer.disconnect();
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

  // userscripts/baidu-cleaner/src/style.css
  var style_default = "#content_right,\n.ec_ad_results,\n.cr-content,\n.right-ad,\n.FYB_RD,\n.wgt-ads,\n.c-row:has([data-tuiguang]),\n.ad-block,\n.banner-ad,\n.union-ad,\n.download-app,\n.app-download,\n.login-mask,\n.passport-login-pop,\n.wgt-footer-main {\n  display: none !important;\n}\n\n#content_left,\n.main-content,\n.lemmaWgt-lemmaTitle,\n.question-content {\n  max-width: min(920px, calc(100vw - 32px)) !important;\n}\n";

  // userscripts/baidu-cleaner/src/main.ts
  var scriptId = "baidu-cleaner";
  var log = createLogger(scriptId, { debug: false });
  var cleanupObserverStarted = false;
  var cleanupTimer;
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    cleanSearchResults();
    startDynamicCleanup();
    log.debug("route ready", location.href);
  }
  function cleanSearchResults() {
    document.querySelectorAll("#content_left > div, #content_right > div").forEach((item) => {
      const text = item.textContent ?? "";
      if (/广告|商业推广|推广链接|Sponsored/i.test(text)) {
        item.hidden = true;
      }
    });
  }
  function startDynamicCleanup() {
    if (cleanupObserverStarted) {
      return;
    }
    cleanupObserverStarted = true;
    observeDocument(() => {
      window.clearTimeout(cleanupTimer);
      cleanupTimer = window.setTimeout(cleanSearchResults, 100);
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
//# sourceMappingURL=baidu-cleaner.user.js.map
