import type { HomeBackgroundV1 } from "../core/types";

export class HomeController {
  #background: HomeBackgroundV1 | null;

  constructor(background: HomeBackgroundV1 | null) {
    this.#background = background ? structuredClone(background) : null;
  }

  initialize(): void {
    this.#applyBackground();
  }

  update(background: HomeBackgroundV1 | null): void {
    this.#background = background ? structuredClone(background) : null;
    this.#applyBackground();
  }

  preview(background: HomeBackgroundV1 | null): void {
    this.update(background);
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
}
