import type { BookmarkRepository } from "../core/types";
import { t } from "../core/i18n";
import { confirmOrganizerDeletes } from "../ui/dialogs";
import { BookmarkPlanExecutor } from "./executor";
import { ResponsesOrganizerClient } from "./responses-client";
import {
  AgentSettingsStore,
  endpointOriginPattern,
  normalizeEndpoint,
} from "./settings";
import { captureOrganizerSnapshot, MAX_SNAPSHOT_BYTES } from "./snapshot";
import type {
  DeleteProposal,
  OrganizerPlan,
  OrganizerProposal,
  OrganizerScope,
} from "./types";

interface OrganizerPanelContext {
  repository: BookmarkRepository;
  rootId: string;
  trigger: HTMLElement;
  showToast: (message: string) => void;
}

function button(label: string, className = "button"): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "organizer-field";
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text, control);
  return wrapper;
}

function formatBytes(value: number): string {
  return value < 1_000
    ? `${value} B`
    : `${(value / 1_000).toFixed(value < 100_000 ? 1 : 0)} KB`;
}

function proposalLabel(proposal: OrganizerProposal): string {
  if (proposal.type === "rename") return t("organizerRename");
  if (proposal.type === "move") return t("organizerMove");
  return t("organizerDelete");
}

function proposalOriginal(proposal: OrganizerProposal): string {
  return proposal.target.path || proposal.target.title;
}

function proposalResult(proposal: OrganizerProposal): string {
  if (proposal.type === "rename") {
    const separator = proposal.target.path.lastIndexOf("/");
    const parent =
      separator > 0 ? proposal.target.path.slice(0, separator) : "";
    return `${parent}/${proposal.newTitle}`;
  }
  if (proposal.type === "move") {
    return `${proposal.destination.path}/${proposal.target.title}`;
  }
  return proposal.descendantCount > 0
    ? `${t("organizerDelete")} · ${proposal.descendantCount}`
    : t("organizerDelete");
}

function statusText(proposal: OrganizerProposal): string {
  if (proposal.status === "applied") return t("organizerApplied");
  if (proposal.status === "rejected") return t("organizerRejected");
  if (proposal.status === "stale") return t("organizerStale");
  if (proposal.status === "failed") return t("organizerFailed");
  return "";
}

export async function openOrganizerPanel(
  context: OrganizerPanelContext,
): Promise<void> {
  const root = document.querySelector<HTMLElement>("#organizer-root");
  if (!root || root.querySelector(".organizer-panel")) return;

  const settingsStore = new AgentSettingsStore();
  await settingsStore.load();
  const allSnapshot = await captureOrganizerSnapshot(
    context.repository,
    context.rootId,
    { type: "all" },
  );

  const panel = document.createElement("aside");
  panel.className = "organizer-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", t("organizeBookmarks"));
  const header = document.createElement("header");
  const heading = document.createElement("h2");
  heading.textContent = t("organizeBookmarks");
  const close = button("×", "icon-button organizer-close");
  close.setAttribute("aria-label", t("cancel"));
  header.append(heading, close);
  const body = document.createElement("div");
  body.className = "organizer-body";
  panel.append(header, body);
  root.append(panel);

  let abortController: AbortController | null = null;
  let plan: OrganizerPlan | null = null;
  let closed = false;
  const finish = (): void => {
    if (closed) return;
    closed = true;
    abortController?.abort();
    document.removeEventListener("keydown", handleKeydown);
    panel.remove();
    if (context.trigger.isConnected) context.trigger.focus();
  };
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  };
  close.addEventListener("click", finish);
  document.addEventListener("keydown", handleKeydown);

  const renderReview = (): void => {
    if (!plan) return;
    const review = document.createElement("section");
    review.className = "organizer-review";
    const top = document.createElement("div");
    top.className = "organizer-review-header";
    const title = document.createElement("h3");
    title.textContent = t("organizerReview");
    const approveAll = button(t("organizerApproveAll"), "button primary");
    approveAll.disabled = !plan.proposals.some(
      (proposal) => proposal.status === "pending",
    );
    top.append(title, approveAll);
    if (plan.summary) {
      const summary = document.createElement("p");
      summary.className = "organizer-summary";
      summary.textContent = plan.summary;
      review.append(summary);
    }
    review.prepend(top);
    const list = document.createElement("div");
    list.className = "organizer-proposals";
    const columns = document.createElement("div");
    columns.className = "organizer-proposal-columns";
    const originalLabel = document.createElement("span");
    originalLabel.textContent = t("organizerOriginal");
    const resultLabel = document.createElement("span");
    resultLabel.textContent = t("organizerResult");
    columns.append(originalLabel, resultLabel);
    list.append(columns);
    const executor = new BookmarkPlanExecutor(context.repository, renderReview);
    for (const proposal of plan.proposals) {
      const item = document.createElement("article");
      item.className = `organizer-proposal is-${proposal.status}`;
      item.title = proposal.reason;
      const kind = document.createElement("strong");
      kind.className = "organizer-proposal-kind";
      kind.textContent = proposalLabel(proposal);
      const original = document.createElement("span");
      original.className = "organizer-proposal-value";
      original.textContent = proposalOriginal(proposal);
      const arrow = document.createElement("span");
      arrow.className = "organizer-proposal-arrow";
      arrow.textContent = "→";
      arrow.setAttribute("aria-hidden", "true");
      const result = document.createElement("span");
      result.className = "organizer-proposal-value organizer-proposal-result";
      result.textContent = proposalResult(proposal);
      item.append(kind, original, arrow, result);
      if (proposal.status === "pending") {
        const actions = document.createElement("div");
        actions.className = "organizer-proposal-actions";
        const reject = button(t("organizerReject"));
        const approve = button(
          t("organizerApprove"),
          proposal.type === "delete" ? "button danger" : "button primary",
        );
        reject.addEventListener("click", () => executor.reject(proposal));
        approve.addEventListener(
          "click",
          () => void executor.approve(proposal),
        );
        actions.append(reject, approve);
        item.append(actions);
      } else {
        const status = document.createElement("span");
        status.className = "organizer-proposal-status";
        status.textContent = statusText(proposal);
        status.title = status.textContent;
        item.append(status);
      }
      list.append(item);
    }
    if (plan.proposals.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = t("organizerNoChanges");
      list.append(empty);
    }
    review.append(list);
    approveAll.addEventListener("click", async () => {
      if (!plan) return;
      const pendingDeletes = plan.proposals.filter(
        (proposal): proposal is DeleteProposal =>
          proposal.status === "pending" && proposal.type === "delete",
      );
      if (
        pendingDeletes.length > 0 &&
        !(await confirmOrganizerDeletes(
          pendingDeletes.length,
          pendingDeletes.reduce(
            (total, proposal) => total + proposal.descendantCount,
            0,
          ),
        ))
      ) {
        return;
      }
      approveAll.disabled = true;
      await executor.approveAll(plan.proposals);
      renderReview();
    });
    body.replaceChildren(review);
  };

  const renderSetup = (): void => {
    const saved = settingsStore.settings;
    const form = document.createElement("form");
    form.className = "organizer-setup";
    const scope = document.createElement("select");
    const all = document.createElement("option");
    all.value = "";
    all.textContent = t("organizerAllBookmarks");
    scope.append(all);
    for (const folder of allSnapshot.folders) {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.path;
      scope.append(option);
    }
    const instruction = document.createElement("textarea");
    instruction.maxLength = 4_000;
    instruction.required = true;
    instruction.placeholder = t("organizerRequestPlaceholder");
    const endpoint = document.createElement("input");
    endpoint.type = "url";
    endpoint.value = saved.endpoint;
    endpoint.required = true;
    const model = document.createElement("input");
    model.type = "text";
    model.maxLength = 100;
    model.value = saved.model;
    model.required = true;
    const apiKey = document.createElement("input");
    apiKey.type = "password";
    apiKey.autocomplete = "off";
    apiKey.placeholder = saved.apiKey ? t("organizerSavedKey") : "";
    const connection = document.createElement("details");
    connection.className = "organizer-connection";
    const connectionTitle = document.createElement("summary");
    connectionTitle.textContent = t("organizerConnection");
    const clearKey = button(t("organizerClearKey"));
    clearKey.disabled = !saved.apiKey;
    clearKey.addEventListener("click", () => {
      void settingsStore.clearKey().then(renderSetup);
    });
    connection.append(
      connectionTitle,
      field(t("organizerEndpoint"), endpoint),
      field(t("organizerModel"), model),
      field(t("organizerApiKey"), apiKey),
      clearKey,
    );
    const meta = document.createElement("p");
    meta.className = "organizer-meta";
    meta.textContent = t("organizerItems", {
      count: String(allSnapshot.nodes.length),
      size: formatBytes(allSnapshot.byteLength),
    });
    scope.addEventListener("change", async () => {
      const next = await captureOrganizerSnapshot(
        context.repository,
        context.rootId,
        scope.value
          ? { type: "folder", folderId: scope.value }
          : { type: "all" },
      );
      meta.textContent = t("organizerItems", {
        count: String(next.nodes.length),
        size: formatBytes(next.byteLength),
      });
    });
    const error = document.createElement("p");
    error.className = "form-error";
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "organizer-actions";
    const run = button(t("organizerRun"), "button primary");
    run.type = "submit";
    actions.append(run);
    form.append(
      field(t("organizerScope"), scope),
      field(t("organizerRequest"), instruction),
      meta,
      connection,
      error,
      actions,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const normalizedEndpoint = normalizeEndpoint(endpoint.value);
      const nextKey = apiKey.value.trim() || saved.apiKey;
      const nextModel = model.value.trim();
      const request = instruction.value.trim();
      const origin = normalizedEndpoint
        ? endpointOriginPattern(normalizedEndpoint)
        : null;
      if (
        !normalizedEndpoint ||
        !nextKey ||
        !nextModel ||
        !request ||
        !origin
      ) {
        error.textContent = t("organizerInvalidConnection");
        error.hidden = false;
        return;
      }
      let allowed = false;
      try {
        allowed = await chrome.permissions.request({ origins: [origin] });
      } catch {
        // Permission requests can fail when the browser dismisses the prompt.
      }
      if (!allowed) {
        error.textContent = t("organizerPermissionDenied");
        error.hidden = false;
        return;
      }
      let snapshot;
      try {
        const previousOrigin = endpointOriginPattern(saved.endpoint);
        await settingsStore.save({
          version: 1,
          endpoint: normalizedEndpoint,
          model: nextModel,
          apiKey: nextKey,
        });
        if (previousOrigin && previousOrigin !== origin) {
          await chrome.permissions.remove({ origins: [previousOrigin] });
        }
        const selectedScope: OrganizerScope = scope.value
          ? { type: "folder", folderId: scope.value }
          : { type: "all" };
        snapshot = await captureOrganizerSnapshot(
          context.repository,
          context.rootId,
          selectedScope,
        );
      } catch {
        error.textContent = t("organizerRequestFailed");
        error.hidden = false;
        return;
      }
      if (snapshot.byteLength > MAX_SNAPSHOT_BYTES) {
        error.textContent = t("organizerScopeTooLarge");
        error.hidden = false;
        return;
      }
      abortController = new AbortController();
      const progress = document.createElement("div");
      progress.className = "organizer-progress";
      const progressText = document.createElement("p");
      progressText.textContent = t("organizerPlanning");
      const cancel = button(t("organizerCancelRun"));
      cancel.addEventListener("click", () => abortController?.abort());
      progress.append(progressText, cancel);
      body.replaceChildren(progress);
      try {
        plan = await new ResponsesOrganizerClient().plan({
          settings: settingsStore.settings,
          instruction: request,
          snapshot,
          signal: abortController.signal,
        });
        abortController = null;
        renderReview();
      } catch (caught) {
        abortController = null;
        if (caught instanceof DOMException && caught.name === "AbortError") {
          renderSetup();
        } else {
          context.showToast(t("organizerRequestFailed"));
          renderSetup();
        }
      }
    });
    body.replaceChildren(form);
    instruction.focus();
  };

  renderSetup();
}
