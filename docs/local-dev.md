# Local Development

## Install

```bash
pnpm install
```

## Build

```bash
pnpm build
pnpm build example
```

Build output goes to `dist/<script-id>.user.js` and `dist/<script-id>.user.js.map`.

## Develop

```bash
pnpm dev example
```

The dev server watches the selected userscript and shared packages, rebuilds on change, serves `dist/`, and prints a localhost install URL.

Install the localhost `.user.js` URL in Violentmonkey. This avoids broad local file access in browser profiles used for normal browsing.

## Create a Script

```bash
pnpm new my-script
```

Then update:

- `userscripts/my-script/meta.ts`
- `userscripts/my-script/README.md`
- root `README.md`
- `docs/targets/<site>.md` when the target site needs notes

## Verify

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm check:meta
```
