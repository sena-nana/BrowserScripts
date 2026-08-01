import assert from "node:assert/strict";
import test from "node:test";

import type {
  BookmarkMoveTarget,
  BookmarkNode,
  BookmarkRepository,
} from "../core/types";
import { BookmarkPlanExecutor } from "./executor";
import { ResponsesOrganizerClient } from "./responses-client";
import {
  endpointOriginPattern,
  normalizeEndpoint,
  sanitizeAgentSettings,
} from "./settings";
import { captureOrganizerSnapshot } from "./snapshot";

class MemoryRepository implements BookmarkRepository {
  readonly nodes = new Map<string, BookmarkNode>([
    ["root", { id: "root", title: "Bookmarks" }],
    ["work", { id: "work", parentId: "root", title: "Work", index: 0 }],
    [
      "archive",
      { id: "archive", parentId: "root", title: "Archive", index: 1 },
    ],
    [
      "link",
      {
        id: "link",
        parentId: "work",
        title: "Example",
        url: "https://user:pass@example.com/path?q=secret#token",
        index: 0,
      },
    ],
  ]);
  updates = 0;
  moves = 0;
  removes = 0;

  getRootChildren(): Promise<BookmarkNode[]> {
    return Promise.resolve([structuredClone(this.nodes.get("root")!)]);
  }
  getAll(): Promise<BookmarkNode[]> {
    return Promise.resolve(
      [...this.nodes.values()].map((node) => structuredClone(node)),
    );
  }
  getChildren(parentId: string): Promise<BookmarkNode[]> {
    return Promise.resolve(
      [...this.nodes.values()]
        .filter((node) => node.parentId === parentId)
        .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
        .map((node) => structuredClone(node)),
    );
  }
  getNode(id: string): Promise<BookmarkNode | null> {
    const node = this.nodes.get(id);
    return Promise.resolve(node ? structuredClone(node) : null);
  }
  async getSubTree(id: string): Promise<BookmarkNode[]> {
    const root = this.nodes.get(id);
    if (!root) return [];
    const result = [structuredClone(root)];
    for (const child of await this.getChildren(id)) {
      result.push(...(await this.getSubTree(child.id)));
    }
    return result;
  }
  search(): Promise<BookmarkNode[]> {
    return Promise.resolve([]);
  }
  create(): Promise<BookmarkNode> {
    return Promise.reject(new Error("not used"));
  }
  update(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<BookmarkNode> {
    this.updates += 1;
    const node = { ...this.nodes.get(id)!, ...changes };
    this.nodes.set(id, node);
    return Promise.resolve(structuredClone(node));
  }
  move(id: string, target: BookmarkMoveTarget): Promise<BookmarkNode> {
    this.moves += 1;
    const node = { ...this.nodes.get(id)!, ...target };
    this.nodes.set(id, node);
    return Promise.resolve(structuredClone(node));
  }
  async remove(id: string, recursive: boolean): Promise<void> {
    this.removes += 1;
    if (recursive) {
      for (const child of await this.getSubTree(id))
        this.nodes.delete(child.id);
    } else {
      this.nodes.delete(id);
    }
  }
  subscribe(): () => void {
    return () => undefined;
  }
}

test("agent connection accepts HTTPS and loopback without leaking invalid values", () => {
  assert.equal(
    normalizeEndpoint("https://agent.example/v1/responses"),
    "https://agent.example/v1/responses",
  );
  assert.equal(normalizeEndpoint("http://agent.example/responses"), null);
  assert.equal(
    endpointOriginPattern("http://localhost:8787/v1/responses"),
    "http://localhost:8787/*",
  );
  assert.deepEqual(
    sanitizeAgentSettings({
      endpoint: "javascript:alert(1)",
      model: "",
      apiKey: 7,
    }),
    {
      version: 1,
      endpoint: "https://api.openai.com/v1/responses",
      model: "gpt-5.6",
      apiKey: "",
    },
  );
});

test("snapshot limits a folder scope and removes URL credentials and secrets", async () => {
  const repository = new MemoryRepository();
  const snapshot = await captureOrganizerSnapshot(repository, "root", {
    type: "folder",
    folderId: "work",
  });
  assert.deepEqual(
    snapshot.nodes.map((node) => node.id),
    ["work", "link"],
  );
  assert.match(snapshot.serialized, /https:\/\/example\.com\/path/);
  assert.doesNotMatch(snapshot.serialized, /user|pass|secret|token/);
  assert.deepEqual(
    snapshot.folders.map((folder) => folder.id),
    ["work", "archive"],
  );
});

test("Responses function calls create review items without changing bookmarks", async () => {
  const repository = new MemoryRepository();
  const snapshot = await captureOrganizerSnapshot(repository, "root", {
    type: "all",
  });
  const requests: Record<string, unknown>[] = [];
  let round = 0;
  const fakeFetch: typeof fetch = (input, init) => {
    void input;
    if (typeof init?.body !== "string") throw new Error("missing body");
    requests.push(JSON.parse(init.body) as Record<string, unknown>);
    round += 1;
    const output =
      round === 1
        ? [
            {
              type: "function_call",
              call_id: "rename-1",
              name: "rename_bookmark",
              arguments: JSON.stringify({
                target_id: "link",
                new_title: "Example Docs",
                reason: "Clearer title",
              }),
            },
            {
              type: "function_call",
              call_id: "move-1",
              name: "move_bookmark",
              arguments: JSON.stringify({
                target_id: "link",
                destination_folder_id: "archive",
                reason: "Keep inactive links together",
              }),
            },
          ]
        : [
            {
              type: "function_call",
              call_id: "finish-1",
              name: "finish_organization",
              arguments: JSON.stringify({ summary: "Two changes" }),
            },
          ];
    return Promise.resolve(
      new Response(JSON.stringify({ output }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  const plan = await new ResponsesOrganizerClient(fakeFetch).plan({
    settings: {
      version: 1,
      endpoint: "https://agent.example/v1/responses",
      model: "test-model",
      apiKey: "test-key",
    },
    instruction: "Clean this up",
    snapshot,
  });
  assert.equal(plan.summary, "Two changes");
  assert.deepEqual(
    plan.proposals.map((proposal) => proposal.type),
    ["rename", "move"],
  );
  assert.equal(repository.updates + repository.moves + repository.removes, 0);
  assert.equal(requests[0]?.store, false);
  assert.equal(requests.length, 2);
});

test("approved proposals execute once and stale proposals do not write", async () => {
  const repository = new MemoryRepository();
  const snapshot = await captureOrganizerSnapshot(repository, "root", {
    type: "all",
  });
  const target = snapshot.nodes.find((node) => node.id === "link")!;
  const rename = {
    id: "rename",
    type: "rename" as const,
    targetId: "link",
    target,
    newTitle: "Example Docs",
    reason: "Clearer",
    status: "pending" as const,
  };
  const executor = new BookmarkPlanExecutor(repository);
  await executor.approve(rename);
  assert.equal(repository.nodes.get("link")?.title, "Example Docs");
  assert.equal(rename.status, "applied");

  const staleMove = {
    id: "move",
    type: "move" as const,
    targetId: "link",
    target,
    destinationFolderId: "archive",
    destination: snapshot.folders.find((node) => node.id === "archive")!,
    reason: "Archive it",
    status: "pending" as const,
  };
  repository.nodes.set("link", {
    ...repository.nodes.get("link")!,
    parentId: "archive",
  });
  await executor.approve(staleMove);
  assert.equal(staleMove.status, "stale");
  assert.equal(repository.moves, 0);
});
