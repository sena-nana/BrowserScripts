import type {
  HomeBackgroundV1,
  LocalUiStateV1,
  SearchProviderId,
  SettingsV4,
  SidebarDensity,
  ThemePreference,
} from "./types";

const SETTINGS_KEY = "settings";
const LOCAL_UI_KEY = "uiState";
const HOME_BACKGROUND_KEY = "homeBackground";
const MAX_BACKGROUND_DATA_URL_LENGTH = 5_600_000;

export const DEFAULT_SETTINGS: SettingsV4 = {
  version: 4,
  appearance: {
    theme: "system",
    sidebarWidth: 350,
    sidebarCollapsed: false,
    sidebarDensity: "standard",
    panelTransparency: 20,
    backdropBlur: 7,
  },
  search: {
    provider: "google",
    customName: "",
    customSearchUrl: "https://example.com/search?q={query}",
    historySuggestions: true,
    onlineSuggestions: true,
  },
};

const DEFAULT_LOCAL_UI: LocalUiStateV1 = {
  version: 1,
  expandedFolderIds: [],
};

type SettingsListener = (settings: SettingsV4) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTheme(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isProvider(value: unknown): value is SearchProviderId {
  return (
    value === "google" ||
    value === "bing" ||
    value === "baidu" ||
    value === "custom"
  );
}

function isSidebarDensity(value: unknown): value is SidebarDensity {
  return value === "compact" || value === "standard" || value === "relaxed";
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

export function sanitizeSettings(value: unknown): SettingsV4 {
  if (!isRecord(value) || value.version !== DEFAULT_SETTINGS.version) {
    return structuredClone(DEFAULT_SETTINGS);
  }
  const appearance = isRecord(value.appearance) ? value.appearance : {};
  const search = isRecord(value.search) ? value.search : {};
  return {
    version: DEFAULT_SETTINGS.version,
    appearance: {
      theme: isTheme(appearance.theme)
        ? appearance.theme
        : DEFAULT_SETTINGS.appearance.theme,
      sidebarWidth: boundedInteger(
        appearance.sidebarWidth,
        260,
        480,
        DEFAULT_SETTINGS.appearance.sidebarWidth,
      ),
      sidebarCollapsed:
        typeof appearance.sidebarCollapsed === "boolean"
          ? appearance.sidebarCollapsed
          : DEFAULT_SETTINGS.appearance.sidebarCollapsed,
      sidebarDensity: isSidebarDensity(appearance.sidebarDensity)
        ? appearance.sidebarDensity
        : DEFAULT_SETTINGS.appearance.sidebarDensity,
      panelTransparency: boundedInteger(
        appearance.panelTransparency,
        0,
        90,
        DEFAULT_SETTINGS.appearance.panelTransparency,
      ),
      backdropBlur: boundedInteger(
        appearance.backdropBlur,
        0,
        30,
        DEFAULT_SETTINGS.appearance.backdropBlur,
      ),
    },
    search: {
      provider: isProvider(search.provider)
        ? search.provider
        : DEFAULT_SETTINGS.search.provider,
      customName:
        typeof search.customName === "string"
          ? search.customName.slice(0, 60)
          : DEFAULT_SETTINGS.search.customName,
      customSearchUrl:
        typeof search.customSearchUrl === "string"
          ? search.customSearchUrl.slice(0, 2048)
          : DEFAULT_SETTINGS.search.customSearchUrl,
      historySuggestions:
        typeof search.historySuggestions === "boolean"
          ? search.historySuggestions
          : DEFAULT_SETTINGS.search.historySuggestions,
      onlineSuggestions:
        typeof search.onlineSuggestions === "boolean"
          ? search.onlineSuggestions
          : DEFAULT_SETTINGS.search.onlineSuggestions,
    },
  };
}

function sanitizeLocalUi(value: unknown): LocalUiStateV1 {
  if (!isRecord(value) || !Array.isArray(value.expandedFolderIds)) {
    return structuredClone(DEFAULT_LOCAL_UI);
  }
  return {
    version: 1,
    expandedFolderIds: [
      ...new Set(
        value.expandedFolderIds.filter(
          (id): id is string => typeof id === "string",
        ),
      ),
    ].slice(0, 2_000),
  };
}

export function sanitizeHomeBackground(
  value: unknown,
): HomeBackgroundV1 | null {
  if (!isRecord(value)) {
    return null;
  }
  const dataUrl = value.dataUrl;
  if (
    value.version !== 1 ||
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/webp;base64,") ||
    dataUrl.length > MAX_BACKGROUND_DATA_URL_LENGTH
  ) {
    return null;
  }
  return {
    version: 1,
    dataUrl,
    updatedAt:
      typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
        ? value.updatedAt
        : 0,
  };
}

export class SettingsStore {
  #settings = structuredClone(DEFAULT_SETTINGS);
  #localUi = structuredClone(DEFAULT_LOCAL_UI);
  #homeBackground: HomeBackgroundV1 | null = null;
  #settingsWrite = Promise.resolve();
  #backgroundWrite = Promise.resolve();
  readonly #listeners = new Set<SettingsListener>();

  async load(): Promise<void> {
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get(SETTINGS_KEY),
      chrome.storage.local.get([LOCAL_UI_KEY, HOME_BACKGROUND_KEY]),
    ]);
    this.#settings = sanitizeSettings(syncData[SETTINGS_KEY]);
    this.#localUi = sanitizeLocalUi(localData[LOCAL_UI_KEY]);
    this.#homeBackground = sanitizeHomeBackground(
      localData[HOME_BACKGROUND_KEY],
    );
    chrome.storage.onChanged.addListener(this.#handleStorageChange);
  }

  dispose(): void {
    chrome.storage.onChanged.removeListener(this.#handleStorageChange);
    this.#listeners.clear();
  }

  get settings(): SettingsV4 {
    return structuredClone(this.#settings);
  }

  get homeBackground(): HomeBackgroundV1 | null {
    return this.#homeBackground ? structuredClone(this.#homeBackground) : null;
  }

  get expandedFolderIds(): ReadonlySet<string> {
    return new Set(this.#localUi.expandedFolderIds);
  }

  subscribe(listener: SettingsListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async updateAppearance(
    changes: Partial<SettingsV4["appearance"]>,
  ): Promise<void> {
    await this.#enqueueSettingsUpdate((settings) => ({
      ...settings,
      appearance: { ...settings.appearance, ...changes },
    }));
  }

  async updateSearch(changes: Partial<SettingsV4["search"]>): Promise<void> {
    await this.#enqueueSettingsUpdate((settings) => ({
      ...settings,
      search: { ...settings.search, ...changes },
    }));
  }

  async updateHomeBackground(
    background: HomeBackgroundV1 | null,
  ): Promise<void> {
    const nextBackground = sanitizeHomeBackground(background);
    const operation = this.#backgroundWrite.then(async () => {
      if (nextBackground) {
        await chrome.storage.local.set({
          [HOME_BACKGROUND_KEY]: nextBackground,
        });
      } else {
        await chrome.storage.local.remove(HOME_BACKGROUND_KEY);
      }
      this.#homeBackground = nextBackground;
    });
    this.#backgroundWrite = operation.catch(() => undefined);
    await operation;
  }

  async saveExpandedFolderIds(ids: Iterable<string>): Promise<void> {
    this.#localUi = {
      version: 1,
      expandedFolderIds: [...new Set(ids)].slice(0, 2_000),
    };
    await chrome.storage.local.set({ [LOCAL_UI_KEY]: this.#localUi });
  }

  async #enqueueSettingsUpdate(
    update: (settings: SettingsV4) => SettingsV4,
  ): Promise<void> {
    const operation = this.#settingsWrite.then(async () => {
      const next = sanitizeSettings(update(this.settings));
      await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
      this.#settings = next;
    });
    this.#settingsWrite = operation.catch(() => undefined);
    await operation;
  }

  readonly #handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName === "sync" && changes[SETTINGS_KEY]?.newValue !== undefined) {
      this.#settings = sanitizeSettings(changes[SETTINGS_KEY].newValue);
      this.#emit();
    }
    if (areaName === "local" && changes[LOCAL_UI_KEY]?.newValue !== undefined) {
      this.#localUi = sanitizeLocalUi(changes[LOCAL_UI_KEY].newValue);
    }
    if (areaName === "local" && HOME_BACKGROUND_KEY in changes) {
      this.#homeBackground = sanitizeHomeBackground(
        changes[HOME_BACKGROUND_KEY].newValue,
      );
      this.#emit();
    }
  };

  #emit(): void {
    const current = this.settings;
    for (const listener of this.#listeners) {
      listener(current);
    }
  }
}

export function applyTheme(theme: ThemePreference): void {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}
