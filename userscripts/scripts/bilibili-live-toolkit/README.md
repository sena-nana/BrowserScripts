# Bilibili Live Toolkit

Lightweight Bilibili live-room helper migrated from the reference live scripts.

## Target

- `https://live.bilibili.com/*`

## Features

- Hides common live-room clutter.
- Shows a compact room summary from Bilibili's live room API, including public room stats when available.
- Provides an opt-in catch-up toggle that seeks the video close to the buffered live edge.

## Permissions

- `GM_addStyle`: inject cleanup and panel styles.
- `GM_getValue` / `GM_setValue`: store the catch-up toggle.
- `GM_xmlhttpRequest`: read public live room summary from `api.live.bilibili.com`.

## Reference Scripts

- `Bilibili Live Tasks Helper.user.js`
- `Bilibili直播自动追帧.user.js`
- `bilibili直播间显示更多信息.user.js`
- `Bilibili Evolved 强化辅助 (非 Bilibili Evolved 本体).user.js`

## Manual Verification

1. Build and install `dist/bilibili-live-toolkit.user.js`.
2. Open a Bilibili live room and confirm the floating panel appears.
3. Toggle catch-up and confirm the state persists after refresh.
4. Confirm no task automation or account action runs automatically.
