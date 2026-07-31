import { t } from "../core/i18n";
import type { BookmarkNode, BookmarkRepository, TreeRow } from "../core/types";
import {
  chooseDestination,
  confirmDelete,
  confirmEmptyTrash,
  confirmPermanentDelete,
  openEntryDialog,
} from "../ui/dialogs";
import { BookmarkTreeModel, type BookmarkViewScope } from "./tree-model";

const OVERSCAN = 7;
const POPOVER_GAP = 4;
const POPOVER_VIEWPORT_INSET = 8;

interface MenuPoint {
  x: number;
  y: number;
}

interface SidebarElements {
  viewport: HTMLElement;
  spacer: HTMLElement;
  content: HTMLElement;
  empty: HTMLElement;
  filter: HTMLInputElement;
  add: HTMLButtonElement;
  title: HTMLElement;
  count: HTMLElement;
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
  #headerTimer = 0;
  #headerSequence = 0;
  #searchSequence = 0;
  #scopeSequence = 0;
  #popoverSequence = 0;
  #renderFrame = 0;
  #markedFirstRows = false;
  #rowHeight: number;
  readonly #verticalPadding: number;

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
    this.#verticalPadding =
      Number.parseFloat(getComputedStyle(elements.content).top) || 0;
  }

  async initialize(expandedIds: ReadonlySet<string>): Promise<void> {
    this.model.subscribe(() => {
      if (!this.#elements.filter.value.trim()) {
        this.#rows = this.model.rows();
        this.#scheduleRender();
      }
      this.#scheduleHeaderUpdate();
    });
    this.#bindEvents();
    await this.model.initialize(expandedIds);
    this.#rows = this.model.rows();
    this.#render();
    await this.#updateHeader();
  }

  dispose(): void {
    this.model.dispose();
    window.clearTimeout(this.#filterTimer);
    window.clearTimeout(this.#headerTimer);
    window.cancelAnimationFrame(this.#renderFrame);
  }

  get targetScope(): BookmarkViewScope {
    return this.model.targetScope;
  }

  get hasTrash(): boolean {
    return this.model.hasTrash;
  }

  async setScope(scope: BookmarkViewScope): Promise<void> {
    const sequence = ++this.#scopeSequence;
    this.#closePopover();
    this.#selectedId = null;
    this.#draggedId = null;
    this.#searchSequence += 1;
    this.#elements.filter.value = "";
    this.#elements.viewport.scrollTop = 0;
    try {
      if (
        !(await this.model.setScope(scope)) ||
        sequence !== this.#scopeSequence
      ) {
        return;
      }
      this.#rows = this.model.rows();
      this.#render();
      await this.#updateHeader();
    } catch {
      if (sequence !== this.#scopeSequence) {
        return;
      }
      this.#rows = this.model.rows();
      this.#render();
      await this.#updateHeader();
      this.#showToast(t("unableToLoadBookmarks"));
    }
  }

  setRowHeight(rowHeight: number): void {
    if (
      !Number.isFinite(rowHeight) ||
      rowHeight <= 0 ||
      rowHeight === this.#rowHeight
    ) {
      return;
    }
    const scrollRow =
      Math.max(0, this.#elements.viewport.scrollTop - this.#verticalPadding) /
      this.#rowHeight;
    this.#rowHeight = rowHeight;
    this.#elements.viewport.scrollTop =
      scrollRow * rowHeight + this.#verticalPadding;
    this.#render();
  }

  #bindEvents(): void {
    this.#elements.viewport.addEventListener("scroll", () => {
      this.#closePopover();
      this.#scheduleRender();
    });
    window.addEventListener(
      "resize",
      () => {
        this.#closePopover();
        this.#scheduleRender();
      },
      {
        passive: true,
      },
    );
    this.#elements.filter.addEventListener("input", () => {
      window.clearTimeout(this.#filterTimer);
      this.#filterTimer = window.setTimeout(() => {
        void this.#applyFilter();
      }, 120);
    });
    this.#elements.add.addEventListener("click", () => {
      if (this.model.scope === "trash") {
        void this.#emptyTrash();
      } else {
        void this.#createAtSelection();
      }
    });
    this.#elements.viewport.addEventListener("keydown", (event) => {
      void this.#handleKeyboard(event);
    });
    document.addEventListener("click", (event) => {
      if (!(event.target as Element).closest(".popover, .tree-menu")) {
        this.#closePopover();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this.#elements.popoverRoot.querySelector(".tree-popover")
      ) {
        event.preventDefault();
        this.#closePopover();
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

  #scheduleHeaderUpdate(): void {
    window.clearTimeout(this.#headerTimer);
    this.#headerTimer = window.setTimeout(() => {
      this.#headerTimer = 0;
      void this.#updateHeader();
    }, 40);
  }

  async #updateHeader(): Promise<void> {
    const sequence = ++this.#headerSequence;
    const scope = this.model.scope;
    const count = await this.model.countBookmarks();
    if (sequence !== this.#headerSequence || scope !== this.model.scope) {
      return;
    }
    const trash = scope === "trash";
    this.#elements.count.textContent = String(count);
    this.#elements.title.textContent = t(trash ? "trash" : "bookmarks");
    this.#elements.add.classList.toggle("is-text-action", trash);
    this.#elements.add.disabled = trash && !this.model.hasScopeItems;
    this.#elements.add.setAttribute(
      "aria-label",
      t(trash ? "emptyTrash" : "addBookmarkItem"),
    );
    if (trash) {
      this.#elements.add.textContent = t("emptyTrash");
    } else {
      const icon = document.createElement("span");
      icon.className = "icon icon-add";
      icon.setAttribute("aria-hidden", "true");
      this.#elements.add.replaceChildren(icon);
    }
  }

  #render(): void {
    const { viewport, spacer, content, empty } = this.#elements;
    const total = this.#rows.length;
    spacer.style.height = `${Math.max(
      viewport.clientHeight,
      total * this.#rowHeight + this.#verticalPadding * 2,
    )}px`;
    empty.hidden = total > 0;
    empty.textContent = t(
      this.model.scope === "trash" ? "noTrashBookmarks" : "noBookmarks",
    );
    if (total === 0) {
      content.replaceChildren();
      return;
    }
    const start = Math.max(
      0,
      Math.floor(
        Math.max(0, viewport.scrollTop - this.#verticalPadding) /
          this.#rowHeight,
      ) - OVERSCAN,
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
    const scope = this.model.scope;
    const element = document.createElement("div");
    element.className = "tree-row";
    element.dataset.id = row.node.id;
    element.dataset.scope = scope;
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
      void this.#openMenu(
        row.node,
        scope,
        menu,
        event.detail > 0 ? { x: event.clientX, y: event.clientY } : undefined,
      );
    });

    element.draggable = scope === "bookmarks" && this.#canModify(row.node);
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.#select(row.node.id);
      void this.#openMenu(row.node, scope, label, {
        x: event.clientX,
        y: event.clientY,
      });
    });
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
      if (
        this.model.scope === "bookmarks" &&
        this.#draggedId &&
        this.#draggedId !== row.node.id
      ) {
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
      void this.#dropOn(row.node, scope);
    });
    element.addEventListener("click", () => this.#select(row.node.id));
    element.append(label, menu);
    return element;
  }

  async #toggleFolder(id: string): Promise<void> {
    if (this.model.isScopeSwitching) {
      return;
    }
    await this.model.toggleFolder(id);
    if (this.model.scope === "bookmarks") {
      this.#onExpandedChange(this.model.expandedIds);
    }
  }

  #select(id: string): void {
    if (id === this.#selectedId) {
      return;
    }
    if (this.#selectedId) {
      this.#setRenderedSelection(this.#selectedId, false);
    }
    this.#selectedId = id;
    this.#setRenderedSelection(id, true);
  }

  #setRenderedSelection(id: string, selected: boolean): void {
    const element = this.#elements.content.querySelector<HTMLElement>(
      `.tree-row[data-id="${CSS.escape(id)}"]`,
    );
    if (!element) {
      return;
    }
    element.classList.toggle("is-selected", selected);
    element.setAttribute("aria-selected", String(selected));
  }

  async #createAtSelection(initialType?: "bookmark" | "folder"): Promise<void> {
    if (this.model.scope !== "bookmarks" || this.model.isScopeSwitching) {
      return;
    }
    const selected = this.#selectedId
      ? this.model.getNode(this.#selectedId)
      : undefined;
    const selectedParent = selected?.url ? selected.parentId : selected?.id;
    const parentId = selectedParent ?? this.model.activeRoot?.id;
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

  async #openMenu(
    node: BookmarkNode,
    scope: BookmarkViewScope,
    anchor: HTMLElement,
    point?: MenuPoint,
  ): Promise<void> {
    const sequence = ++this.#popoverSequence;
    if (
      !(await this.model.isNodeInScope(node.id, scope)) ||
      sequence !== this.#popoverSequence
    ) {
      return;
    }
    const popover = document.createElement("div");
    popover.className = "popover tree-popover";
    popover.setAttribute("role", "menu");

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
        this.#closePopover();
        action();
      });
      popover.append(button);
    };

    if (node.url) {
      addAction("open-new-tab", t("openInNewTab"), () =>
        window.open(node.url, "_blank", "noopener"),
      );
    }
    if (scope === "trash") {
      addAction(
        "restore",
        t("restoreTo"),
        () => void this.#restore(node, scope),
      );
      addAction(
        "permanently-delete",
        t("permanentlyDelete"),
        () => void this.#deletePermanently(node, scope),
        "danger",
      );
    } else if (!node.url && !node.unmodifiable) {
      addAction("add-bookmark", t("addBookmark"), () => {
        this.#selectedId = node.id;
        void this.#createAtSelection("bookmark");
      });
      addAction("add-folder", t("addFolder"), () => {
        this.#selectedId = node.id;
        void this.#createAtSelection("folder");
      });
    }
    if (scope === "bookmarks" && this.#canModify(node)) {
      addAction("edit", t("edit"), () => void this.#edit(node, scope));
      addAction(
        "move",
        t("moveTo"),
        () => void this.#moveWithDialog(node, scope),
      );
      addAction(
        "delete",
        t("delete"),
        () => void this.#delete(node, scope),
        "danger",
      );
    }
    this.#elements.popoverRoot.replaceChildren(popover);
    this.#positionMenu(popover, anchor, point);
    popover.querySelector<HTMLButtonElement>("button")?.focus();
  }

  #positionMenu(
    popover: HTMLElement,
    anchor: HTMLElement,
    point?: MenuPoint,
  ): void {
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const origin = point ?? {
      x: anchorRect.left,
      y: anchorRect.bottom + POPOVER_GAP,
    };
    const preferredLeft =
      origin.x + popoverRect.width <= window.innerWidth - POPOVER_VIEWPORT_INSET
        ? origin.x
        : origin.x - popoverRect.width;
    const preferredTop =
      origin.y + popoverRect.height <=
      window.innerHeight - POPOVER_VIEWPORT_INSET
        ? origin.y
        : origin.y - popoverRect.height;
    const maxLeft = Math.max(
      POPOVER_VIEWPORT_INSET,
      window.innerWidth - popoverRect.width - POPOVER_VIEWPORT_INSET,
    );
    const maxTop = Math.max(
      POPOVER_VIEWPORT_INSET,
      window.innerHeight - popoverRect.height - POPOVER_VIEWPORT_INSET,
    );
    const left = Math.min(
      Math.max(POPOVER_VIEWPORT_INSET, preferredLeft),
      maxLeft,
    );
    const top = Math.min(
      Math.max(POPOVER_VIEWPORT_INSET, preferredTop),
      maxTop,
    );
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  #closePopover(): void {
    this.#popoverSequence += 1;
    this.#elements.popoverRoot.replaceChildren();
  }

  async #confirmInScope(
    node: BookmarkNode,
    scope: BookmarkViewScope,
    confirm: (node: BookmarkNode) => Promise<boolean>,
  ): Promise<boolean> {
    return (
      (await this.model.isNodeInScope(node.id, scope)) &&
      (await confirm(node)) &&
      (await this.model.isNodeInScope(node.id, scope))
    );
  }

  async #edit(node: BookmarkNode, scope: BookmarkViewScope): Promise<void> {
    if (!(await this.model.isNodeInScope(node.id, scope))) {
      return;
    }
    const result = await openEntryDialog({ mode: "edit", node });
    if (!result || !(await this.model.isNodeInScope(node.id, scope))) {
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

  async #delete(node: BookmarkNode, scope: BookmarkViewScope): Promise<void> {
    if (!(await this.#confirmInScope(node, scope, confirmDelete))) {
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

  async #deletePermanently(
    node: BookmarkNode,
    scope: BookmarkViewScope,
  ): Promise<void> {
    if (!(await this.#confirmInScope(node, scope, confirmPermanentDelete))) {
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

  async #emptyTrash(): Promise<void> {
    if (
      this.model.scope !== "trash" ||
      this.model.isScopeSwitching ||
      !this.model.hasScopeItems ||
      !(await confirmEmptyTrash()) ||
      this.model.scope !== "trash" ||
      this.model.isScopeSwitching
    ) {
      return;
    }
    try {
      await this.model.emptyTrash();
      this.#selectedId = null;
    } catch {
      this.#showToast(t("unableToEmptyTrash"));
    }
  }

  async #restore(node: BookmarkNode, scope: BookmarkViewScope): Promise<void> {
    if (!(await this.model.isNodeInScope(node.id, scope))) {
      return;
    }
    const folders = await this.model.destinationFolders(node.id);
    const parentId = await chooseDestination(folders, undefined, "restore");
    if (!parentId || !(await this.model.isNodeInScope(node.id, scope))) {
      return;
    }
    try {
      await this.model.move(node.id, { parentId });
      if (this.#selectedId === node.id) {
        this.#selectedId = null;
      }
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  async #moveWithDialog(
    node: BookmarkNode,
    scope: BookmarkViewScope,
  ): Promise<void> {
    if (!(await this.model.isNodeInScope(node.id, scope))) {
      return;
    }
    const folders = await this.model.destinationFolders(node.id);
    const parentId = await chooseDestination(folders, node.parentId);
    if (!parentId || !(await this.model.isNodeInScope(node.id, scope))) {
      return;
    }
    try {
      await this.model.move(node.id, { parentId });
    } catch {
      this.#showToast(t("unableToSave"));
    }
  }

  async #dropOn(target: BookmarkNode, scope: BookmarkViewScope): Promise<void> {
    if (
      scope !== "bookmarks" ||
      !(await this.model.isNodeInScope(target.id, scope))
    ) {
      return;
    }
    const draggedId = this.#draggedId;
    this.#draggedId = null;
    if (!draggedId || draggedId === target.id) {
      return;
    }
    if (!(await this.model.isNodeInScope(draggedId, scope))) {
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
    } else if (
      event.key === "Delete" &&
      (this.model.scope === "trash" || this.#canModify(row.node))
    ) {
      event.preventDefault();
      if (this.model.scope === "trash") {
        await this.#deletePermanently(row.node, "trash");
      } else {
        await this.#delete(row.node, "bookmarks");
      }
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
