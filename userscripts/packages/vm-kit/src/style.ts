export function injectStyle(css: string, id?: string): HTMLStyleElement | undefined {
  if (!css.trim()) {
    return undefined;
  }

  if (id) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLStyleElement) {
      existing.textContent = css;
      return existing;
    }
  }

  const gmAddStyle = globalThis.GM_addStyle;

  if (typeof gmAddStyle === 'function') {
    const style = gmAddStyle(css);

    if (id && style instanceof HTMLStyleElement) {
      style.id = id;
    }

    return style instanceof HTMLStyleElement ? style : undefined;
  }

  const style = document.createElement('style');

  if (id) {
    style.id = id;
  }

  style.textContent = css;
  document.head.append(style);
  return style;
}
