# AGENTS.md

## Repository Purpose

This Git repository aggregates independently managed browser projects.

## Project Boundaries

- `userscripts/` is the independent Violentmonkey/userscript Yarn monorepo.
- `extensions/<extension-id>/` contains one independent Yarn monorepo per CRX extension.
- The Git root is not a package-manager workspace and has no unified Yarn commands.
- Run commands from the target monorepo root.
- Before changing a project, read the more specific `AGENTS.md` in that target directory.
- Every monorepo owns its `package.json`, `yarn.lock`, `.yarnrc.yml`, and workspace configuration.
- Do not add `workspace:*` dependencies across monorepo boundaries.

Userscript-specific metadata, GM API, DOM/SPA, build, and documentation rules live only in `userscripts/AGENTS.md`.

## Cross-Project Safety

- Do not collect, log, transmit, or persist sensitive user data unless explicitly requested.
- Do not scrape private tokens, cookies, local-storage credentials, account secrets, or payment data.
- Do not bypass paywalls, access controls, CAPTCHAs, anti-cheat systems, or account restrictions.
- Do not automate destructive website actions without explicit user confirmation.
- Do not inject unpinned remote scripts.
- Do not put technical implementation notes in website UI.
- Do not add controls that appear functional unless their behavior is fully wired.
- Add tests only for observable behavior; do not add low-value tests that match source text, logs, or static strings.
