# AGENTS.md

## Repository Purpose

This repository is a collection of Violentmonkey / userscript scripts.

It contains:

- source code for each userscript
- shared userscript utilities
- build scripts that emit single-file `.user.js` outputs
- local API quick references
- target-site debugging notes
- browser debugging recipes
- skill instructions for agents working on userscript tasks

## Source of Truth

Use these local files first:

1. `docs/index.md`
2. `docs/api/quick-reference.md`
3. `docs/api/metadata.md`
4. `docs/api/gm.md`
5. `docs/browser-debug.md`
6. `docs/local-dev.md`
7. `docs/remote-docs.md`
8. target-specific notes under `docs/targets/`

Use remote documentation only when the local docs are missing, stale, or ambiguous.

## Repository Layout

- `userscripts/<id>/` contains one userscript project.
- `userscripts/_template/` is the template for new scripts.
- `packages/vm-kit/` contains shared runtime helpers.
- `packages/build-kit/` contains shared build and metadata helpers.
- `dist/` contains generated `.user.js` install files.
- `docs/api/` contains local API quick references.
- `docs/targets/` contains target-site notes and selectors.
- `tools/` contains repository maintenance scripts.
- `skills/violentmonkey-script-dev/SKILL.md` contains operational workflow notes.

## Hard Rules

### Metadata

Every emitted userscript must start with a valid metadata block:

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

- The metadata block must be the first content in the emitted `.user.js`.
- Do not add text, imports, comments, or license headers before metadata.
- Prefer `@match` over `@include`.
- Use the narrowest possible `@match`.
- Do not use `*://*/*` unless the user explicitly wants a global script.
- Always set `@version`.
- Keep `@namespace` stable.
- Keep `@name` and `@namespace` unique as a pair.
- Add `@noframes` unless the script intentionally runs in iframes.
- Use `@grant none` only when no privileged GM API is needed.
- If any GM API is used, grant it explicitly.
- Use `@inject-into page` only when page JavaScript globals must be accessed.
- Prefer `@inject-into auto` or `content` for DOM-only scripts.

### Build Output

- Do not edit `dist/*.user.js` manually.
- Modify source under `userscripts/<id>/src/`.
- Build output must be a single installable `.user.js`.
- If TypeScript, CSS, or ES modules are used, bundle them before emitting.
- Development builds may include sourcemaps.
- Release builds should be deterministic and reproducible.

### Runtime Safety

- Do not collect, log, transmit, or persist sensitive user data unless the user explicitly asks.
- Do not scrape private tokens, cookies, localStorage credentials, account secrets, or payment data.
- Do not bypass paywalls, access controls, CAPTCHAs, anti-cheat, or account restrictions.
- Do not automate destructive actions on websites without explicit confirmation from the user.
- Keep cross-origin requests narrow and documented.
- Avoid injecting third-party remote scripts with `@require` unless the dependency is version-pinned and necessary.
- Do not use unpinned CDN URLs for release builds.
- Do not expose debug helpers on `window` in release builds.

### DOM and SPA Handling

- Do not rely only on fixed `setTimeout` for dynamic DOM.
- Prefer `MutationObserver` or shared helpers from `packages/vm-kit/src/dom.ts`.
- Disconnect observers when the target is found or when no longer needed.
- For SPA sites, handle soft navigation explicitly.
- Do not assume the userscript reruns after `history.pushState`, `replaceState`, or hash-only navigation.
- Keep selectors documented in `docs/targets/<site>.md` when they are fragile.

### UI and Tests

- Do not show technical implementation notes inside website UI.
- Do not add UI controls that look functional unless the behavior is fully wired.
- Fix root causes, not surface symptoms.
- Add tests only when they verify behavior; do not add string-matching or low-value placeholder tests.

## New Userscript Procedure

When creating a new userscript:

1. Run `yarn new <script-id>`.
2. Update `userscripts/<script-id>/meta.ts`.
3. Add a short README for the script.
4. Add target-site notes under `docs/targets/` if the site is new.
5. Add or update local API notes if a new GM API pattern is introduced.
6. Build and confirm `dist/<script-id>.user.js` starts with metadata.
7. Add the script to the root README index.

## Verification

Before finishing a code change, run:

```bash
yarn typecheck
yarn lint
yarn build
yarn check:meta
```

If a smoke test exists for the changed script, run it. If no smoke test exists, provide a manual verification checklist in the final response or PR notes.
