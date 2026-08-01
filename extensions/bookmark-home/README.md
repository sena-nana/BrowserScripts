# Bookmark Home

Bookmark Home is a framework-free Chrome Manifest V3 new-tab extension. Its
transparent home page combines a complete bookmark tree, search suggestions,
and an optional local background.

## Develop

```bash
yarn install
yarn build
yarn verify
yarn e2e
yarn perf
```

Load `packages/extension/dist/` from `chrome://extensions` with Developer mode
enabled.

## Privacy and permissions

- `bookmarks` displays and manages the browser bookmark tree.
- `history` supplies local history suggestions.
- `storage` synchronizes preferences and keeps expanded folders and the
  optional background locally.
- `favicon` displays browser-managed favicons.
- Exact Google, Bing, and Baidu hosts are used only after the user types in the
  central search field and online suggestions are enabled.
- The optional bookmark organizer sends only the selected bookmark names,
  folder structure, and URLs without credentials, queries, or fragments to the
  user-configured Responses-compatible endpoint. It never changes bookmarks
  until the user reviews and approves each proposed action.
- Organizer credentials stay in extension-local storage and are never synced.
  Access to a configured endpoint is requested only when the user starts an
  organizer run.

The extension has no content script, background worker, browser side panel, or
access to arbitrary websites. Search input and suggestion results are not
persisted.
