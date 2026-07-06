// ==UserScript==
// @name        Google Play Download Links
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Add user-triggered public mirror search links on Google Play app pages.
// @match       https://play.google.com/store/apps/details*
// @run-at      document-end
// @inject-into auto
// @noframes
// @grant       GM_addStyle
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
  function createLink(action) {
    injectVmKitUiStyle();
    const link = document.createElement("a");
    link.href = action.href;
    link.textContent = action.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  // userscripts/google-play-download-links/src/style.css
  var style_default = ".vm-google-play-download-links {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin: 12px 0;\n}\n\n.vm-google-play-download-links a {\n  border: 1px solid #dadce0;\n  border-radius: 6px;\n  padding: 6px 10px;\n  color: #1a73e8;\n  font:\n    500 13px/1.3 system-ui,\n    sans-serif;\n  text-decoration: none;\n}\n\n.vm-google-play-download-links a:hover {\n  background: #f1f3f4;\n}\n";

  // userscripts/google-play-download-links/src/main.ts
  var scriptId = "google-play-download-links";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    renderMirrorLinks();
    log.debug("route ready", location.href);
  }
  function renderMirrorLinks() {
    const packageName = new URL(location.href).searchParams.get("id");
    if (!packageName) {
      return;
    }
    const target = document.querySelector("main h1")?.closest("div") ?? document.body;
    const panel = ensureElement("div", {
      id: "vm-google-play-download-links",
      className: "vm-google-play-download-links",
      parent: target
    });
    if (panel.dataset.packageName === packageName) {
      return;
    }
    panel.dataset.packageName = packageName;
    const mirrors = [
      [
        "APKMirror",
        `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${packageName}`
      ],
      ["APKPure", `https://apkpure.com/search?q=${packageName}`],
      ["APKCombo", `https://apkcombo.com/search/${packageName}`],
      ["APKPremier", `https://apkpremier.com/?s=${packageName}`]
    ];
    panel.replaceChildren(...mirrors.map(([label, href]) => createLink({ label, href })));
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
//# sourceMappingURL=google-play-download-links.user.js.map
