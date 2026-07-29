# Cloud Drive Userscript Notes

## Scope

`pan-link-opener` runs on normal `http` and `https` pages because its core feature is recognizing selected cloud-drive links in arbitrary text. `pan-download-helper` targets known cloud-drive hosts only.

## Safety Boundary

These scripts do not read cookies, scrape access tokens, bypass passwords, solve CAPTCHA, or call private direct-link APIs. Opening links, filling codes, copying commands, and copying links are user-triggered only.

`pan-link-opener` keeps its floating button hidden until the current selection contains a recognized cloud-drive URL.

## Required Permissions

- `GM_addStyle` for floating controls.
- `GM_openInTab` only after the user confirms opening a recognized cloud-drive link.
- `GM_setClipboard` copies visible links or generated commands after user clicks.

## Debug Steps

1. Open a supported cloud-drive share page.
2. Confirm extraction code from `?pwd=` or hash is filled when present.
3. Select text containing a supported share link and click the opener button.
4. Confirm download helper only copies links already visible on the current page.

## Last Verified

2026-07-06
