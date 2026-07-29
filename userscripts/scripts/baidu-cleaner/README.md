# Baidu Cleaner

Baidu page cleanup migrated from the Baidu ad-removal reference script.

## Target

- `https://*.baidu.com/*`

## Features

- Hides common ads, login prompts, app-download prompts, and right-side distractions.
- Marks search results containing ad labels as hidden.

## Permissions

- `GM_addStyle`: cleanup styles.

## Reference Script

- `百度系网站去广告.user.js`

## Manual Verification

1. Build and install `dist/baidu-cleaner.user.js`.
2. Open Baidu Search, Baike, Zhidao, and Wenku pages.
3. Confirm main content remains visible and ad/sidebar clutter is reduced.
