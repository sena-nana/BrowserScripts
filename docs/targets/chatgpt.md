# ChatGPT Userscript Notes

## Scope

`chatgpt-practical-enhancer` runs on ChatGPT web pages and chat.openai.com legacy URLs.

## Known URL Patterns

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- Conversation pages currently use `/c/<conversation-id>`.

## SPA Behavior

ChatGPT is a single-page app. The script binds idempotently on DOM mutations instead of assuming a full page reload after navigation.

## Stable Selectors

- `main div[data-message-author-role="user"]`
- `main [data-message-author-role="assistant"]`
- `a[href*="/c/"]`

## Fragile Selectors

- `form.w-full #prompt-textarea`
- `nav.flex:not(#stage-sidebar-tiny-bar)`
- Width and home-cleanup selectors that depend on ChatGPT class names.

## Required Permissions

- `GM_addStyle` injects the feature panel and layout styles.
- `GM_getValue` and `GM_setValue` store feature toggles and sensitive-content rules locally.
- `GM_xmlhttpRequest` requests `/api/auth/session` on the current ChatGPT host for keep-alive.
- `unsafeWindow` and `@inject-into page` allow fetch, XHR, and sendBeacon interception in the page context.

## Debug Steps

1. Confirm the current URL matches `https://chatgpt.com/*` or `https://chat.openai.com/*`.
2. Confirm the `增强` entry is mounted in the sidebar or as a lower-left floating button.
3. Toggle one option, refresh, and confirm the option state persists.
4. Check DevTools for runtime errors if ChatGPT changes selectors.

## Known Breakage Points

- ChatGPT DOM class names and prompt/sidebar selectors change often.
- Backend conversation endpoints can change shape, which may affect sidebar summaries.

## Last Verified

2026-07-03
