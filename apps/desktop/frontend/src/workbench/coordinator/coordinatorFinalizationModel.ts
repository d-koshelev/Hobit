import type {
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
} from "../../workspace/types";
import type { DiffReviewRecommendation } from "../diffReview";
import type { QueuePromptPackImportMetadata } from "../promptPack/queuePromptPackMetadata";

export type CoordinatorDecision =
  | "accept_without_commit"
  | "accept_with_commit"
  | "request_changes"
  | "create_follow_up"
  | "mark_blocked"
  | "mark_failed"
  | "rollback_required"
  | "manual_review_required";

export type CoordinatorDecisionSeverity = "warning" | "error";

export type CoordinatorFinalizationState =
  | "blocked"
  | "changes_requested"
  | "failed"
  | "finalized"
  | "follow_up_required"
  | "manual_review_required"
  | "ready_for_finalization"
  | "rollback_required";

export type CoordinatorNextAction =
  | "create_diff_review"
  | "create_follow_up"
  | "finalize"
  | "manual_review"
  | "record_blocker"
  | "record_failure"
  | "record_rollback_required"
  | "request_changes"
  | "resolve_commit"
  | "run_validation";

export type CoordinatorDecisionEvidenceKind =
  | "commit"
  | "diff_review"
  | "prompt_pack"
  | "queue_task"
  | "validation"
  | "worker_report";

export type CoordinatorDecisionEvidenceRef = {
  id: string;
  kind: CoordinatorDecisionEvidenceKind;
  label?: string;
  status?: string | null;
  summary?: string | null;
};

export type CoordinatorCommitInfo = {
  hash?: string | null;
  missingHashReason?: string | null;
  source?: "operator" | "worker_report" | "git_review" | "unknown";
  title?: string | null;
};

export type CoordinatorCommitValidationResult = {
  errors: string[];
  expectedTitle?: string | null;
  hashFormat: "missing" | "short_sha" | "full_sha" | "invalid";
  normalizedHash?: string | null;
  titleStatus:
    | "generic"
    | "match"
    | "missing"
    | "mismatch"
    | "project_prefixed"
    | "unchecked";
  valid: boolean;
  warnings: string[];
};

export type CoordinatorValidationEvidenceRef = {
  evidenceRefs?: CoordinatorDecisionEvidenceRef[];
  explicitOverrideReason?: string | null;
  status?: AgentQueueTaskValidationStatus | "not_run" | "unknown" | null;
  summary?: string | null;
};

export type CoordinatorDiffReviewRef = {
  evidenceRefs?: CoordinatorDecisionEvidenceRef[];
  explicitOverrideReason?: string | null;
  recommendation?: DiffReviewRecommendation | null;
  reportId?: string | null;
  status?: AgentQueueTaskStatus | "reported" | "missing" | "unknown" | null;
  taskId?: string | null;
};

export type CoordinatorSourceQueueTaskRef = {
  id: string;
  status?: AgentQueueTaskStatus | null;
  title: string;
};

export type CoordinatorDependencyGate = {
  dependentTaskIds: string[];
  readyToUnblock: boolean;
  reason: string;
};

export type CoordinatorPromptPackMetadataRef = QueuePromptPackImportMetadata & {
  projectName?: string | null;
};

export type CoordinatorFinalizationRequest = {
  commit?: CoordinatorCommitInfo | null;
  decision: CoordinatorDecision;
  dependencyGate?: CoordinatorDependencyGate | null;
  diffReview?: CoordinatorDiffReviewRef | null;
  evidenceRefs?: CoordinatorDecisionEvidenceRef[];
  operatorNote?: string | null;
  promptPackMetadata?: CoordinatorPromptPackMetadataRef | null;
  sourceQueueTask: CoordinatorSourceQueueTaskRef;
  validationEvidence?: CoordinatorValidationEvidenceRef | null;
};

export type CoordinatorFinalizationIssue = {
  code: string;
  message: string;
  severity: CoordinatorDecisionSeverity;
};

export type CoordinatorFinalizationResult = {
  commitValidation: CoordinatorCommitValidationResult;
  decision: CoordinatorDecision;
  errors: CoordinatorFinalizationIssue[];
  nextAction: CoordinatorNextAction;
  ok: boolean;
  shouldUnblockDependents: boolean;
  sourceQueueTaskId: string;
  state: CoordinatorFinalizationState;
  summary: string;
  warnings: CoordinatorFinalizationIssue[];
};

const ACCEPT_DECISIONS = new Set<CoordinatorDecision>([
  "accept_without_commit",
  "accept_with_commit",
]);

const GENERIC_COMMIT_TITLES = new Set([
  "bug fix",
  "changes",
  "cleanup",
  "done",
  "fix",
  "fixes",
  "implementation",
  "initial commit",
  "misc",
  "misc changes",
  "refactor",
  "task",
  "update",
  "updates",
  "wip",
  "work in progress",
]);

export function validateCoordinatorDecisionRequest(
  request: CoordinatorFinalizationRequest,
): CoordinatorFinalizationResult {
  const issues: CoordinatorFinalizationIssue[] = [];
  const expectedTitle = buildExpectedCommitTitleFromMetadata(
    request.promptPackMetadata,
  );
  const commitValidation = validateCommitInfo(
    request.commit,
    request.decision,
    expectedTitle,
    request.promptPackMetadata?.projectName,
  );

  for (const error of commitValidation.errors) {
    issues.push(issue("commit_invalid", error, "error"));
  }

  for (const warning of commitValidation.warnings) {
    issues.push(issue("commit_warning", warning, "warning"));
  }

  if (!request.sourceQueueTask.id.trim()) {
    issues.push(
      issue("source_queue_task_id_missing", "Source Queue task id is required.", "error"),
    );
  }

  if (!request.sourceQueueTask.title.trim()) {
    issues.push(
      issue(
        "source_queue_task_title_missing",
        "Source Queue task title is required.",
        "error",
      ),
    );
  }

  addDecisionFieldIssues(request, issues);
  addEvidenceIssues(request, issues);

  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  const ok = errors.length === 0;
  const state = ok ? stateForDecision(request.decision) : "blocked";

  return {
    commitValidation,
    decision: request.decision,
    errors,
    nextAction: nextActionForRequest(request, errors),
    ok,
    shouldUnblockDependents: shouldUnblockDependents({
      decision: request.decision,
      state,
    }),
    sourceQueueTaskId: request.sourceQueueTask.id,
    state,
    summary: summarizeCoordinatorFinalizationState(state),
    warnings,
  };
}

export function validateCommitHashFormat(
  hash: string | null | undefined,
): CoordinatorCommitValidationResult {
  const normalizedHash = hash?.trim().toLowerCase() || null;

  if (!normalizedHash) {
    return emptyCommitValidation({
      hashFormat: "missing",
      normalizedHash: null,
      valid: false,
    });
  }

  if (/^[0-9a-f]{40}$/.test(normalizedHash)) {
    return emptyCommitValidation({
      hashFormat: "full_sha",
      normalizedHash,
      valid: true,
    });
  }

  if (/^[0-9a-f]{7,39}$/.test(normalizedHash)) {
    return emptyCommitValidation({
      hashFormat: "short_sha",
      normalizedHash,
      valid: true,
    });
  }

  return emptyCommitValidation({
    errors: ["Commit hash must be a 7-40 character hexadecimal SHA."],
    hashFormat: "invalid",
    normalizedHash,
    valid: false,
  });
}

export function buildExpectedCommitTitleFromMetadata(
  metadata: Pick<QueuePromptPackImportMetadata, "expectedCommitTitle"> | null | undefined,
): string | null {
  const title = metadata?.expectedCommitTitle?.trim();
  return title || null;
}

export function validateExpectedCommitTitle(
  actualTitle: string | null | undefined,
  expectedTitle: string | null | undefined,
  options: { projectName?: string | null; requireExpected?: boolean } = {},
): CoordinatorCommitValidationResult {
  const title = actualTitle?.trim() || null;
  const expected = expectedTitle?.trim() || null;
  const errors: string[] = [];
  const warnings: string[] = [];
  let titleStatus: CoordinatorCommitValidationResult["titleStatus"] = "unchecked";

  if (!title) {
    titleStatus = "missing";
    errors.push("Commit title is required when commit metadata is supplied.");
  } else if (isGenericCommitTitle(title)) {
    titleStatus = "generic";
    errors.push("Generic commit titles are not valid coordinator evidence.");
  } else if (hasProjectNamePrefix(title, options.projectName)) {
    titleStatus = "project_prefixed";
    errors.push("Project names belong in reports, not repository commit titles.");
  } else if (expected) {
    titleStatus = title === expected ? "match" : "mismatch";
    if (titleStatus === "mismatch") {
      errors.push("Commit title does not match prompt-pack expected commit title.");
    }
  } else {
    titleStatus = "unchecked";
    if (options.requireExpected) {
      warnings.push("Prompt-pack expected commit title is missing.");
    }
  }

  return emptyCommitValidation({
    errors,
    expectedTitle: expected,
    titleStatus,
    valid: errors.length === 0,
    warnings,
  });
}

export function summarizeCoordinatorFinalizationState(
  state: CoordinatorFinalizationState,
): string {
  switch (state) {
    case "blocked":
      return "Blocked: required finalization evidence or fields are missing.";
    case "changes_requested":
      return "Changes requested: dependents remain blocked until reviewed again.";
    case "failed":
      return "Failed: work is rejected or failed and dependents remain blocked.";
    case "finalized":
      return "Finalized: accepted coordinator decision can unblock dependents explicitly.";
    case "follow_up_required":
      return "Follow-up required: create or review follow-up work before unblocking.";
    case "manual_review_required":
      return "Manual review required: a human review decision is still needed.";
    case "ready_for_finalization":
      return "Ready for finalization: evidence is recorded for explicit closure.";
    case "rollback_required":
      return "Rollback required: rollback is recorded as a review outcome only.";
  }
}

export function shouldUnblockDependents(input: {
  decision: CoordinatorDecision;
  state: CoordinatorFinalizationState;
}): boolean {
  return input.state === "finalized" && ACCEPT_DECISIONS.has(input.decision);
}

function validateCommitInfo(
  commit: CoordinatorCommitInfo | null | undefined,
  decision: CoordinatorDecision,
  expectedTitle: string | null,
  projectName: string | null | undefined,
): CoordinatorCommitValidationResult {
  const hashValidation = validateCommitHashFormat(commit?.hash);
  const titleValidation = validateExpectedCommitTitle(
    commit?.title,
    expectedTitle,
    {
      projectName,
      requireExpected: decision === "accept_with_commit",
    },
  );
  const errors = [...hashValidation.errors];
  const warnings = [...titleValidation.warnings];

  if (decision === "accept_with_commit" && !hashValidation.valid) {
    errors.push("Accept with commit requires a valid commit hash.");
  }

  if (decision !== "accept_without_commit" && !commit?.hash?.trim()) {
    errors.push("Missing commit hash is allowed only for accept_without_commit.");
  }

  if (decision === "accept_without_commit" && !commit?.hash?.trim()) {
    if (!commit?.missingHashReason?.trim()) {
      errors.push(
        "Accept without commit requires an explicit missing-hash reason.",
      );
    }
  }

  if (commit?.hash?.trim()) {
    errors.push(...titleValidation.errors);
  }

  return {
    errors: unique(errors),
    expectedTitle,
    hashFormat: hashValidation.hashFormat,
    normalizedHash: hashValidation.normalizedHash ?? null,
    titleStatus: commit?.hash?.trim() ? titleValidation.titleStatus : "unchecked",
    valid: errors.length === 0,
    warnings: unique(warnings),
  };
}

function addDecisionFieldIssues(
  request: CoordinatorFinalizationRequest,
  issues: CoordinatorFinalizationIssue[],
) {
  if (request.decision === "create_follow_up") {
    const dependentIds = request.dependencyGate?.dependentTaskIds ?? [];
    if (dependentIds.length === 0 && !request.operatorNote?.trim()) {
      issues.push(
        issue(
          "follow_up_reference_missing",
          "Create follow-up requires a follow-up/dependency reference or operator note.",
          "error",
        ),
      );
    }
  }

  if (
    (request.decision === "request_changes" ||
      request.decision === "mark_blocked" ||
      request.decision === "mark_failed" ||
      request.decision === "rollback_required" ||
      request.decision === "manual_review_required") &&
    !request.operatorNote?.trim()
  ) {
    issues.push(
      issue(
        "operator_note_missing",
        "This coordinator decision requires an operator note.",
        "error",
      ),
    );
  }
}

function addEvidenceIssues(
  request: CoordinatorFinalizationRequest,
  issues: CoordinatorFinalizationIssue[],
) {
  const isAcceptDecision = ACCEPT_DECISIONS.has(request.decision);
  const validationStatus = request.validationEvidence?.status ?? null;
  const hasValidationOverride = Boolean(
    request.validationEvidence?.explicitOverrideReason?.trim(),
  );

  if (!validationStatus) {
    issues.push(
      issue(
        "validation_evidence_missing",
        "Validation evidence is missing.",
        isAcceptDecision ? "error" : "warning",
      ),
    );
  } else if (validationStatus !== "passed" && !hasValidationOverride) {
    issues.push(
      issue(
        "validation_not_passed",
        "Validation must be passed or have an explicit override reason.",
        isAcceptDecision ? "error" : "warning",
      ),
    );
  }

  const diffRecommendation = request.diffReview?.recommendation ?? null;
  const hasDiffOverride = Boolean(
    request.diffReview?.explicitOverrideReason?.trim(),
  );

  if (!request.diffReview?.taskId && !request.diffReview?.reportId) {
    issues.push(
      issue(
        "diff_review_missing",
        "Diff Review reference is missing.",
        request.decision === "accept_with_commit" ? "error" : "warning",
      ),
    );
    return;
  }

  if (
    request.decision === "accept_with_commit" &&
    diffRecommendation !== "accept_ready" &&
    !hasDiffOverride
  ) {
    issues.push(
      issue(
        "diff_review_not_accept_ready",
        "Accept with commit requires accept-ready Diff Review or an explicit override.",
        "error",
      ),
    );
  }
}

function stateForDecision(
  decision: CoordinatorDecision,
): CoordinatorFinalizationState {
  switch (decision) {
    case "accept_without_commit":
    case "accept_with_commit":
      return "finalized";
    case "request_changes":
      return "changes_requested";
    case "create_follow_up":
      return "follow_up_required";
    case "mark_blocked":
      return "blocked";
    case "mark_failed":
      return "failed";
    case "rollback_required":
      return "rollback_required";
    case "manual_review_required":
      return "manual_review_required";
  }
}

function nextActionForRequest(
  request: CoordinatorFinalizationRequest,
  errors: CoordinatorFinalizationIssue[],
): CoordinatorNextAction {
  if (errors.some((item) => item.code.startsWith("commit_"))) {
    return "resolve_commit";
  }

  if (errors.some((item) => item.code.startsWith("validation_"))) {
    return "run_validation";
  }

  if (errors.some((item) => item.code.startsWith("diff_review_"))) {
    return "create_diff_review";
  }

  switch (request.decision) {
    case "accept_without_commit":
    case "accept_with_commit":
      return "finalize";
    case "request_changes":
      return "request_changes";
    case "create_follow_up":
      return "create_follow_up";
    case "mark_blocked":
      return "record_blocker";
    case "mark_failed":
      return "record_failure";
    case "rollback_required":
      return "record_rollback_required";
    case "manual_review_required":
      return "manual_review";
  }
}

function isGenericCommitTitle(title: string) {
  return GENERIC_COMMIT_TITLES.has(normalizeTitle(title));
}

function hasProjectNamePrefix(title: string, projectName: string | null | undefined) {
  const project = projectName?.trim();
  if (!project) {
    return false;
  }

  const escapedProject = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^(?:\\[${escapedProject}\\]|${escapedProject})\\s*(?::|-|/)\\s+`,
    "i",
  ).test(title.trim());
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function issue(
  code: string,
  message: string,
  severity: CoordinatorDecisionSeverity,
): CoordinatorFinalizationIssue {
  return { code, message, severity };
}

function emptyCommitValidation(
  overrides: Partial<CoordinatorCommitValidationResult> = {},
): CoordinatorCommitValidationResult {
  return {
    errors: overrides.errors ?? [],
    expectedTitle: overrides.expectedTitle,
    hashFormat: overrides.hashFormat ?? "missing",
    normalizedHash: overrides.normalizedHash,
    titleStatus: overrides.titleStatus ?? "unchecked",
    valid: overrides.valid ?? true,
    warnings: overrides.warnings ?? [],
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
