import { t } from "../core/i18n";
import type { BookmarkNode } from "../core/types";

interface EntryDialogResult {
  type: "bookmark" | "folder";
  title: string;
  url?: string;
}

function dialogRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("#dialog-root");
  if (!root) {
    throw new Error("Dialog root is missing");
  }
  return root;
}

function createBackdrop(): HTMLDivElement {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  dialogRoot().replaceChildren(backdrop);
  return backdrop;
}

function closeBackdrop(backdrop: HTMLElement): void {
  backdrop.remove();
}

function field(
  labelText: string,
  input: HTMLInputElement | HTMLSelectElement,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "form-field";
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, input);
  return label;
}

function button(label: string, className = "button"): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function openEntryDialog(options: {
  mode: "create" | "edit";
  node?: BookmarkNode;
  initialType?: "bookmark" | "folder";
}): Promise<EntryDialogResult | null> {
  return new Promise((resolve) => {
    const backdrop = createBackdrop();
    const form = document.createElement("form");
    form.className = "modal";
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");

    const editing = options.mode === "edit";
    const originalType = options.node?.url ? "bookmark" : "folder";
    const heading = document.createElement("h2");
    heading.textContent = editing
      ? t(originalType === "bookmark" ? "editBookmark" : "editFolder")
      : t("addBookmarkItem");

    const typeSelect = document.createElement("select");
    for (const [value, label] of [
      ["bookmark", t("newBookmark")],
      ["folder", t("newFolder")],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      typeSelect.append(option);
    }
    typeSelect.value = editing
      ? originalType
      : (options.initialType ?? "bookmark");
    typeSelect.disabled = editing;

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = 240;
    titleInput.value = options.node?.title ?? "";
    titleInput.required = true;

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.inputMode = "url";
    urlInput.value = options.node?.url ?? "";

    const error = document.createElement("p");
    error.className = "form-error";
    error.setAttribute("role", "alert");
    error.hidden = true;

    const typeField = field(t("folder"), typeSelect);
    const urlField = field(t("url"), urlInput);
    const syncType = (): void => {
      urlField.hidden = typeSelect.value === "folder";
      typeField.hidden = editing;
    };
    typeSelect.addEventListener("change", syncType);
    syncType();

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancel = button(t("cancel"));
    const save = button(editing ? t("save") : t("create"), "button primary");
    save.type = "submit";
    actions.append(cancel, save);

    form.append(
      heading,
      typeField,
      field(t("name"), titleInput),
      urlField,
      error,
      actions,
    );
    backdrop.append(form);

    const finish = (value: EntryDialogResult | null): void => {
      closeBackdrop(backdrop);
      resolve(value);
    };
    cancel.addEventListener("click", () => finish(null));
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        finish(null);
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        error.textContent = t("titleRequired");
        error.hidden = false;
        titleInput.focus();
        return;
      }
      if (typeSelect.value === "folder") {
        finish({ type: "folder", title });
        return;
      }
      const url = normalizeHttpUrl(urlInput.value);
      if (!url) {
        error.textContent = t("urlInvalid");
        error.hidden = false;
        urlInput.focus();
        return;
      }
      finish({ type: "bookmark", title, url });
    });
    titleInput.focus();
  });
}

export async function confirmDelete(node: BookmarkNode): Promise<boolean> {
  return confirmDestructiveAction({
    heading: t(node.url ? "deleteBookmark" : "deleteFolder"),
    copy: t(node.url ? "confirmDeleteBookmark" : "confirmDeleteFolder"),
    action: t("delete"),
  });
}

export async function confirmPermanentDelete(
  node: BookmarkNode,
): Promise<boolean> {
  return confirmDestructiveAction({
    heading: t(
      node.url ? "permanentlyDeleteBookmark" : "permanentlyDeleteFolder",
    ),
    copy: t(
      node.url
        ? "confirmPermanentlyDeleteBookmark"
        : "confirmPermanentlyDeleteFolder",
    ),
    action: t("permanentlyDelete"),
  });
}

export async function confirmEmptyTrash(): Promise<boolean> {
  return confirmDestructiveAction({
    heading: t("emptyTrash"),
    copy: t("confirmEmptyTrash"),
    action: t("emptyTrash"),
  });
}

function confirmDestructiveAction(options: {
  heading: string;
  copy: string;
  action: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = createBackdrop();
    const modal = document.createElement("section");
    modal.className = "modal";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");

    const heading = document.createElement("h2");
    heading.textContent = options.heading;
    const copy = document.createElement("p");
    copy.textContent = options.copy;
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancel = button(t("cancel"));
    const remove = button(options.action, "button danger");
    actions.append(cancel, remove);
    modal.append(heading, copy, actions);
    backdrop.append(modal);

    const finish = (value: boolean): void => {
      closeBackdrop(backdrop);
      resolve(value);
    };
    cancel.addEventListener("click", () => finish(false));
    remove.addEventListener("click", () => finish(true));
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        finish(false);
      }
    });
    cancel.focus();
  });
}

export async function chooseDestination(
  folders: BookmarkNode[],
  currentParentId: string | undefined,
  mode: "move" | "restore" = "move",
): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = createBackdrop();
    const form = document.createElement("form");
    form.className = "modal";
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    const heading = document.createElement("h2");
    heading.textContent = t(mode === "restore" ? "restoreTo" : "moveTo");
    const select = document.createElement("select");
    for (const folder of folders) {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.title || t("bookmarks");
      option.selected = folder.id === currentParentId;
      select.append(option);
    }
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancel = button(t("cancel"));
    const move = button(
      t(mode === "restore" ? "restore" : "move"),
      "button primary",
    );
    move.type = "submit";
    actions.append(cancel, move);
    form.append(heading, field(t("folder"), select), actions);
    backdrop.append(form);

    const finish = (value: string | null): void => {
      closeBackdrop(backdrop);
      resolve(value);
    };
    cancel.addEventListener("click", () => finish(null));
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        finish(null);
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(select.value || null);
    });
    select.focus();
  });
}
