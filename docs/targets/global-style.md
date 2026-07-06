# Global Style Userscript Notes

## Scope

`font-rendering-tuner` and `scrollbar-dark` run broadly on `http://*/*` and `https://*/*` because their only default behavior is local visual styling.

## Safety Boundary

Both scripts avoid network access and page data collection. Global behavior is limited through explicit `@exclude-match` entries for known sensitive or conflicting sites.

## Required Permissions

- `GM_addStyle` for styling.
- `GM_getValue` / `GM_setValue` / `GM_registerMenuCommand` only for local font settings.

## Debug Steps

1. Open a normal webpage and confirm scrollbar/font changes apply.
2. Open excluded sites and confirm metadata prevents execution.
3. Use the userscript menu to toggle font rendering settings.

## Last Verified

2026-07-06
