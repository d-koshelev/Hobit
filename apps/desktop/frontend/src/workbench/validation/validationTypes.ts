export type ValidationSeverity = "info" | "warning" | "error";

export type ValidationCapability =
  | "read_files"
  | "run_build"
  | "run_tests"
  | "run_lint"
  | "run_typecheck"
  | "inspect_git"
  | "network"
  | "writes_files"
  | "mutates_git";

export type ValidationSafetyCategory =
  | "read_only"
  | "build_or_test"
  | "writes_workspace"
  | "mutates_git"
  | "destructive"
  | "unknown";

export type ValidationCommandSourceKind = "prompt_pack" | "manual" | "system";

export interface ValidationCommandSource {
  kind: ValidationCommandSourceKind;
  label?: string;
  promptPackId?: string;
  promptPackItemId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ValidationOutputHint {
  stream: "stdout" | "stderr" | "either";
  includes: string;
  severity?: ValidationSeverity;
}

export interface ValidationCommandSpec {
  id: string;
  title: string;
  executable?: string;
  args?: string[];
  shellCommand?: string;
  cwd: string;
  timeoutMs?: number;
  env?: Record<string, string | null>;
  allowedExitCodes?: number[];
  expectedOutputHints?: ValidationOutputHint[];
  safetyCategory: ValidationSafetyCategory;
  source: ValidationCommandSource;
  capabilities?: ValidationCapability[];
  stdoutCapBytes?: number;
  stderrCapBytes?: number;
}

export interface NormalizedValidationCommandSpec extends ValidationCommandSpec {
  args: string[];
  timeoutMs: number;
  env: Record<string, string | null>;
  allowedExitCodes: number[];
  expectedOutputHints: ValidationOutputHint[];
  capabilities: ValidationCapability[];
  stdoutCapBytes: number;
  stderrCapBytes: number;
  validationErrors: string[];
  validationWarnings: string[];
}

export interface ValidationSuiteSpec {
  id: string;
  title: string;
  commands: ValidationCommandSpec[];
  cwd?: string;
  stopOnFirstFailure?: boolean;
  source: ValidationCommandSource;
}

export interface ValidationRunRequest {
  runId: string;
  workspaceId: string;
  queueItemId?: string;
  requestedBySurface: "queue" | "workspace_chat" | "workspace_agent" | "self_test" | "manual";
  suite: ValidationSuiteSpec;
  createdAt: string;
}

export type ValidationRunStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "needs_review"
  | "cancelled";

export interface ValidationRunState {
  runId: string;
  workspaceId: string;
  queueItemId?: string;
  status: ValidationRunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  commandResults: ValidationCommandResult[];
  warnings: string[];
  errors: string[];
}

export interface ValidationOutputPreview {
  text: string;
  truncated: boolean;
  originalBytes: number;
  capBytes: number;
}

export type ValidationCommandStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "failed_to_start"
  | "timed_out"
  | "cancelled"
  | "needs_review";

export interface ValidationCommandResult {
  commandId: string;
  title: string;
  status: ValidationCommandStatus;
  exitCode?: number | null;
  allowedExitCodes: number[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  cwd: string;
  stdout: ValidationOutputPreview;
  stderr: ValidationOutputPreview;
  fullLogRef?: string;
  warnings: string[];
  errors: string[];
}

export interface ValidationSuiteResult {
  runId: string;
  queueItemId?: string;
  suiteId: string;
  status: ValidationRunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  commandResults: ValidationCommandResult[];
  warnings: string[];
  errors: string[];
}

export interface ValidationEvidence {
  evidenceId: string;
  runId: string;
  queueItemId?: string;
  commandId: string;
  status: ValidationCommandStatus;
  exitCode?: number | null;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  cwd: string;
  stdoutPreview: ValidationOutputPreview;
  stderrPreview: ValidationOutputPreview;
  fullLogRef?: string;
  warnings: string[];
  errors: string[];
}

export interface ValidationEvidenceRef {
  evidenceId: string;
  runId: string;
  queueItemId?: string;
  commandId: string;
  status: ValidationCommandStatus;
  fullLogRef?: string;
}

export interface ValidationResultSummary {
  status: ValidationRunStatus;
  severity: ValidationSeverity;
  title: string;
  summary: string;
  commandCount: number;
  passedCount: number;
  failedCount: number;
  needsReviewCount: number;
  warnings: string[];
  errors: string[];
  evidenceRefs: ValidationEvidenceRef[];
}
