// ==UserScript==
// @name        Font Rendering Tuner
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Adjust browser font rendering with local menu settings and explicit site exclusions.
// @match       http://*/*
// @match       https://*/*
// @exclude-match https://*.bilibili.com/*
// @exclude-match https://www.zhihu.com/*
// @exclude-match https://zhuanlan.zhihu.com/*
// @run-at      document-start
// @inject-into auto
// @noframes
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
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

  // userscripts/font-rendering-tuner/src/style.css
  var style_default = ".vm-font-rendering-tuner-active body,\n.vm-font-rendering-tuner-active button,\n.vm-font-rendering-tuner-active input,\n.vm-font-rendering-tuner-active textarea,\n.vm-font-rendering-tuner-active select {\n  font-family: var(--vm-font-rendering-family) !important;\n  font-size-adjust: var(--vm-font-rendering-scale);\n  -webkit-font-smoothing: antialiased;\n  text-rendering: optimizelegibility;\n}\n\n.vm-font-rendering-tuner-active pre,\n.vm-font-rendering-tuner-active code,\n.vm-font-rendering-tuner-active kbd,\n.vm-font-rendering-tuner-active samp {\n  font-family:\n    ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace !important;\n}\n";

  // userscripts/font-rendering-tuner/src/main.ts
  var scriptId = "font-rendering-tuner";
  var log = createLogger(scriptId, { debug: false });
  var enabledKey = `${scriptId}:enabled`;
  var fontKey = `${scriptId}:font`;
  var scaleKey = `${scriptId}:scale`;
  function getEnabled() {
    return GM_getValue(enabledKey, true) === true;
  }
  function getFont() {
    return String(GM_getValue(fontKey, "Microsoft YaHei, system-ui, sans-serif"));
  }
  function getScale() {
    return Math.min(1.12, Math.max(0.92, Number(GM_getValue(scaleKey, 1)) || 1));
  }
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    document.documentElement.classList.toggle("vm-font-rendering-tuner-active", getEnabled());
    document.documentElement.style.setProperty("--vm-font-rendering-family", getFont());
    document.documentElement.style.setProperty("--vm-font-rendering-scale", String(getScale()));
    log.debug("style ready", location.href);
  }
  function registerMenu() {
    GM_registerMenuCommand(`${getEnabled() ? "Disable" : "Enable"} font rendering`, () => {
      GM_setValue(enabledKey, !getEnabled());
      run();
    });
    GM_registerMenuCommand("Use Microsoft YaHei", () => {
      GM_setValue(fontKey, "Microsoft YaHei, system-ui, sans-serif");
      run();
    });
    GM_registerMenuCommand("Use system font", () => {
      GM_setValue(fontKey, "system-ui, sans-serif");
      run();
    });
    GM_registerMenuCommand("Set custom font", () => {
      const next = window.prompt("Font family", getFont());
      if (!next?.trim()) {
        return;
      }
      GM_setValue(fontKey, next.trim());
      run();
    });
    GM_registerMenuCommand("Set font scale", () => {
      const next = window.prompt("Scale between 0.92 and 1.12", String(getScale()));
      const value = Number(next);
      if (!Number.isFinite(value)) {
        return;
      }
      GM_setValue(scaleKey, Math.min(1.12, Math.max(0.92, value)));
      run();
    });
    GM_registerMenuCommand("Reset font scale", () => {
      GM_setValue(scaleKey, 1);
      run();
    });
  }
  run();
  registerMenu();
  if (false) {
    installDebugBridge(scriptId, {
      rerun: run,
      state: () => ({
        enabled: getEnabled(),
        font: getFont(),
        scale: getScale(),
        url: location.href
      }),
      stop: () => document.documentElement.classList.remove("vm-font-rendering-tuner-active")
    });
  }
})();
//# sourceMappingURL=font-rendering-tuner.user.js.map
