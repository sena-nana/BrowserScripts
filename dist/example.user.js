// ==UserScript==
// @name        BrowserScripts Example
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Minimal example userscript for the BrowserScripts scaffold.
// @match       https://example.com/*
// @run-at      document-end
// @inject-into auto
// @noframes
// @grant       none
// ==/UserScript==

(() => {
  // packages/vm-kit/src/dom.ts
  function ensureElement(tagName, options = {}) {
    if (options.id) {
      const existing = document.getElementById(options.id);
      if (existing instanceof HTMLElement) {
        return existing;
      }
    }
    const element = document.createElement(tagName);
    if (options.id) {
      element.id = options.id;
    }
    if (options.className) {
      element.className = options.className;
    }
    if (options.textContent) {
      element.textContent = options.textContent;
    }
    (options.parent ?? document.body).append(element);
    return element;
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
    const run = () => {
      if (stopped || location.href === lastUrl) {
        return;
      }
      lastUrl = location.href;
      callback(new URL(lastUrl));
    };
    callback(new URL(lastUrl));
    const addListener = (type) => {
      window.addEventListener(type, run);
      cleanups.push(() => window.removeEventListener(type, run));
    };
    addListener("popstate");
    addListener("hashchange");
    const patchHistory = (methodName) => {
      const original = history[methodName];
      history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        queueMicrotask(run);
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
      maybeNavigation.addEventListener("navigatesuccess", run);
      cleanups.push(() => maybeNavigation.removeEventListener("navigatesuccess", run));
    }
    const observer = new MutationObserver(run);
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

  // userscripts/example/src/style.css
  var style_default = ".vm-example-badge {\n  position: fixed;\n  right: 16px;\n  bottom: 16px;\n  z-index: 2147483647;\n  padding: 8px 10px;\n  border: 1px solid rgba(15, 23, 42, 0.18);\n  border-radius: 6px;\n  background: #ffffff;\n  color: #0f172a;\n  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);\n  font:\n    600 12px/1.4 system-ui,\n    -apple-system,\n    BlinkMacSystemFont,\n    'Segoe UI',\n    sans-serif;\n}\n";

  // userscripts/example/src/main.ts
  var scriptId = "example";
  var markerId = "vm-example-badge";
  var log = createLogger(scriptId, { debug: false });
  function renderBadge() {
    injectStyle(style_default, "vm-example-style");
    if (!document.body) {
      log.warn("document.body is not ready");
      return;
    }
    const badge = ensureElement("div", {
      id: markerId,
      className: "vm-example-badge",
      textContent: "VM Example active",
      parent: document.body
    });
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");
    log.debug("badge rendered", location.href);
  }
  var stopUrlWatcher = onUrlChange(() => renderBadge());
  if (false) {
    installDebugBridge(scriptId, {
      rerun: renderBadge,
      state: () => ({
        markerExists: Boolean(document.getElementById(markerId)),
        url: location.href
      }),
      stop: stopUrlWatcher
    });
  }
})();
//# sourceMappingURL=example.user.js.map
