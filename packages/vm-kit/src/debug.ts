export interface DebugBridge {
  rerun: () => void;
  state: () => unknown;
  stop: () => void;
}

export function installDebugBridge(scriptId: string, bridge: DebugBridge): void {
  if (!__DEV__) {
    return;
  }

  const name = `__VM_${scriptId.replaceAll('-', '_').toUpperCase()}_DEBUG__`;

  Object.defineProperty(window, name, {
    value: bridge,
    configurable: true
  });
}
