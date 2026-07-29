# BrowserScripts

A single Git repository for independently managed browser projects.

## Layout

- [`userscripts/`](userscripts/README.md): an independent Yarn monorepo for Violentmonkey userscripts.
- `extensions/<extension-id>/`: one independent Yarn monorepo per CRX extension.

## Userscript commands

Run userscript commands from the userscript monorepo root:

```bash
cd userscripts
yarn install
yarn build
yarn typecheck
yarn lint
```

Do not run a unified Yarn command from the Git root.

## Monorepo boundaries

Each project monorepo owns its `package.json`, `yarn.lock`, `.yarnrc.yml`, and workspace configuration. The Git root has no `package.json`, `yarn.lock`, root workspace, or cross-monorepo `workspace:*` dependencies. Extensions are likewise isolated from one another and from `userscripts/`.
