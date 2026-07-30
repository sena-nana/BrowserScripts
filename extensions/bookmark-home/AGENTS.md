# Bookmark Home

## Project Boundary

- This directory is an independent Yarn 4 monorepo.
- Run every command from this directory.
- `packages/extension/` owns the Manifest V3 extension source and unpacked `dist/`.
- Do not add dependencies on the repository-level userscript workspace.

## Architecture

- Keep the runtime framework-free and split code by responsibility.
- Browser API access belongs behind repository/provider interfaces.
- The new-tab page is the only extension surface. Do not add content scripts, a browser side panel, or page injection.
- Settings are versioned and sanitized before use.
- Bookmark rendering must stay windowed; do not render the entire bookmark tree.

## Verification

Run:

```bash
yarn verify
yarn perf
yarn e2e
```

Tests must assert observable behavior. Do not add tests that match source code, logs, or static implementation strings.
