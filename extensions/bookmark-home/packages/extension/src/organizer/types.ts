import type { BookmarkNode } from "../core/types";

export interface AgentSettingsV1 {
  version: 1;
  endpoint: string;
  model: string;
  apiKey: string;
}

export type OrganizerScope =
  { type: "all" } | { type: "folder"; folderId: string };

export interface SnapshotNode {
  id: string;
  parentId?: string;
  title: string;
  kind: "bookmark" | "folder";
  path: string;
  url?: string;
  modifiable: boolean;
  fingerprint: string;
}

export interface OrganizerSnapshot {
  nodes: SnapshotNode[];
  folders: SnapshotNode[];
  liveNodes: Map<string, BookmarkNode>;
  serialized: string;
  byteLength: number;
}

export type ProposalStatus =
  "pending" | "applying" | "applied" | "rejected" | "stale" | "failed";

interface ProposalBase {
  id: string;
  targetId: string;
  reason: string;
  target: SnapshotNode;
  status: ProposalStatus;
}

export interface RenameProposal extends ProposalBase {
  type: "rename";
  newTitle: string;
}

export interface MoveProposal extends ProposalBase {
  type: "move";
  destinationFolderId: string;
  destination: SnapshotNode;
}

export interface DeleteProposal extends ProposalBase {
  type: "delete";
  descendantCount: number;
  subtreeFingerprint: string;
}

export type OrganizerProposal = RenameProposal | MoveProposal | DeleteProposal;

export interface OrganizerPlan {
  summary: string;
  proposals: OrganizerProposal[];
}
