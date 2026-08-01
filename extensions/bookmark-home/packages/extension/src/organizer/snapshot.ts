import type { BookmarkNode, BookmarkRepository } from "../core/types";
import type { OrganizerScope, OrganizerSnapshot, SnapshotNode } from "./types";

export const MAX_SNAPSHOT_BYTES = 1_000_000;

export function sanitizedBookmarkUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href.slice(0, 2_048);
  } catch {
    return "";
  }
}

export function bookmarkFingerprint(node: BookmarkNode): string {
  return JSON.stringify([
    node.id,
    node.parentId ?? "",
    node.title,
    node.url ?? "",
    node.unmodifiable ?? "",
    node.trash ?? false,
  ]);
}

function buildPaths(
  nodes: BookmarkNode[],
  rootId: string,
): Map<string, string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths = new Map<string, string>();
  const resolve = (id: string, visiting = new Set<string>()): string => {
    const cached = paths.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node || id === rootId || visiting.has(id)) return "";
    visiting.add(id);
    const parent = node.parentId ? resolve(node.parentId, visiting) : "";
    const path = `${parent}/${node.title || "(untitled)"}`;
    paths.set(id, path);
    return path;
  };
  nodes.forEach((node) => resolve(node.id));
  return paths;
}

function toSnapshotNode(node: BookmarkNode, path: string): SnapshotNode {
  const url = node.url ? sanitizedBookmarkUrl(node.url) : undefined;
  return {
    id: node.id,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    title: node.title,
    kind: node.url ? "bookmark" : "folder",
    path,
    ...(url ? { url } : {}),
    modifiable: !node.unmodifiable && node.trash !== true,
    fingerprint: bookmarkFingerprint(node),
  };
}

export async function captureOrganizerSnapshot(
  repository: BookmarkRepository,
  rootId: string,
  scope: OrganizerScope,
): Promise<OrganizerSnapshot> {
  const all = await repository.getSubTree(rootId);
  const scopeRootId = scope.type === "all" ? rootId : scope.folderId;
  const scoped =
    scope.type === "all" ? all : await repository.getSubTree(scope.folderId);
  const paths = buildPaths(all, rootId);
  const nodes = scoped
    .filter((node) => node.id !== rootId && node.trash !== true)
    .map((node) => toSnapshotNode(node, paths.get(node.id) ?? ""));
  const folders = all
    .filter(
      (node) =>
        !node.url &&
        node.id !== rootId &&
        !node.unmodifiable &&
        node.trash !== true,
    )
    .map((node) => toSnapshotNode(node, paths.get(node.id) ?? ""));
  const serialized = JSON.stringify({
    scope_root_id: scopeRootId,
    bookmarks: nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      kind: node.kind,
      path: node.path,
      url: node.url,
      modifiable: node.modifiable,
    })),
    destination_folders: folders.map((folder) => ({
      id: folder.id,
      parentId: folder.parentId,
      title: folder.title,
      kind: folder.kind,
      path: folder.path,
    })),
  });
  return {
    nodes,
    folders,
    liveNodes: new Map(all.map((node) => [node.id, node])),
    serialized,
    byteLength: new TextEncoder().encode(serialized).byteLength,
  };
}
