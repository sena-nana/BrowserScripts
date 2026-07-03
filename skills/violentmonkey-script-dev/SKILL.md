# Violentmonkey Script Development Skill

## Purpose

Use this skill when creating, modifying, debugging, reviewing, or documenting userscript code in this repository.

The goal is to produce small, maintainable, installable `.user.js` scripts with correct metadata, narrow permissions, local documentation, and repeatable browser debugging steps.

## Read First

Read these local files before making changes:

1. `AGENTS.md`
2. `docs/index.md`
3. `docs/api/quick-reference.md`
4. `docs/browser-debug.md`
5. `docs/local-dev.md`
6. relevant `docs/targets/<site>.md`
7. relevant `userscripts/<script-id>/README.md`

If local docs are incomplete, check the remote docs listed in `docs/remote-docs.md`.

## Workflow

Create a script:

```bash
pnpm new <script-id>
```

Build:

```bash
pnpm build <script-id>
```

Develop locally:

```bash
pnpm dev <script-id>
```

Verify:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm check:meta
```

## Metadata Checklist

- `@name`
- `@namespace`
- `@version`
- `@description`
- `@match`
- `@grant`
- `@run-at`
- `@noframes` when iframe support is unnecessary
- `@downloadURL` only when a stable install URL exists
- `@supportURL` when issue reporting exists
- `@homepageURL` when project documentation exists

## Runtime Rules

- Keep permissions narrow.
- Use explicit grants.
- Prefer DOM helpers over fixed delays.
- Handle SPA navigation explicitly.
- Do not expose debug bridges in release builds.
- Do not collect sensitive user data unless explicitly requested.
- Do not add tests that only match logs or static strings.
