import type {
  AgentQueueDiffReviewMetadata,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  displayTaskTitle,
  normalizeItemType,
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
