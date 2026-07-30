# Extensions

Independently managed CRX extensions live here.

## Projects

- [`bookmark-home/`](bookmark-home/README.md): Chrome Manifest V3 transparent new-tab home with a windowed bookmark tree and search.

## Extension contract

Each direct child of `extensions/` must:

- use a kebab-case directory name such as `extensions/example-extension/`;
- be an independent Yarn monorepo;
- set `private: true` in its root `package.json`;
- declare a non-empty `workspaces` configuration;
- own its `package.json`, `yarn.lock`, and `.yarnrc.yml`;
- run install, build, test, and release commands from that extension's root.

Extensions must not use `workspace:*` dependencies across extension boundaries or between an extension and `userscripts/`.
