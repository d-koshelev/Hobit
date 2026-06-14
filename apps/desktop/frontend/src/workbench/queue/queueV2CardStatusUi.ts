import type { BadgeVariant } from "../agentQueueFormatting";
import type { QueueNextAction } from "./queueV2NextActionModel";
import type { QueueTaskViewModel } from "./queueV2ViewModel";
import { queueV2BlockedByDependencyLabel } from "./queueV2SmartStatusModel";

type QueueMarkerTone = "success" | "error" | "info" | "warning" | "neutral";

export function queueV2MarkerBadgeVariant(tone: QueueMarkerTone): BadgeVariant {
  switch (tone) {
    case "success":
      return "success";
    case "error":
      return "error";
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "neutral":
      return "neutral";
  }
}

export function queueV2HumanStatusBadgeVariant(
  status: QueueTaskViewModel["humanStatus"]["status"],
): BadgeVariant {
  switch (status) {
    case "ready":
    case "closed":
      return "success";
    case "running":
      return "info";
    case "waiting_dependency":
    case "review":
    case "needs_decision":
    case "blocked":
      return "warning";
    case "failed":
      return "error";
    case "cancelled":
      return "neutral";
  }
}

export function queueV2CardStatusDetail(item: QueueTaskViewModel) {
  if (
    item.humanStatus.status === "waiting_dependency" ||
    item.humanStatus.status === "needs_decision"
  ) {
    return item.humanStatus.text;
  }

  if (item.humanStatus.text.startsWith("Blocked:")) {
    return (
      queueV2BlockedByDependencyLabel(item.dependencySummary) ??
      item.blockerSummary.primaryReason ??
      item.blockedReasons[0]?.label ??
      null
    );
  }

  return (
    item.blockerSummary.primaryReason ??
    item.blockedReasons[0]?.label ??
    item.eligibility.blockedReasons[0]?.label ??
    null
  );
}

export function queueV2NextActionBadgeVariant(
  action: QueueNextAction,
): BadgeVariant {
  switch (action) {
    case "review_report":
    case "accept_result":
    case "request_changes":
    case "create_follow_up":
    case "reject_result":
      return "warning";
    case "resolve_dependency":
    case "resolve_blocker":
    case "wait_for_capacity":
    case "assign_worker":
      return "info";
    default:
      return "neutral";
  }
}
