# CSDN Reader Cleaner

CSDN reading cleanup migrated from the CSDNGreener reference script.

## Target

- `https://*.csdn.net/*`

## Features

- Hides common sidebars, login prompts, and read-more overlays.
- Expands article containers.
- Restores copying selected text.
- Rewrites visible `link.csdn.net/?target=` anchors to their target URL.

## Permissions

- `GM_addStyle`: cleanup styles.
- `GM_setClipboard`: copies selected text when the user triggers copy.

## Reference Script

- `「CSDNGreener」🍃CSDN广告完全过滤-免登录-个性化排版-最强老牌脚本-持续更新.user.js`

## Manual Verification

1. Build and install `dist/csdn-reader-cleaner.user.js`.
2. Open a CSDN article.
3. Confirm article content is not clipped and selected text can be copied.
