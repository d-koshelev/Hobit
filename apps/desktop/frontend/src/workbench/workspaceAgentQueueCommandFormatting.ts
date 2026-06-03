import type {
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import {
  workspaceAgentQueueBlockerLabel,
  workspaceAgentQueueNextRecommendedItem,
  workspaceAgentQueueTopBlockers,
} from "./workspaceAgentQueueActions";
import type { WorkspaceAgentQueueAutonomousActionResult } from "./workspaceAgentQueueBridge";

export function queueSummary(snapshot: QueueWidgetSnapshot) {
  const counts = snapshot.itemCounts;
  const topQueued = snapshot.items
    .filter(
      (item) =>
        (item.status === "queued" || item.status === "ready") &&
        item.blockers.length === 0,
    )
    .slice(0, 3);
  const blockers = workspaceAgentQueueTopBlockers(snapshot, 3);
  const nextItem = workspaceAgentQueueNextRecommendedItem(snapshot);

  return [
    `Queue has ${counts.total.toString()} item${counts.total === 1 ? "" : "s"}: ${counts.queued.toString()} queued, ${counts.running.toString()} running, ${counts.blocked.toString()} blocked, ${counts.reportReady.toString()} report-ready, ${counts.awaitingCoordinatorReview.toString()} awaiting review, ${counts.finalized.toString()} finalized.`,
    `Top queued tasks: ${
      topQueued.length > 0
        ? topQueued.map((item) => `${item.id} - ${item.title}`).join("; ")
        : "none"
    }.`,
    `Blockers: ${
      blockers.length > 0
        ? blockers.map(workspaceAgentQueueBlockerLabel).join("; ")
        : "none obvious"
    }.`,
    `Recommendation: ${queueRecommendation(snapshot, nextItem)}.`,
  ].join(" ");
}

export function createdItemSummary(item: QueueWidgetItemSnapshot) {
  const executionWorkspace = item.executionWorkspace?.trim() ?? "";

  if (!executionWorkspace) {
    return "Created Queue item, but task workspace is missing.";
  }

  return [
    `Created Queue item: ${item.id} \u2014 ${item.title}. Status: ${item.status}.`,
    `Task workspace: ${executionWorkspace}`,
    `Sandbox: ${item.sandbox ?? "not set"}`,
    `Approval: ${item.approvalPolicy ?? "not set"}`,
  ].join("\n");
}

export function findQueueUpdateTarget(
  items: QueueWidgetItemSnapshot[],
  target: string,
):
  | { item: QueueWidgetItemSnapshot; kind: "matched" }
  | { items: QueueWidgetItemSnapshot[]; kind: "ambiguous" }
  | { kind: "missing" } {
  const normalizedTarget = target.trim().toLowerCase();
  const exactMatch = items.find(
    (item) => item.id.toLowerCase() === normalizedTarget,
  );

  if (exactMatch) {
    return { item: exactMatch, kind: "matched" };
  }

  const titleMatches = items.filter((item) =>
    item.title.toLowerCase().includes(normalizedTarget),
  );

  if (titleMatches.length === 1 && titleMatches[0]) {
    return { item: titleMatches[0], kind: "matched" };
  }

  if (titleMatches.length > 1) {
    return { items: titleMatches.slice(0, 5), kind: "ambiguous" };
  }

  return { kind: "missing" };
}

export function autonomousResultMessage(
  result: WorkspaceAgentQueueAutonomousActionResult,
  successFallback: string,
  failurePrefix: string,
) {
  if (result.ok) {
    return result.message || successFallback;
  }

  return `${failurePrefix}: ${result.error?.message ?? result.message}`;
}

function queueRecommendation(
  snapshot: QueueWidgetSnapshot,
  nextItem: QueueWidgetItemSnapshot | undefined,
) {
  const counts = snapshot.itemCounts;

  if (counts.running > 0) {
    return "review active running work before starting more";
  }

  if (nextItem?.status === "queued" || nextItem?.status === "ready") {
    return `run or review ${nextItem.id} next`;
  }

  if (snapshot.blockers.length > 0 || counts.blocked > 0) {
    return "clear the top blocker before starting new work";
  }

  if (counts.total === 0) {
    return "create a focused Queue task";
  }

  if (nextItem?.status === "draft") {
    return `finish drafting ${nextItem.id}`;
  }

  return "no immediate Queue action";
}
