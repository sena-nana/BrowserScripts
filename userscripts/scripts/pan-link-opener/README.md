# Pan Link Opener

Cloud-drive link and extraction-code helper migrated from the smart recognition reference script.

## Target

- `http://*/*`
- `https://*/*`

This broad match is intentional because the core feature is recognizing selected cloud-drive links in arbitrary pages. The floating button stays hidden unless the current selection contains a supported link.

## Features

- Parses selected text for supported cloud-drive links and extraction codes on any normal web page.
- Opens a recognized link only after the user clicks and confirms.
- Fills extraction codes from URL query/hash on supported share pages.
- Supports common cloud-drive and store links including Baidu, Aliyun/Alipan, Weiyun, Lanzou, 189, Mobile Cloud, Xunlei, Quark, 123Pan, 360, 115, CowTransfer, CTFile, FlowUs, and browser extension stores.

## Permissions

- `GM_openInTab`: opens a recognized link after confirmation.
  Excluded login hosts are documented in `meta.ts`.

## Reference Script

- `网盘智能识别助手.user.js`

## Manual Verification

1. Build and install `dist/pan-link-opener.user.js`.
2. Open a supported cloud-drive page with `?pwd=abcd` or `#abcd`.
3. Confirm the extraction code is filled when a matching input exists.
4. Select text containing a share link and confirm opening is prompted.
