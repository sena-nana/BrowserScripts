import { t } from "../core/i18n";
import type { SettingsV2, Suggestion } from "../core/types";
import { providerName, resolveSearchInput } from "./providers";
import type { SuggestionEngine } from "./suggestion-engine";

interface SearchElements {
  form: HTMLFormElement;
  input: HTMLInputElement;
  list: HTMLUListElement;
}

export class SearchController {
  readonly #engine: SuggestionEngine;
  readonly #elements: SearchElements;
  #settings: SettingsV2["search"];
  #suggestions: Suggestion[] = [];
  #selectedIndex = -1;
  #timer = 0;
  #request: AbortController | null = null;

  constructor(
    engine: SuggestionEngine,
    elements: SearchElements,
    settings: SettingsV2["search"],
  ) {
    this.#engine = engine;
    this.#elements = elements;
    this.#settings = { ...settings };
  }

  initialize(): void {
    const warm = (): void => {
      void this.#engine.warm();
    };
    window.requestIdleCallback(warm, { timeout: 1_000 });
    this.#updatePlaceholder();
    this.#elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#navigate(
        this.#selectedSuggestionValue() ?? this.#elements.input.value,
        event instanceof SubmitEvent &&
          event.submitter instanceof HTMLElement &&
          event.submitter.dataset.newTab === "true",
      );
    });
    this.#elements.input.addEventListener("input", () => {
      this.#selectedIndex = -1;
      window.clearTimeout(this.#timer);
      this.#timer = window.setTimeout(() => {
        void this.#refreshSuggestions();
      }, 120);
    });
    this.#elements.input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.#moveSelection(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Escape") {
        this.#hideSuggestions();
      } else if (event.key === "Enter") {
        event.preventDefault();
        this.#navigate(
          this.#selectedSuggestionValue() ?? this.#elements.input.value,
          event.ctrlKey || event.metaKey,
        );
      }
    });
    document.addEventListener("keydown", (event) => {
      if (
        (event.key.toLocaleLowerCase() === "k" &&
          (event.ctrlKey || event.metaKey)) ||
        (event.key === "/" && document.activeElement !== this.#elements.input)
      ) {
        event.preventDefault();
        this.#elements.input.focus();
        this.#elements.input.select();
      }
    });
    document.addEventListener("click", (event) => {
      if (!(event.target as Element).closest("#web-search")) {
        this.#hideSuggestions();
      }
    });
  }

  dispose(): void {
    window.clearTimeout(this.#timer);
    this.#request?.abort();
    this.#engine.dispose();
  }

  updateSettings(settings: SettingsV2["search"]): void {
    this.#settings = { ...settings };
    this.#updatePlaceholder();
    this.#hideSuggestions();
  }

  async #refreshSuggestions(): Promise<void> {
    this.#request?.abort();
    const query = this.#elements.input.value.trim();
    if (!query) {
      this.#hideSuggestions();
      return;
    }
    const request = new AbortController();
    this.#request = request;
    const started = performance.now();
    const suggestions = await this.#engine.suggest(
      query,
      this.#settings,
      request.signal,
    );
    if (request.signal.aborted || this.#request !== request) {
      return;
    }
    performance.measure("bookmark-home:local-suggestions", {
      start: started,
      end: performance.now(),
    });
    this.#suggestions = suggestions;
    this.#selectedIndex = -1;
    this.#renderSuggestions();
  }

  #renderSuggestions(): void {
    const fragment = document.createDocumentFragment();
    this.#suggestions.forEach((suggestion, index) => {
      const item = document.createElement("li");
      item.className = "suggestion";
      item.dataset.source = suggestion.source;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === this.#selectedIndex));
      const icon = document.createElement("span");
      icon.className = "node-icon";
      if (suggestion.url) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = `${chrome.runtime.getURL("/_favicon/")}?pageUrl=${encodeURIComponent(suggestion.url)}&size=32`;
        icon.append(image);
      } else {
        icon.classList.add("icon", "icon-search");
      }
      const copy = document.createElement("span");
      copy.className = "suggestion-copy";
      const title = document.createElement("span");
      title.className = "suggestion-title";
      title.textContent = suggestion.title;
      copy.append(title);
      if (suggestion.url) {
        const url = document.createElement("span");
        url.className = "suggestion-url";
        url.textContent = suggestion.url;
        copy.append(url);
      }
      const source = document.createElement("span");
      source.className = "suggestion-source";
      source.textContent = t(
        suggestion.source === "bookmark"
          ? "bookmarks"
          : suggestion.source === "history"
            ? "history"
            : "online",
      );
      item.append(icon, copy, source);
      item.addEventListener("mousemove", () => {
        this.#selectedIndex = index;
        this.#syncSelection();
      });
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("click", (event) => {
        this.#navigate(
          suggestion.url ?? suggestion.query ?? suggestion.title,
          event.ctrlKey || event.metaKey || event.button === 1,
        );
      });
      fragment.append(item);
    });
    this.#elements.list.replaceChildren(fragment);
    this.#elements.list.hidden = this.#suggestions.length === 0;
  }

  #moveSelection(delta: number): void {
    if (this.#suggestions.length === 0) {
      return;
    }
    this.#selectedIndex =
      (this.#selectedIndex + delta + this.#suggestions.length) %
      this.#suggestions.length;
    this.#syncSelection();
  }

  #syncSelection(): void {
    const items = this.#elements.list.querySelectorAll('[role="option"]');
    items.forEach((item, index) => {
      item.setAttribute("aria-selected", String(index === this.#selectedIndex));
    });
  }

  #selectedSuggestionValue(): string | null {
    const suggestion = this.#suggestions[this.#selectedIndex];
    return suggestion
      ? (suggestion.url ?? suggestion.query ?? suggestion.title)
      : null;
  }

  #navigate(value: string, newTab: boolean): void {
    const url = resolveSearchInput(value, this.#settings);
    if (!url) {
      return;
    }
    this.#hideSuggestions();
    if (newTab) {
      window.open(url, "_blank", "noopener");
    } else {
      window.location.assign(url);
    }
  }

  #hideSuggestions(): void {
    this.#suggestions = [];
    this.#selectedIndex = -1;
    this.#elements.list.hidden = true;
    this.#elements.list.replaceChildren();
  }

  #updatePlaceholder(): void {
    this.#elements.input.placeholder = t("searchPlaceholder", {
      engine: providerName(this.#settings),
    });
  }
}
