# Matching

Use `@match` for predictable URL scope.

Guidelines:

- Keep patterns as narrow as possible.
- Avoid `*://*/*` unless the user explicitly asks for a global script.
- Add target notes for fragile URL patterns.
- Remember that SPA soft navigation does not reinstall or rerun the userscript.

When a site changes URL without a full reload, use `onUrlChange` from `@browserscripts/vm-kit` or a site-specific navigation helper.
