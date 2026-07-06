# Migration Gap Audit

Last updated: 2026-07-06

## Filled After Initial Migration

- `pan-link-opener`: restored the necessary selected-text recognition flow on arbitrary web pages. The script now uses broad `http` / `https` matching, keeps the button hidden until a supported cloud-drive URL is selected, and still requires user confirmation before opening.
- `font-rendering-tuner`: added a custom font-family menu action instead of only offering two presets.
- `bilibili-live-toolkit`: expanded room summary output with additional safe read-only room stats when Bilibili returns them.
- `pan-link-opener`: added safe parser coverage for 360, 115, CowTransfer, CTFile, FlowUs, and browser extension store links.
- `csdn-reader-cleaner`: normalizes `link.csdn.net/?target=` redirect anchors.
- `xiaohongshu-cleaner`: blocks app-wakeup URL clicks and normalizes same-site redirect links.
- `tieba-cleaner`: adds a local visible-post reverse-order button on thread pages.
- `google-play-download-links`: adds APKPremier as another public mirror search link.
- `pan-download-helper`: copies all visible download links and generates per-link `curl` / `aria2c` commands with derived filenames.
- `font-rendering-tuner`: adds a menu prompt for font scale.
- `baidu-cleaner`: observes dynamic DOM changes and reruns ad-label cleanup without fixed polling.
- Shared UI/clipboard helpers were added to `packages/vm-kit` and reused by migrated scripts.

## Intentionally Not Migrated

- Bilibili bulk unfollow, follow-group mutation, dynamic deletion, and delete-and-unfollow actions: destructive account actions.
- Bilibili live task automation: site/task automation with account-side effects.
- Cloud-drive cookie reads, token scraping, direct-link API bypass, local RPC automation, and CAPTCHA-related flows: access-control and credential risk.
- Google Play direct APK fetching and CAPTCHA handling: access-control and distribution risk.
- VoiceLinks large remote-data popup/cache system: high complexity and broad cross-origin behavior; the core RJ/VJ linking workflow is migrated.
- Bilibili Evolved full feature set: large third-party project; only lightweight layout/readability intent is migrated.

## Remaining Optional Enhancements

- Add per-site enable/disable settings for broad visual scripts if global styling conflicts appear.
- Add more provider patterns to `pan-link-opener` when a concrete unsupported link format is observed.
- Add browser smoke checks for representative target pages when those pages are accessible in a test profile.
