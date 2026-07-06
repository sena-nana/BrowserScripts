# BrowserScripts Docs

Use these notes before reaching for remote documentation.

## Start Here

- `docs/local-dev.md`: repository commands and local install flow
- `docs/browser-debug.md`: browser debugging checklist
- `docs/api/quick-reference.md`: common metadata and GM API choices
- `docs/remote-docs.md`: official docs index
- `docs/migration-index.md`: mapping from imported reference scripts to maintained userscripts
- `docs/migration-gap-audit.md`: necessary-feature audit and intentionally skipped high-risk behavior

## Local API Notes

- `docs/api/metadata.md`: metadata block rules
- `docs/api/gm.md`: privileged API usage
- `docs/api/matching.md`: URL matching and SPA caveats
- `docs/api/dom-observer.md`: DOM observation patterns
- `docs/api/spa-navigation.md`: soft navigation handling
- `docs/api/inject-context.md`: page/content context decisions

## Target Notes

Create one file under `docs/targets/` for every site with fragile selectors, non-obvious SPA behavior, or permissions that deserve explanation.
