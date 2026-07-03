# Userscript Quick Reference

| Need                 | API / Metadata                               | Notes                                                     |
| -------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Inject CSS           | `GM_addStyle(css)` or DOM style node         | Grant `GM_addStyle` only when needed                      |
| Add DOM nodes        | DOM API                                      | Prefer native DOM unless privileged insertion is required |
| Save config          | `GM_getValue`, `GM_setValue`                 | Values must be serializable                               |
| Menu command         | `GM_registerMenuCommand`                     | Useful for toggles and low-frequency actions              |
| Notification         | `GM_notification`                            | Keep user-facing noise low                                |
| Cross-origin request | `GM_xmlhttpRequest`                          | Grant explicitly and keep destinations narrow             |
| Resource text        | `GM_getResourceText`                         | Pair with `@resource`                                     |
| Resource URL         | `GM_getResourceURL`                          | Pair with `@resource`                                     |
| New tab              | `GM_openInTab`                               | Browser behavior can differ                               |
| Page globals         | `unsafeWindow`, `@inject-into page`          | Use only when DOM access is insufficient                  |
| Dynamic DOM          | `MutationObserver`, `observeElement`         | Disconnect when done                                      |
| SPA route changes    | Navigation API, history events, DOM fallback | Soft navigation does not rerun scripts                    |

Metadata must be the first content in the emitted `.user.js`. Prefer `@match` over `@include`, always set `@version`, and use explicit grants.
