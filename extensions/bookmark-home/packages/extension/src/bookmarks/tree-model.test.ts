import assert from "node:assert/strict";
import test from "node:test";

import type {
  BookmarkCreateInput,
  BookmarkEvent,
  BookmarkEventListener,
  BookmarkMoveTarget,
  BookmarkNode,
  BookmarkRepository,
} from "../core/types";
import { BookmarkTreeModel } from "./tree-model";

class FakeBookmarkRepository implements BookmarkRepository {
  readonly nodes = new Map<string, BookmarkNode>();
  readonly children = new Map<string, string[]>();
  readonly listeners = new Set<BookmarkEventListener>();
  readonly childReads: string[] = [];
  readonly removals: Array<{ id: string; recursive: boolean }> = [];
  failNextMove = false;

  constructor(mode: "vivaldi" | "chrome" = "vivaldi") {
    if (mode === "chrome") {
      this.addNodes([
        {
          id: "bar",
          title: "Bookmarks bar",
          folderType: "bookmarks-bar",
        },
        { id: "other", title: "Other bookmarks", folderType: "other" },
        {
          id: "bar-link",
          parentId: "bar",
          index: 0,
          title: "Bar link",
          url: "https://bar.example/",
        },
      ]);
      this.children.set("root", ["bar", "other"]);
      this.children.set("bar", ["bar-link"]);
      this.children.set("other", []);
      return;
    }

    this.addNodes([
      { id: "bookmarks", title: "Bookmarks" },
      { id: "other", title: "Other bookmarks", folderType: "other" },
      { id: "trash", title: "Trash", trash: true },
      {
        id: "folder",
        parentId: "bookmarks",
        index: 0,
        title: "Folder",
      },
      {
        id: "link",
        parentId: "bookmarks",
        index: 1,
        title: "Link",
        url: "https://example.com/",
      },
      {
        id: "nested",
        parentId: "folder",
        index: 0,
        title: "Nested",
        url: "https://nested.example/",
      },
      {
        id: "other-link",
        parentId: "other",
        index: 0,
        title: "Other link",
        url: "https://other.example/",
      },
      {
        id: "deleted-folder",
        parentId: "trash",
        index: 0,
        title: "Deleted folder",
      },
      {
        id: "deleted-link",
        parentId: "trash",
        index: 1,
        title: "Deleted link",
        url: "https://deleted.example/",
      },
      {
        id: "deleted-nested",
        parentId: "deleted-folder",
        index: 0,
        title: "Deleted nested",
        url: "https://deleted-nested.example/",
      },
    ]);
    this.children.set("root", ["bookmarks", "other", "trash"]);
    this.children.set("bookmarks", ["folder", "link"]);
    this.children.set("folder", ["nested"]);
    this.children.set("other", ["other-link"]);
    this.children.set("trash", ["deleted-folder", "deleted-link"]);
    this.children.set("deleted-folder", ["deleted-nested"]);
  }

  addNodes(nodes: BookmarkNode[]): void {
    nodes.forEach((node) => this.nodes.set(node.id, node));
  }

  async getRootChildren(): Promise<BookmarkNode[]> {
    return this.nodesFor("root");
  }

  async getAll(): Promise<BookmarkNode[]> {
    return [...this.nodes.values()].map((node) => ({ ...node }));
  }

  async getChildren(parentId: string): Promise<BookmarkNode[]> {
    this.childReads.push(parentId);
    return this.nodesFor(parentId);
  }

  async getNode(id: string): Promise<BookmarkNode | null> {
    const node = this.nodes.get(id);
    return node ? { ...node } : null;
  }

  async getSubTree(id: string): Promise<BookmarkNode[]> {
    const result: BookmarkNode[] = [];
    const visit = (nodeId: string): void => {
      const node = this.nodes.get(nodeId);
      if (!node) {
        return;
      }
      result.push({ ...node });
      (this.children.get(nodeId) ?? []).forEach(visit);
    };
    visit(id);
    return result;
  }

  async search(query: string): Promise<BookmarkNode[]> {
    return [...this.nodes.values()]
      .filter((node) =>
        `${node.title} ${node.url ?? ""}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
      )
      .map((node) => ({ ...node }));
  }

  async create(input: BookmarkCreateInput): Promise<BookmarkNode> {
    const id = `created-${this.nodes.size}`;
    const siblings = this.children.get(input.parentId) ?? [];
    const index = input.index ?? siblings.length;
    const node: BookmarkNode = {
      id,
      parentId: input.parentId,
      index,
      title: input.title,
      ...(input.url === undefined ? {} : { url: input.url }),
    };
    this.nodes.set(id, node);
    siblings.splice(index, 0, id);
    this.children.set(input.parentId, siblings);
    this.emit({ type: "created", node });
    return { ...node };
  }

  async update(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<BookmarkNode> {
    const node = { ...this.nodes.get(id)!, ...changes };
    this.nodes.set(id, node);
    return { ...node };
  }

  async move(id: string, target: BookmarkMoveTarget): Promise<BookmarkNode> {
    if (this.failNextMove) {
      this.failNextMove = false;
      throw new Error("move failed");
    }
    const node = this.nodes.get(id)!;
    const oldParentId = node.parentId!;
    this.children.set(
      oldParentId,
      (this.children.get(oldParentId) ?? []).filter(
        (childId) => childId !== id,
      ),
    );
    const siblings = this.children.get(target.parentId) ?? [];
    const index = Math.min(target.index ?? siblings.length, siblings.length);
    siblings.splice(index, 0, id);
    this.children.set(target.parentId, siblings);
    const moved = { ...node, parentId: target.parentId, index };
    this.nodes.set(id, moved);
    return { ...moved };
  }

  async remove(id: string, recursive: boolean): Promise<void> {
    this.removals.push({ id, recursive });
    const node = this.nodes.get(id);
    if (node?.parentId) {
      this.children.set(
        node.parentId,
        (this.children.get(node.parentId) ?? []).filter(
          (childId) => childId !== id,
        ),
      );
    }
    const removeNode = (nodeId: string): void => {
      for (const childId of this.children.get(nodeId) ?? []) {
        removeNode(childId);
      }
      this.children.delete(nodeId);
      this.nodes.delete(nodeId);
    };
    removeNode(id);
  }

  subscribe(listener: BookmarkEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: BookmarkEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  nodesFor(parentId: string): BookmarkNode[] {
    return (this.children.get(parentId) ?? []).map((id) => ({
      ...this.nodes.get(id)!,
    }));
  }
}

test("default scope renders only direct children of the Vivaldi bookmarks root", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);

  await model.initialize(new Set());

  assert.deepEqual(repository.childReads, ["bookmarks"]);
  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["folder", "link"],
  );
  assert.equal(model.activeRoot?.id, "bookmarks");
  assert.equal(model.hasTrash, true);
  assert.equal(model.expandedIds.size, 0);
  model.dispose();
});

test("plain Chrome falls back to bookmarks bar and has no trash scope", async () => {
  const model = new BookmarkTreeModel(new FakeBookmarkRepository("chrome"));

  await model.initialize(new Set());

  assert.equal(model.activeRoot?.id, "bar");
  assert.equal(model.hasTrash, false);
  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["bar-link"],
  );
  assert.equal(await model.setScope("trash"), false);
  model.dispose();
});

test("bookmark events update the visible root without reloading the tree", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set());

  repository.emit({
    type: "created",
    node: {
      id: "external",
      parentId: "bookmarks",
      index: 1,
      title: "External",
      url: "https://external.example/",
    },
  });

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["folder", "external", "link"],
  );
  model.dispose();
});

test("scope switching isolates rows, searches, counts, and expanded state", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set());
  await model.toggleFolder("folder");

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["folder", "nested", "link"],
  );
  assert.deepEqual(await model.search("Other link"), []);
  assert.equal(await model.countBookmarks(), 2);

  assert.equal(await model.setScope("trash"), true);
  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["deleted-folder", "deleted-link"],
  );
  assert.deepEqual(
    (await model.search("Deleted nested")).map((row) => row.node.id),
    ["deleted-nested"],
  );
  assert.equal(await model.countBookmarks(), 2);
  await model.toggleFolder("deleted-folder");

  await model.setScope("bookmarks");
  assert.equal(model.expandedIds.has("folder"), true);
  assert.equal(model.expandedIds.has("deleted-folder"), false);
  model.dispose();
});

test("restore destinations include the hidden root and exclude a folder subtree", async () => {
  const model = new BookmarkTreeModel(new FakeBookmarkRepository());
  await model.initialize(new Set());

  assert.deepEqual(
    (await model.destinationFolders("folder")).map((node) => node.id),
    ["bookmarks"],
  );
  assert.deepEqual(
    (await model.destinationFolders("deleted-link")).map((node) => node.id),
    ["bookmarks", "folder"],
  );
  model.dispose();
});

test("external moves into and out of trash update the active scope", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set());
  await model.setScope("trash");

  repository.nodes.set("external-trash", {
    id: "external-trash",
    parentId: "trash",
    index: 1,
    title: "Externally deleted",
    url: "https://external-trash.example/",
  });
  repository.children.set("trash", [
    "deleted-folder",
    "external-trash",
    "deleted-link",
  ]);
  repository.emit({
    type: "moved",
    id: "external-trash",
    parentId: "trash",
    index: 1,
    oldParentId: "bookmarks",
    oldIndex: 0,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["deleted-folder", "external-trash", "deleted-link"],
  );

  repository.nodes.set("external-trash", {
    ...repository.nodes.get("external-trash")!,
    parentId: "bookmarks",
    index: 0,
  });
  repository.children.set(
    "trash",
    (repository.children.get("trash") ?? []).filter(
      (id) => id !== "external-trash",
    ),
  );
  repository.emit({
    type: "moved",
    id: "external-trash",
    parentId: "bookmarks",
    index: 0,
    oldParentId: "trash",
    oldIndex: 1,
  });

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["deleted-folder", "deleted-link"],
  );
  model.dispose();
});

test("emptying trash permanently removes its children but preserves the root", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set());
  await model.setScope("trash");

  await model.emptyTrash();

  assert.deepEqual(repository.removals, [
    { id: "deleted-folder", recursive: true },
    { id: "deleted-link", recursive: false },
  ]);
  assert.equal(repository.nodes.has("trash"), true);
  assert.deepEqual(model.rows(), []);
  assert.equal(model.hasScopeItems, false);
  model.dispose();
});

test("failed optimistic moves restore the previous visible position", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set(["folder"]));
  repository.failNextMove = true;

  await assert.rejects(
    model.move("link", { parentId: "folder" }),
    /move failed/,
  );

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["folder", "nested", "link"],
  );
  assert.equal(model.getNode("link")?.parentId, "bookmarks");
  model.dispose();
});

test("moves cannot place a folder inside itself or its descendant", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set(["folder"]));

  assert.equal(await model.canMove("folder", "folder"), false);
  assert.equal(await model.canMove("folder", "nested"), false);
  model.dispose();
});
