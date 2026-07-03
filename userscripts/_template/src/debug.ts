export interface DebugBridge {
  rerun: () => void;
  state: () => unknown;
  stop: () => void;
}

export function installDebugBridge(bridge: DebugBridge): void {
  if (!__DEV__) {
    return;
  }

  Object.defineProperty(window, '__VM_TEMPLATE_USERSCRIPT_DEBUG__', {
    value: bridge,
    configurable: true
  });
}
