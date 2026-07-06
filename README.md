# BrowserScripts

Personal Violentmonkey / userscript collection.

This repository keeps each userscript in its own directory, shares common helpers through local packages, and emits installable files to `dist/*.user.js`.

## Scripts

| ID                           | Target                  | Output                                    |
| ---------------------------- | ----------------------- | ----------------------------------------- |
| `baidu-cleaner`              | `https://*.baidu.com/*` | `dist/baidu-cleaner.user.js`              |
| `bilibili-live-toolkit`      | Bilibili live rooms     | `dist/bilibili-live-toolkit.user.js`      |
| `bilibili-site-toolkit`      | Bilibili site pages     | `dist/bilibili-site-toolkit.user.js`      |
| `bilibili-space-manager`     | Bilibili space pages    | `dist/bilibili-space-manager.user.js`     |
| `chatgpt-practical-enhancer` | `https://chatgpt.com/*` | `dist/chatgpt-practical-enhancer.user.js` |
| `csdn-reader-cleaner`        | `https://*.csdn.net/*`  | `dist/csdn-reader-cleaner.user.js`        |
| `dlsite-voice-links`         | DLsite / ASMR sites     | `dist/dlsite-voice-links.user.js`         |
| `example`                    | `https://example.com/*` | `dist/example.user.js`                    |
| `font-rendering-tuner`       | Broad visual styling    | `dist/font-rendering-tuner.user.js`       |
| `google-play-download-links` | Google Play app pages   | `dist/google-play-download-links.user.js` |
| `pan-download-helper`        | Cloud-drive hosts       | `dist/pan-download-helper.user.js`        |
| `pan-link-opener`            | Cloud-drive hosts       | `dist/pan-link-opener.user.js`            |
| `scrollbar-dark`             | Broad visual styling    | `dist/scrollbar-dark.user.js`             |
| `tieba-cleaner`              | Tieba pages             | `dist/tieba-cleaner.user.js`              |
| `xiaohongshu-cleaner`        | Xiaohongshu pages       | `dist/xiaohongshu-cleaner.user.js`        |

## Commands

```bash
yarn install
yarn build
yarn dev example
yarn check:meta
yarn typecheck
yarn lint
yarn format:check
yarn new my-script
```

`yarn dev <script-id>` watches the script source, rebuilds `dist/<script-id>.user.js`, serves `dist/` over localhost, and prints the install URL for Violentmonkey.

## Layout

```txt
userscripts/<id>/        one userscript project
userscripts/_template/   starter copied by yarn new
packages/vm-kit/         shared runtime helpers
packages/build-kit/      build and metadata helpers
dist/                    generated installable userscripts
docs/                    local quick references and debugging notes
skills/                  agent workflow instructions
tools/                   repository commands
```

## Local Install

1. Run `yarn dev example`.
2. Open the printed `http://127.0.0.1:<port>/example.user.js` URL in a browser with Violentmonkey.
3. Install or update the script.
4. Visit `https://example.com/`.

Firefox, Edge, Brave, or compatible Chromium browsers are the primary debug targets. Chrome support depends on the extension/runtime state in your browser profile.

## Rules

- Edit source under `userscripts/<id>/src/`; do not edit `dist/*.user.js` manually.
- Keep metadata narrow and explicit.
- Prefer local docs under `docs/` before remote references.
- Add functional tests only when they verify real behavior.
