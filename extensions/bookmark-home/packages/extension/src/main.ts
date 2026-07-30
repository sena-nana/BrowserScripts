import "./styles.css";

import { ChromeBookmarkRepository } from "./bookmarks/chrome-repository";
import { BookmarkSidebar } from "./bookmarks/sidebar";
import { localizeDocument, t } from "./core/i18n";
import { applyTheme, SettingsStore } from "./core/settings";
import type { SettingsV4 } from "./core/types";
import { HomeController } from "./home/controller";
import { SearchController } from "./search/controller";
import { SuggestionEngine } from "./search/suggestion-engine";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const settingsStore = new SettingsStore();
const repository = new ChromeBookmarkRepository();
let toastTimer = 0;
let bookmarkSidebar: BookmarkSidebar | null = null;

function shallowEqual<T extends object>(left: T, right: T): boolean {
  const keys = Object.keys(left) as (keyof T)[];
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => left[key] === right[key])
  );
}

function showToast(message: string): void {
  const toast = requiredElement<HTMLElement>("#toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2_800);
}

function sidebarRowHeight(): number {
  return Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--row-height"),
  );
}

function applyAppearance(appearance: SettingsV4["appearance"]): void {
  applyTheme(appearance.theme);
  document.documentElement.dataset.sidebarDensity = appearance.sidebarDensity;
  document.documentElement.style.setProperty(
    "--sidebar-width",
    `${appearance.sidebarWidth}px`,
  );
  document.documentElement.style.setProperty(
    "--custom-panel-alpha",
    String((100 - appearance.panelTransparency) / 100),
  );
  document.documentElement.style.setProperty(
    "--custom-backdrop-blur",
    `${appearance.backdropBlur}px`,
  );
  document.body.classList.toggle(
    "sidebar-collapsed",
    appearance.sidebarCollapsed,
  );
  bookmarkSidebar?.setRowHeight(sidebarRowHeight());
}

function revealInitialAppearance(): void {
  void document.documentElement.offsetWidth;
  document.documentElement.classList.remove("appearance-pending");
}

function openSettings(trigger: HTMLElement): void {
  const existing = document.querySelector<HTMLElement>(".settings-card");
  if (existing) {
    existing.querySelector<HTMLButtonElement>(".settings-close")?.click();
    return;
  }
  void import("./settings/card").then(({ openSettingsCard }) => {
    openSettingsCard({
      store: settingsStore,
      previewAppearance: applyAppearance,
      showToast,
      trigger,
    });
  });
}

function bindSidebarLayout(): void {
  const open = requiredElement<HTMLButtonElement>("#open-sidebar");
  const resize = requiredElement<HTMLElement>("#sidebar-resize");
  const menu = requiredElement<HTMLButtonElement>("#sidebar-menu");
  const popoverRoot = requiredElement<HTMLElement>("#popover-root");
  const toggleFilter = requiredElement<HTMLButtonElement>(
    "#toggle-bookmark-filter",
  );
  const closeFilter = requiredElement<HTMLButtonElement>(
    "#close-bookmark-filter",
  );
  const header = requiredElement<HTMLElement>(".sidebar-header");
  const filterPanel = requiredElement<HTMLElement>(".bookmark-filter");
  const filter = requiredElement<HTMLInputElement>("#bookmark-filter");

  open.addEventListener("click", () => {
    void settingsStore.updateAppearance({ sidebarCollapsed: false });
  });
  toggleFilter.addEventListener("click", () => {
    filterPanel.hidden = false;
    header.classList.add("is-filtering");
    filter.focus();
  });
  closeFilter.addEventListener("click", () => {
    filter.value = "";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    header.classList.remove("is-filtering");
    filterPanel.hidden = true;
    toggleFilter.focus();
  });
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const popover = document.createElement("div");
    popover.className = "popover sidebar-popover";
    popover.setAttribute("role", "menu");
    const rect = menu.getBoundingClientRect();
    const addAction = (label: string, action: () => void): void => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        popoverRoot.replaceChildren();
        action();
      });
      popover.append(button);
    };
    if (bookmarkSidebar?.hasTrash) {
      if (bookmarkSidebar.scope === "trash") {
        addAction(t("bookmarks"), () => {
          void bookmarkSidebar?.setScope("bookmarks");
        });
      } else {
        addAction(t("trash"), () => {
          void bookmarkSidebar?.setScope("trash");
        });
      }
    }
    addAction(t("settings"), () => openSettings(menu));
    addAction(t("collapseBookmarks"), () => {
      void settingsStore.updateAppearance({ sidebarCollapsed: true });
    });
    popoverRoot.replaceChildren(popover);
    const popoverRect = popover.getBoundingClientRect();
    popover.style.left = `${Math.max(8, rect.right - popoverRect.width)}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    popover.querySelector("button")?.focus();
  });

  resize.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    resize.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent): void => {
      const width = Math.min(480, Math.max(260, moveEvent.clientX));
      document.documentElement.style.setProperty(
        "--sidebar-width",
        `${width}px`,
      );
    };
    const onEnd = (endEvent: PointerEvent): void => {
      resize.releasePointerCapture(endEvent.pointerId);
      resize.removeEventListener("pointermove", onMove);
      resize.removeEventListener("pointerup", onEnd);
      resize.removeEventListener("pointercancel", onEnd);
      const width = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-width",
        ),
      );
      void settingsStore.updateAppearance({ sidebarWidth: width });
    };
    resize.addEventListener("pointermove", onMove);
    resize.addEventListener("pointerup", onEnd);
    resize.addEventListener("pointercancel", onEnd);
  });
}

async function run(): Promise<void> {
  performance.mark("bookmark-home:bootstrap");
  localizeDocument();
  await settingsStore.load();
  applyAppearance(settingsStore.settings.appearance);
  revealInitialAppearance();
  performance.mark("bookmark-home:shell-ready");
  bindSidebarLayout();

  bookmarkSidebar = new BookmarkSidebar(
    repository,
    {
      viewport: requiredElement("#bookmark-tree"),
      spacer: requiredElement("#tree-spacer"),
      content: requiredElement("#tree-content"),
      empty: requiredElement("#tree-empty"),
      filter: requiredElement("#bookmark-filter"),
      add: requiredElement("#add-bookmark-item"),
      title: requiredElement(".sidebar-title > span"),
      count: requiredElement("#bookmark-count"),
      popoverRoot: requiredElement("#popover-root"),
    },
    {
      showToast,
      onExpandedChange: (ids) => {
        void settingsStore.saveExpandedFolderIds(ids);
      },
      rowHeight: sidebarRowHeight(),
    },
  );
  const search = new SearchController(
    new SuggestionEngine(repository),
    {
      form: requiredElement("#web-search"),
      input: requiredElement("#web-search-input"),
      list: requiredElement("#search-suggestions"),
    },
    settingsStore.settings.search,
  );
  search.initialize();

  await bookmarkSidebar.initialize(settingsStore.expandedFolderIds);

  const home = new HomeController(settingsStore.homeBackground);
  home.initialize();

  let appliedSettings = settingsStore.settings;
  let appliedBackground = settingsStore.homeBackground;
  settingsStore.subscribe((settings) => {
    if (!shallowEqual(appliedSettings.appearance, settings.appearance)) {
      applyAppearance(settings.appearance);
    }
    if (!shallowEqual(appliedSettings.search, settings.search)) {
      search.updateSettings(settings.search);
    }
    const background = settingsStore.homeBackground;
    if (
      appliedBackground?.dataUrl !== background?.dataUrl ||
      appliedBackground?.updatedAt !== background?.updatedAt
    ) {
      home.update(background);
    }
    appliedSettings = settings;
    appliedBackground = background;
  });

  const settingsButton = requiredElement<HTMLButtonElement>("#open-settings");
  settingsButton.addEventListener("click", () => {
    openSettings(settingsButton);
  });

  performance.mark("bookmark-home:ready");
}

void run();
