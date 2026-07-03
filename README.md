# BrowserScripts

Personal Violentmonkey / userscript collection.

This repository keeps each userscript in its own directory, shares common helpers through local packages, and emits installable files to `dist/*.user.js`.

## Scripts

| ID        | Target                  | Output                 |
| --------- | ----------------------- | ---------------------- |
| `example` | `https://example.com/*` | `dist/example.user.js` |

## Commands

```bash
pnpm install
pnpm build
pnpm dev example
pnpm check:meta
pnpm typecheck
pnpm lint
pnpm format:check
pnpm new my-script
```

`pnpm dev <script-id>` watches the script source, rebuilds `dist/<script-id>.user.js`, serves `dist/` over localhost, and prints the install URL for Violentmonkey.

## Layout

```txt
userscripts/<id>/        one userscript project
userscripts/_template/   starter copied by pnpm new
packages/vm-kit/         shared runtime helpers
packages/build-kit/      build and metadata helpers
dist/                    generated installable userscripts
docs/                    local quick references and debugging notes
skills/                  agent workflow instructions
tools/                   repository commands
```

## Local Install

1. Run `pnpm dev example`.
2. Open the printed `http://127.0.0.1:<port>/example.user.js` URL in a browser with Violentmonkey.
3. Install or update the script.
4. Visit `https://example.com/`.

Firefox, Edge, Brave, or compatible Chromium browsers are the primary debug targets. Chrome support depends on the extension/runtime state in your browser profile.

## Rules

- Edit source under `userscripts/<id>/src/`; do not edit `dist/*.user.js` manually.
- Keep metadata narrow and explicit.
- Prefer local docs under `docs/` before remote references.
- Add functional tests only when they verify real behavior.
