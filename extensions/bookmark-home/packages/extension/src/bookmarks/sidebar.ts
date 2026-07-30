import { t } from "../core/i18n";
import type { BookmarkNode, BookmarkRepository, TreeRow } from "../core/types";
import {
  chooseDestination,
  confirmDelete,
  openEntryDialog,
} from "../ui/dialogs";
import { BookmarkTreeModel } from "./tree-model";

const OVERSCAN = 7;

interface SidebarElements {
  viewport: HTMLElement;
  spacer: HTMLElement;
  content: HTMLElement;
  empty: HTMLElement;
  filter: HTMLInputElement;
  add: HTMLButtonElement;
  popoverRoot: HTMLElement;
}

export class BookmarkSidebar {
  readonly model: BookmarkTreeModel;
  readonly #elements: SidebarElements;
  readonly #showToast: (message: string) => void;
  readonly #onExpandedChange: (ids: ReadonlySet<string>) => void;
  #rows: TreeRow[] = [];
  #selectedId: string | null = null;
  #draggedId: string | null = null;
  #filterTimer = 0;
  #searchSequence = 0;
  #renderFrame = 0;
  #markedFirstRows = false;
  #rowHeight: number;

  constructor(
    repository: BookmarkRepository,
    elements: SidebarElements,
    options: {
      showToast: (message: string) => void;
      onExpandedChange: (ids: ReadonlySet<string>) => void;
      rowHeight: number;
    },
  ) {
    this.model = new BookmarkTreeModel(repository);
    this.#elements = elements;
    this.#showToast = options.showToast;
    this.#onExpandedChange = options.onExpandedChange;
    this.#rowHeight = options.rowHeight;
  }

  async initialize(expandedIds: ReadonlySet<string>): Promise<void> {
    this.model.subscribe(() => {
      if (!this.#elements.filter.value.trim()) {
        this.#rows = this.model.rows();
        this.#scheduleRender();
      }
    });
    this.#bindEvents();
    await this.model.initialize(expandedIds);
    this.#rows = this.model.rows();
    this.#render();
  }

  dispose(): void {
    this.model.dispose();
    window.clearTimeout(this.#filterTimer);
    window.cancelAnimationFrame(this.#renderFrame);
  }

  setRowHeight(rowHeight: number): void {
    if (
      !Number.isFinite(rowHeight) ||
      rowHeight <= 0 ||
      rowHeight === this.#rowHeight
    ) {
      return;
    }
    const scrollRow = this.#elements.viewport.scrollTop / this.#rowHeight;
    this.#rowHeight = rowHeight;
    this.#elements.viewport.scrollTop = scrollRow * rowHeight;
    this.#render();
  }

  #bindEvents(): void {
    this.#elements.viewport.addEventListener("scroll", () =>
      this.#scheduleRender(),
    );
    window.addEventListener("resize", () => this.#scheduleRender(), {
      passive: true,
    });
    this.#elements.filter.addEventListener("input", () => {
      window.clearTimeout(this.#filterTimer);
      this.#filterTimer = window.setTimeout(() => {
        void this.#applyFilter();
      }, 120);
    });
    this.#elements.add.addEventListener("click", () => {
      void this.#createAtSelection();
    });
    this.#elements.viewport.addEventListener("keydown", (event) => {
      void this.#handleKeyboard(event);
    });
    document.addEventListener("click", (event) => {
      if (!(event.target as Element).closest(".popover, .tree-menu")) {
        this.#elements.popoverRoot.replaceChildren();
      }
    });
  }

  async #applyFilter(): Promise<void> {
    const sequence = ++this.#searchSequence;
    const query = this.#elements.filter.value.trim();
    const rows = await this.model.search(query);
    if (sequence !== this.#searchSequence) {
      return;
    }
    this.#rows = rows;
    this.#elements.viewport.scrollTop = 0;
    this.#render();
  }

  #scheduleRender(): void {
    if (this.#renderFrame) {
      return;
    }
    this.#renderFrame = window.requestAnimationFrame(() => {
      this.#renderFrame = 0;
      this.#render();
    });
  }

  #render(): void {
    const { viewport, spacer, content, empty } = this.#elements;
    const total = this.#rows.length;
    spacer.style.height = `${Math.max(viewport.clientHeight, total * this.#rowHeight)}px`;
    empty.hidden = total > 0;
    empty.textContent = t("noBookmarks");
    if (total === 0) {
      content.replaceChildren();
      return;
    }
    const start = Math.max(
      0,
      Math.floor(viewport.scrollTop / this.#rowHeight) - OVERSCAN,
    );
    const visibleCount =
      Math.ceil(viewport.clientHeight / this.#rowHeight) + OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);
    const fragment = document.createDocumentFragment();
    for (let index = start; index < end; index += 1) {
      const row = this.#rows[index];
      if (row) {
        fragment.append(this.#createRow(row, index));
      }
    }
    content.replaceChildren(fragment);
    if (!this.#markedFirstRows) {
      this.#markedFirstRows = true;
      performance.mark("bookmark-home:first-bookmark-rows");
    }
  }

  #createRow(row: TreeRow, index: number): HTMLElement {
    const element = document.createElement("div");
    element.className = "tree-row";
    element.dataset.id = row.node.id;
    element.setAttribute("role", "treeitem");
    element.setAttribute("aria-level", String(row.depth + 1));
    element.setAttribute(
      "aria-selected",
      String(row.node.id === this.#selectedId),
    );
    element.style.setProperty("--tree-depth", String(row.depth));
    element.style.transform = `translateY(${index * this.#rowHeight}px)`;
    if (row.node.id === this.#selectedId) {
      element.classList.add("is-selected");
    }
    if (!row.node.url) {
      element.setAttribute("aria-expanded", String(row.expanded));
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = row.node.url
      ? "tree-toggle is-placeholder"
      : "tree-toggle";
    toggle.tabIndex = -1;
    toggle.setAttribute(
      "aria-label",
      row.expanded ? t("collapseBookmarks") : t("expandFolder"),
    );
    if (!row.node.url) {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.#toggleFolder(row.node.id);
      });
    }

    const label = row.node.url
      ? document.createElement("a")
      : document.createElement("button");
    label.className = "tree-label";
    label.tabIndex = -1;
    if (label instanceof HTMLAnchorElement && row.node.url) {
      label.href = row.node.url;
    } else {
      label.setAttribute("type", "button");
    }
    const icon = document.createElement("span");
    icon.className = row.node.url ? "node-icon" : "node-icon folder";
    if (row.node.url) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.src = `${chrome.runtime.getURL("/_favicon/")}?pageUrl=${encodeURIComponent(row.node.url)}&size=32`;
      icon.append(image);
    }
    const title = document.createElement("span");
    title.textContent = row.node.title || row.node.url || t("bookmarks");
    label.append(icon, title);
    label.addEventListener("click", (event) => {
      this.#select(row.node.id);
      if (!row.node.url) {
        event.preventDefault();
        void this.#toggleFolder(row.node.id);
      }
    });

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "tree-menu";
    menu.tabIndex = -1;
    menu.setAttribute("aria-label", t("edit"));
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      this.#select(row.node.id);
      this.#openMenu(row.node, menu);
    });

    element.draggable = this.#canModify(row.node);
    element.addEventListener("dragstart", (event) => {
      this.#draggedId = row.node.id;
      event.dataTransfer?.setData("text/plain", row.node.id);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
    });
    element.addEventListener("dragend", () => {
      this.#draggedId = null;
      document
        .querySelectorAll(".tree-row.is-drop-target")
        .forEach((node) => node.classList.remove("is-drop-target"));
    });
    element.addEventListener("dragover", (event) => {
      if (this.#draggedId && this.#draggedId !== row.node.id) {
        event.preventDefault();
        element.classList.add("is-drop-target");
      }
    });
    element.addEventListener("dragleave", () =>
      element.classList.remove("is-drop-target"),
    );
    element.addEventListener("drop", (event) => {
      event.preventDefault();
      element.classList.remove("is-drop-target");
      void this.#dropOn(row.node);
    });
    element.addEventListener("click", () => this.#select(row.node.id));
    element.append(toggle, label, menu);
    return element;
  }

  async #toggleFolder(id: string): Promise<void> {
    await this.model.toggleFolder(id);
    this.#onExpandedChange(this.model.expandedIds);
  }

  #select(id: string): void {
    this.#selectedId = id;
    this.#scheduleRender();
  }

  async #createAtSelection(initialType?: "bookmark" | "folder"): Promise<void> {
    const selected = this.#selectedId
      ? this.model.getNode(this.#selectedId)
      : undefined;
    const selectedParent = selected?.url ? selected.parentId : selected?.id;
    const parentId = selectedParent ?? this.model.rootFolders[0]?.id;
    if (!parentId) {
      return;
    }
    const result = await openEntryDialog({
      mode: "create",
      ...(initialType === undefined ? {} : { initialType }),
    });
    if (!result) {
      return;
    }
    try {
      await this.model.create({
        parentId,
        title: result.title,
        ...(result.url === undefined ? {} : { url: result.url }),
      });
      await this.model.ensureChildrenLoaded(parentId);
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  #openMenu(node: BookmarkNode, anchor: HTMLElement): void {
    const popover = document.createElement("div");
    popover.className = "popover";
    popover.setAttribute("role", "menu");
    const rect = anchor.getBoundingClientRect();
    popover.style.left = `${Math.min(rect.left, window.innerWidth - 210)}px`;
    popover.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 230)}px`;

    const addAction = (
      id: string,
      label: string,
      action: () => void,
      className = "",
    ): void => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = id;
      button.textContent = label;
      button.className = className;
      button.addEventListener("click", () => {
        this.#elements.popoverRoot.replaceChildren();
        action();
      });
      popover.append(button);
    };

    if (node.url) {
      addAction("open-new-tab", t("openInNewTab"), () =>
        window.open(node.url, "_blank", "noopener"),
      );
    } else if (!node.unmodifiable) {
      addAction("add-bookmark", t("addBookmark"), () => {
        this.#selectedId = node.id;
        void this.#createAtSelection("bookmark");
      });
      addAction("add-folder", t("addFolder"), () => {
        this.#selectedId = node.id;
        void this.#createAtSelection("folder");
      });
    }
    if (this.#canModify(node)) {
      addAction("edit", t("edit"), () => void this.#edit(node));
      addAction("move", t("moveTo"), () => void this.#moveWithDialog(node));
      addAction("delete", t("delete"), () => void this.#delete(node), "danger");
    }
    this.#elements.popoverRoot.replaceChildren(popover);
    popover.querySelector<HTMLButtonElement>("button")?.focus();
  }

  async #edit(node: BookmarkNode): Promise<void> {
    const result = await openEntryDialog({ mode: "edit", node });
    if (!result) {
      return;
    }
    try {
      await this.model.update(node.id, {
        title: result.title,
        ...(result.url === undefined ? {} : { url: result.url }),
      });
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  async #delete(node: BookmarkNode): Promise<void> {
    if (!(await confirmDelete(node))) {
      return;
    }
    try {
      await this.model.remove(node.id);
      if (this.#selectedId === node.id) {
        this.#selectedId = null;
      }
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  async #moveWithDialog(node: BookmarkNode): Promise<void> {
    const folders = this.model
      .rows()
      .map((row) => row.node)
      .filter(
        (candidate) =>
          !candidate.url && candidate.id !== node.id && !candidate.unmodifiable,
      );
    const parentId = await chooseDestination(folders, node.parentId);
    if (!parentId) {
      return;
    }
    try {
      await this.model.move(node.id, { parentId });
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  async #dropOn(target: BookmarkNode): Promise<void> {
    const draggedId = this.#draggedId;
    this.#draggedId = null;
    if (!draggedId || draggedId === target.id) {
      return;
    }
    const parentId = target.url ? target.parentId : target.id;
    if (!parentId) {
      return;
    }
    const moveTarget = target.url
      ? { parentId, index: target.index ?? 0 }
      : { parentId };
    try {
      await this.model.move(draggedId, moveTarget);
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  async #handleKeyboard(event: KeyboardEvent): Promise<void> {
    if (this.#rows.length === 0) {
      return;
    }
    const index = this.#selectedId
      ? this.#rows.findIndex((row) => row.node.id === this.#selectedId)
      : -1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.max(
        0,
        Math.min(this.#rows.length - 1, index + direction),
      );
      const row = this.#rows[next];
      if (row) {
        this.#select(row.node.id);
        this.#scrollRowIntoView(next);
      }
      return;
    }
    const row = index >= 0 ? this.#rows[index] : undefined;
    if (!row) {
      return;
    }
    if (event.key === "ArrowRight" && !row.node.url && !row.expanded) {
      event.preventDefault();
      await this.#toggleFolder(row.node.id);
    } else if (event.key === "ArrowLeft" && !row.node.url && row.expanded) {
      event.preventDefault();
      await this.#toggleFolder(row.node.id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (row.node.url) {
        window.location.assign(row.node.url);
      } else {
        await this.#toggleFolder(row.node.id);
      }
    } else if (event.key === "Delete" && this.#canModify(row.node)) {
      event.preventDefault();
      await this.#delete(row.node);
    }
  }

  #scrollRowIntoView(index: number): void {
    const top = index * this.#rowHeight;
    const bottom = top + this.#rowHeight;
    const viewport = this.#elements.viewport;
    if (top < viewport.scrollTop) {
      viewport.scrollTop = top;
    } else if (bottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = bottom - viewport.clientHeight;
    }
  }

  #canModify(node: BookmarkNode): boolean {
    return !node.unmodifiable && node.folderType === undefined;
  }
}
