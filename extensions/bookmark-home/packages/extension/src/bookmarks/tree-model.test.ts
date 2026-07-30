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
  failNextMove = false;

  constructor() {
    const roots: BookmarkNode[] = [
      {
        id: "bar",
        title: "Bookmarks bar",
        folderType: "bookmarks-bar",
      },
      { id: "other", title: "Other bookmarks", folderType: "other" },
    ];
    const barChildren: BookmarkNode[] = [
      {
        id: "folder",
        parentId: "bar",
        index: 0,
        title: "Folder",
      },
      {
        id: "link",
        parentId: "bar",
        index: 1,
        title: "Link",
        url: "https://example.com/",
      },
    ];
    [...roots, ...barChildren].forEach((node) => this.nodes.set(node.id, node));
    this.children.set(
      "root",
      roots.map((node) => node.id),
    );
    this.children.set(
      "bar",
      barChildren.map((node) => node.id),
    );
    this.children.set("other", []);
    this.children.set("folder", []);
  }

  async getRootChildren(): Promise<BookmarkNode[]> {
    return (this.children.get("root") ?? []).map((id) => ({
      ...this.nodes.get(id)!,
    }));
  }

  async getAll(): Promise<BookmarkNode[]> {
    return [...this.nodes.values()].map((node) => ({ ...node }));
  }

  async getChildren(parentId: string): Promise<BookmarkNode[]> {
    this.childReads.push(parentId);
    return (this.children.get(parentId) ?? []).map((id) => ({
      ...this.nodes.get(id)!,
    }));
  }

  async getNode(id: string): Promise<BookmarkNode | null> {
    const node = this.nodes.get(id);
    return node ? { ...node } : null;
  }

  async getSubTree(id: string): Promise<BookmarkNode[]> {
    const result: BookmarkNode[] = [];
    const visit = (nodeId: string): void => {
      const node = this.nodes.get(nodeId);
      if (node) {
        result.push({ ...node });
      }
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
    const node: BookmarkNode = {
      id,
      parentId: input.parentId,
      index: input.index ?? this.children.get(input.parentId)?.length ?? 0,
      title: input.title,
      ...(input.url === undefined ? {} : { url: input.url }),
    };
    this.nodes.set(id, node);
    const siblings = this.children.get(input.parentId) ?? [];
    siblings.splice(node.index ?? siblings.length, 0, id);
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
    return moved;
  }

  async remove(id: string): Promise<void> {
    this.nodes.delete(id);
  }

  subscribe(listener: BookmarkEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: BookmarkEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

test("tree initialization loads only the roots and default bookmark bar", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);

  await model.initialize(new Set());

  assert.deepEqual(repository.childReads, ["bar"]);
  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["bar", "folder", "link", "other"],
  );
  assert.equal(model.expandedIds.has("bar"), true);
  model.dispose();
});

test("bookmark events update loaded folders without reloading the whole tree", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set());

  repository.emit({
    type: "created",
    node: {
      id: "external",
      parentId: "bar",
      index: 1,
      title: "External",
      url: "https://external.example/",
    },
  });

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["bar", "folder", "external", "link", "other"],
  );
  model.dispose();
});

test("failed optimistic moves restore the previous visible position", async () => {
  const repository = new FakeBookmarkRepository();
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set());
  await model.toggleFolder("folder");
  repository.failNextMove = true;

  await assert.rejects(
    model.move("link", { parentId: "folder" }),
    /move failed/,
  );

  assert.deepEqual(
    model.rows().map((row) => row.node.id),
    ["bar", "folder", "link", "other"],
  );
  assert.equal(model.getNode("link")?.parentId, "bar");
  model.dispose();
});

test("moves cannot place a folder inside itself or its descendant", async () => {
  const repository = new FakeBookmarkRepository();
  const child: BookmarkNode = {
    id: "child",
    parentId: "folder",
    index: 0,
    title: "Child",
  };
  repository.nodes.set(child.id, child);
  repository.children.set("folder", [child.id]);
  repository.children.set("child", []);
  const model = new BookmarkTreeModel(repository);
  await model.initialize(new Set(["bar", "folder"]));

  assert.equal(await model.canMove("folder", "folder"), false);
  assert.equal(await model.canMove("folder", "child"), false);
  model.dispose();
});
