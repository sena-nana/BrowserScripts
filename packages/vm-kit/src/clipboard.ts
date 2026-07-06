export function copyText(text: string): void {
  const value = String(text);
  const gmSetClipboard = globalThis.GM_setClipboard;

  if (typeof gmSetClipboard === 'function') {
    gmSetClipboard(value);
    return;
  }

  void navigator.clipboard?.writeText(value);
}

export function copyWithNotice(text: string, message = '已复制'): void {
  copyText(text);
  window.alert(message);
}

export function bindSelectedTextCopy(): void {
  document.addEventListener(
    'copy',
    (event) => {
      const text = window.getSelection()?.toString();

      if (!text) {
        return;
      }

      event.stopImmediatePropagation();
      event.preventDefault();
      event.clipboardData?.setData('text/plain', text);
      copyText(text);
    },
    true
  );
}
