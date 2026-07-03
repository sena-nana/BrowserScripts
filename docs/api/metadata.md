# Metadata

Every emitted userscript must start with:

```js
// ==UserScript==
// @name        Example
// @namespace   https://github.com/wangjunxue/BrowserScripts
// @version     0.1.0
// @description Example userscript
// @match       https://example.com/*
// @grant       none
// ==/UserScript==
```

Rules:

- Metadata must be first byte content in the file.
- Prefer `@match` over `@include`.
- Use narrow URL patterns.
- Always set `@version`.
- Use `@grant none` only when no GM API is needed.
- Add explicit `@grant` lines for every GM API.
- Add `@noframes` unless iframe execution is required.
- Use `@inject-into page` only for page global access.

This repository stores metadata in `userscripts/<id>/meta.ts` and emits the block during `pnpm build`.
