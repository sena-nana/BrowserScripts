import type { HomeBackgroundV1, HomeLink, SettingsV2 } from "../core/types";
import { providerHomepage } from "../search/providers";

export class HomeController {
  readonly #topLinks: HTMLElement;
  #settings: SettingsV2;
  #background: HomeBackgroundV1 | null;

  constructor(
    topLinks: HTMLElement,
    settings: SettingsV2,
    background: HomeBackgroundV1 | null,
  ) {
    this.#topLinks = topLinks;
    this.#settings = structuredClone(settings);
    this.#background = background ? structuredClone(background) : null;
  }

  initialize(): void {
    this.#applyBackground();
    this.#renderTopLinks();
  }

  update(settings: SettingsV2, background: HomeBackgroundV1 | null): void {
    this.#settings = structuredClone(settings);
    this.#background = background ? structuredClone(background) : null;
    this.#applyBackground();
    this.#renderTopLinks();
  }

  preview(settings: SettingsV2, background: HomeBackgroundV1 | null): void {
    this.update(settings, background);
  }

  #applyBackground(): void {
    document.body.classList.toggle(
      "has-custom-background",
      Boolean(this.#background),
    );
    document.body.style.backgroundImage = this.#background
      ? `url("${this.#background.dataUrl}")`
      : "";
  }

  #renderTopLinks(): void {
    const links =
      this.#settings.home.topLinks.length > 0
        ? this.#settings.home.topLinks
        : [providerHomepage(this.#settings.search)];
    this.#topLinks.replaceChildren(...links.map((link) => this.#link(link)));
  }

  #link(link: HomeLink): HTMLAnchorElement {
    const anchor = document.createElement("a");
    anchor.className = "top-link";
    anchor.href = link.url;
    anchor.title = link.title;
    anchor.dataset.id = link.id;
    anchor.textContent = link.title;
    return anchor;
  }
}
