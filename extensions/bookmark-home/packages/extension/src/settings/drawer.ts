import { t } from "../core/i18n";
import type { SettingsStore } from "../core/settings";
import type { SettingsV2, ThemePreference } from "../core/types";

interface DrawerContext {
  store: SettingsStore;
  previewAppearance: (appearance: SettingsV2["appearance"]) => void;
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function settingField(
  labelText: string,
  control: HTMLElement,
): HTMLLabelElement {
  const label = document.createElement("label");
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

export function openSettingsDrawer(context: DrawerContext): void {
  const root = document.querySelector<HTMLElement>("#settings-root");
  if (!root || root.childElementCount > 0) {
    return;
  }
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  const panel = document.createElement("aside");
  panel.className = "settings-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", t("settings"));

  const header = document.createElement("header");
  const heading = document.createElement("h2");
  heading.textContent = t("settings");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button";
  close.setAttribute("aria-label", t("cancel"));
  close.textContent = "×";
  header.append(heading, close);

  const appearanceGroup = document.createElement("section");
  appearanceGroup.className = "settings-group";
  const appearanceHeading = document.createElement("h3");
  appearanceHeading.textContent = t("searchAppearance");
  const theme = document.createElement("select");
  theme.append(
    option("system", t("system")),
    option("light", t("light")),
    option("dark", t("dark")),
  );
  const width = document.createElement("input");
  width.type = "range";
  width.min = "260";
  width.max = "480";
  width.step = "1";
  const widthOutput = document.createElement("output");
  const widthField = settingField(t("sidebarWidth"), width);
  widthField.append(widthOutput);
  const collapsed = document.createElement("input");
  collapsed.type = "checkbox";
  const collapsedField = settingField(t("collapseBookmarks"), collapsed);
  collapsedField.className = "switch-row";
  appearanceGroup.append(
    appearanceHeading,
    settingField(t("theme"), theme),
    widthField,
    collapsedField,
  );

  panel.append(header, appearanceGroup);
  backdrop.append(panel);
  root.append(backdrop);

  const sync = (settings: SettingsV2): void => {
    theme.value = settings.appearance.theme;
    width.value = String(settings.appearance.sidebarWidth);
    widthOutput.textContent = `${settings.appearance.sidebarWidth}px`;
    collapsed.checked = settings.appearance.sidebarCollapsed;
  };
  sync(context.store.settings);
  const unsubscribe = context.store.subscribe(sync);

  const finish = (): void => {
    unsubscribe();
    backdrop.remove();
  };
  close.addEventListener("click", finish);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) {
      finish();
    }
  });
  theme.addEventListener("change", () => {
    void context.store.updateAppearance({
      theme: theme.value as ThemePreference,
    });
  });
  width.addEventListener("input", () => {
    const appearance = {
      ...context.store.settings.appearance,
      sidebarWidth: Number(width.value),
    };
    widthOutput.textContent = `${appearance.sidebarWidth}px`;
    context.previewAppearance(appearance);
  });
  width.addEventListener("change", () => {
    void context.store.updateAppearance({
      sidebarWidth: Number(width.value),
    });
  });
  collapsed.addEventListener("change", () => {
    void context.store.updateAppearance({
      sidebarCollapsed: collapsed.checked,
    });
  });
  close.focus();
}
