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
- `main [data-message-author-role]`
- `a[href*="/c/"]`

## Fragile Selectors

- `form.w-full #prompt-textarea`
- `nav.flex:not(#stage-sidebar-tiny-bar)`
- Width and home-cleanup selectors that depend on ChatGPT class names.
- Single-turn display depends on `data-message-author-role` message nodes to split user/assistant turns.

## Required Permissions

- `GM_addStyle` injects the feature panel and layout styles.
- `GM_getValue` and `GM_setValue` store feature toggles and sensitive-content rules locally.
- `GM_xmlhttpRequest` requests `/api/auth/session` on the current ChatGPT host after keep-alive is enabled.
- `unsafeWindow` and `@inject-into page` allow fetch, XHR, and sendBeacon interception in the page context.
- Sidebar time and summary capture reads same-origin JSON response shapes for conversation metadata instead of relying on fixed backend endpoint paths.

## Debug Steps

1. Confirm the current URL matches `https://chatgpt.com/*` or `https://chat.openai.com/*`.
2. Confirm the `增强` entry is mounted as a lower-left floating button outside ChatGPT's sidebar navigation.
3. Confirm keep-alive is disabled by default; enable it and verify `/api/auth/session` polling starts.
4. Change the keep-alive interval, refresh, and confirm the interval persists.
5. Disable keep-alive and confirm session polling stops.
6. Toggle one option, refresh, and confirm the option state persists.
7. Enable single-turn display in a long conversation and confirm the right-side short-line navigator switches between complete conversation turns.
8. Check DevTools for runtime errors if ChatGPT changes selectors.

## Known Breakage Points

- ChatGPT DOM class names and prompt/sidebar selectors change often.
- Do not mount custom controls inside ChatGPT's React-managed sidebar navigation; it can cause hydration recovery loops.
- Sidebar history metadata must be decorated only after page load, not during initial React hydration.
- ChatGPT history response shapes can change, which may affect sidebar summaries.
- Single-turn display groups turns by `data-message-author-role` and rebuilds the turn model from current DOM; if ChatGPT changes message role attributes, the performance mode needs selector review.

## Last Verified

2026-07-06
