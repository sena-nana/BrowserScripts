# Extensions

Future CRX extensions live here. No extension scaffold is created until a real extension defines its manifest, browser targets, build tooling, and internal workspace split.

## Extension contract

Each direct child of `extensions/` must:

- use a kebab-case directory name such as `extensions/example-extension/`;
- be an independent Yarn monorepo;
- set `private: true` in its root `package.json`;
- declare a non-empty `workspaces` configuration;
- own its `package.json`, `yarn.lock`, and `.yarnrc.yml`;
- run install, build, test, and release commands from that extension's root.

Extensions must not use `workspace:*` dependencies across extension boundaries or between an extension and `userscripts/`.
