# DOM Observation

Dynamic sites often render target elements after the userscript starts.

Preferred pattern:

```ts
import { observeElement } from '@browserscripts/vm-kit';

const stop = observeElement('.target', (element) => {
  element.classList.add('ready');
  stop();
});
```

Guidelines:

- Observe the narrowest stable root when possible.
- Disconnect observers when work is complete.
- Avoid fixed delays as the only readiness mechanism.
- Document fragile selectors in `docs/targets/<site>.md`.
