import type {
  AgentQueueTaskItemType,
  AgentQueueTaskStatus,
  AgentQueueWorkerExecutionReportValidationResult,
} from "../../workspace/types";
import type { QueuePromptPackImportMetadata } from "../promptPack/queuePromptPackMetadata";
import type { ValidationResultSummary } from "../validation";

export type DiffReviewSeverity = "info" | "warning" | "error" | "blocker";

export type DiffReviewRecommendation =
  | "accept_ready"
  | "request_changes"
  | "validation_required"
  | "blocked"
  | "rollback_required"
  | "manual_review_required";

export type DiffReviewState =
  | "draft"
  | "ready"
  | "reviewing"
  | "reported"
  | "blocked";

export type DiffReviewChecklistItemId =
  | "report_matches_actual_diff"
  | "allowed_scope_respected"
  | "forbidden_files_not_changed"
  | "project_contracts_respected"
  | "validation_evidence_exists_and_passed_or_explicit"
  | "tests_added_or_updated_where_required"
  | "prompt_pack_metadata_preserved"
  | "expected_commit_title_available_and_correct"
  | "no_hidden_commit_push_finalize"
  | "dependent_tasks_unblock_state";

export type DiffReviewChecklistItemStatus =
  | "unchecked"
  | "pass"
  | "fail"
  | "not_applicable"
  | "needs_manual_review";

export interface DiffReviewFinding {
  id: string;
  severity: DiffReviewSeverity;
  title: string;
  detail: string;
  checklistItemId?: DiffReviewChecklistItemId;
}

export interface DiffReviewChecklistItem {
  id: DiffReviewChecklistItemId;
  label: string;
  required: boolean;
  status: DiffReviewChecklistItemStatus;
  guidance: string;
  findingIds: string[];
}

export interface DiffReviewSourceTaskRef {
  queueItemId: string;
  title: string;
  status?: AgentQueueTaskStatus;
  itemType?: AgentQueueTaskItemType;
  executionWorkspace?: string | null;
  reportId?: string | null;
  commitHash?: string | null;
  expectedCommitTitle?: string | null;
  promptPackBlockId?: string | null;
  promptPackId?: string | null;
}

export interface DiffReviewInputSnapshot {
  actualDiffSummary?: string | null;
  agentFinalResponse?: string | null;
  allowedScope?: string[];
  expectedCommitTitle?: string | null;
  forbiddenFiles?: string[];
  reportedChangedFiles?: string[];
  reportSummary?: string | null;
  validationCommands?: string[];
  validationEvidenceSummary?: ValidationResultSummary | null;
  validationResult?: AgentQueueWorkerExecutionReportValidationResult | null;
  promptPackMetadata?: QueuePromptPackImportMetadata | null;
  projectContracts?: string[];
  testsAddedOrUpdated?: boolean | null;
  dependentTaskIds?: string[];
  dependentTasksCanBeUnblocked?: boolean | null;
  unsupportedStates?: string[];
}

export interface DiffReviewRequest {
  requestId: string;
  workspaceId: string;
  createdAt: string;
  sourceTask: DiffReviewSourceTaskRef;
  inputSnapshot: DiffReviewInputSnapshot;
  state: DiffReviewState;
  recommendation?: DiffReviewRecommendation | null;
  readonlyByDefault: boolean;
}

export interface DiffReviewChecklistResult {
  requestId: string;
  checklist: DiffReviewChecklistItem[];
  findings: DiffReviewFinding[];
  recommendation: DiffReviewRecommendation;
  summary: string;
  state: DiffReviewState;
}

export function buildDefaultDiffReviewChecklist(): DiffReviewChecklistItem[] {
  return [
    checklistItem(
      "report_matches_actual_diff",
      "Report matches actual diff",
      "Compare the worker report to the visible read-only diff before coordinator acceptance.",
    ),
    checklistItem(
      "allowed_scope_respected",
      "Allowed scope respected",
      "Verify every changed area is inside the declared allowed scope.",
    ),
    checklistItem(
      "forbidden_files_not_changed",
      "Forbidden files not changed",
      "Confirm forbidden paths, files, and behaviors are untouched.",
    ),
    checklistItem(
      "project_contracts_respected",
      "Project contracts respected",
      "Check AGENTS.md and task-specific Hobit contracts for violations.",
    ),
    checklistItem(
      "validation_evidence_exists_and_passed_or_explicit",
      "Validation evidence exists and is passed or explicit",
      "Require passed validation evidence or an explicit visible reason validation is unavailable.",
    ),
    checklistItem(
      "tests_added_or_updated_where_required",
      "Tests added or updated where required",
      "Confirm test coverage changed when the implementation risk or contract requires it.",
    ),
    checklistItem(
      "prompt_pack_metadata_preserved",
      "Prompt-pack metadata preserved",
      "Confirm prompt-pack id, block id, scope, dependencies, validation commands, and title metadata are preserved when present.",
    ),
    checklistItem(
      "expected_commit_title_available_and_correct",
      "Expected commit title available and correct",
      "Check the expected commit title is visible and matches the intended final change.",
    ),
    checklistItem(
      "no_hidden_commit_push_finalize",
      "No hidden commit, push, or finalize",
      "Verify the source task was not auto-finalized and no hidden commit, push, rollback, or dependency unblock occurred.",
    ),
    checklistItem(
      "dependent_tasks_unblock_state",
      "Dependent tasks can or cannot be unblocked",
      "State whether dependent tasks remain blocked or can be explicitly unblocked by the operator.",
    ),
  ];
}

export function validateDiffReviewRequest(
  request: DiffReviewRequest,
): DiffReviewChecklistResult {
  const checklist = buildDefaultDiffReviewChecklist();
  const findings = buildRequestFindings(request);
  const checklistWithFindings = checklist.map((item) => {
    const matchingFindings = findings.filter(
      (finding) => finding.checklistItemId === item.id,
    );

    return {
      ...item,
      findingIds: matchingFindings.map((finding) => finding.id),
      status: checklistStatusForFindings(matchingFindings),
    };
  });
  const recommendation =
    request.recommendation ?? recommendationForFindings(findings);

  return {
    checklist: checklistWithFindings,
    findings,
    recommendation,
    requestId: request.requestId,
    state: findings.some((finding) => finding.severity === "blocker")
      ? "blocked"
      : request.state,
    summary: summarizeDiffReviewRecommendation(recommendation),
  };
}

export function summarizeDiffReviewRecommendation(
  recommendation: DiffReviewRecommendation,
): string {
  switch (recommendation) {
    case "accept_ready":
      return "Accept ready: checklist evidence supports coordinator acceptance.";
    case "request_changes":
      return "Request changes: findings require implementation follow-up.";
    case "validation_required":
      return "Validation required: acceptance is blocked until validation evidence is explicit.";
    case "blocked":
      return "Blocked: required review inputs or source context are unavailable.";
    case "rollback_required":
      return "Rollback required: changes appear unsafe enough to require operator rollback discussion.";
    case "manual_review_required":
      return "Manual review required: a human reviewer must inspect unresolved scope, diff, or metadata gaps.";
  }
}

export function buildDiffReviewPromptBody(request: DiffReviewRequest): string {
  const snapshot = request.inputSnapshot;
  const metadata = snapshot.promptPackMetadata;

  return [
    `Diff Review request: ${request.sourceTask.title}`,
    "",
    "Purpose:",
    "- Inspect the actual git diff for the source work item.",
    "- Compare the diff to the worker execution report and declared scope.",
    "- Check Hobit contracts and project instructions for violations.",
    "- Do not finalize the source item.",
    "",
    "Review mode:",
    "- Read-only by default.",
    "- Do not modify code, create commits, push, rollback, finalize the source task, unblock dependents, run Terminal commands, or start Queue/Executor work.",
    "- Inspect visible evidence and produce a recommendation report only.",
    "",
    "Source task:",
    `- Source item id: ${request.sourceTask.queueItemId}`,
    `- Source status: ${request.sourceTask.status ?? "unknown"}`,
    `- Source item type: ${request.sourceTask.itemType ?? "implementation"}`,
    `- Execution workspace: ${request.sourceTask.executionWorkspace ?? "not recorded"}`,
    `- Source report id: ${request.sourceTask.reportId ?? "not recorded"}`,
    `- Source commit hash: ${request.sourceTask.commitHash ?? "not recorded"}`,
    `- Expected commit title: ${
      request.sourceTask.expectedCommitTitle ??
      metadata?.expectedCommitTitle ??
      "not recorded"
    }`,
    "",
    "Source task report summary/ref:",
    textLine("Worker report summary", snapshot.reportSummary),
    `- Source report ref: ${request.sourceTask.reportId ?? "not recorded"}`,
    textLine("Agent final response", snapshot.agentFinalResponse),
    "",
    "Diff/file-change availability:",
    textLine("Actual diff summary", snapshot.actualDiffSummary),
    listBlock("Reported changed files", snapshot.reportedChangedFiles ?? []),
    listBlock("Unavailable review inputs", snapshot.unsupportedStates ?? []),
    "",
    "Validation evidence summary/ref:",
    `- Validation evidence: ${
      snapshot.validationEvidenceSummary
        ? `${snapshot.validationEvidenceSummary.status}; ${snapshot.validationEvidenceSummary.summary}`
        : snapshot.validationResult ?? "not recorded"
    }`,
    listBlock(
      "Validation evidence refs",
      snapshot.validationEvidenceSummary?.evidenceRefs.map(validationEvidenceRefLabel) ?? [],
    ),
    listBlock(
      "Validation commands",
      snapshot.validationCommands ?? metadata?.validationCommands ?? [],
    ),
    "",
    "Declared scope:",
    listBlock("Allowed scope", snapshot.allowedScope ?? metadata?.allowedScope ?? []),
    listBlock("Forbidden files", snapshot.forbiddenFiles ?? metadata?.forbiddenScope ?? []),
    "",
    "Prompt-pack metadata:",
    `- Pack: ${metadata?.packName ?? "not recorded"}${
      metadata?.packId ? ` (${metadata.packId})` : ""
    }`,
    `- Block id: ${metadata?.blockId ?? request.sourceTask.promptPackBlockId ?? "not recorded"}`,
    listBlock("Dependencies", metadata?.dependencies ?? []),
    listBlock("Unavailable review inputs", snapshot.unsupportedStates ?? []),
    "",
    "Checklist:",
    ...buildDefaultDiffReviewChecklist().map((item) => `- ${item.label}`),
    "",
    "Expected recommendation format:",
    "- Findings with severity and evidence.",
    "- Recommendation: accept_ready, request_changes, validation_required, blocked, rollback_required, or manual_review_required.",
    "- Explicit dependent-task unblock statement: can be unblocked or cannot be unblocked.",
  ].join("\n");
}

function buildRequestFindings(request: DiffReviewRequest): DiffReviewFinding[] {
  const findings: DiffReviewFinding[] = [];
  const snapshot = request.inputSnapshot;
  const validationPassed =
    snapshot.validationEvidenceSummary?.status === "passed" ||
    snapshot.validationResult === "passed";

  if (!hasText(snapshot.actualDiffSummary)) {
    findings.push(
      finding(
        "missing_actual_diff",
        "warning",
        "Actual diff summary missing",
        "diff unavailable, manual diff required",
        "report_matches_actual_diff",
      ),
    );
  }

  if (!hasText(snapshot.reportSummary)) {
    findings.push(
      finding(
        "missing_worker_report",
        "warning",
        "Worker report missing",
        "No worker report summary is present, so the reviewer must treat report-vs-diff comparison as a manual review gap.",
        "report_matches_actual_diff",
      ),
    );
  }

  if (!validationPassed) {
    findings.push(
      finding(
        "missing_or_unpassed_validation",
        "error",
        "Validation evidence missing or not passed",
        "Validation must be passed or explicitly documented before coordinator acceptance.",
        "validation_evidence_exists_and_passed_or_explicit",
      ),
    );
  }

  if (!request.readonlyByDefault) {
    findings.push(
      finding(
        "review_not_readonly",
        "blocker",
        "Diff Review is not read-only by default",
        "Diff Review items must not edit code, commit, push, finalize, rollback, or unblock dependents by default.",
        "no_hidden_commit_push_finalize",
      ),
    );
  }

  if (
    (snapshot.promptPackMetadata || request.sourceTask.promptPackBlockId) &&
    !(
      snapshot.promptPackMetadata?.blockId ||
      request.sourceTask.promptPackBlockId
    )
  ) {
    findings.push(
      finding(
        "prompt_pack_block_missing",
        "warning",
        "Prompt-pack block id missing",
        "Prompt-pack metadata appears present but no block id is available.",
        "prompt_pack_metadata_preserved",
      ),
    );
  }

  if (
    !request.sourceTask.expectedCommitTitle &&
    !snapshot.promptPackMetadata?.expectedCommitTitle
  ) {
    findings.push(
      finding(
        "expected_commit_title_missing",
        "warning",
        "Expected commit title missing",
        "The expected commit title is not visible for final acceptance review.",
        "expected_commit_title_available_and_correct",
      ),
    );
  }

  if (
    snapshot.dependentTaskIds?.length &&
    snapshot.dependentTasksCanBeUnblocked == null
  ) {
    findings.push(
      finding(
        "dependent_unblock_state_missing",
        "warning",
        "Dependent unblock state missing",
        "Dependent tasks exist, but the request does not state whether they can be unblocked.",
        "dependent_tasks_unblock_state",
      ),
    );
  }

  for (const [index, unsupportedState] of (
    snapshot.unsupportedStates ?? []
  ).entries()) {
    findings.push(
      finding(
        `unsupported_state_${index.toString()}`,
        "info",
        "Unsupported review input",
        unsupportedState,
      ),
    );
  }

  return findings;
}

function recommendationForFindings(
  findings: DiffReviewFinding[],
): DiffReviewRecommendation {
  if (findings.some((finding) => finding.severity === "blocker")) {
    return "blocked";
  }

  if (findings.some((finding) => finding.id === "missing_or_unpassed_validation")) {
    return "validation_required";
  }

  if (findings.some((finding) => finding.severity === "error")) {
    return "request_changes";
  }

  if (findings.some((finding) => finding.severity === "warning")) {
    return "manual_review_required";
  }

  return "accept_ready";
}

function checklistItem(
  id: DiffReviewChecklistItemId,
  label: string,
  guidance: string,
): DiffReviewChecklistItem {
  return {
    findingIds: [],
    guidance,
    id,
    label,
    required: true,
    status: "unchecked",
  };
}

function checklistStatusForFindings(
  findings: DiffReviewFinding[],
): DiffReviewChecklistItemStatus {
  if (findings.some((finding) => finding.severity === "blocker" || finding.severity === "error")) {
    return "fail";
  }

  if (findings.some((finding) => finding.severity === "warning")) {
    return "needs_manual_review";
  }

  return "unchecked";
}

function finding(
  id: string,
  severity: DiffReviewSeverity,
  title: string,
  detail: string,
  checklistItemId?: DiffReviewChecklistItemId,
): DiffReviewFinding {
  return { checklistItemId, detail, id, severity, title };
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function textLine(label: string, value: string | null | undefined) {
  return `- ${label}: ${hasText(value) ? value?.trim() : "not recorded"}`;
}

function listBlock(label: string, values: string[]) {
  if (values.length === 0) {
    return `- ${label}: none recorded`;
  }

  return [`- ${label}:`, ...values.map((value) => `  - ${value}`)].join("\n");
}

function validationEvidenceRefLabel(
  ref: NonNullable<DiffReviewInputSnapshot["validationEvidenceSummary"]>["evidenceRefs"][number],
) {
  return [
    ref.evidenceId,
    `run ${ref.runId}`,
    `command ${ref.commandId}`,
    `status ${ref.status}`,
    ref.fullLogRef ? `log ${ref.fullLogRef}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}
