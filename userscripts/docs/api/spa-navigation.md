# SPA Navigation

Userscripts do not automatically rerun on `history.pushState`, `replaceState`, hash changes, or framework-level route updates.

Use:

```ts
import { onUrlChange } from '@browserscripts/vm-kit';

const stop = onUrlChange(() => {
  // refresh DOM bindings for the current route
});
```

Keep handlers idempotent. A route handler may run more than once for the same visual page.
