# CSDN Userscript Notes

## Scope

`csdn-reader-cleaner` runs on `https://*.csdn.net/*` to clean article pages and restore normal text copying.

## Fragile Selectors

- Article containers: `#article_content`, `.blog-content-box`, `.htmledit_views`.
- Login and read-more overlays: `.passport-login-container`, `.readall_box`, `.btn-readmore`.

## Required Permissions

- `GM_addStyle` for cleanup CSS.
- `GM_setClipboard` only when the user copies selected text.

## Debug Steps

1. Open a CSDN article.
2. Confirm sidebars, read-more overlays, and login prompts are hidden.
3. Select article text and copy it.

## Last Verified

2026-07-06
