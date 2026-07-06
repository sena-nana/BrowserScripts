export interface ObserveElementOptions {
  root?: Document | Element;
  observerInit?: MutationObserverInit;
  once?: boolean;
}

export type StopObserver = () => void;

export function observeElement<T extends Element>(
  selector: string,
  callback: (element: T) => void,
  options: ObserveElementOptions = {}
): StopObserver {
  const root = options.root ?? document;
  const observerInit = options.observerInit ?? {
    childList: true,
    subtree: true
  };
  const once = options.once ?? true;
  let stopped = false;

  const tryFind = () => {
    if (stopped) {
      return false;
    }

    const element = root.querySelector<T>(selector);
    if (!element) {
      return false;
    }

    callback(element);
    return true;
  };

  if (tryFind() && once) {
    stopped = true;
    return () => {
      stopped = true;
    };
  }

  const observer = new MutationObserver(() => {
    if (tryFind() && once) {
      stop();
    }
  });
  const observeRoot = root instanceof Document ? root.documentElement : root;

  const stop = () => {
    stopped = true;
    observer.disconnect();
  };

  if (!observeRoot) {
    return stop;
  }

  observer.observe(observeRoot, observerInit);
  return stop;
}

export function ensureElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: {
    id?: string;
    className?: string;
    textContent?: string;
    parent?: Element;
  } = {}
): HTMLElementTagNameMap[K] {
  if (options.id) {
    const existing = document.getElementById(options.id);
    if (existing instanceof HTMLElement) {
      return existing as HTMLElementTagNameMap[K];
    }
  }

  const element = document.createElement(tagName);

  if (options.id) {
    element.id = options.id;
  }

  if (options.className) {
    element.className = options.className;
  }

  if (options.textContent) {
    element.textContent = options.textContent;
  }

  (options.parent ?? document.body).append(element);
  return element;
}

export function observeDocument(
  callback: MutationCallback,
  options: MutationObserverInit = { childList: true, subtree: true }
): StopObserver {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, options);
  return () => observer.disconnect();
}
