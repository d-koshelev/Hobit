import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
  AgentQueueWorkerExecutionReportValidationResult,
  WorkspaceGitDiffSummary,
} from "../../workspace/types";
import {
  displayTaskTitle,
  normalizeItemType,
} from "../agentQueueTaskUiModel";
import { getQueuePromptPackImportMetadata } from "../promptPack/queuePromptPackMetadata";
import type { ValidationResultSummary, ValidationRunStatus } from "../validation";
import type {
  DiffReviewChecklistItemId,
  DiffReviewFinding,
  DiffReviewInputSnapshot,
  DiffReviewSourceTaskRef,
} from "./diffReviewModel";

export type DiffReviewInputAvailabilitySummary = {
  hasActualDiffSummary: boolean;
  hasExpectedCommitTitle: boolean;
  hasPromptPackMetadata: boolean;
  hasReport: boolean;
  hasValidationEvidence: boolean;
  checklistFindings: DiffReviewFinding[];
  warnings: string[];
};

export type DiffReviewInputSnapshotResolution = {
  availability: DiffReviewInputAvailabilitySummary;
  inputSnapshot: DiffReviewInputSnapshot;
  sourceTask: DiffReviewSourceTaskRef;
};

export type ResolveDiffReviewInputSnapshotInput = {
  agentFinalResponse?: string | null;
  dependentTasks?: AgentQueueTask[];
  dependentTasksCanBeUnblocked?: boolean | null;
  diffSummary?: WorkspaceGitDiffSummary | null;
  fileChangeSummary?: string | null;
  projectContracts?: string[];
  report?: AgentQueueWorkerExecutionReport | null;
  sourceTask: AgentQueueTask;
  testsAddedOrUpdated?: boolean | null;
  validationEvidenceSummary?: ValidationResultSummary | null;
};

export function resolveDiffReviewInputSnapshot({
  agentFinalResponse,
  dependentTasks = [],
  dependentTasksCanBeUnblocked = null,
  diffSummary,
  fileChangeSummary,
  projectContracts = [],
  report,
  sourceTask,
  testsAddedOrUpdated = null,
  validationEvidenceSummary,
}: ResolveDiffReviewInputSnapshotInput): DiffReviewInputSnapshotResolution {
  const promptPackMetadata = getQueuePromptPackImportMetadata(sourceTask);
  const sourceReport =
    report && !isValidationReport(report)
      ? report
      : latestImplementationReport(sourceTask) ?? report ?? null;
  const validationReport = latestValidationReport(sourceTask);
  const validationSummary =
    validationEvidenceSummary ?? validationSummaryFromReport(validationReport);
  const expectedCommitTitle = promptPackMetadata?.expectedCommitTitle ?? null;
  const actualDiffSummary =
    trimmedOrNull(fileChangeSummary) ?? diffSummaryText(diffSummary);
  const unsupportedStates = unsupportedReviewStates({
    actualDiffSummary,
    promptPackMetadataAvailable: Boolean(promptPackMetadata),
    report: sourceReport,
    validationSummary,
  });

  const inputSnapshot: DiffReviewInputSnapshot = {
    actualDiffSummary,
    agentFinalResponse:
      safeReviewText(trimmedOrNull(agentFinalResponse)) ??
      safeReviewText(trimmedOrNull(sourceReport?.rawReportPreview)),
    allowedScope: promptPackMetadata?.allowedScope ?? [],
    dependentTaskIds: dependentTasks.map((task) => task.queueItemId),
    dependentTasksCanBeUnblocked,
    expectedCommitTitle,
    forbiddenFiles: promptPackMetadata?.forbiddenScope ?? [],
    projectContracts,
    promptPackMetadata,
    reportedChangedFiles: uniqueNonEmpty(sourceReport?.changedFiles ?? []),
    reportSummary: safeReviewText(trimmedOrNull(sourceReport?.summary)),
    testsAddedOrUpdated,
    unsupportedStates,
    validationCommands: validationCommandsForTask({
      promptPackCommands: promptPackMetadata?.validationCommands ?? [],
      report: sourceReport,
      sourceTask,
      validationReport,
    }),
    validationEvidenceSummary: validationSummary,
    validationResult: validationReport?.validationResult ?? sourceReport?.validationResult,
  };
  const sourceTaskRef: DiffReviewSourceTaskRef = {
    commitHash: sourceReport?.commitHash ?? null,
    expectedCommitTitle,
    executionWorkspace: sourceTask.executionWorkspace ?? null,
    itemType: normalizeItemType(sourceTask.itemType),
    promptPackBlockId: promptPackMetadata?.blockId ?? null,
    promptPackId: promptPackMetadata?.packId ?? null,
    queueItemId: sourceTask.queueItemId,
    reportId: sourceReport?.reportId ?? null,
    status: sourceTask.status,
    title: displayTaskTitle(sourceTask),
  };

  return {
    availability: summarizeDiffReviewInputAvailability(inputSnapshot),
    inputSnapshot,
    sourceTask: sourceTaskRef,
  };
}

export function summarizeDiffReviewInputAvailability(
  snapshot: DiffReviewInputSnapshot,
): DiffReviewInputAvailabilitySummary {
  const findings: DiffReviewFinding[] = [];

  if (!hasText(snapshot.actualDiffSummary)) {
    findings.push(
      availabilityFinding(
        "input_diff_unavailable",
        "warning",
        "Diff unavailable",
        "diff unavailable, manual diff required",
        "report_matches_actual_diff",
      ),
    );
  }

  if (!hasText(snapshot.reportSummary) && !hasText(snapshot.agentFinalResponse)) {
    findings.push(
      availabilityFinding(
        "input_report_missing",
        "warning",
        "Report missing",
        "Source task report or final response is missing; review must rely on visible scope and manually inspected diff.",
        "report_matches_actual_diff",
      ),
    );
  }

  if (!snapshot.validationEvidenceSummary && !snapshot.validationResult) {
    findings.push(
      availabilityFinding(
        "input_validation_missing",
        "warning",
        "Validation evidence missing",
        "Validation evidence is missing; the reviewer must request or inspect validation before acceptance.",
        "validation_evidence_exists_and_passed_or_explicit",
      ),
    );
  }

  if (!hasText(snapshot.expectedCommitTitle)) {
    findings.push(
      availabilityFinding(
        "input_expected_commit_title_missing",
        "warning",
        "Expected commit title missing",
        "Expected commit title is not available from prompt-pack metadata or report evidence.",
        "expected_commit_title_available_and_correct",
      ),
    );
  }

  return {
    checklistFindings: findings,
    hasActualDiffSummary: hasText(snapshot.actualDiffSummary),
    hasExpectedCommitTitle: hasText(snapshot.expectedCommitTitle),
    hasPromptPackMetadata: Boolean(snapshot.promptPackMetadata),
    hasReport: hasText(snapshot.reportSummary) || hasText(snapshot.agentFinalResponse),
    hasValidationEvidence: Boolean(
      snapshot.validationEvidenceSummary || snapshot.validationResult,
    ),
    warnings: findings.map((finding) => finding.detail),
  };
}

function latestImplementationReport(task: AgentQueueTask) {
  const reports = task.workerExecutionReports ?? [];
  return [...reports].reverse().find((report) => !isValidationReport(report)) ?? null;
}

function latestValidationReport(task: AgentQueueTask) {
  const reports = task.workerExecutionReports ?? [];

  return [...reports].reverse().find(isValidationReport) ?? null;
}

function isValidationReport(report: AgentQueueWorkerExecutionReport) {
  return Boolean(
    report.validationResult ||
      report.validationCommandsRun?.length ||
      report.workerId === "queue-validation" ||
      report.reportId.startsWith("validation-report-"),
  );
}

function validationSummaryFromReport(
  report: AgentQueueWorkerExecutionReport | null,
): ValidationResultSummary | null {
  if (!report?.validationResult || report.validationResult === "not_run") {
    return null;
  }

  const status = validationStatusFromReport(report.validationResult);

  return {
    commandCount: report.validationCommandsRun?.length ?? report.commandsRun.length,
    errors: [...report.errors],
    evidenceRefs: [],
    failedCount: status === "failed" ? 1 : 0,
    needsReviewCount: status === "needs_review" ? 1 : 0,
    passedCount: status === "passed" ? 1 : 0,
    severity: status === "passed" ? "info" : status === "failed" ? "error" : "warning",
    status,
    summary: report.summary,
    title: `Validation ${status.replace("_", " ")}`,
    warnings: [...report.warnings],
  };
}

function validationStatusFromReport(
  result: AgentQueueWorkerExecutionReportValidationResult,
): ValidationRunStatus {
  switch (result) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "partial":
    case "not_run":
      return "needs_review";
  }
}

function validationCommandsForTask({
  promptPackCommands,
  report,
  sourceTask,
  validationReport,
}: {
  promptPackCommands: string[];
  report: AgentQueueWorkerExecutionReport | null;
  sourceTask: AgentQueueTask;
  validationReport: AgentQueueWorkerExecutionReport | null;
}) {
  return uniqueNonEmpty([
    ...promptPackCommands,
    ...(sourceTask.executionPlanPreview?.expectedValidationCommands ?? []),
    ...(report?.validationCommandsSuggested ?? []),
    ...(report?.validationCommandsRun ?? []),
    ...(validationReport?.validationCommandsSuggested ?? []),
    ...(validationReport?.validationCommandsRun ?? []),
  ]);
}

function diffSummaryText(diffSummary: WorkspaceGitDiffSummary | null | undefined) {
  if (!diffSummary) {
    return null;
  }

  const totals = diffSummary.summary;
  const additions =
    totals.totalAdditions === null
      ? "additions unknown"
      : `${totals.totalAdditions.toString()} addition(s)`;
  const deletions =
    totals.totalDeletions === null
      ? "deletions unknown"
      : `${totals.totalDeletions.toString()} deletion(s)`;
  const fileLines = diffSummary.files.slice(0, 20).map((file) =>
    [
      file.path,
      file.status,
      file.additions === null ? null : `+${file.additions.toString()}`,
      file.deletions === null ? null : `-${file.deletions.toString()}`,
      file.staged ? "staged" : null,
      file.unstaged ? "unstaged" : null,
      file.untracked ? "untracked" : null,
      file.conflicted ? "conflicted" : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const hiddenFiles = Math.max(0, diffSummary.files.length - fileLines.length);

  return [
    `Repo: ${diffSummary.repoRoot}`,
    `Status: ${diffSummary.status}`,
    `${totals.totalFiles.toString()} changed file(s); ${totals.stagedCount.toString()} staged; ${totals.unstagedCount.toString()} unstaged; ${totals.untrackedCount.toString()} untracked; ${totals.conflictedCount.toString()} conflicted; ${additions}; ${deletions}`,
    diffSummary.errorMessage ? `Diff error: ${diffSummary.errorMessage}` : null,
    ...fileLines.map((line) => `- ${line}`),
    hiddenFiles ? `- +${hiddenFiles.toString()} more file(s)` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function unsupportedReviewStates({
  actualDiffSummary,
  promptPackMetadataAvailable,
  report,
  validationSummary,
}: {
  actualDiffSummary: string | null;
  promptPackMetadataAvailable: boolean;
  report: AgentQueueWorkerExecutionReport | null;
  validationSummary: ValidationResultSummary | null;
}) {
  const states: string[] = [];

  if (!hasText(actualDiffSummary)) {
    states.push("diff unavailable, manual diff required");
  }

  if (!report) {
    states.push("source task report missing");
  }

  if (!validationSummary) {
    states.push("validation evidence missing");
  }

  if (!promptPackMetadataAvailable) {
    states.push("prompt-pack metadata unavailable");
  }

  return states;
}

function availabilityFinding(
  id: string,
  severity: DiffReviewFinding["severity"],
  title: string,
  detail: string,
  checklistItemId?: DiffReviewChecklistItemId,
): DiffReviewFinding {
  return { checklistItemId, detail, id, severity, title };
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function trimmedOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function safeReviewText(value: string | null) {
  return value
    ?.replace(/\bmodel-only\b/gi, "local preview")
    .replace(/\bprovider\b/gi, "external")
    .replace(/\bmodel\b/gi, "configuration")
    .replace(/\bthinking\b/gi, "private reasoning") ?? null;
}
