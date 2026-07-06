// ==UserScript==
// @name        Tieba Cleaner
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Simplify Tieba reading pages and reduce ads, sidebars, and login prompts.
// @match       https://tieba.baidu.com/*
// @match       https://dq.tieba.com/*
// @match       https://jump.bdimg.com/*
// @match       https://jump2.bdimg.com/*
// @exclude-match https://tieba.baidu.com/f/fdir*
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

  // userscripts/tieba-cleaner/src/style.css
  var style_default = ".right_section,\n.aside,\n.j_click_stats,\n.app_download_box,\n.tbui_aside_float_bar,\n.celebrity,\n.game_wrapper,\n.spreadad,\n.forum_recommend,\n.p_postlist .tail-info,\n.thread_theme_7,\n.fengchao-wrap,\n.dialogJ,\n.login-dialog,\n.poster_head,\n.pb_footer {\n  display: none !important;\n}\n\n.vm-tieba-thread #content,\n.vm-tieba-thread .wrap1,\n.vm-tieba-thread .pb_content {\n  width: min(980px, calc(100vw - 32px)) !important;\n}\n\n.l_post,\n.d_post_content_main {\n  margin-right: 0 !important;\n}\n\n#vm-tieba-reverse-posts {\n  color: #24292f;\n}\n";

  // userscripts/tieba-cleaner/src/main.ts
  var scriptId = "tieba-cleaner";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    document.documentElement.classList.toggle("vm-tieba-thread", location.pathname.startsWith("/p/"));
    renderReverseButton();
    log.debug("route ready", location.href);
  }
  function renderReverseButton() {
    if (!location.pathname.startsWith("/p/") || document.getElementById("vm-tieba-reverse-posts")) {
      return;
    }
    const button = createButton({
      label: "\u5012\u5E8F",
      onClick: reverseVisiblePosts
    });
    button.id = "vm-tieba-reverse-posts";
    button.classList.add("vm-kit-floating-button");
    document.body.append(button);
  }
  function reverseVisiblePosts() {
    const list = document.querySelector("#j_p_postlist, .p_postlist");
    if (!list) {
      window.alert("\u672A\u627E\u5230\u5E16\u5B50\u5217\u8868");
      return;
    }
    const posts = [...list.querySelectorAll(".l_post, .j_l_post")];
    for (const post of posts.reverse()) {
      list.append(post);
    }
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
//# sourceMappingURL=tieba-cleaner.user.js.map
