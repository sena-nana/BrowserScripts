import type {
  BookmarkCreateInput,
  BookmarkEvent,
  BookmarkMoveTarget,
  BookmarkNode,
  BookmarkRepository,
  TreeRow,
} from "../core/types";

type TreeListener = () => void;

export class BookmarkTreeModel {
  readonly #nodes = new Map<string, BookmarkNode>();
  readonly #children = new Map<string, string[]>();
  readonly #loadedFolders = new Set<string>();
  readonly #loadingFolders = new Set<string>();
  readonly #expanded = new Set<string>();
  readonly #listeners = new Set<TreeListener>();
  readonly #repository: BookmarkRepository;
  #rootIds: string[] = [];
  #unsubscribeRepository: (() => void) | null = null;
  #importing = false;

  constructor(repository: BookmarkRepository) {
    this.#repository = repository;
  }

  async initialize(savedExpanded: ReadonlySet<string>): Promise<void> {
    this.#expanded.clear();
    savedExpanded.forEach((id) => this.#expanded.add(id));
    await this.#reloadRoots();
    this.#unsubscribeRepository = this.#repository.subscribe(
      this.#handleRepositoryEvent,
    );
    const bookmarkBar = this.#rootIds
      .map((id) => this.#nodes.get(id))
      .find((node) => node?.folderType === "bookmarks-bar");
    if (bookmarkBar && this.#expanded.size === 0) {
      this.#expanded.add(bookmarkBar.id);
    }
    await Promise.all(
      [...this.#expanded].map((id) => this.ensureChildrenLoaded(id)),
    );
    this.#emit();
  }

  dispose(): void {
    this.#unsubscribeRepository?.();
    this.#unsubscribeRepository = null;
    this.#listeners.clear();
  }

  subscribe(listener: TreeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get expandedIds(): ReadonlySet<string> {
    return new Set(this.#expanded);
  }

  getNode(id: string): BookmarkNode | undefined {
    const node = this.#nodes.get(id);
    return node ? { ...node } : undefined;
  }

  get rootFolders(): BookmarkNode[] {
    return this.#rootIds
      .map((id) => this.#nodes.get(id))
      .filter((node): node is BookmarkNode => node !== undefined && !node.url)
      .map((node) => ({ ...node }));
  }

  rows(): TreeRow[] {
    const result: TreeRow[] = [];
    const visit = (id: string, depth: number): void => {
      const node = this.#nodes.get(id);
      if (!node) {
        return;
      }
      result.push({
        node: { ...node },
        depth,
        expanded: this.#expanded.has(id),
        loading: this.#loadingFolders.has(id),
      });
      if (!node.url && this.#expanded.has(id)) {
        for (const childId of this.#children.get(id) ?? []) {
          visit(childId, depth + 1);
        }
      }
    };
    this.#rootIds.forEach((id) => visit(id, 0));
    return result;
  }

  async search(query: string): Promise<TreeRow[]> {
    const normalized = query.trim();
    if (!normalized) {
      return this.rows();
    }
    return (await this.#repository.search(normalized)).map((node) => ({
      node,
      depth: 0,
      expanded: false,
      loading: false,
    }));
  }

  async toggleFolder(id: string): Promise<void> {
    if (this.#expanded.delete(id)) {
      this.#emit();
      return;
    }
    this.#expanded.add(id);
    this.#emit();
    await this.ensureChildrenLoaded(id);
  }

  async ensureChildrenLoaded(id: string): Promise<void> {
    if (
      this.#loadedFolders.has(id) ||
      this.#loadingFolders.has(id) ||
      this.#nodes.get(id)?.url
    ) {
      return;
    }
    this.#loadingFolders.add(id);
    this.#emit();
    try {
      const children = await this.#repository.getChildren(id);
      this.#replaceChildren(id, children);
      this.#loadedFolders.add(id);
    } finally {
      this.#loadingFolders.delete(id);
      this.#emit();
    }
  }

  async create(input: BookmarkCreateInput): Promise<BookmarkNode> {
    const node = await this.#repository.create(input);
    this.#upsertCreated(node);
    this.#emit();
    return node;
  }

  async update(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<BookmarkNode> {
    const node = await this.#repository.update(id, changes);
    this.#nodes.set(id, node);
    this.#emit();
    return node;
  }

  async remove(id: string): Promise<void> {
    const node = this.#nodes.get(id);
    await this.#repository.remove(id, !node?.url);
    this.#removeKnownNode(id);
    this.#emit();
  }

  async move(id: string, target: BookmarkMoveTarget): Promise<void> {
    if (!(await this.canMove(id, target.parentId))) {
      throw new Error("invalid-move");
    }
    const node = this.#nodes.get(id);
    if (!node?.parentId) {
      throw new Error("missing-parent");
    }
    const previous = {
      parentId: node.parentId,
      index: this.#children.get(node.parentId)?.indexOf(id) ?? node.index ?? 0,
    };
    this.#applyMove(
      id,
      target.parentId,
      target.index ?? Number.MAX_SAFE_INTEGER,
    );
    this.#emit();
    try {
      const moved = await this.#repository.move(id, target);
      this.#nodes.set(id, moved);
    } catch (error) {
      this.#applyMove(id, previous.parentId, previous.index);
      this.#emit();
      throw error;
    }
  }

  async canMove(id: string, parentId: string): Promise<boolean> {
    if (id === parentId || this.#nodes.get(id)?.unmodifiable) {
      return false;
    }
    let currentId: string | undefined = parentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      if (currentId === id) {
        return false;
      }
      visited.add(currentId);
      const cached = this.#nodes.get(currentId);
      const node: BookmarkNode | null =
        cached ?? (await this.#repository.getNode(currentId));
      currentId = node?.parentId;
    }
    return true;
  }

  readonly #handleRepositoryEvent = (event: BookmarkEvent): void => {
    if (event.type === "import-began") {
      this.#importing = true;
      return;
    }
    if (event.type === "import-ended") {
      this.#importing = false;
      void this.#reloadVisible();
      return;
    }
    if (this.#importing) {
      return;
    }
    switch (event.type) {
      case "created":
        this.#upsertCreated(event.node);
        break;
      case "changed": {
        const node = this.#nodes.get(event.id);
        if (node) {
          this.#nodes.set(event.id, {
            ...node,
            title: event.title,
            ...(event.url === undefined ? {} : { url: event.url }),
          });
        }
        break;
      }
      case "moved":
        this.#applyMove(event.id, event.parentId, event.index);
        break;
      case "removed":
        this.#removeKnownNode(event.id);
        break;
      case "reordered":
        if (this.#loadedFolders.has(event.parentId)) {
          this.#children.set(event.parentId, [...event.childIds]);
        }
        break;
    }
    this.#emit();
  };

  async #reloadRoots(): Promise<void> {
    const roots = await this.#repository.getRootChildren();
    this.#rootIds = roots.map((node) => node.id);
    roots.forEach((node) => this.#nodes.set(node.id, node));
  }

  async #reloadVisible(): Promise<void> {
    const expanded = [...this.#expanded];
    this.#nodes.clear();
    this.#children.clear();
    this.#loadedFolders.clear();
    await this.#reloadRoots();
    await Promise.all(expanded.map((id) => this.ensureChildrenLoaded(id)));
    this.#emit();
  }

  #replaceChildren(parentId: string, nodes: BookmarkNode[]): void {
    this.#children.set(
      parentId,
      nodes.map((node) => node.id),
    );
    nodes.forEach((node) => this.#nodes.set(node.id, node));
  }

  #upsertCreated(node: BookmarkNode): void {
    this.#nodes.set(node.id, node);
    if (!node.parentId || !this.#loadedFolders.has(node.parentId)) {
      return;
    }
    const children = this.#children.get(node.parentId) ?? [];
    const withoutNode = children.filter((id) => id !== node.id);
    const index = Math.min(
      node.index ?? withoutNode.length,
      withoutNode.length,
    );
    withoutNode.splice(index, 0, node.id);
    this.#children.set(node.parentId, withoutNode);
  }

  #applyMove(id: string, parentId: string, index: number): void {
    const node = this.#nodes.get(id);
    if (!node) {
      return;
    }
    if (node.parentId && this.#children.has(node.parentId)) {
      this.#children.set(
        node.parentId,
        (this.#children.get(node.parentId) ?? []).filter(
          (childId) => childId !== id,
        ),
      );
    }
    if (this.#loadedFolders.has(parentId)) {
      const children = (this.#children.get(parentId) ?? []).filter(
        (childId) => childId !== id,
      );
      children.splice(Math.min(index, children.length), 0, id);
      this.#children.set(parentId, children);
    }
    this.#nodes.set(id, { ...node, parentId, index });
  }

  #removeKnownNode(id: string): void {
    const node = this.#nodes.get(id);
    if (node?.parentId && this.#children.has(node.parentId)) {
      this.#children.set(
        node.parentId,
        (this.#children.get(node.parentId) ?? []).filter(
          (childId) => childId !== id,
        ),
      );
    }
    for (const childId of this.#children.get(id) ?? []) {
      this.#removeKnownNode(childId);
    }
    this.#children.delete(id);
    this.#loadedFolders.delete(id);
    this.#expanded.delete(id);
    this.#nodes.delete(id);
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
