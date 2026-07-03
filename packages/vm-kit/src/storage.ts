const LOCAL_PREFIX = 'browserscripts:';

export async function getStoredValue<T>(key: string, fallback: T): Promise<T> {
  const gmGetValue = globalThis.GM_getValue;

  if (typeof gmGetValue === 'function') {
    return (await gmGetValue(key, fallback)) as T;
  }

  const raw = localStorage.getItem(`${LOCAL_PREFIX}${key}`);

  if (raw === null) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

export async function setStoredValue<T>(key: string, value: T): Promise<void> {
  const gmSetValue = globalThis.GM_setValue;

  if (typeof gmSetValue === 'function') {
    await gmSetValue(key, value);
    return;
  }

  localStorage.setItem(`${LOCAL_PREFIX}${key}`, JSON.stringify(value));
}

export async function removeStoredValue(key: string): Promise<void> {
  const gmDeleteValue = globalThis.GM_deleteValue;

  if (typeof gmDeleteValue === 'function') {
    await gmDeleteValue(key);
    return;
  }

  localStorage.removeItem(`${LOCAL_PREFIX}${key}`);
}
