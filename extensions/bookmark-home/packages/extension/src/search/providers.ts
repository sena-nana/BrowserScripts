import type { SearchProviderId, SettingsV3, Suggestion } from "../core/types";

export interface SearchProvider {
  id: SearchProviderId;
  name: string;
  searchUrl: string;
  suggestionUrl?: string;
}

export const SEARCH_PROVIDERS: Record<
  Exclude<SearchProviderId, "custom">,
  SearchProvider
> = {
  google: {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q={query}",
    suggestionUrl:
      "https://suggestqueries.google.com/complete/search?client=chrome&q={query}",
  },
  bing: {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q={query}",
    suggestionUrl: "https://api.bing.com/osjson.aspx?query={query}",
  },
  baidu: {
    id: "baidu",
    name: "百度",
    searchUrl: "https://www.baidu.com/s?wd={query}",
    suggestionUrl: "https://suggestion.baidu.com/su?wd={query}&cb=bookmarkHome",
  },
};

export function providerName(settings: SettingsV3["search"]): string {
  return settings.provider === "custom"
    ? settings.customName.trim() || "Custom"
    : SEARCH_PROVIDERS[settings.provider].name;
}

export function isValidCustomSearchUrl(value: string): boolean {
  if (!value.includes("{query}")) {
    return false;
  }
  try {
    return new URL(value.replace("{query}", "test")).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildSearchUrl(
  query: string,
  settings: SettingsV3["search"],
): string {
  const template =
    settings.provider === "custom" &&
    isValidCustomSearchUrl(settings.customSearchUrl)
      ? settings.customSearchUrl
      : settings.provider === "custom"
        ? SEARCH_PROVIDERS.google.searchUrl
        : SEARCH_PROVIDERS[settings.provider].searchUrl;
  return template.replaceAll("{query}", encodeURIComponent(query));
}

const BLOCKED_SCHEMES = /^(?:javascript|data|vbscript):/i;
const EXPLICIT_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const DOMAIN_LIKE =
  /^(?:localhost(?::\d+)?|(?:[\p{L}\d-]+\.)+[\p{L}]{2,})(?:[/:?#]|$)/iu;

export function directNavigationUrl(input: string): string | null {
  const value = input.trim();
  if (!value || BLOCKED_SCHEMES.test(value)) {
    return null;
  }
  const candidate = EXPLICIT_SCHEME.test(value)
    ? value
    : DOMAIN_LIKE.test(value)
      ? `https://${value}`
      : "";
  if (!candidate) {
    return null;
  }
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function resolveSearchInput(
  input: string,
  settings: SettingsV3["search"],
): string | null {
  const value = input.trim();
  if (!value || BLOCKED_SCHEMES.test(value)) {
    return null;
  }
  return directNavigationUrl(value) ?? buildSearchUrl(value, settings);
}

function toStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function parseGoogleSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return toStrings(value[1]);
}

export function parseBingSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return toStrings(value[1]);
}

export function parseBaiduSuggestions(value: string): string[] {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return [];
  }
  try {
    const parsed = JSON.parse(value.slice(start, end + 1)) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "s" in parsed &&
      Array.isArray(parsed.s)
    ) {
      return toStrings(parsed.s);
    }
  } catch {
    return [];
  }
  return [];
}

function createTimeoutSignal(
  parentSignal: AbortSignal,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  const timer = window.setTimeout(abort, timeoutMs);
  parentSignal.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      window.clearTimeout(timer);
      parentSignal.removeEventListener("abort", abort);
    },
  };
}

export async function fetchOnlineSuggestions(
  providerId: SearchProviderId,
  query: string,
  signal: AbortSignal,
): Promise<Suggestion[]> {
  if (providerId === "custom") {
    return [];
  }
  const provider = SEARCH_PROVIDERS[providerId];
  if (!provider.suggestionUrl) {
    return [];
  }
  const timeout = createTimeoutSignal(signal, 900);
  try {
    const response = await fetch(
      provider.suggestionUrl.replace("{query}", encodeURIComponent(query)),
      {
        signal: timeout.signal,
        credentials: "omit",
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return [];
    }
    const values =
      providerId === "baidu"
        ? parseBaiduSuggestions(await response.text())
        : providerId === "google"
          ? parseGoogleSuggestions((await response.json()) as unknown)
          : parseBingSuggestions((await response.json()) as unknown);
    return values.slice(0, 6).map((title, index) => ({
      id: `online:${providerId}:${title.toLocaleLowerCase()}`,
      source: "online",
      title,
      query: title,
      score: 100 - index,
    }));
  } catch {
    return [];
  } finally {
    timeout.dispose();
  }
}
