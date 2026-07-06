// ==UserScript==
// @name        Bilibili Live Toolkit
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Bilibili live room cleanup, room info, and opt-in playback catch-up helpers.
// @match       https://live.bilibili.com/*
// @run-at      document-end
// @inject-into auto
// @noframes
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @connect     api.live.bilibili.com
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

  // packages/vm-kit/src/network.ts
  function gmRequest(options) {
    const request = globalThis.GM_xmlhttpRequest;
    if (typeof request !== "function") {
      return Promise.reject(new Error("GM_xmlhttpRequest is not available"));
    }
    return new Promise((resolve, reject) => {
      const details = {
        method: options.method ?? "GET",
        url: options.url,
        onload: (response) => {
          resolve({
            status: response.status,
            response: response.response,
            responseText: response.responseText ?? "",
            finalUrl: response.finalUrl ?? options.url
          });
        },
        onerror: (error) => reject(error),
        ontimeout: () => reject(new Error(`GM_xmlhttpRequest timed out: ${options.url}`))
      };
      if (options.headers) {
        details.headers = options.headers;
      }
      if (options.data) {
        details.data = options.data;
      }
      if (options.timeout !== void 0) {
        details.timeout = options.timeout;
      }
      if (options.responseType !== void 0) {
        details.responseType = options.responseType;
      }
      request(details);
    });
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
  function ensureFloatingPanel(options) {
    injectVmKitUiStyle();
    const existing = document.getElementById(options.id);
    if (existing instanceof HTMLDivElement) {
      return existing;
    }
    const panel = document.createElement("div");
    panel.id = options.id;
    panel.className = ["vm-kit-floating-panel", options.className].filter(Boolean).join(" ");
    (options.parent ?? document.body).append(panel);
    return panel;
  }

  // userscripts/bilibili-live-toolkit/src/style.css
  var style_default = ".web-player-icon-roomStatus,\n.gift-panel,\n.shop-popover,\n.pk-process,\n.live-skin-normal-a-text,\n.flip-view,\n.game-party-panel,\n.combo-card,\n.header-info-ctnr .right-ctnr,\n.room-bg,\n.ad-banner {\n  display: none !important;\n}\n\n.vm-bilibili-live-toolkit {\n  border: 1px solid rgb(255 255 255 / 28%);\n  background: rgb(24 24 27 / 88%);\n  color: #fff;\n}\n\n.vm-bilibili-live-toolkit-title {\n  font-weight: 700;\n}\n\n.vm-bilibili-live-toolkit-info {\n  overflow: hidden;\n  color: rgb(255 255 255 / 76%);\n  white-space: pre-line;\n}\n\n.vm-bilibili-live-toolkit button {\n  border: 1px solid rgb(255 255 255 / 20%);\n  background: rgb(255 255 255 / 12%);\n  color: inherit;\n}\n";

  // userscripts/bilibili-live-toolkit/src/main.ts
  var scriptId = "bilibili-live-toolkit";
  var log = createLogger(scriptId, { debug: false });
  var autoSeekKey = `${scriptId}:auto-seek`;
  var seekTimer;
  function run() {
    injectStyle(style_default, `vm-${scriptId}-style`);
    renderPanel();
    syncAutoSeek();
    log.debug("route ready", location.href);
  }
  function getRoomId() {
    const match = location.pathname.match(/^\/(?:blanc\/)?(\d+)/);
    return match?.[1] ?? null;
  }
  function renderPanel() {
    const roomId = getRoomId();
    if (!roomId) {
      return;
    }
    const panel = ensureFloatingPanel({
      id: "vm-bilibili-live-toolkit",
      className: "vm-bilibili-live-toolkit"
    });
    const title = document.createElement("div");
    title.className = "vm-bilibili-live-toolkit-title";
    title.textContent = `\u76F4\u64AD\u95F4 ${roomId}`;
    const info = document.createElement("div");
    info.className = "vm-bilibili-live-toolkit-info";
    info.textContent = "\u52A0\u8F7D\u4E2D";
    const seekToggle = document.createElement("button");
    seekToggle.type = "button";
    seekToggle.textContent = isAutoSeekEnabled() ? "\u8FFD\u5E27\u5F00" : "\u8FFD\u5E27\u5173";
    seekToggle.addEventListener("click", () => {
      GM_setValue(autoSeekKey, !isAutoSeekEnabled());
      syncAutoSeek();
      seekToggle.textContent = isAutoSeekEnabled() ? "\u8FFD\u5E27\u5F00" : "\u8FFD\u5E27\u5173";
    });
    panel.replaceChildren(title, info, seekToggle);
    loadRoomInfo(roomId, info);
  }
  async function loadRoomInfo(roomId, target) {
    try {
      const response = await gmRequest({
        method: "GET",
        url: `https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${encodeURIComponent(roomId)}`,
        responseType: "json"
      });
      const data = response.response?.data;
      const room = data?.room_info;
      const anchor = data?.anchor_info?.base_info;
      const title = [anchor?.uname, room?.title].filter(Boolean).join(" - ");
      const stats = [
        room?.area_name,
        formatCount(room?.online ?? data?.watched_show?.num),
        data?.watched_show?.text_small
      ].filter(Boolean);
      target.textContent = [title || "\u5DF2\u8FDE\u63A5", stats.join(" / ")].filter(Boolean).join("\n");
    } catch {
      target.textContent = "\u4FE1\u606F\u52A0\u8F7D\u5931\u8D25";
    }
  }
  function formatCount(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return void 0;
    }
    if (value >= 1e4) {
      return `${(value / 1e4).toFixed(1)}\u4E07`;
    }
    return `${value}`;
  }
  function isAutoSeekEnabled() {
    return Boolean(GM_getValue(autoSeekKey, false));
  }
  function syncAutoSeek() {
    if (seekTimer !== void 0) {
      window.clearInterval(seekTimer);
      seekTimer = void 0;
    }
    if (!isAutoSeekEnabled()) {
      return;
    }
    seekTimer = window.setInterval(catchUpVideo, 3e3);
    catchUpVideo();
  }
  function catchUpVideo() {
    const video = document.querySelector("video");
    if (!video || video.buffered.length === 0) {
      return;
    }
    const liveEdge = video.buffered.end(video.buffered.length - 1);
    if (Number.isFinite(liveEdge) && liveEdge - video.currentTime > 8) {
      video.currentTime = Math.max(video.currentTime, liveEdge - 2);
    }
  }
  var stopUrlWatcher = onUrlChange(() => run());
  if (false) {
    installDebugBridge(scriptId, {
      rerun: run,
      state: () => ({
        autoSeek: isAutoSeekEnabled(),
        roomId: getRoomId(),
        url: location.href
      }),
      stop: () => {
        stopUrlWatcher();
        if (seekTimer !== void 0) {
          window.clearInterval(seekTimer);
        }
      }
    });
  }
})();
//# sourceMappingURL=bilibili-live-toolkit.user.js.map
