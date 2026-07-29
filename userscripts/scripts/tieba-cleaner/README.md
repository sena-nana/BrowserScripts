# Tieba Cleaner

Tieba reading cleanup migrated from the Tieba simplification reference script.

## Target

- `https://tieba.baidu.com/*`
- `https://dq.tieba.com/*`
- `https://jump.bdimg.com/*`
- `https://jump2.bdimg.com/*`

`https://tieba.baidu.com/f/fdir*` is excluded.

## Features

- Hides common sidebars, app prompts, ads, and login dialogs.
- Widens thread reading content.
- Adds an opt-in button to reverse the currently visible posts on thread pages.

## Permissions

- `GM_addStyle`: cleanup styles.

## Reference Script

- `贴吧页面精简.user.js`

## Manual Verification

1. Build and install `dist/tieba-cleaner.user.js`.
2. Open a Tieba thread page.
3. Confirm side clutter is reduced and thread content remains readable.
