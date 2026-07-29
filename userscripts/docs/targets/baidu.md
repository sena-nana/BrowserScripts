# Baidu Userscript Notes

## Scope

`baidu-cleaner` targets `https://*.baidu.com/*`; `tieba-cleaner` targets Tieba-specific hosts.

## Fragile Selectors

- Search result containers: `#content_left > div`, `#content_right`.
- Tieba layout selectors: `.right_section`, `.l_post`, `.d_post_content_main`.

## Required Permissions

- `GM_addStyle` for cleanup CSS.

## Debug Steps

1. Open Baidu Search, Baike, Zhidao, Wenku, and Tieba pages.
2. Confirm ad/sidebar/login distractions are reduced.
3. Confirm `https://tieba.baidu.com/f/fdir*` is excluded by metadata.

## Last Verified

2026-07-06
