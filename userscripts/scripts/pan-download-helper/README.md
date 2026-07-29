# Pan Download Helper

User-triggered cloud-drive download helper migrated from the direct-link reference script.

## Target

Known Baidu, Aliyun/Alipan, 189, Xunlei, Quark, and Mobile Cloud hosts.

## Features

- Copies visible download links from the current page.
- Generates `curl` or `aria2c` commands for visible links only, with filenames derived from link metadata or text.

## Safety Boundary

This script does not read cookies, scrape tokens, request direct-link APIs, bypass passwords, or solve CAPTCHA.

## Permissions

- `GM_addStyle`: floating controls.
- `GM_setClipboard`: copy visible links or generated commands after user click.

## Reference Script

- `网盘直链下载助手.user.js`

## Manual Verification

1. Build and install `dist/pan-download-helper.user.js`.
2. Open a supported cloud-drive page with an explicit download link.
3. Click each copy action and confirm clipboard content.
4. Confirm pages without visible download links show a message instead of fabricating output.
