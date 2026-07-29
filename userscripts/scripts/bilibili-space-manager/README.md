# Bilibili Space Manager

Read-only Bilibili space helper migrated from follow, dynamic, and favorite management scripts.

## Target

- `https://space.bilibili.com/*`

## Features

- Shows the current UID and relation summary.
- Copies UID or visible video/dynamic/favorite titles on explicit click.
- Provides direct navigation to the user's dynamic and favorite pages.

## Permissions

- `GM_addStyle`: panel styles.
- `GM_xmlhttpRequest`: read public relation summary from `api.bilibili.com`.
- `GM_setClipboard`: copy UID or visible page entries after user action.

## Reference Scripts

- `[Bilibili] 关注管理器.user.js`
- `动态管理.user.js`
- `哔哩哔哩(B站-Bilibili)收藏夹Fix.user.js`

## Manual Verification

1. Build and install `dist/bilibili-space-manager.user.js`.
2. Open a Bilibili space page and confirm the panel shows the UID.
3. Click copy actions and confirm clipboard content.
4. Confirm there are no delete, unfollow, or bulk-action controls.
