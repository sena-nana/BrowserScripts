import assert from "node:assert/strict";
import test from "node:test";

import type {
  BookmarkEvent,
  BookmarkEventListener,
  BookmarkNode,
  BookmarkRepository,
  SettingsV2,
} from "../core/types";
import { SuggestionEngine } from "./suggestion-engine";

class IndexedRepository implements BookmarkRepository {
  readonly listeners = new Set<BookmarkEventListener>();
  searchCalls = 0;

  getRootChildren(): Promise<BookmarkNode[]> {
    return Promise.resolve([]);
  }

  getAll(): Promise<BookmarkNode[]> {
    return Promise.resolve([
      {
        id: "one",
        title: "Alpha documentation",
        url: "https://example.com/alpha",
      },
      {
        id: "folder",
        title: "Alpha folder",
      },
    ]);
  }

  getChildren(): Promise<BookmarkNode[]> {
    return Promise.resolve([]);
  }

  getNode(): Promise<BookmarkNode | null> {
    return Promise.resolve(null);
  }

  getSubTree(): Promise<BookmarkNode[]> {
    return Promise.resolve([]);
  }

  search(): Promise<BookmarkNode[]> {
    this.searchCalls += 1;
    return Promise.resolve([]);
  }

  create(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }

  update(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }

  move(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }

  remove(): Promise<void> {
    return Promise.reject(new Error("not used"));
  }

  subscribe(listener: BookmarkEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: BookmarkEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

const localOnly: SettingsV2["search"] = {
  provider: "google",
  customName: "",
  customSearchUrl: "https://example.com/?q={query}",
  historySuggestions: false,
  onlineSuggestions: false,
};

test("bookmark suggestions use the in-memory index and follow live events", async () => {
  const repository = new IndexedRepository();
  const engine = new SuggestionEngine(repository);
  await engine.warm();

  assert.deepEqual(
    (
      await engine.suggest("alpha", localOnly, new AbortController().signal)
    ).map((item) => item.id),
    ["bookmark:one"],
  );
  assert.equal(repository.searchCalls, 0);

  repository.emit({
    type: "created",
    node: {
      id: "two",
      title: "Beta guide",
      url: "https://example.com/beta",
    },
  });
  assert.deepEqual(
    (await engine.suggest("beta", localOnly, new AbortController().signal)).map(
      (item) => item.id,
    ),
    ["bookmark:two"],
  );

  repository.emit({
    type: "removed",
    id: "two",
    parentId: "bar",
    index: 0,
  });
  assert.deepEqual(
    await engine.suggest("beta", localOnly, new AbortController().signal),
    [],
  );
  engine.dispose();
});

test("an aborted request does not publish stale suggestions", async () => {
  const repository = new IndexedRepository();
  const engine = new SuggestionEngine(repository);
  const request = new AbortController();
  request.abort();

  assert.deepEqual(
    await engine.suggest("alpha", localOnly, request.signal),
    [],
  );
  engine.dispose();
});
