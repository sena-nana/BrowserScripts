// ==UserScript==
// @name        Bilibili Site Toolkit
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Lightweight Bilibili layout cleanup and page readability helpers.
// @match       https://www.bilibili.com/*
// @match       https://t.bilibili.com/*
// @match       https://space.bilibili.com/*
// @run-at      document-start
// @inject-into auto
// @noframes
// @grant       GM_addStyle
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

  // userscripts/bilibili-site-toolkit/src/style.css
  var style_default = ".ad-report,\n.bili-video-card__info--ad,\n.video-page-game-card-small,\n.pop-live-small-mode,\n.activity-m-v1,\n.right-entry,\n.eva-extension-area,\n.live-card,\n.feed-card:has(.bili-video-card__info--ad) {\n  display: none !important;\n}\n\n.vm-bilibili-video .right-container,\n.vm-bilibili-video .recommend-list-v1 {\n  max-height: 70vh;\n  overflow: auto;\n}\n\n.vm-bilibili-dynamic .bili-dyn-list-tabs,\n.vm-bilibili-space .space-right-bottom {\n  position: sticky;\n  top: 0;\n  z-index: 10;\n}\n\n.video-tag-container,\n.tag-panel {\n  max-height: none !important;\n}\n";

  // userscripts/bilibili-site-toolkit/src/main.ts
  var scriptId = "bilibili-site-toolkit";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    document.documentElement.classList.toggle(
      "vm-bilibili-space",
      location.hostname === "space.bilibili.com"
    );
    document.documentElement.classList.toggle(
      "vm-bilibili-dynamic",
      location.hostname === "t.bilibili.com"
    );
    document.documentElement.classList.toggle(
      "vm-bilibili-video",
      location.pathname.startsWith("/video/")
    );
    revealTags();
    log.debug("route ready", location.href);
  }
  function revealTags() {
    document.querySelectorAll(".tag-panel .tag, .video-tag-container .tag").forEach((tag) => {
      tag.style.display = "";
      tag.style.maxWidth = "none";
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
//# sourceMappingURL=bilibili-site-toolkit.user.js.map
