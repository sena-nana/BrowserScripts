# Bilibili Userscript Notes

## Scope

`bilibili-live-toolkit`, `bilibili-space-manager`, and `bilibili-site-toolkit` cover live rooms, user spaces, dynamic pages, and video pages.

## Known URL Patterns

- `https://live.bilibili.com/*`
- `https://space.bilibili.com/*`
- `https://www.bilibili.com/*`
- `https://t.bilibili.com/*`

## SPA Behavior

Bilibili pages may update content without full reloads. Scripts use idempotent reruns and DOM queries instead of fixed one-shot timers.

## Fragile Selectors

- Live room clutter selectors such as `.gift-panel`, `.pk-process`, `.combo-card`.
- Space/favorite title selectors such as `.bili-video-card__info--tit`, `.fav-video-list .title`.
- Video page side content selectors such as `.right-container` and `.recommend-list-v1`.

## Required Permissions

- `GM_addStyle` for layout cleanup and floating controls.
- `GM_xmlhttpRequest` only for Bilibili public room/relation summary endpoints.
- `GM_getValue` / `GM_setValue` for live catch-up preference.
- `GM_setClipboard` for explicit copy actions.

## Debug Steps

1. Visit a target Bilibili URL and confirm the script's match applies.
2. For live rooms, confirm the floating panel appears and the catch-up toggle changes state.
3. For space pages, confirm UID copy and visible-item copy are user-triggered.
4. Confirm no delete, unfollow, or bulk action is performed automatically.

## Last Verified

2026-07-06
