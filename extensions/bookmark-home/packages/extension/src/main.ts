import "./styles.css";

import { ChromeBookmarkRepository } from "./bookmarks/chrome-repository";
import { BookmarkSidebar } from "./bookmarks/sidebar";
import { localizeDocument, t } from "./core/i18n";
import { applyTheme, SettingsStore } from "./core/settings";
import type { SettingsV2 } from "./core/types";
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

function showToast(message: string): void {
  const toast = requiredElement<HTMLElement>("#toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2_800);
}

function applyAppearance(appearance: SettingsV2["appearance"]): void {
  applyTheme(appearance.theme);
  document.documentElement.style.setProperty(
    "--sidebar-width",
    `${appearance.sidebarWidth}px`,
  );
  document.body.classList.toggle(
    "sidebar-collapsed",
    appearance.sidebarCollapsed,
  );
}

function openSettings(): void {
  void import("./settings/drawer").then(({ openSettingsDrawer }) => {
    openSettingsDrawer({
      store: settingsStore,
      previewAppearance: applyAppearance,
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
  const tools = requiredElement<HTMLElement>(".sidebar-tools");
  const filter = requiredElement<HTMLInputElement>("#bookmark-filter");

  open.addEventListener("click", () => {
    void settingsStore.updateAppearance({ sidebarCollapsed: false });
  });
  toggleFilter.addEventListener("click", () => {
    tools.hidden = false;
    filter.focus();
  });
  closeFilter.addEventListener("click", () => {
    filter.value = "";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    tools.hidden = true;
    toggleFilter.focus();
  });
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const popover = document.createElement("div");
    popover.className = "popover sidebar-popover";
    popover.setAttribute("role", "menu");
    const rect = menu.getBoundingClientRect();
    popover.style.left = `${Math.max(8, rect.right - 190)}px`;
    popover.style.top = `${rect.bottom + 4}px`;
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
    addAction(t("settings"), openSettings);
    addAction(t("collapseBookmarks"), () => {
      void settingsStore.updateAppearance({ sidebarCollapsed: true });
    });
    popoverRoot.replaceChildren(popover);
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

function bindBookmarkCount(): void {
  const output = requiredElement<HTMLElement>("#bookmark-count");
  let timer = 0;
  const update = async (): Promise<void> => {
    const nodes = await repository.getAll();
    output.textContent = String(nodes.filter((node) => node.url).length);
  };
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void update(), 80);
  };
  repository.subscribe(schedule);
  void update();
}

async function run(): Promise<void> {
  performance.mark("bookmark-home:bootstrap");
  localizeDocument();
  performance.mark("bookmark-home:shell-ready");
  await settingsStore.load();
  applyAppearance(settingsStore.settings.appearance);
  bindSidebarLayout();

  const sidebar = new BookmarkSidebar(
    repository,
    {
      viewport: requiredElement("#bookmark-tree"),
      spacer: requiredElement("#tree-spacer"),
      content: requiredElement("#tree-content"),
      empty: requiredElement("#tree-empty"),
      filter: requiredElement("#bookmark-filter"),
      add: requiredElement("#add-bookmark-item"),
      popoverRoot: requiredElement("#popover-root"),
    },
    {
      showToast,
      onExpandedChange: (ids) => {
        void settingsStore.saveExpandedFolderIds(ids);
      },
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

  await sidebar.initialize(settingsStore.expandedFolderIds);
  bindBookmarkCount();

  const home = new HomeController(settingsStore.homeBackground);
  home.initialize();

  settingsStore.subscribe((settings) => {
    applyAppearance(settings.appearance);
    search.updateSettings(settings.search);
    home.update(settingsStore.homeBackground);
  });

  requiredElement<HTMLButtonElement>("#edit-home").addEventListener(
    "click",
    () => {
      void import("./home/editor").then(({ openHomeEditor }) => {
        openHomeEditor({
          store: settingsStore,
          preview: (settings, background) => {
            search.updateSettings(settings.search);
            home.preview(background);
          },
          cancelPreview: () => {
            const settings = settingsStore.settings;
            search.updateSettings(settings.search);
            home.update(settingsStore.homeBackground);
          },
          showToast,
        });
      });
    },
  );

  performance.mark("bookmark-home:ready");
}

void run();
