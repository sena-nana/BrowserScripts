import type {
  BookmarkCreateInput,
  BookmarkEvent,
  BookmarkEventListener,
  BookmarkMoveTarget,
  BookmarkNode,
  BookmarkRepository,
} from "../core/types";

export function fromChromeNode(
  node: chrome.bookmarks.BookmarkTreeNode,
): BookmarkNode {
  return {
    id: node.id,
    title: node.title,
    ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
    ...(node.index === undefined ? {} : { index: node.index }),
    ...(node.url === undefined ? {} : { url: node.url }),
    ...(node.dateAdded === undefined ? {} : { dateAdded: node.dateAdded }),
    ...(node.dateLastUsed === undefined
      ? {}
      : { dateLastUsed: node.dateLastUsed }),
    ...(node.folderType === undefined ? {} : { folderType: node.folderType }),
    ...(node.unmodifiable === undefined
      ? {}
      : { unmodifiable: node.unmodifiable }),
  };
}

function flattenTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    result.push(fromChromeNode(node));
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

export class ChromeBookmarkRepository implements BookmarkRepository {
  readonly #listeners = new Set<BookmarkEventListener>();

  getRootChildren = async (): Promise<BookmarkNode[]> => {
    const [root] = await chrome.bookmarks.getTree();
    return (root?.children ?? []).map(fromChromeNode);
  };

  getAll = async (): Promise<BookmarkNode[]> =>
    flattenTree(await chrome.bookmarks.getTree());

  getChildren = async (parentId: string): Promise<BookmarkNode[]> =>
    (await chrome.bookmarks.getChildren(parentId)).map(fromChromeNode);

  getNode = async (id: string): Promise<BookmarkNode | null> => {
    const [node] = await chrome.bookmarks.get(id);
    return node ? fromChromeNode(node) : null;
  };

  getSubTree = async (id: string): Promise<BookmarkNode[]> =>
    flattenTree(await chrome.bookmarks.getSubTree(id));

  search = async (query: string): Promise<BookmarkNode[]> =>
    (await chrome.bookmarks.search(query)).map(fromChromeNode);

  create = async (input: BookmarkCreateInput): Promise<BookmarkNode> =>
    fromChromeNode(await chrome.bookmarks.create(input));

  update = async (
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<BookmarkNode> =>
    fromChromeNode(await chrome.bookmarks.update(id, changes));

  move = async (
    id: string,
    target: BookmarkMoveTarget,
  ): Promise<BookmarkNode> =>
    fromChromeNode(await chrome.bookmarks.move(id, target));

  remove = async (id: string, recursive: boolean): Promise<void> => {
    if (recursive) {
      await chrome.bookmarks.removeTree(id);
    } else {
      await chrome.bookmarks.remove(id);
    }
  };

  subscribe(listener: BookmarkEventListener): () => void {
    this.#listeners.add(listener);
    if (this.#listeners.size === 1) {
      this.#listen();
    }
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) {
        this.#unlisten();
      }
    };
  }

  readonly #emit = (event: BookmarkEvent): void => {
    for (const listener of this.#listeners) {
      listener(event);
    }
  };

  readonly #created = (
    _id: string,
    node: chrome.bookmarks.BookmarkTreeNode,
  ): void => {
    this.#emit({ type: "created", node: fromChromeNode(node) });
  };

  readonly #changed = (
    id: string,
    info: { title: string; url?: string },
  ): void => {
    this.#emit({
      type: "changed",
      id,
      title: info.title,
      ...(info.url === undefined ? {} : { url: info.url }),
    });
  };

  readonly #moved = (
    id: string,
    info: {
      parentId: string;
      index: number;
      oldParentId: string;
      oldIndex: number;
    },
  ): void => {
    this.#emit({
      type: "moved",
      id,
      parentId: info.parentId,
      index: info.index,
      oldParentId: info.oldParentId,
      oldIndex: info.oldIndex,
    });
  };

  readonly #removed = (
    id: string,
    info: {
      parentId: string;
      index: number;
      node: chrome.bookmarks.BookmarkTreeNode;
    },
  ): void => {
    this.#emit({
      type: "removed",
      id,
      parentId: info.parentId,
      index: info.index,
    });
  };

  readonly #reordered = (id: string, info: { childIds: string[] }): void => {
    this.#emit({ type: "reordered", parentId: id, childIds: info.childIds });
  };

  readonly #importBegan = (): void => {
    this.#emit({ type: "import-began" });
  };

  readonly #importEnded = (): void => {
    this.#emit({ type: "import-ended" });
  };

  #listen(): void {
    chrome.bookmarks.onCreated.addListener(this.#created);
    chrome.bookmarks.onChanged.addListener(this.#changed);
    chrome.bookmarks.onMoved.addListener(this.#moved);
    chrome.bookmarks.onRemoved.addListener(this.#removed);
    chrome.bookmarks.onChildrenReordered.addListener(this.#reordered);
    chrome.bookmarks.onImportBegan.addListener(this.#importBegan);
    chrome.bookmarks.onImportEnded.addListener(this.#importEnded);
  }

  #unlisten(): void {
    chrome.bookmarks.onCreated.removeListener(this.#created);
    chrome.bookmarks.onChanged.removeListener(this.#changed);
    chrome.bookmarks.onMoved.removeListener(this.#moved);
    chrome.bookmarks.onRemoved.removeListener(this.#removed);
    chrome.bookmarks.onChildrenReordered.removeListener(this.#reordered);
    chrome.bookmarks.onImportBegan.removeListener(this.#importBegan);
    chrome.bookmarks.onImportEnded.removeListener(this.#importEnded);
  }
}
