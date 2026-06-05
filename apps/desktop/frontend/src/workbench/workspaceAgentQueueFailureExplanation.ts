import type {
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import {
  firstNonEmpty,
  errorToMessage,
  timestampValue,
} from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export async function explainQueueFailure(bridge: WorkspaceAgentQueueBridge) {
  try {
    const result = await bridge.getSnapshot({ includeSelectedItem: true });
    const snapshot = result.snapshot ?? result.item;

    if (!result.ok || !snapshot) {
      return `Queue failure evidence could not be loaded: ${
        result.error?.message ?? result.message
      }`;
    }

    return queueFailureExplanation(snapshot);
  } catch (error) {
    return `Queue failure evidence could not be loaded: ${errorToMessage(error)}`;
  }
}

export function queueFailureExplanation(snapshot: QueueWidgetSnapshot) {
  const item = failureExplanationTarget(snapshot);

  if (!item) {
    return [
      "No failure evidence is available for this item.",
      "Open/refresh the Queue report or select the failed item.",
    ].join(" ");
  }

  if (!hasFailureEvidence(item)) {
    return [
      `Queue item: ${item.id} - ${item.title}.`,
      "No failure evidence is available for this item.",
      "Open/refresh the Queue report or select the failed item.",
    ].join(" ");
  }

  const latestRun = item.runLinks[0] ?? null;
  const failedCommand = firstNonEmpty([
    item.reportSummary.failedCommand,
    latestRun?.directWorkRunId
      ? `Direct Work run ${latestRun.directWorkRunId}`
      : null,
  ]);
  const errorMessage = firstNonEmpty([
    item.reportSummary.errorMessage,
    item.blockers.find((blocker) => blocker.code === "validation_failed")
      ?.message,
    item.blockers[0]?.message,
  ]);
  const resultStatus = item.reportSummary.status;
  const evidenceStatus = item.evidenceSummary.status;
  const validationSummary = firstNonEmpty([
    item.reportSummary.validationSummary,
    item.validationStatus ? `Validation status: ${item.validationStatus}.` : null,
    item.evidenceSummary.validationStatus
      ? `Validation status: ${item.evidenceSummary.validationStatus}.`
      : null,
  ]);
  const finalSummary = firstNonEmpty([
    item.reportSummary.summary,
    latestRun
      ? `Latest run ${latestRun.directWorkRunId} is ${latestRun.status}.`
      : null,
  ]);

  return [
    `Queue item: ${item.id} - ${item.title}.`,
    `Execution status: ${item.executionStatus}.`,
    `Coordinator/review status: ${item.coordinatorStatus ?? "not reported"}.`,
    `Result/evidence status: report ${resultStatus}, evidence ${evidenceStatus}.`,
    `Failed command: ${failedCommand || "not available in Queue evidence"}.`,
    `Error message: ${errorMessage || "not available in Queue evidence"}.`,
    `Worker report / final response summary: ${
      finalSummary || "not available in Queue evidence"
    }.`,
    `Validation summary: ${
      validationSummary || "not available in Queue evidence"
    }.`,
    `Suggested next action: ${failureExplanationNextAction(item)}.`,
  ].join(" ");
}

function failureExplanationTarget(snapshot: QueueWidgetSnapshot) {
  if (snapshot.selectedItem && hasFailureEvidence(snapshot.selectedItem)) {
    return snapshot.selectedItem;
  }

  const failedItems = snapshot.items
    .filter(hasFailureEvidence)
    .sort(
      (left, right) =>
        timestampValue(right.updatedAt) - timestampValue(left.updatedAt),
    );

  if (failedItems[0]) {
    return failedItems[0];
  }

  return snapshot.selectedItem;
}

function hasFailureEvidence(item: QueueWidgetItemSnapshot) {
  return (
    item.status === "failed" ||
    item.executionStatus === "failed" ||
    item.coordinatorStatus === "failed" ||
    item.validationStatus === "failed" ||
    item.evidenceSummary.validationStatus === "failed" ||
    item.reportSummary.status === "evidence_missing" ||
    Boolean(item.reportSummary.errorMessage) ||
    Boolean(item.reportSummary.failedCommand) ||
    item.blockers.some((blocker) => blocker.code === "validation_failed") ||
    item.runLinks.some((link) =>
      ["failed", "timed_out", "cancelled"].includes(link.status),
    )
  );
}

function failureExplanationNextAction(item: QueueWidgetItemSnapshot) {
  if (item.reportSummary.status === "evidence_missing") {
    return "refresh or open the Queue report so existing evidence can load; do not rerun validation unless explicitly requested";
  }

  if (item.reportSummary.errorMessage || item.reportSummary.failedCommand) {
    return "review the existing failed command/error in the Queue report, then decide whether to create a focused follow-up";
  }

  if (
    item.validationStatus === "failed" ||
    item.evidenceSummary.validationStatus === "failed"
  ) {
    return "inspect the existing validation evidence in the Queue report before deciding on a rerun";
  }

  return "open the Queue report for this item and review the linked evidence before taking action";
}
