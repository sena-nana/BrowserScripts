# DLsite Voice Links

RJ/VJ work-code helper migrated from DLsite redirect and VoiceLinks reference scripts.

## Target

- `https://www.dlsite.com/*`
- `https://ci-en.dlsite.com/*`
- `https://media.ci-en.jp/*`
- `https://asmr.one/*`

## Features

- Links visible RJ/VJ/BJ codes to DLsite product pages.
- Adds an explicit ASMR link on DLsite RJ product pages.

## Permissions

- `GM_addStyle`: link and action styling.

## Reference Scripts

- `DLsite跳转到ASMR网站.user.js`
- `VoiceLinks.user.js`

## Manual Verification

1. Build and install `dist/dlsite-voice-links.user.js`.
2. Open a DLsite product page with an RJ code.
3. Confirm work codes become links and the ASMR action opens a new tab.
