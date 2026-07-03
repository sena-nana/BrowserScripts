# GM APIs

Prefer native browser APIs when they are enough. Use GM APIs for privileged userscript capabilities and grant each API explicitly.

Common APIs:

- `GM_addStyle`: inject CSS through the manager.
- `GM_getValue` / `GM_setValue`: persistent values.
- `GM_registerMenuCommand`: menu actions.
- `GM_notification`: user notifications.
- `GM_xmlhttpRequest`: cross-origin requests.
- `GM_getResourceText` / `GM_getResourceURL`: bundled resources.
- `GM_openInTab`: open tabs.
- `GM_setClipboard`: clipboard writes.

Cross-origin requests and persistent storage should be documented in the script README when they affect user data or external services.
