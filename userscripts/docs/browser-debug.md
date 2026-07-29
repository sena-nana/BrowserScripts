# Browser Debugging

## Basic Checklist

1. Confirm Violentmonkey is installed and enabled.
2. Confirm the script is installed and enabled.
3. Confirm the current URL matches `@match`.
4. Confirm `@exclude-match` is not blocking the page.
5. Confirm iframe behavior and `@noframes`.
6. Confirm `@run-at` timing.
7. Confirm `@inject-into` context.
8. Confirm all GM APIs are listed in `@grant`.
9. Check DevTools Console for `[vm:<script-id>]` logs.
10. Use sourcemap-aware breakpoints in DevTools.

## SPA Pages

Userscripts do not automatically rerun on soft navigation. Use `onUrlChange` from `@browserscripts/vm-kit` or document the site's navigation behavior in `docs/targets/<site>.md`.

## Dynamic DOM

Use `observeElement` from `@browserscripts/vm-kit` or a scoped `MutationObserver`. Disconnect observers when no longer needed.

## Page Globals

Use `@inject-into page` only when page-defined JavaScript values are required. For DOM-only scripts, prefer `auto` or `content`.
