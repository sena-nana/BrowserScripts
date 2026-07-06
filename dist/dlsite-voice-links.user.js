// ==UserScript==
// @name        DLsite Voice Links
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Link RJ/VJ codes and add explicit DLsite to ASMR navigation on related sites.
// @match       https://www.dlsite.com/*
// @match       https://ci-en.dlsite.com/*
// @match       https://media.ci-en.jp/*
// @match       https://asmr.one/*
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

  // userscripts/dlsite-voice-links/src/voice-parser.ts
  var workCodePattern = /\b(?:R[JE]|VJ|BJ)\d{6,8}\b/gi;
  function findWorkCodes(text) {
    const seen = /* @__PURE__ */ new Set();
    const codes = [];
    for (const match of text.matchAll(workCodePattern)) {
      const code = match[0].toUpperCase();
      if (seen.has(code)) {
        continue;
      }
      seen.add(code);
      const item = {
        code,
        dlsiteUrl: toDlsiteUrl(code)
      };
      if (code.startsWith("RJ")) {
        item.asmrUrl = `https://asmr.one/work/${code}`;
      }
      codes.push(item);
    }
    return codes;
  }
  function toDlsiteUrl(code) {
    return `https://www.dlsite.com/maniax/work/=/product_id/${code.toUpperCase()}.html`;
  }

  // userscripts/dlsite-voice-links/src/style.css
  var style_default = ".vm-dlsite-voice-links-actions {\n  display: flex;\n  gap: 8px;\n  margin: 10px 0;\n}\n\n.vm-dlsite-voice-links-actions a,\n.vm-dlsite-voice-link {\n  border-bottom: 1px solid currentcolor;\n  color: #b45f06 !important;\n  font-weight: 600;\n  text-decoration: none;\n}\n\n.vm-dlsite-voice-links-actions a {\n  border: 1px solid #d7a25a;\n  border-radius: 6px;\n  padding: 5px 9px;\n  background: #fff8ec;\n}\n";

  // userscripts/dlsite-voice-links/src/main.ts
  var scriptId = "dlsite-voice-links";
  var log = createLogger(scriptId, { debug: false });
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    renderWorkActions();
    linkifyVisibleCodes();
    log.debug("route ready", location.href);
  }
  function renderWorkActions() {
    if (!location.hostname.endsWith("dlsite.com")) {
      return;
    }
    const code = findWorkCodes(location.href)[0] ?? findWorkCodes(document.title)[0];
    if (!code?.asmrUrl || document.getElementById("vm-dlsite-voice-links-actions")) {
      return;
    }
    const host = document.querySelector("#work_name, h1")?.parentElement ?? document.body;
    const panel = ensureElement("div", {
      id: "vm-dlsite-voice-links-actions",
      className: "vm-dlsite-voice-links-actions",
      parent: host
    });
    const link = document.createElement("a");
    link.href = code.asmrUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "ASMR";
    panel.replaceChildren(link);
  }
  function linkifyVisibleCodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("a, script, style, textarea, input, .vm-dlsite-voice-link")) {
          return NodeFilter.FILTER_REJECT;
        }
        return findWorkCodes(node.nodeValue ?? "").length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNodes = [];
    while (textNodes.length < 80) {
      const node = walker.nextNode();
      if (!node) {
        break;
      }
      textNodes.push(node);
    }
    for (const node of textNodes) {
      const text = node.nodeValue ?? "";
      const codes = findWorkCodes(text);
      if (!codes.length) {
        continue;
      }
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const item of codes) {
        const index = text.toUpperCase().indexOf(item.code, cursor);
        if (index < 0) {
          continue;
        }
        fragment.append(document.createTextNode(text.slice(cursor, index)));
        const link = document.createElement("a");
        link.className = "vm-dlsite-voice-link";
        link.href = item.dlsiteUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.code;
        fragment.append(link);
        cursor = index + item.code.length;
      }
      fragment.append(document.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
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
//# sourceMappingURL=dlsite-voice-links.user.js.map
