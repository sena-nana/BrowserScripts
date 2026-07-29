export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(namespace: string, options: { debug?: boolean } = {}): Logger {
  const prefix = `[vm:${namespace}]`;

  return {
    debug: (...args: unknown[]) => {
      if (options.debug) {
        console.debug(prefix, ...args);
      }
    },
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args)
  };
}
