import type {
  BookmarkCreateInput,
  BookmarkEvent,
  BookmarkMoveTarget,
  BookmarkNode,
  BookmarkRepository,
  TreeRow,
} from "../core/types";

type TreeListener = () => void;
export type BookmarkViewScope = "bookmarks" | "trash";

interface BookmarkRoots {
  bookmarks: BookmarkNode;
  trash?: BookmarkNode;
}

interface LoadedScopeState {
  nodes: Map<string, BookmarkNode>;
  children: Map<string, string[]>;
  loadedFolders: Set<string>;
  rootIds: string[];
}

export class BookmarkTreeModel {
  readonly #nodes = new Map<string, BookmarkNode>();
  readonly #children = new Map<string, string[]>();
  readonly #loadedFolders = new Set<string>();
  readonly #loadingFolders = new Map<string, symbol>();
  readonly #expandedByScope: Record<BookmarkViewScope, Set<string>> = {
    bookmarks: new Set(),
    trash: new Set(),
  };
  readonly #listeners = new Set<TreeListener>();
  readonly #repository: BookmarkRepository;
  #bookmarksRoot: BookmarkNode | null = null;
  #trashRoot: BookmarkNode | undefined;
  #rootIds: string[] = [];
  #scope: BookmarkViewScope = "bookmarks";
  #targetScope: BookmarkViewScope = "bookmarks";
  #loadGeneration = 0;
  #loadingGeneration: number | null = null;
  #repositoryRevision = 0;
  #repositoryEvents: Promise<void> = Promise.resolve();
  #unsubscribeRepository: (() => void) | null = null;
  #importing = false;

  constructor(repository: BookmarkRepository) {
    this.#repository = repository;
  }

  async initialize(savedExpanded: ReadonlySet<string>): Promise<void> {
    this.#expandedByScope.bookmarks.clear();
    savedExpanded.forEach((id) => this.#expandedByScope.bookmarks.add(id));
    this.#expandedByScope.trash.clear();
    const roots = await this.#loadRoots();
    this.#expandedByScope.bookmarks.delete(roots.bookmarks.id);
    const state = await this.#buildScope("bookmarks", roots);
    this.#commitScope("bookmarks", roots, state);
    this.#unsubscribeRepository = this.#repository.subscribe(
      this.#handleRepositoryEvent,
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

  get scope(): BookmarkViewScope {
    return this.#scope;
  }

  get targetScope(): BookmarkViewScope {
    return this.#targetScope;
  }

  get isScopeSwitching(): boolean {
    return this.#loadingGeneration === this.#loadGeneration;
  }

  get hasTrash(): boolean {
    return this.#trashRoot !== undefined;
  }

  get hasScopeItems(): boolean {
    const root = this.#activeRoot();
    return root ? (this.#children.get(root.id)?.length ?? 0) > 0 : false;
  }

  get expandedIds(): ReadonlySet<string> {
    return new Set(this.#expanded());
  }

  get activeRoot(): BookmarkNode | undefined {
    const root = this.#activeRoot();
    return root ? { ...root } : undefined;
  }

  get bookmarksRoot(): BookmarkNode | undefined {
    return this.#bookmarksRoot ? { ...this.#bookmarksRoot } : undefined;
  }

  getNode(id: string): BookmarkNode | undefined {
    const node = this.#nodes.get(id);
    return node ? { ...node } : undefined;
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
        expanded: this.#expanded().has(id),
        loading: this.#loadingFolders.has(id),
      });
      if (!node.url && this.#expanded().has(id)) {
        for (const childId of this.#children.get(id) ?? []) {
          visit(childId, depth + 1);
        }
      }
    };
    this.#rootIds.forEach((id) => visit(id, 0));
    return result;
  }

  async setScope(scope: BookmarkViewScope): Promise<boolean> {
    if (scope === "trash" && !this.#trashRoot) {
      return false;
    }
    return this.#replaceScope(scope);
  }

  async #replaceScope(
    requestedScope: BookmarkViewScope,
    options: { force?: boolean; reloadRoots?: boolean } = {},
  ): Promise<boolean> {
    const generation = ++this.#loadGeneration;
    this.#targetScope = requestedScope;
    if (!options.force && requestedScope === this.#scope) {
      this.#loadingGeneration = null;
      return true;
    }
    this.#loadingGeneration = generation;
    try {
      const roots = options.reloadRoots
        ? await this.#loadRoots()
        : this.#currentRoots();
      const scope =
        requestedScope === "trash" && !roots.trash
          ? "bookmarks"
          : requestedScope;
      const state = await this.#buildLatestScope(scope, roots, generation);
      if (!state || generation !== this.#loadGeneration) {
        return false;
      }
      this.#commitScope(scope, roots, state);
      this.#loadingGeneration = null;
      this.#emit();
      return true;
    } catch (error) {
      if (generation === this.#loadGeneration) {
        this.#targetScope = this.#scope;
        this.#loadingGeneration = null;
        this.#emit();
      }
      throw error;
    }
  }

  async isNodeInScope(id: string, scope: BookmarkViewScope): Promise<boolean> {
    if (
      scope !== this.#scope ||
      this.isScopeSwitching ||
      this.#targetScope !== scope
    ) {
      return false;
    }
    const generation = this.#loadGeneration;
    const root = this.#rootFor(scope, this.#currentRoots());
    if (!root) {
      return false;
    }
    let currentId = id;
    const visited = new Set<string>();
    while (!visited.has(currentId)) {
      visited.add(currentId);
      let node: BookmarkNode | null;
      try {
        node = await this.#repository.getNode(currentId);
      } catch {
        return false;
      }
      if (
        generation !== this.#loadGeneration ||
        scope !== this.#scope ||
        this.isScopeSwitching
      ) {
        return false;
      }
      if (!node?.parentId) {
        return false;
      }
      if (node.parentId === root.id) {
        return true;
      }
      currentId = node.parentId;
    }
    return false;
  }

  async search(query: string): Promise<TreeRow[]> {
    const normalized = query.trim();
    if (!normalized) {
      return this.rows();
    }
    const root = this.#activeRoot();
    if (!root) {
      return [];
    }
    const [matches, subtree] = await Promise.all([
      this.#repository.search(normalized),
      this.#repository.getSubTree(root.id),
    ]);
    const scopedIds = new Set(subtree.map((node) => node.id));
    scopedIds.delete(root.id);
    return matches
      .filter((node) => scopedIds.has(node.id))
      .map((node) => ({
        node,
        depth: 0,
        expanded: false,
        loading: false,
      }));
  }

  async countBookmarks(): Promise<number> {
    const root = this.#activeRoot();
    if (!root) {
      return 0;
    }
    return (await this.#repository.getSubTree(root.id)).filter(
      (node) => node.url !== undefined,
    ).length;
  }

  async destinationFolders(excludedId?: string): Promise<BookmarkNode[]> {
    const root = this.#bookmarksRoot;
    if (!root) {
      return [];
    }
    const excluded = new Set<string>();
    if (excludedId) {
      const node = await this.#repository.getNode(excludedId);
      if (node && !node.url) {
        for (const descendant of await this.#repository.getSubTree(
          excludedId,
        )) {
          excluded.add(descendant.id);
        }
      } else {
        excluded.add(excludedId);
      }
    }
    return (await this.#repository.getSubTree(root.id))
      .filter(
        (node) =>
          !node.url &&
          !node.unmodifiable &&
          node.trash !== true &&
          !excluded.has(node.id),
      )
      .map((node) => ({ ...node }));
  }

  async toggleFolder(id: string): Promise<void> {
    if (this.#expanded().delete(id)) {
      this.#emit();
      return;
    }
    this.#expanded().add(id);
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
    const generation = this.#loadGeneration;
    const request = Symbol(id);
    this.#loadingFolders.set(id, request);
    this.#emit();
    try {
      const children = await this.#repository.getChildren(id);
      if (
        generation !== this.#loadGeneration ||
        this.#loadingFolders.get(id) !== request ||
        !this.#nodes.has(id)
      ) {
        return;
      }
      this.#replaceChildren(id, children);
      this.#loadedFolders.add(id);
    } finally {
      if (this.#loadingFolders.get(id) === request) {
        this.#loadingFolders.delete(id);
        this.#emit();
      }
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
    const node =
      this.#nodes.get(id) ?? (await this.#repository.getNode(id)) ?? undefined;
    await this.#repository.remove(id, !node?.url);
    this.#removeKnownNode(id);
    this.#emit();
  }

  async emptyTrash(): Promise<void> {
    const trash = this.#trashRoot;
    if (!trash) {
      return;
    }
    try {
      const children = await this.#repository.getChildren(trash.id);
      for (const child of children) {
        await this.#repository.remove(child.id, !child.url);
      }
    } finally {
      if (this.#scope === "trash") {
        await this.#reloadVisible(false);
      }
    }
  }

  async move(id: string, target: BookmarkMoveTarget): Promise<void> {
    if (!(await this.canMove(id, target.parentId))) {
      throw new Error("invalid-move");
    }
    const node =
      this.#nodes.get(id) ?? (await this.#repository.getNode(id)) ?? undefined;
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
    this.#repositoryRevision += 1;
    const applying = this.#repositoryEvents.then(() =>
      this.#applyRepositoryEvent(event),
    );
    this.#repositoryEvents = applying.catch(() => undefined);
  };

  async #applyRepositoryEvent(event: BookmarkEvent): Promise<void> {
    if (event.type === "import-began") {
      this.#importing = true;
      return;
    }
    if (event.type === "import-ended") {
      this.#importing = false;
      await this.#reloadVisible();
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
      case "moved": {
        if (!this.#nodes.has(event.id)) {
          const node = await this.#repository.getNode(event.id);
          if (node && this.#loadedFolders.has(event.parentId)) {
            this.#nodes.set(node.id, node);
          }
        }
        this.#applyMove(event.id, event.parentId, event.index);
        break;
      }
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
  }

  async #loadRoots(): Promise<BookmarkRoots> {
    const roots = (await this.#repository.getRootChildren()).filter(
      (node) => !node.url,
    );
    const trash = roots.find((node) => node.trash === true);
    const visible = roots.filter((node) => node !== trash);
    const bookmarks =
      visible.find(
        (node) =>
          node.folderType === undefined && node.unmodifiable === undefined,
      ) ??
      visible.find((node) => node.folderType === "bookmarks-bar") ??
      visible.find(
        (node) =>
          node.folderType !== "other" &&
          node.folderType !== "mobile" &&
          node.folderType !== "managed",
      );
    if (!bookmarks) {
      throw new Error("Bookmark root is missing");
    }
    return {
      bookmarks,
      ...(trash === undefined ? {} : { trash }),
    };
  }

  async #buildScope(
    scope: BookmarkViewScope,
    roots: BookmarkRoots,
  ): Promise<LoadedScopeState> {
    const nodes = new Map<string, BookmarkNode>();
    const children = new Map<string, string[]>();
    const loadedFolders = new Set<string>();
    nodes.set(roots.bookmarks.id, roots.bookmarks);
    if (roots.trash) {
      nodes.set(roots.trash.id, roots.trash);
    }
    const root = this.#rootFor(scope, roots);
    if (!root) {
      throw new Error("Bookmark scope root is missing");
    }
    const loadChildren = async (parentId: string): Promise<void> => {
      const childNodes = await this.#repository.getChildren(parentId);
      children.set(
        parentId,
        childNodes.map((node) => node.id),
      );
      childNodes.forEach((node) => nodes.set(node.id, node));
      loadedFolders.add(parentId);
    };
    await loadChildren(root.id);
    const rootIds = [...(children.get(root.id) ?? [])];
    let pending = [...this.#expandedByScope[scope]];
    while (pending.length > 0) {
      const loadable = pending.filter(
        (id) => nodes.has(id) && !loadedFolders.has(id),
      );
      if (loadable.length === 0) {
        break;
      }
      await Promise.all(loadable.map(loadChildren));
      const loaded = new Set(loadable);
      pending = pending.filter((id) => !loaded.has(id));
    }
    return { nodes, children, loadedFolders, rootIds };
  }

  async #buildLatestScope(
    scope: BookmarkViewScope,
    roots: BookmarkRoots,
    generation: number,
  ): Promise<LoadedScopeState | undefined> {
    while (generation === this.#loadGeneration) {
      const revision = this.#repositoryRevision;
      const state = await this.#buildScope(scope, roots);
      if (generation !== this.#loadGeneration) {
        return undefined;
      }
      if (revision === this.#repositoryRevision) {
        return state;
      }
    }
    return undefined;
  }

  async #reloadVisible(reloadRoots = true): Promise<void> {
    await this.#replaceScope(this.#targetScope, {
      force: true,
      reloadRoots,
    });
  }

  #commitScope(
    scope: BookmarkViewScope,
    roots: BookmarkRoots,
    state: LoadedScopeState,
  ): void {
    this.#bookmarksRoot = roots.bookmarks;
    this.#trashRoot = roots.trash;
    this.#nodes.clear();
    state.nodes.forEach((node, id) => this.#nodes.set(id, node));
    this.#children.clear();
    state.children.forEach((ids, id) => this.#children.set(id, ids));
    this.#loadedFolders.clear();
    state.loadedFolders.forEach((id) => this.#loadedFolders.add(id));
    this.#loadingFolders.clear();
    this.#rootIds = state.rootIds;
    this.#scope = scope;
    this.#targetScope = scope;
  }

  #currentRoots(): BookmarkRoots {
    if (!this.#bookmarksRoot) {
      throw new Error("Bookmark root is missing");
    }
    return {
      bookmarks: this.#bookmarksRoot,
      ...(this.#trashRoot === undefined ? {} : { trash: this.#trashRoot }),
    };
  }

  #rootFor(
    scope: BookmarkViewScope,
    roots: BookmarkRoots,
  ): BookmarkNode | undefined {
    return scope === "trash" ? roots.trash : roots.bookmarks;
  }

  #activeRoot(): BookmarkNode | undefined {
    return this.#scope === "trash"
      ? this.#trashRoot
      : (this.#bookmarksRoot ?? undefined);
  }

  #expanded(): Set<string> {
    return this.#expandedByScope[this.#scope];
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
    if (node.parentId === this.#activeRoot()?.id) {
      this.#rootIds = withoutNode;
    }
  }

  #applyMove(id: string, parentId: string, index: number): void {
    const node = this.#nodes.get(id);
    if (!node) {
      return;
    }
    if (node.parentId && this.#children.has(node.parentId)) {
      const previousChildren = (this.#children.get(node.parentId) ?? []).filter(
        (childId) => childId !== id,
      );
      this.#children.set(node.parentId, previousChildren);
      if (node.parentId === this.#activeRoot()?.id) {
        this.#rootIds = previousChildren;
      }
    }
    if (this.#loadedFolders.has(parentId)) {
      const children = (this.#children.get(parentId) ?? []).filter(
        (childId) => childId !== id,
      );
      children.splice(Math.min(index, children.length), 0, id);
      this.#children.set(parentId, children);
      if (parentId === this.#activeRoot()?.id) {
        this.#rootIds = children;
      }
    }
    this.#nodes.set(id, { ...node, parentId, index });
  }

  #removeKnownNode(id: string): void {
    const node = this.#nodes.get(id);
    if (node?.parentId && this.#children.has(node.parentId)) {
      const siblings = (this.#children.get(node.parentId) ?? []).filter(
        (childId) => childId !== id,
      );
      this.#children.set(node.parentId, siblings);
      if (node.parentId === this.#activeRoot()?.id) {
        this.#rootIds = siblings;
      }
    }
    for (const childId of this.#children.get(id) ?? []) {
      this.#removeKnownNode(childId);
    }
    this.#children.delete(id);
    this.#loadedFolders.delete(id);
    this.#expanded().delete(id);
    this.#nodes.delete(id);
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
