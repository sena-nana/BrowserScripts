export type StopUrlWatcher = () => void;

export function onUrlChange(callback: (url: URL) => void): StopUrlWatcher {
  let stopped = false;
  let lastUrl = location.href;
  const cleanups: StopUrlWatcher[] = [];

  const run = () => {
    if (stopped || location.href === lastUrl) {
      return;
    }

    lastUrl = location.href;
    callback(new URL(lastUrl));
  };

  callback(new URL(lastUrl));

  const addListener = (type: string) => {
    window.addEventListener(type, run);
    cleanups.push(() => window.removeEventListener(type, run));
  };

  addListener('popstate');
  addListener('hashchange');

  const patchHistory = (methodName: 'pushState' | 'replaceState') => {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History[typeof methodName]>
    ) {
      const result = original.apply(this, args);
      queueMicrotask(run);
      return result;
    } as History[typeof methodName];

    cleanups.push(() => {
      history[methodName] = original;
    });
  };

  patchHistory('pushState');
  patchHistory('replaceState');

  const maybeNavigation = (globalThis as typeof globalThis & { navigation?: EventTarget })
    .navigation as
    | (EventTarget & {
        addEventListener(type: 'navigatesuccess', listener: () => void): void;
        removeEventListener(type: 'navigatesuccess', listener: () => void): void;
      })
    | undefined;

  if (maybeNavigation) {
    maybeNavigation.addEventListener('navigatesuccess', run);
    cleanups.push(() => maybeNavigation.removeEventListener('navigatesuccess', run));
  }

  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  cleanups.push(() => observer.disconnect());

  return () => {
    stopped = true;
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  };
}
