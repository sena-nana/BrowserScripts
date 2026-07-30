import type {
  HomeBackgroundV1,
  HomeLink,
  LocalUiStateV1,
  SearchProviderId,
  SettingsV2,
  ThemePreference,
} from "./types";

const SETTINGS_KEY = "settings";
const LOCAL_UI_KEY = "uiState";
const HOME_BACKGROUND_KEY = "homeBackground";
const MAX_BACKGROUND_DATA_URL_LENGTH = 5_600_000;

export const DEFAULT_SETTINGS: SettingsV2 = {
  version: 2,
  appearance: {
    theme: "system",
    sidebarWidth: 350,
    sidebarCollapsed: false,
  },
  search: {
    provider: "google",
    customName: "",
    customSearchUrl: "https://example.com/search?q={query}",
    historySuggestions: true,
    onlineSuggestions: true,
  },
  home: {
    topLinks: [],
  },
};

const DEFAULT_LOCAL_UI: LocalUiStateV1 = {
  version: 1,
  expandedFolderIds: [],
};

type SettingsListener = (settings: SettingsV2) => void;

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

function boundedWidth(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(480, Math.max(260, Math.round(value)))
    : DEFAULT_SETTINGS.appearance.sidebarWidth;
}

export function sanitizeHomeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) {
    return null;
  }
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function sanitizeHomeLinks(value: unknown, maximum: number): HomeLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const urls = new Set<string>();
  const links: HomeLink[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const url = sanitizeHomeUrl(item.url);
    const title =
      typeof item.title === "string" ? item.title.trim().slice(0, 80) : "";
    if (!url || !title || urls.has(url)) {
      continue;
    }
    urls.add(url);
    links.push({
      id:
        typeof item.id === "string" && item.id.length <= 100
          ? item.id
          : `link-${links.length}-${url}`,
      title,
      url,
    });
    if (links.length >= maximum) {
      break;
    }
  }
  return links;
}

export function sanitizeSettings(value: unknown): SettingsV2 {
  if (!isRecord(value)) {
    return structuredClone(DEFAULT_SETTINGS);
  }
  const appearance = isRecord(value.appearance) ? value.appearance : {};
  const search = isRecord(value.search) ? value.search : {};
  const home = isRecord(value.home) ? value.home : {};
  return {
    version: 2,
    appearance: {
      theme: isTheme(appearance.theme)
        ? appearance.theme
        : DEFAULT_SETTINGS.appearance.theme,
      sidebarWidth: boundedWidth(appearance.sidebarWidth),
      sidebarCollapsed:
        typeof appearance.sidebarCollapsed === "boolean"
          ? appearance.sidebarCollapsed
          : DEFAULT_SETTINGS.appearance.sidebarCollapsed,
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
    home: {
      topLinks: sanitizeHomeLinks(home.topLinks, 6),
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

export interface HomeDraftPersistence {
  saveSettings(settings: SettingsV2): Promise<void>;
  saveBackground(background: HomeBackgroundV1 | null): Promise<void>;
}

export async function persistHomeDraftWithRollback(
  persistence: HomeDraftPersistence,
  nextSettings: SettingsV2,
  nextBackground: HomeBackgroundV1 | null,
  previousSettings: SettingsV2,
  previousBackground: HomeBackgroundV1 | null,
): Promise<void> {
  try {
    await persistence.saveSettings(nextSettings);
    await persistence.saveBackground(nextBackground);
  } catch (error) {
    await Promise.allSettled([
      persistence.saveSettings(previousSettings),
      persistence.saveBackground(previousBackground),
    ]);
    throw error;
  }
}

export class SettingsStore {
  #settings = structuredClone(DEFAULT_SETTINGS);
  #localUi = structuredClone(DEFAULT_LOCAL_UI);
  #homeBackground: HomeBackgroundV1 | null = null;
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

  get settings(): SettingsV2 {
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
    changes: Partial<SettingsV2["appearance"]>,
  ): Promise<void> {
    await this.#save({
      ...this.#settings,
      appearance: { ...this.#settings.appearance, ...changes },
    });
  }

  async updateSearch(changes: Partial<SettingsV2["search"]>): Promise<void> {
    await this.#save({
      ...this.#settings,
      search: { ...this.#settings.search, ...changes },
    });
  }

  async saveHomeDraft(
    settings: SettingsV2,
    background: HomeBackgroundV1 | null,
  ): Promise<void> {
    const previousSettings = this.settings;
    const previousBackground = this.homeBackground;
    const nextSettings = sanitizeSettings(settings);
    const nextBackground = sanitizeHomeBackground(background);
    const persistence: HomeDraftPersistence = {
      saveSettings: (value) =>
        chrome.storage.sync.set({ [SETTINGS_KEY]: value }),
      saveBackground: async (value) => {
        if (value) {
          await chrome.storage.local.set({
            [HOME_BACKGROUND_KEY]: value,
          });
        } else {
          await chrome.storage.local.remove(HOME_BACKGROUND_KEY);
        }
      },
    };
    try {
      await persistHomeDraftWithRollback(
        persistence,
        nextSettings,
        nextBackground,
        previousSettings,
        previousBackground,
      );
      this.#settings = nextSettings;
      this.#homeBackground = nextBackground;
      this.#emit();
    } catch (error) {
      this.#settings = previousSettings;
      this.#homeBackground = previousBackground;
      this.#emit();
      throw error;
    }
  }

  async saveExpandedFolderIds(ids: Iterable<string>): Promise<void> {
    this.#localUi = {
      version: 1,
      expandedFolderIds: [...new Set(ids)].slice(0, 2_000),
    };
    await chrome.storage.local.set({ [LOCAL_UI_KEY]: this.#localUi });
  }

  async #save(next: SettingsV2): Promise<void> {
    this.#settings = sanitizeSettings(next);
    await chrome.storage.sync.set({ [SETTINGS_KEY]: this.#settings });
    this.#emit();
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
