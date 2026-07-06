# Xiaohongshu Userscript Notes

## Scope

`xiaohongshu-cleaner` runs on `https://www.xiaohongshu.com/*`.

## Fragile Selectors

- Login/app prompts: `.login-container`, `.login-modal`, `.download-app`, `.launch-app-container`.
- Content selectors: `.note-content`, `.desc`, `.comment-item`.

## Required Permissions

- `GM_addStyle` for cleanup CSS.
- `GM_setClipboard` only when the user copies selected text.

## Debug Steps

1. Open a note page.
2. Confirm login/app prompts are hidden when present.
3. Select visible text and copy it.

## Last Verified

2026-07-06
