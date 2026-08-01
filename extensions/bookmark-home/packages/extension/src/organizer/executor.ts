import type { BookmarkNode, BookmarkRepository } from "../core/types";
import { bookmarkFingerprint } from "./snapshot";
import type {
  DeleteProposal,
  OrganizerProposal,
  ProposalStatus,
} from "./types";

function subtreeFingerprint(nodes: BookmarkNode[]): string {
  return nodes.map(bookmarkFingerprint).join("\n");
}

function relevantSnapshotMatches(
  proposal: OrganizerProposal,
  live: BookmarkNode,
): boolean {
  const original = JSON.parse(proposal.target.fingerprint) as unknown[];
  const current = JSON.parse(bookmarkFingerprint(live)) as unknown[];
  if (proposal.type === "rename") {
    return (
      current[2] === original[2] &&
      current[3] === original[3] &&
      current[4] === original[4] &&
      current[5] === original[5]
    );
  }
  if (proposal.type === "move") {
    return (
      current[1] === original[1] &&
      current[3] === original[3] &&
      current[4] === original[4] &&
      current[5] === original[5]
    );
  }
  return bookmarkFingerprint(live) === proposal.target.fingerprint;
}

export class BookmarkPlanExecutor {
  readonly #repository: BookmarkRepository;
  readonly #onStatusChange: () => void;

  constructor(
    repository: BookmarkRepository,
    onStatusChange: () => void = () => undefined,
  ) {
    this.#repository = repository;
    this.#onStatusChange = onStatusChange;
  }

  reject(proposal: OrganizerProposal): void {
    if (proposal.status !== "pending") return;
    this.#setStatus(proposal, "rejected");
  }

  async approve(proposal: OrganizerProposal): Promise<void> {
    if (proposal.status !== "pending") return;
    this.#setStatus(proposal, "applying");
    try {
      const live = await this.#repository.getNode(proposal.targetId);
      if (
        !live ||
        live.unmodifiable ||
        live.trash ||
        !relevantSnapshotMatches(proposal, live)
      ) {
        this.#setStatus(proposal, "stale");
        return;
      }
      if (proposal.type === "rename") {
        await this.#repository.update(proposal.targetId, {
          title: proposal.newTitle,
        });
      } else if (proposal.type === "move") {
        const destination = await this.#repository.getNode(
          proposal.destinationFolderId,
        );
        if (
          !destination ||
          destination.url ||
          destination.unmodifiable ||
          destination.trash
        ) {
          this.#setStatus(proposal, "stale");
          return;
        }
        if (
          await this.#isDescendant(
            proposal.destinationFolderId,
            proposal.targetId,
          )
        ) {
          this.#setStatus(proposal, "stale");
          return;
        }
        await this.#repository.move(proposal.targetId, {
          parentId: proposal.destinationFolderId,
        });
      } else {
        if (!(await this.#deleteSnapshotMatches(proposal))) {
          this.#setStatus(proposal, "stale");
          return;
        }
        await this.#repository.remove(
          proposal.targetId,
          proposal.target.kind === "folder",
        );
      }
      this.#setStatus(proposal, "applied");
    } catch {
      this.#setStatus(proposal, "failed");
    }
  }

  async approveAll(proposals: OrganizerProposal[]): Promise<void> {
    const pending = proposals.filter(
      (proposal) => proposal.status === "pending",
    );
    const order = [
      ...pending.filter((proposal) => proposal.type === "move"),
      ...pending.filter((proposal) => proposal.type === "rename"),
      ...pending
        .filter(
          (proposal): proposal is DeleteProposal => proposal.type === "delete",
        )
        .sort(
          (left, right) => right.target.path.length - left.target.path.length,
        ),
    ];
    for (const proposal of order) await this.approve(proposal);
  }

  async #deleteSnapshotMatches(proposal: DeleteProposal): Promise<boolean> {
    if (proposal.target.kind === "bookmark") return true;
    try {
      const nodes = await this.#repository.getSubTree(proposal.targetId);
      return subtreeFingerprint(nodes) === proposal.subtreeFingerprint;
    } catch {
      return false;
    }
  }

  async #isDescendant(
    candidateId: string,
    ancestorId: string,
  ): Promise<boolean> {
    let currentId: string | undefined = candidateId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      if (currentId === ancestorId) return true;
      visited.add(currentId);
      currentId = (await this.#repository.getNode(currentId))?.parentId;
    }
    return false;
  }

  #setStatus(proposal: OrganizerProposal, status: ProposalStatus): void {
    proposal.status = status;
    this.#onStatusChange();
  }
}
