import type {
  BookmarkEvent,
  BookmarkNode,
  BookmarkRepository,
  SettingsV4,
  Suggestion,
} from "../core/types";
import { fetchOnlineSuggestions } from "./providers";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function prefixBonus(value: string, query: string): number {
  const target = normalized(value);
  const needle = normalized(query);
  return target === needle ? 40 : target.startsWith(needle) ? 20 : 0;
}

export function mergeSuggestions(
  groups: Suggestion[][],
  limit = 8,
): Suggestion[] {
  const seen = new Set<string>();
  const merged = groups
    .flat()
    .sort((left, right) => right.score - left.score)
    .filter((item) => {
      const key = item.url
        ? `url:${normalized(item.url).replace(/\/$/, "")}`
        : `query:${normalized(item.query ?? item.title)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  return merged.slice(0, limit);
}

export class SuggestionEngine {
  readonly #bookmarks: BookmarkRepository;
  readonly #bookmarkIndex = new Map<
    string,
    { node: BookmarkNode & { url: string }; searchable: string }
  >();
  #warmPromise: Promise<void> | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor(bookmarks: BookmarkRepository) {
    this.#bookmarks = bookmarks;
    this.#unsubscribe = bookmarks.subscribe(this.#handleBookmarkEvent);
  }

  warm(force = false): Promise<void> {
    if (force) {
      this.#warmPromise = null;
    }
    this.#warmPromise ??= this.#bookmarks
      .getAll()
      .then((nodes) => {
        this.#bookmarkIndex.clear();
        nodes.forEach((node) => this.#indexNode(node));
      })
      .catch(() => {
        this.#bookmarkIndex.clear();
      });
    return this.#warmPromise;
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#bookmarkIndex.clear();
  }

  async suggest(
    query: string,
    settings: SettingsV4["search"],
    signal: AbortSignal,
  ): Promise<Suggestion[]> {
    const value = query.trim();
    if (!value || signal.aborted) {
      return [];
    }
    const bookmarkPromise = this.#bookmarkSuggestions(value);
    const historyPromise = settings.historySuggestions
      ? this.#historySuggestions(value)
      : Promise.resolve([]);
    const onlinePromise = settings.onlineSuggestions
      ? fetchOnlineSuggestions(settings.provider, value, signal)
      : Promise.resolve([]);
    const groups = await Promise.all([
      bookmarkPromise,
      historyPromise,
      onlinePromise,
    ]);
    return signal.aborted ? [] : mergeSuggestions(groups);
  }

  async #bookmarkSuggestions(query: string): Promise<Suggestion[]> {
    await this.warm();
    const needle = normalized(query);
    return [...this.#bookmarkIndex.values()]
      .filter((entry) => entry.searchable.includes(needle))
      .map((entry) => entry.node)
      .slice(0, 8)
      .map((node, index) => ({
        id: `bookmark:${node.id}`,
        source: "bookmark",
        title: node.title || node.url,
        url: node.url,
        score:
          300 +
          prefixBonus(node.title, query) +
          prefixBonus(node.url, query) -
          index,
      }));
  }

  readonly #handleBookmarkEvent = (event: BookmarkEvent): void => {
    if (event.type === "created") {
      this.#indexNode(event.node);
    } else if (event.type === "changed") {
      const existing = this.#bookmarkIndex.get(event.id)?.node;
      if (existing) {
        this.#indexNode({
          ...existing,
          title: event.title,
          ...(event.url === undefined ? {} : { url: event.url }),
        });
      }
    } else if (event.type === "removed") {
      this.#bookmarkIndex.delete(event.id);
    } else if (event.type === "import-ended") {
      void this.warm(true);
    }
  };

  #indexNode(node: BookmarkNode): void {
    if (!node.url) {
      this.#bookmarkIndex.delete(node.id);
      return;
    }
    this.#bookmarkIndex.set(node.id, {
      node: { ...node, url: node.url },
      searchable: normalized(`${node.title}\n${node.url}`),
    });
  }

  async #historySuggestions(query: string): Promise<Suggestion[]> {
    try {
      const items = await chrome.history.search({
        text: query,
        startTime: 0,
        maxResults: 8,
      });
      return items
        .filter(
          (item): item is typeof item & { url: string } =>
            typeof item.url === "string",
        )
        .map((item, index) => ({
          id: `history:${item.id ?? item.url}`,
          source: "history",
          title: item.title || item.url,
          url: item.url,
          score:
            200 +
            prefixBonus(item.title ?? "", query) +
            prefixBonus(item.url, query) -
            index,
        }));
    } catch {
      return [];
    }
  }
}
