# Google Play Userscript Notes

## Scope

`google-play-download-links` runs on `https://play.google.com/store/apps/details*`.

## Safety Boundary

The script only adds public mirror search links for the current package name. It does not process CAPTCHA pages, fetch APKs, or bypass access restrictions.

## Required Permissions

- `GM_addStyle` for link styling.

## Debug Steps

1. Open a Google Play app details page.
2. Confirm public mirror search links appear near the title area.
3. Confirm links open in a new tab and include the package id.

## Last Verified

2026-07-06
