export interface ActionButton {
  label: string;
  onClick: () => void;
}

export interface ActionLink {
  label: string;
  href: string;
}

export interface FloatingPanelOptions {
  id: string;
  className?: string;
  parent?: Element;
}

const uiStyleId = 'vm-kit-ui-style';

export function injectVmKitUiStyle(): void {
  if (document.getElementById(uiStyleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = uiStyleId;
  style.textContent = `
    .vm-kit-floating-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483000;
      display: grid;
      gap: 8px;
      width: min(280px, calc(100vw - 32px));
      border: 1px solid #d0d7de;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      color: #24292f;
      font: 12px/1.4 system-ui, sans-serif;
      box-shadow: 0 8px 24px rgb(31 35 40 / 16%);
    }
    .vm-kit-floating-panel button,
    .vm-kit-floating-panel a,
    .vm-kit-floating-button {
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 6px 9px;
      background: #f6f8fa;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-decoration: none;
    }
    .vm-kit-floating-panel button:hover,
    .vm-kit-floating-panel a:hover,
    .vm-kit-floating-button:hover {
      background: #eef1f4;
    }
    .vm-kit-floating-button {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483000;
      box-shadow: 0 8px 24px rgb(31 35 40 / 16%);
    }
  `;
  document.head.append(style);
}

export function ensureFloatingPanel(options: FloatingPanelOptions): HTMLDivElement {
  injectVmKitUiStyle();

  const existing = document.getElementById(options.id);

  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const panel = document.createElement('div');
  panel.id = options.id;
  panel.className = ['vm-kit-floating-panel', options.className].filter(Boolean).join(' ');
  (options.parent ?? document.body).append(panel);
  return panel;
}

export function createButton(action: ActionButton): HTMLButtonElement {
  const button = document.createElement('button');
  injectVmKitUiStyle();
  button.type = 'button';
  button.textContent = action.label;
  button.addEventListener('click', action.onClick);
  return button;
}

export function createLink(action: ActionLink): HTMLAnchorElement {
  injectVmKitUiStyle();
  const link = document.createElement('a');
  link.href = action.href;
  link.textContent = action.label;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function confirmAction(message: string, action: () => void): void {
  if (window.confirm(message)) {
    action();
  }
}
