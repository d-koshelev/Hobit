import type {
  AgentQueueDiffReviewMetadata,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  displayTaskTitle,
  normalizeItemType,
  normalizeQueueTag,
} from "../agentQueueTaskUiModel";

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
  const sourceTitle = displayTaskTitle(sourceTask);
  const changedFiles = report?.changedFiles ?? [];
  const commandsRun = report?.commandsRun ?? [];
  const suggestedValidation = report?.validationCommandsSuggested ?? [];
  const warnings = report?.warnings ?? [];
  const errors = report?.errors ?? [];

  return [
    `Diff Review work item for: ${sourceTitle}`,
    "",
    "Purpose:",
    "- Inspect the actual git diff for the source work item.",
    "- Compare the diff to the worker execution report and declared scope.",
    "- Verify changed files are within the intended scope.",
    "- Check Hobit contracts and project instructions for violations.",
    "- Identify missing work, mismatch, risky changes, or unexpected changes.",
    "- Recommend follow-up, rollback discussion, or coordinator decision.",
    "- Produce a structured report with findings, evidence, risk, and recommendation.",
    "",
    "Source work item:",
    `- Source item id: ${sourceTask.queueItemId}`,
    `- Title: ${sourceTitle}`,
    `- Queue tag: ${normalizeQueueTag(sourceTask).queueTagName}`,
    `- Status: ${sourceTask.status}`,
    `- Coordinator status: ${sourceTask.coordinatorStatus ?? "not_reported"}`,
    sourceTask.description.trim()
      ? `- Declared scope: ${sourceTask.description.trim()}`
      : "- Declared scope: not recorded",
    "",
    "Worker execution report:",
    report
      ? [
          `- Report id: ${report.reportId}`,
          `- Report status: ${report.reportStatus}`,
          report.commitHash ? `- Commit: ${report.commitHash}` : null,
          report.finalGitStatus ? `- Final git status: ${report.finalGitStatus}` : null,
          `- Summary: ${safePromptText(report.summary)}`,
          listBlock("Changed files reported", changedFiles),
          listBlock("Commands reported", commandsRun),
          listBlock("Suggested validation", suggestedValidation),
          listBlock("Warnings", warnings),
          listBlock("Errors", errors),
          report.followUpRecommendation
            ? `- Follow-up recommendation: ${safePromptText(report.followUpRecommendation)}`
            : null,
          report.rollbackRecommendation
            ? `- Rollback recommendation: ${safePromptText(report.rollbackRecommendation)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "- No worker report is attached. Review the source item scope and any available changed-file or coordinator-review context.",
    "",
    "Required output:",
    "- Diff summary and changed-file scope check.",
    "- Report-vs-diff comparison.",
    "- Contract and safety findings.",
    "- Missing work or unexpected-change findings.",
    "- Validation gaps or commands to run separately.",
    "- Recommendation: accept for coordinator review, request follow-up, request rollback discussion, or block finalization.",
    "",
    "Boundaries:",
    "- Do not modify code by default.",
    "- Do not finalize the source item.",
    "- Do not launch Queue, Executor, Codex, Terminal, or external calls.",
  ].join("\n");
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

function listBlock(title: string, values: string[]) {
  if (values.length === 0) {
    return `- ${title}: none reported`;
  }

  return [`- ${title}:`, ...values.map((value) => `  - ${safePromptText(value)}`)].join("\n");
}

function safePromptText(value: string) {
  return value
    .replace(/\bmodel-only\b/gi, "local preview")
    .replace(/\bprovider\b/gi, "external")
    .replace(/\bmodel\b/gi, "configuration")
    .replace(/\bthinking\b/gi, "private reasoning");
}
