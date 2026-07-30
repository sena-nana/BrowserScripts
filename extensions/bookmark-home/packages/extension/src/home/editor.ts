import { t } from "../core/i18n";
import type { SettingsStore } from "../core/settings";
import type {
  HomeBackgroundV1,
  SearchProviderId,
  SettingsV2,
} from "../core/types";
import { isValidCustomSearchUrl, SEARCH_PROVIDERS } from "../search/providers";
import { prepareBackground } from "./background";

interface EditorContext {
  store: SettingsStore;
  preview: (settings: SettingsV2, background: HomeBackgroundV1 | null) => void;
  cancelPreview: () => void;
  showToast: (message: string) => void;
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "edit-field";
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
  wrapper.classList.add("edit-check");
  return { wrapper, input };
}

export function openHomeEditor(context: EditorContext): void {
  const root = document.querySelector<HTMLElement>("#home-editor-root");
  if (!root || root.childElementCount > 0) {
    return;
  }
  let draft = context.store.settings;
  let background = context.store.homeBackground;

  const panel = document.createElement("aside");
  panel.id = "home-editor";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", t("editHome"));
  const heading = document.createElement("h2");
  heading.textContent = t("editHome");

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  const searchGroup = document.createElement("section");
  searchGroup.className = "home-edit-group";
  const searchHeading = document.createElement("h3");
  searchHeading.textContent = t("search");
  const provider = document.createElement("select");
  provider.append(
    option("google", SEARCH_PROVIDERS.google.name),
    option("bing", SEARCH_PROVIDERS.bing.name),
    option("baidu", SEARCH_PROVIDERS.baidu.name),
    option("custom", t("custom")),
  );
  provider.value = draft.search.provider;
  const customName = document.createElement("input");
  customName.type = "text";
  customName.maxLength = 60;
  customName.value = draft.search.customName;
  const customUrl = document.createElement("input");
  customUrl.type = "url";
  customUrl.maxLength = 2_048;
  customUrl.value = draft.search.customSearchUrl;
  const customNameField = field(t("customEngineName"), customName);
  const customUrlField = field(t("customSearchUrl"), customUrl);
  const history = checkbox(t("historySuggestions"));
  history.input.checked = draft.search.historySuggestions;
  const online = checkbox(t("onlineSuggestions"));
  online.input.checked = draft.search.onlineSuggestions;
  searchGroup.append(
    searchHeading,
    field(t("searchEngine"), provider),
    customNameField,
    customUrlField,
    history.wrapper,
    online.wrapper,
  );

  const bar = document.createElement("footer");
  bar.className = "home-edit-bar";
  const backgroundInput = document.createElement("input");
  backgroundInput.type = "file";
  backgroundInput.accept = "image/png,image/jpeg,image/webp,image/avif";
  backgroundInput.hidden = true;
  const upload = document.createElement("button");
  upload.type = "button";
  upload.className = "edit-action";
  upload.textContent = t("chooseBackground");
  const removeBackground = document.createElement("button");
  removeBackground.type = "button";
  removeBackground.className = "edit-action";
  removeBackground.textContent = t("removeBackground");
  removeBackground.hidden = !background;
  const spacer = document.createElement("span");
  spacer.className = "edit-bar-spacer";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "edit-action";
  cancel.textContent = t("cancel");
  const save = document.createElement("button");
  save.type = "button";
  save.className = "edit-action primary";
  save.textContent = t("save");
  bar.append(backgroundInput, upload, removeBackground, spacer, cancel, save);

  panel.append(heading, error, searchGroup);
  root.append(panel, bar);
  document.body.classList.add("home-editing");

  const showCustomSearch = (): void => {
    const visible = provider.value === "custom";
    customNameField.hidden = !visible;
    customUrlField.hidden = !visible;
  };

  const syncDraft = (): void => {
    draft = {
      ...draft,
      search: {
        ...draft.search,
        provider: provider.value as SearchProviderId,
        customName: customName.value.trim(),
        customSearchUrl: customUrl.value.trim(),
        historySuggestions: history.input.checked,
        onlineSuggestions: online.input.checked,
      },
    };
  };

  const preview = (): void => {
    syncDraft();
    context.preview(draft, background);
  };

  const finish = (restore: boolean): void => {
    if (restore) {
      context.cancelPreview();
    }
    document.body.classList.remove("home-editing");
    root.replaceChildren();
  };

  provider.addEventListener("change", () => {
    showCustomSearch();
    preview();
  });
  for (const control of [customName, customUrl, history.input, online.input]) {
    control.addEventListener("change", preview);
  }
  upload.addEventListener("click", () => backgroundInput.click());
  backgroundInput.addEventListener("change", async () => {
    const file = backgroundInput.files?.[0];
    if (!file) {
      return;
    }
    try {
      upload.disabled = true;
      upload.textContent = t("loading");
      background = await prepareBackground(file);
      removeBackground.hidden = false;
      context.preview(draft, background);
    } catch {
      context.showToast(t("backgroundInvalid"));
    } finally {
      upload.disabled = false;
      upload.textContent = t("chooseBackground");
      backgroundInput.value = "";
    }
  });
  removeBackground.addEventListener("click", () => {
    background = null;
    removeBackground.hidden = true;
    context.preview(draft, background);
  });
  cancel.addEventListener("click", () => finish(true));
  save.addEventListener("click", async () => {
    syncDraft();
    const customSearchValid =
      draft.search.provider !== "custom" ||
      isValidCustomSearchUrl(draft.search.customSearchUrl);
    if (!customSearchValid) {
      error.textContent = t("urlInvalid");
      error.hidden = false;
      return;
    }
    save.disabled = true;
    try {
      await context.store.saveHomeDraft(draft, background);
      finish(false);
    } catch {
      save.disabled = false;
      context.showToast(t("unableToSave"));
    }
  });

  showCustomSearch();
  heading.focus();
}
