# Example Userscript

Minimal script proving the BrowserScripts scaffold works.

## Target

- `https://example.com/*`

## Behavior

When installed on `https://example.com/`, the script adds a small fixed badge showing that the userscript is active. The badge is re-applied after SPA-style URL changes.

## Verification

1. Run `pnpm dev example`.
2. Install the printed localhost URL in Violentmonkey.
3. Open `https://example.com/`.
4. Confirm a `VM Example active` badge appears in the lower-right corner.
5. Confirm release builds do not expose `window.__VM_EXAMPLE_DEBUG__`.
