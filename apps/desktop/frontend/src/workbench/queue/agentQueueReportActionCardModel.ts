import type {
  AgentQueueReportAction,
  AgentQueueReportActionCard,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  displayTaskTitle,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskStatus,
  normalizeValidationStatus,
} from "../agentQueueTaskUiModel";
import { queueClosureStateForTask } from "./agentQueueClosureState";
import { latestWorkerExecutionReport } from "./agentQueueDiffReviewModel";

export function buildWorkerExecutionReportActionCard({
  linkedDiffReviewTask,
  sourceTask,
  dependentTasks = [],
  report,
}: {
  linkedDiffReviewTask?: AgentQueueTask | null;
  sourceTask: AgentQueueTask;
  dependentTasks?: AgentQueueTask[];
  report: AgentQueueWorkerExecutionReport;
}): AgentQueueReportActionCard {
  const queueTag = normalizeQueueTag(sourceTask);

  return {
    cardId: reportActionCardId({
      kind: "worker_execution",
      reportId: report.reportId,
      sourceItemId: sourceTask.queueItemId,
    }),
    changedFiles: report.changedFiles,
    commitHash: report.commitHash,
    createdAt: report.createdAt,
    dependentItemIds: dependentTasks.map((task) => task.queueItemId),
    errors: report.errors,
    followUpRecommendation: report.followUpRecommendation,
    linkedDiffReviewItemId: linkedDiffReviewTask?.queueItemId,
    linkedDiffReviewStatus: linkedDiffReviewTask?.status,
    linkedFollowUpItemIds: [],
    recommendedActions: workerReportActions({
      hasLinkedDiffReview: Boolean(linkedDiffReviewTask),
      isNoChangeReport: report.changedFiles.length === 0 && !report.commitHash,
    }),
    reportKind: "worker_execution",
    reportStatus: report.reportStatus,
    reportSummary: report.summary,
    rollbackRecommendation: report.rollbackRecommendation,
    sourceItemDescription: sourceTask.description,
    sourceItemId: sourceTask.queueItemId,
    sourceItemPriority: sourceTask.priority,
    sourceItemPrompt: sourceTask.prompt,
    sourceItemStatus: normalizeTaskStatus(sourceTask.status),
    sourceItemTitle: displayTaskTitle(sourceTask),
    sourceItemType: normalizeItemType(sourceTask.itemType),
    sourceCoordinatorStatus: sourceTask.coordinatorStatus,
    sourceClosureState: queueClosureStateForTask(sourceTask) ?? "closure_required",
    sourceQueueTag: queueTag.queueTagName,
    sourceQueueTagId: queueTag.queueTagId,
    sourceReportId: report.reportId,
    sourceValidationStatus: normalizeValidationStatus(sourceTask.validationStatus),
    warnings: report.warnings,
  };
}

export function buildDiffReviewReportActionCard({
  diffReviewTask,
  sourceTask,
}: {
  diffReviewTask: AgentQueueTask;
  sourceTask?: AgentQueueTask | null;
}): AgentQueueReportActionCard | null {
  const metadata = diffReviewTask.diffReview;
  const source = sourceTask ?? null;
  const queueTag = normalizeQueueTag(source ?? diffReviewTask);
  const sourceReportId = metadata?.sourceReportId ?? diffReviewTask.queueItemId;
  const sourceReport = source ? latestWorkerExecutionReport(source) : null;

  if (!metadata?.sourceItemId && !source) {
    return null;
  }

  return {
    cardId: reportActionCardId({
      kind: "diff_review",
      reportId: sourceReportId,
      sourceItemId: metadata?.sourceItemId ?? source?.queueItemId ?? diffReviewTask.queueItemId,
    }),
    changedFiles: sourceReport?.changedFiles ?? [],
    commitHash: metadata?.sourceCommitHash ?? sourceReport?.commitHash,
    createdAt: diffReviewTask.updatedAt,
    dependentItemIds: [],
    errors: [],
    followUpRecommendation: sourceReport?.followUpRecommendation,
    linkedDiffReviewItemId: diffReviewTask.queueItemId,
    linkedDiffReviewStatus: diffReviewTask.status,
    linkedFollowUpItemIds: [],
    recommendedActions: diffReviewReportActions(
      (sourceReport?.changedFiles.length ?? 0) === 0 &&
        !metadata?.sourceCommitHash &&
        !sourceReport?.commitHash,
    ),
    reportKind: "diff_review",
    reportStatus: normalizeTaskStatus(diffReviewTask.status),
    reportSummary:
      metadata?.reviewTargetSummary ||
      `Diff Review item ${displayTaskTitle(diffReviewTask)} is available for coordinator review.`,
    rollbackRecommendation: sourceReport?.rollbackRecommendation,
    sourceItemDescription: source?.description,
    sourceItemId: metadata?.sourceItemId ?? source?.queueItemId ?? diffReviewTask.queueItemId,
    sourceItemPriority: source?.priority ?? diffReviewTask.priority,
    sourceItemPrompt: source?.prompt,
    sourceItemStatus: normalizeTaskStatus(source?.status ?? "review_needed"),
    sourceItemTitle: source ? displayTaskTitle(source) : metadata?.sourceItemId ?? "Source item",
    sourceItemType: normalizeItemType(source?.itemType ?? "implementation"),
    sourceCoordinatorStatus: source?.coordinatorStatus,
    sourceClosureState:
      queueClosureStateForTask(source ?? diffReviewTask) ?? "closure_required",
    sourceQueueTag: queueTag.queueTagName,
    sourceQueueTagId: queueTag.queueTagId,
    sourceReportId,
    sourceValidationStatus: source
      ? normalizeValidationStatus(source.validationStatus)
      : undefined,
    warnings: [
      "Diff Review report metadata is model-only until a real review report is attached.",
    ],
  };
}

export function followUpTaskPromptFromReportCard(
  card: AgentQueueReportActionCard,
): string {
  return [
    `Follow-up/sub-block from report ${card.sourceReportId}.`,
    "",
    `Source Queue item: ${card.sourceItemTitle} (${card.sourceItemId})`,
    `Report kind: ${card.reportKind}`,
    `Report status: ${card.reportStatus}`,
    `Summary: ${card.reportSummary}`,
    card.followUpRecommendation
      ? `Follow-up recommendation: ${card.followUpRecommendation}`
      : "Follow-up recommendation: coordinator requested follow-up from the report card.",
    card.rollbackRecommendation
      ? `Rollback recommendation: ${card.rollbackRecommendation}`
      : null,
    compactListBlock("Changed files reported", card.changedFiles),
    compactListBlock("Warnings", card.warnings),
    compactListBlock("Errors", card.errors),
    "",
    "Do not run automatically. Produce a focused follow-up result for coordinator review.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function diffReviewTaskPromptFromReportCard(
  card: AgentQueueReportActionCard,
): string {
  return [
    `Diff Review work item for: ${card.sourceItemTitle}`,
    "",
    "Review goal:",
    "- Inspect the actual git diff manually through approved review surfaces.",
    "- Compare the diff to the worker/diff-review report and declared scope.",
    "- Check Hobit contracts and report findings.",
    "- Do not finalize the source item, run validation, execute rollback, or mutate Git.",
    "",
    `Source item: ${card.sourceItemId}`,
    `Source report: ${card.sourceReportId}`,
    card.commitHash ? `Commit: ${card.commitHash}` : null,
    `Report summary: ${card.reportSummary}`,
    compactListBlock("Changed files reported", card.changedFiles),
    compactListBlock("Warnings", card.warnings),
    compactListBlock("Errors", card.errors),
  ]
    .filter(Boolean)
    .join("\n");
}

function workerReportActions({
  hasLinkedDiffReview,
  isNoChangeReport,
}: {
  hasLinkedDiffReview: boolean;
  isNoChangeReport: boolean;
}): AgentQueueReportAction[] {
  return [
    reportAction("open_source_item", "Open source item", "Open the source Queue item."),
    reportAction(
      "mark_ready_for_finalization",
      "Ready for finalization",
      "Mark the source item ready for explicit coordinator finalization. No work starts.",
    ),
    reportAction(
      "finalize_accept_item",
      "Finalize / accept",
      "Explicitly accept the source Queue item. Dependent work may become eligible only in dry-run.",
    ),
    reportAction(
      "accept_without_commit",
      "Accept without commit",
      "Explicitly accept this no-change Queue item. No Git commit is created.",
      isNoChangeReport,
    ),
    reportAction(
      "mark_needs_changes",
      "Needs changes",
      "Mark the source Queue item for coordinator review/needs changes when the Queue task update path is available.",
    ),
    reportAction(
      "mark_follow_up_required",
      "Follow-up required",
      "Mark the source item as requiring follow-up before finalization.",
    ),
    reportAction(
      "create_follow_up",
      "Create follow-up",
      "Create a queued follow-up/sub-block item. It will not run automatically.",
    ),
    reportAction(
      "create_diff_review",
      hasLinkedDiffReview ? "Diff review linked" : "Create diff review",
      hasLinkedDiffReview
        ? "A linked Diff Review item already exists."
        : "Create a queued Diff Review item. It will not run automatically.",
      !hasLinkedDiffReview,
    ),
    reportAction(
      "open_linked_diff_review",
      "Open linked diff review",
      "Open the linked Diff Review item when one exists.",
      hasLinkedDiffReview,
    ),
    reportAction(
      "mark_blocked",
      "Blocked",
      "Mark the source item blocked. No follow-up or runtime action is started.",
    ),
    reportAction(
      "mark_failed_rejected",
      "Failed / rejected",
      "Reject the source item as failed while preserving report evidence.",
    ),
    reportAction(
      "mark_rollback_required",
      "Rollback required",
      "Mark rollback as required on the card only. No rollback executes.",
    ),
    reportAction(
      "pause_dependent_items",
      "Pause dependents",
      "Record a coordinator pause request for dependent tasks. No process is killed.",
    ),
    reportAction(
      "pause_queue_tag",
      "Pause queue tag",
      "Record a coordinator pause request for this queue tag. No process is killed.",
    ),
  ];
}

function diffReviewReportActions(isNoChangeReport: boolean): AgentQueueReportAction[] {
  return [
    reportAction("open_source_item", "Open source item", "Open the source Queue item."),
    reportAction(
      "open_linked_diff_review",
      "Open diff review item",
      "Open the linked Diff Review Queue item.",
    ),
    reportAction(
      "mark_ready_for_finalization",
      "Ready for finalization",
      "Mark the source item ready for explicit coordinator finalization. No work starts.",
    ),
    reportAction(
      "finalize_accept_item",
      "Finalize / accept",
      "Explicitly accept the source Queue item. Dependent work may become eligible only in dry-run.",
    ),
    reportAction(
      "accept_without_commit",
      "Accept without commit",
      "Explicitly accept this no-change Queue item. No Git commit is created.",
      isNoChangeReport,
    ),
    reportAction(
      "mark_needs_changes",
      "Needs changes",
      "Mark the source Queue item for coordinator review/needs changes when the Queue task update path is available.",
    ),
    reportAction(
      "mark_follow_up_required",
      "Follow-up required",
      "Mark the source item as requiring follow-up before finalization.",
    ),
    reportAction(
      "create_follow_up",
      "Create follow-up",
      "Create a queued follow-up/sub-block item. It will not run automatically.",
    ),
    reportAction(
      "mark_blocked",
      "Blocked",
      "Mark the source item blocked. No follow-up or runtime action is started.",
    ),
    reportAction(
      "mark_failed_rejected",
      "Failed / rejected",
      "Reject the source item as failed while preserving report evidence.",
    ),
    reportAction(
      "mark_rollback_required",
      "Rollback required",
      "Mark rollback as required on the card only. No rollback executes.",
    ),
  ];
}

function reportAction(
  type: AgentQueueReportAction["type"],
  label: string,
  description: string,
  enabled = true,
): AgentQueueReportAction {
  return {
    actionId: `${type}`,
    description,
    enabled,
    label,
    type,
  };
}

function reportActionCardId({
  kind,
  reportId,
  sourceItemId,
}: {
  kind: string;
  reportId: string;
  sourceItemId: string;
}) {
  return `queue-report-card-${kind}-${sourceItemId}-${reportId}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
}

function compactListBlock(title: string, values: string[]) {
  if (values.length === 0) {
    return `- ${title}: none reported`;
  }

  return [`- ${title}:`, ...values.slice(0, 6).map((value) => `  - ${value}`)].join(
    "\n",
  );
}
