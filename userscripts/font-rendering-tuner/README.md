# Font Rendering Tuner

Global font rendering helper migrated from the font rendering reference script.

## Target

- `http://*/*`
- `https://*/*`

Excludes selected Bilibili and Zhihu hosts where global font changes commonly conflict.

## Features

- Applies local font smoothing and a configurable font family.
- Provides userscript menu actions for toggling font rendering, setting a custom font family, setting scale, and resetting scale.

## Permissions

- `GM_addStyle`: inject font styling.
- `GM_getValue` / `GM_setValue`: store local settings.
- `GM_registerMenuCommand`: expose local settings actions.

## Reference Script

- `字体渲染（自用脚本）.user.js`

## Manual Verification

1. Build and install `dist/font-rendering-tuner.user.js`.
2. Open a normal webpage and confirm font styling applies.
3. Use the userscript menu actions to toggle/reset settings.
