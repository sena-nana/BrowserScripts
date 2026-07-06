# Xiaohongshu Cleaner

Xiaohongshu cleanup migrated from the Xiaohongshu optimization reference script.

## Target

- `https://www.xiaohongshu.com/*`

## Features

- Hides common login, app-open, ad, and sticky prompt surfaces.
- Restores copying selected visible text.
- Suppresses app-wakeup links and normalizes same-site redirect links.

## Permissions

- `GM_addStyle`: cleanup styles.
- `GM_setClipboard`: copies selected text when the user triggers copy.

## Reference Script

- `小红书优化.user.js`

## Manual Verification

1. Build and install `dist/xiaohongshu-cleaner.user.js`.
2. Open a Xiaohongshu note page.
3. Confirm login/app prompts are reduced and selected text can be copied.
