import { t } from "../core/i18n";
import type { SettingsStore } from "../core/settings";
import type {
  SearchProviderId,
  SettingsV4,
  ThemePreference,
} from "../core/types";
import { prepareBackground } from "../home/background";
import { isValidCustomSearchUrl, SEARCH_PROVIDERS } from "../search/providers";

interface SettingsCardContext {
  store: SettingsStore;
  previewAppearance: (appearance: SettingsV4["appearance"]) => void;
  showToast: (message: string) => void;
  trigger: HTMLElement;
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "settings-field";
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text, control);
  return wrapper;
}

function checkbox(label: string): {
  wrapper: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const input = document.createElement("input");
  input.type = "checkbox";
  const wrapper = field(label, input);
  wrapper.classList.add("settings-switch");
  return { wrapper, input };
}

function range(
  label: string,
  id: string,
  min: number,
  max: number,
): {
  wrapper: HTMLLabelElement;
  input: HTMLInputElement;
  output: HTMLOutputElement;
} {
  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  const output = document.createElement("output");
  const wrapper = field(label, input);
  wrapper.classList.add("range-field");
  wrapper.append(output);
  return { wrapper, input, output };
}

function section(title: string): HTMLElement {
  const element = document.createElement("section");
  element.className = "settings-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  element.append(heading);
  return element;
}

export function openSettingsCard(context: SettingsCardContext): void {
  const root = document.querySelector<HTMLElement>("#settings-root");
  if (!root) {
    return;
  }
  const existing = root.querySelector<HTMLElement>(".settings-card");
  if (existing) {
    existing.querySelector<HTMLButtonElement>(".settings-close")?.focus();
    return;
  }

  const card = document.createElement("aside");
  card.className = "settings-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", t("settings"));

  const header = document.createElement("header");
  const heading = document.createElement("h2");
  heading.textContent = t("settings");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button settings-close";
  close.setAttribute("aria-label", t("cancel"));
  close.textContent = "×";
  header.append(heading, close);

  const content = document.createElement("div");
  content.className = "settings-grid";

  const appearance = section(t("searchAppearance"));
  const theme = document.createElement("select");
  theme.id = "settings-theme";
  theme.append(
    option("system", t("system")),
    option("light", t("light")),
    option("dark", t("dark")),
  );

  const density = document.createElement("select");
  density.id = "settings-sidebar-density";
  density.append(
    option("compact", t("compact")),
    option("standard", t("standard")),
    option("relaxed", t("relaxed")),
  );

  const {
    wrapper: widthField,
    input: width,
    output: widthOutput,
  } = range(t("sidebarWidth"), "settings-sidebar-width", 260, 480);

  const collapsed = checkbox(t("collapseBookmarks"));
  collapsed.input.id = "settings-sidebar-collapsed";
  appearance.append(
    field(t("theme"), theme),
    field(t("sidebarDensity"), density),
    widthField,
    collapsed.wrapper,
  );

  const background = section(t("background"));
  const backgroundInput = document.createElement("input");
  backgroundInput.id = "settings-background-file";
  backgroundInput.type = "file";
  backgroundInput.accept = "image/png,image/jpeg,image/webp,image/avif";
  backgroundInput.hidden = true;
  const backgroundActions = document.createElement("div");
  backgroundActions.className = "background-actions";
  const upload = document.createElement("button");
  upload.type = "button";
  upload.className = "button";
  upload.textContent = t("chooseBackground");
  const removeBackground = document.createElement("button");
  removeBackground.id = "settings-remove-background";
  removeBackground.type = "button";
  removeBackground.className = "button";
  removeBackground.textContent = t("removeBackground");
  backgroundActions.append(upload, removeBackground);

  const {
    wrapper: panelTransparencyField,
    input: panelTransparency,
    output: panelTransparencyOutput,
  } = range(t("panelTransparency"), "settings-panel-transparency", 0, 90);
  const {
    wrapper: backdropBlurField,
    input: backdropBlur,
    output: backdropBlurOutput,
  } = range(t("backdropBlur"), "settings-backdrop-blur", 0, 30);

  background.append(
    backgroundInput,
    backgroundActions,
    panelTransparencyField,
    backdropBlurField,
  );

  const search = section(t("search"));
  const provider = document.createElement("select");
  provider.id = "settings-search-provider";
  provider.append(
    option("google", SEARCH_PROVIDERS.google.name),
    option("bing", SEARCH_PROVIDERS.bing.name),
    option("baidu", SEARCH_PROVIDERS.baidu.name),
    option("custom", t("custom")),
  );
  const customName = document.createElement("input");
  customName.id = "settings-custom-name";
  customName.type = "text";
  customName.maxLength = 60;
  const customUrl = document.createElement("input");
  customUrl.id = "settings-custom-url";
  customUrl.type = "url";
  customUrl.maxLength = 2_048;
  const customNameField = field(t("customEngineName"), customName);
  const customUrlField = field(t("customSearchUrl"), customUrl);
  const customUrlError = document.createElement("span");
  customUrlError.className = "field-error";
  customUrlError.setAttribute("role", "alert");
  customUrlError.textContent = t("urlInvalid");
  customUrlError.hidden = true;
  customUrlField.append(customUrlError);
  const history = checkbox(t("historySuggestions"));
  history.input.id = "settings-history-suggestions";
  const online = checkbox(t("onlineSuggestions"));
  online.input.id = "settings-online-suggestions";
  search.append(
    field(t("searchEngine"), provider),
    customNameField,
    customUrlField,
    history.wrapper,
    online.wrapper,
  );

  content.append(appearance, background, search);
  card.append(header, content);
  root.append(card);

  const showCustomSearch = (): void => {
    const visible = provider.value === "custom";
    customNameField.hidden = !visible;
    customUrlField.hidden = !visible;
  };

  const appearanceFromControls = (): SettingsV4["appearance"] => ({
    theme: theme.value as ThemePreference,
    sidebarWidth: Number(width.value),
    sidebarCollapsed: collapsed.input.checked,
    sidebarDensity: density.value as SettingsV4["appearance"]["sidebarDensity"],
    panelTransparency: Number(panelTransparency.value),
    backdropBlur: Number(backdropBlur.value),
  });

  const sync = (settings: SettingsV4): void => {
    theme.value = settings.appearance.theme;
    width.value = String(settings.appearance.sidebarWidth);
    widthOutput.textContent = `${settings.appearance.sidebarWidth}px`;
    collapsed.input.checked = settings.appearance.sidebarCollapsed;
    density.value = settings.appearance.sidebarDensity;
    panelTransparency.value = String(settings.appearance.panelTransparency);
    panelTransparencyOutput.textContent = `${settings.appearance.panelTransparency}%`;
    backdropBlur.value = String(settings.appearance.backdropBlur);
    backdropBlurOutput.textContent = `${settings.appearance.backdropBlur}px`;
    provider.value = settings.search.provider;
    customName.value = settings.search.customName;
    customUrl.value = settings.search.customSearchUrl;
    history.input.checked = settings.search.historySuggestions;
    online.input.checked = settings.search.onlineSuggestions;
    const currentBackground = context.store.homeBackground;
    removeBackground.hidden = !currentBackground;
    panelTransparency.disabled = !currentBackground;
    backdropBlur.disabled = !currentBackground;
    showCustomSearch();
  };

  const persist = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch {
      sync(context.store.settings);
      context.previewAppearance(context.store.settings.appearance);
      context.showToast(t("unableToSave"));
    }
  };

  const bindAppearanceRange = (
    input: HTMLInputElement,
    output: HTMLOutputElement,
    suffix: string,
    save: (value: number) => Promise<void>,
  ): void => {
    input.addEventListener("input", () => {
      output.textContent = `${input.value}${suffix}`;
      context.previewAppearance(appearanceFromControls());
    });
    input.addEventListener("change", () => {
      void persist(() => save(Number(input.value)));
    });
  };

  sync(context.store.settings);
  const unsubscribe = context.store.subscribe(sync);
  let closing = false;

  const focusable = (): HTMLElement[] =>
    [
      ...card.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled])",
      ),
    ].filter((element) => !element.hidden && element.offsetParent !== null);

  const finish = (restoreFocus = true): void => {
    if (closing) {
      return;
    }
    closing = true;
    unsubscribe();
    document.removeEventListener("pointerdown", handleOutside);
    document.removeEventListener("keydown", handleKeydown);
    card.classList.add("is-closing");
    const remove = (): void => {
      card.remove();
      if (restoreFocus && context.trigger.isConnected) {
        context.trigger.focus();
      }
    };
    void Promise.allSettled(
      card.getAnimations().map((animation) => animation.finished),
    ).then(remove);
  };

  const handleOutside = (event: PointerEvent): void => {
    if (
      context.trigger.id === "open-settings" &&
      context.trigger.contains(event.target as Node)
    ) {
      return;
    }
    if (!card.contains(event.target as Node)) {
      finish(false);
    }
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const elements = focusable();
    const first = elements[0];
    const last = elements.at(-1);
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  close.addEventListener("click", () => finish());
  document.addEventListener("pointerdown", handleOutside);
  document.addEventListener("keydown", handleKeydown);

  theme.addEventListener("change", () => {
    void persist(() =>
      context.store.updateAppearance({
        theme: theme.value as ThemePreference,
      }),
    );
  });
  density.addEventListener("change", () => {
    void persist(() =>
      context.store.updateAppearance({
        sidebarDensity:
          density.value as SettingsV4["appearance"]["sidebarDensity"],
      }),
    );
  });
  bindAppearanceRange(width, widthOutput, "px", (sidebarWidth) =>
    context.store.updateAppearance({ sidebarWidth }),
  );
  collapsed.input.addEventListener("change", () => {
    void persist(() =>
      context.store.updateAppearance({
        sidebarCollapsed: collapsed.input.checked,
      }),
    );
  });
  bindAppearanceRange(
    panelTransparency,
    panelTransparencyOutput,
    "%",
    (panelTransparency) =>
      context.store.updateAppearance({ panelTransparency }),
  );
  bindAppearanceRange(backdropBlur, backdropBlurOutput, "px", (backdropBlur) =>
    context.store.updateAppearance({ backdropBlur }),
  );

  provider.addEventListener("change", () => {
    showCustomSearch();
    void persist(() =>
      context.store.updateSearch({
        provider: provider.value as SearchProviderId,
      }),
    );
  });
  customName.addEventListener("change", () => {
    void persist(() =>
      context.store.updateSearch({ customName: customName.value.trim() }),
    );
  });
  customUrl.addEventListener("input", () => {
    if (isValidCustomSearchUrl(customUrl.value.trim())) {
      customUrl.removeAttribute("aria-invalid");
      customUrlError.hidden = true;
    }
  });
  customUrl.addEventListener("change", () => {
    const value = customUrl.value.trim();
    if (!isValidCustomSearchUrl(value)) {
      customUrl.setAttribute("aria-invalid", "true");
      customUrlError.hidden = false;
      return;
    }
    customUrl.removeAttribute("aria-invalid");
    customUrlError.hidden = true;
    void persist(() => context.store.updateSearch({ customSearchUrl: value }));
  });
  history.input.addEventListener("change", () => {
    void persist(() =>
      context.store.updateSearch({
        historySuggestions: history.input.checked,
      }),
    );
  });
  online.input.addEventListener("change", () => {
    void persist(() =>
      context.store.updateSearch({
        onlineSuggestions: online.input.checked,
      }),
    );
  });

  upload.addEventListener("click", () => backgroundInput.click());
  backgroundInput.addEventListener("change", async () => {
    const file = backgroundInput.files?.[0];
    if (!file) {
      return;
    }
    upload.disabled = true;
    upload.textContent = t("loading");
    try {
      const prepared = await prepareBackground(file);
      await persist(() => context.store.updateHomeBackground(prepared));
    } catch {
      context.showToast(t("backgroundInvalid"));
    } finally {
      upload.disabled = false;
      upload.textContent = t("chooseBackground");
      backgroundInput.value = "";
    }
  });
  removeBackground.addEventListener("click", () => {
    void persist(() => context.store.updateHomeBackground(null));
  });

  close.focus();
}
