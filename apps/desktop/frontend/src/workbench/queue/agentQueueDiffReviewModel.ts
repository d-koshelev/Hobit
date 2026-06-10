import type {
  AgentQueueDiffReviewMetadata,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  displayTaskTitle,
  normalizeCoordinatorStatus,
  normalizeItemType,
  normalizeValidationStatus,
} from "../agentQueueTaskUiModel";
import {
  buildDiffReviewPromptBody,
  resolveDiffReviewInputSnapshot,
} from "../diffReview";

export type BuildDiffReviewPromptInput = {
  report?: AgentQueueWorkerExecutionReport | null;
  sourceTask: AgentQueueTask;
};

export function canCreateDiffReviewItem(task: AgentQueueTask | null) {
  if (!task || normalizeItemType(task.itemType) === "diff_review") {
    return false;
  }

  const latestReport = latestWorkerExecutionReport(task);

  return Boolean(
    latestReport ||
      task.coordinatorStatus === "awaiting_coordinator_review" ||
      task.status === "review_needed",
  );
}

export function latestWorkerExecutionReport(task: AgentQueueTask) {
  return task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ] ?? null;
}

export function buildDiffReviewMetadata({
  report,
  sourceTask,
}: BuildDiffReviewPromptInput): AgentQueueDiffReviewMetadata {
  return {
    reviewMode: report ? "diff_vs_report" : "contract_scope",
    reviewTargetSummary: diffReviewTargetSummary({ report, sourceTask }),
    sourceCommitHash: report?.commitHash,
    sourceItemId: sourceTask.queueItemId,
    sourceReportId: report?.reportId,
  };
}

export function buildDiffReviewPrompt({
  report,
  sourceTask,
}: BuildDiffReviewPromptInput) {
  const resolved = resolveDiffReviewInputSnapshot({ report, sourceTask });

  return buildDiffReviewPromptBody({
    createdAt: sourceTask.updatedAt,
    inputSnapshot: resolved.inputSnapshot,
    readonlyByDefault: true,
    requestId: `diff-review-${sourceTask.queueItemId}`,
    sourceTask: resolved.sourceTask,
    state: "draft",
    workspaceId: sourceTask.workspaceId,
  });
}

export function linkedDiffReviewTasks(
  sourceTask: AgentQueueTask | null,
  tasks: AgentQueueTask[],
) {
  if (!sourceTask) {
    return [];
  }

  return tasks.filter(
    (task) =>
      normalizeItemType(task.itemType) === "diff_review" &&
      task.diffReview?.sourceItemId === sourceTask.queueItemId,
  );
}

export function diffReviewSourceLabel(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
) {
  const sourceItemId = task.diffReview?.sourceItemId;

  if (!sourceItemId) {
    return null;
  }

  const sourceTask = tasks.find(
    (candidate) => candidate.queueItemId === sourceItemId,
  );

  return sourceTask
    ? `${displayTaskTitle(sourceTask)} (${sourceItemId})`
    : sourceItemId;
}

export type DiffReviewLinkageStatus =
  | "not_requested"
  | "requested_created"
  | "running"
  | "report_ready"
  | "accepted"
  | "rejected"
  | "blocked";

export type DiffReviewAvailabilitySummary = {
  hasDiffSummary: boolean;
  hasReport: boolean;
  hasValidation: boolean;
  warnings: string[];
};

export type DiffReviewLinkageView = {
  availability: DiffReviewAvailabilitySummary;
  isDiffReviewTask: boolean;
  linkedReviewTaskId: string | null;
  linkedReviewTitle: string | null;
  reviewModeLabel: string | null;
  sourceTaskId: string | null;
  sourceTaskTitle: string | null;
  status: DiffReviewLinkageStatus;
  statusLabel: string;
};

export function diffReviewLinkageViewForTask(
  task: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
): DiffReviewLinkageView {
  const isDiffReviewTask = normalizeItemType(task.itemType) === "diff_review";
  const sourceTask = isDiffReviewTask
    ? tasks.find((candidate) => candidate.queueItemId === task.diffReview?.sourceItemId) ??
      null
    : task;
  const linkedReviewTask = isDiffReviewTask
    ? task
    : linkedDiffReviewTasks(task, [...tasks])[0] ?? null;
  const availability = diffReviewAvailabilitySummary(sourceTask ?? task);
  const status = isDiffReviewTask
    ? diffReviewStatusForReviewTask(task)
    : linkedReviewTask
      ? diffReviewStatusForReviewTask(linkedReviewTask)
      : "not_requested";

  return {
    availability,
    isDiffReviewTask,
    linkedReviewTaskId: linkedReviewTask?.queueItemId ?? null,
    linkedReviewTitle: linkedReviewTask ? displayTaskTitle(linkedReviewTask) : null,
    reviewModeLabel: linkedReviewTask?.diffReview
      ? reviewModeDisplayLabel(linkedReviewTask.diffReview.reviewMode)
      : task.diffReview
        ? reviewModeDisplayLabel(task.diffReview.reviewMode)
        : null,
    sourceTaskId: sourceTask?.queueItemId ?? task.diffReview?.sourceItemId ?? null,
    sourceTaskTitle: sourceTask ? displayTaskTitle(sourceTask) : null,
    status,
    statusLabel: diffReviewStatusLabel(status),
  };
}

export function diffReviewStatusLabel(status: DiffReviewLinkageStatus) {
  switch (status) {
    case "not_requested":
      return "Not requested";
    case "requested_created":
      return "Requested";
    case "running":
      return "Running";
    case "report_ready":
      return "Report ready";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "blocked":
      return "Blocked";
  }
}

export function reviewModeDisplayLabel(
  reviewMode: AgentQueueDiffReviewMetadata["reviewMode"] | undefined,
) {
  switch (reviewMode) {
    case "contract_scope":
      return "Contract/scope";
    case "general_review":
      return "General review";
    case "diff_vs_report":
    default:
      return "Diff vs report";
  }
}

function diffReviewStatusForReviewTask(
  task: AgentQueueTask,
): DiffReviewLinkageStatus {
  if (
    task.closureState === "commit_created" ||
    task.closureState === "no_change_accepted" ||
    task.closureState === "follow_up_created"
  ) {
    return "accepted";
  }

  if (
    normalizeCoordinatorStatus(task.coordinatorStatus) === "needs_changes" ||
    normalizeCoordinatorStatus(task.coordinatorStatus) === "failed" ||
    task.status === "failed"
  ) {
    return "rejected";
  }

  if (
    task.closureState === "closure_blocked" ||
    normalizeCoordinatorStatus(task.coordinatorStatus) === "blocked" ||
    task.status === "cancelled"
  ) {
    return "blocked";
  }

  if (task.status === "running") {
    return "running";
  }

  if (
    task.status === "completed" ||
    task.status === "review_needed" ||
    (task.workerExecutionReports?.length ?? 0) > 0
  ) {
    return "report_ready";
  }

  return "requested_created";
}

function diffReviewAvailabilitySummary(
  sourceTask: AgentQueueTask,
): DiffReviewAvailabilitySummary {
  const latestReport = latestWorkerExecutionReport(sourceTask);
  const hasReport = Boolean(latestReport);
  const hasDiffSummary = Boolean(
    latestReport?.changedFiles.length ||
      latestReport?.commitHash ||
      latestReport?.finalGitStatus,
  );
  const hasValidation =
    normalizeValidationStatus(sourceTask.validationStatus) !== "not_started" ||
    Boolean(latestReport?.validationResult) ||
    Boolean(latestReport?.validationCommandsRun?.length);
  const warnings = [
    ...(latestReport?.warnings ?? []),
    ...(!hasReport ? ["Source report is not recorded."] : []),
    ...(!hasDiffSummary ? ["Diff/file summary is not recorded."] : []),
    ...(!hasValidation ? ["Validation evidence is not recorded."] : []),
  ];

  return {
    hasDiffSummary,
    hasReport,
    hasValidation,
    warnings,
  };
}

function diffReviewTargetSummary({
  report,
  sourceTask,
}: BuildDiffReviewPromptInput) {
  const sourceTitle = displayTaskTitle(sourceTask);

  if (report?.commitHash) {
    return `${sourceTitle}; commit ${report.commitHash}`;
  }

  if (report?.changedFiles.length) {
    return `${sourceTitle}; ${report.changedFiles.length.toString()} reported changed file${
      report.changedFiles.length === 1 ? "" : "s"
    }`;
  }

  return `${sourceTitle}; source item ${sourceTask.queueItemId}`;
}
