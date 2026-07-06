// ==UserScript==
// @name        CSDN Reader Cleaner
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Clean CSDN article pages, restore copy behavior, and reduce login distractions.
// @match       https://*.csdn.net/*
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

  // userscripts/csdn-reader-cleaner/src/style.css
  var style_default = ".csdn-side-toolbar,\n.blog_container_aside,\n.toolbar-inside,\n.passport-login-container,\n.login-mark,\n.hide-preCode-box,\n.recommend-box,\n.programmer1Box,\n.template-box,\n.more-toolbox-new,\n.left-toolbox,\n.right-item-ad,\n.csdn-tracking-statistics,\n.passport-login-tip-container,\n.btn-readmore,\n.readall_box {\n  display: none !important;\n}\n\n#mainBox,\n.main_father,\n.blog-content-box,\n#article_content,\n.htmledit_views {\n  max-width: min(980px, calc(100vw - 32px)) !important;\n}\n\n#article_content,\n.htmledit_views {\n  max-height: none !important;\n  user-select: text !important;\n}\n\n.vm-csdn-copy-ready pre,\n.vm-csdn-copy-ready code,\n.vm-csdn-copy-ready article {\n  user-select: text !important;\n}\n";

  // userscripts/csdn-reader-cleaner/src/main.ts
  var scriptId = "csdn-reader-cleaner";
  var log = createLogger(scriptId, { debug: false });
  var copyBound = false;
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    restoreCopy();
    unwrapArticle();
    normalizeRedirectLinks();
    log.debug("route ready", location.href);
  }
  function restoreCopy() {
    document.body?.classList.add("vm-csdn-copy-ready");
    if (copyBound) {
      return;
    }
    copyBound = true;
    bindSelectedTextCopy();
  }
  function unwrapArticle() {
    document.querySelectorAll("#article_content, .blog-content-box, .htmledit_views").forEach((article) => {
      article.style.maxHeight = "none";
      article.style.height = "auto";
      article.style.overflow = "visible";
      article.classList.remove("hide-article-box");
    });
  }
  function normalizeRedirectLinks() {
    document.querySelectorAll('a[href*="link.csdn.net/?target="]').forEach((link) => {
      const target = new URL(link.href).searchParams.get("target");
      if (!target) {
        return;
      }
      link.href = decodeURIComponent(target);
      link.rel = "noopener noreferrer";
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
//# sourceMappingURL=csdn-reader-cleaner.user.js.map
