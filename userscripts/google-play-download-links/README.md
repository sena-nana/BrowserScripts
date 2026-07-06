# Google Play Download Links

Public mirror search links migrated from the Google Play direct-download reference script.

## Target

- `https://play.google.com/store/apps/details*`

## Features

- Adds APKMirror, APKPure, APKCombo, and APKPremier search links for the current package id.

## Safety Boundary

This script does not process CAPTCHA pages, fetch APK files, or bypass regional/account restrictions.

## Permissions

- `GM_addStyle`: link styling.

## Reference Script

- `Direct download from Google Play.user.js`

## Manual Verification

1. Build and install `dist/google-play-download-links.user.js`.
2. Open a Google Play app details page.
3. Confirm mirror links appear and include the package id.
