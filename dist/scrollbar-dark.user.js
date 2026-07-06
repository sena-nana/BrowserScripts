// ==UserScript==
// @name        Scrollbar Dark
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Apply a narrow dark scrollbar style globally with known site exclusions.
// @match       http://*/*
// @match       https://*/*
// @exclude-match https://*.bilibili.com/*
// @exclude-match https://www.zhihu.com/*
// @exclude-match https://zhuanlan.zhihu.com/*
// @exclude-match https://www.baidu.com/*
// @run-at      document-start
// @inject-into auto
// @noframes
// @grant       none
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

  // userscripts/scrollbar-dark/src/style.css
  var style_default = ".vm-scrollbar-dark {\n  scrollbar-color: #5c6472 #111318;\n  scrollbar-width: thin;\n}\n\n.vm-scrollbar-dark ::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}\n\n.vm-scrollbar-dark ::-webkit-scrollbar-track {\n  background: #111318;\n}\n\n.vm-scrollbar-dark ::-webkit-scrollbar-thumb {\n  min-height: 48px;\n  border: 2px solid #111318;\n  border-radius: 8px;\n  background: #5c6472;\n}\n\n.vm-scrollbar-dark ::-webkit-scrollbar-thumb:hover {\n  background: #788191;\n}\n";

  // userscripts/scrollbar-dark/src/main.ts
  var scriptId = "scrollbar-dark";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    document.documentElement.classList.add("vm-scrollbar-dark");
    log.debug("style ready", location.href);
  }
  run();
  if (false) {
    installDebugBridge(scriptId, {
      rerun: run,
      state: () => ({
        active: document.documentElement.classList.contains("vm-scrollbar-dark"),
        url: location.href
      }),
      stop: () => document.documentElement.classList.remove("vm-scrollbar-dark")
    });
  }
})();
//# sourceMappingURL=scrollbar-dark.user.js.map
