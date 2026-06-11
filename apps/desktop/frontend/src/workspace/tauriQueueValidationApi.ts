import { invoke } from "@tauri-apps/api/core";

import type {
  QueueValidationCommandEvidence,
  QueueValidationCommandRun,
  QueueValidationSuiteRun,
  RunQueueValidationSuiteRequest,
} from "./types";

type TauriQueueValidationSuiteRun = {
  validation_run_id: string;
  workspace_id: string;
  queue_item_id: string;
  requested_by_surface: string;
  status: string;
  task_validation_status: string;
  command_results: TauriQueueValidationCommandRun[];
  evidence: TauriQueueValidationCommandEvidence[];
  warnings: string[];
  errors: string[];
  duration_ms: number;
  no_git_mutations: boolean;
  no_commit_push: boolean;
};

type TauriQueueValidationCommandRun = {
  command_id: string;
  title: string;
  status: string;
  exit_code: number | null;
  allowed_exit_codes: number[];
  cwd: string;
  stdout_preview: string;
  stderr_preview: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  duration_ms: number;
  error_message: string | null;
  command_summary: string[];
  warnings: string[];
  errors: string[];
};

type TauriQueueValidationCommandEvidence = {
  evidence_id: string;
  validation_run_id: string;
  workspace_id: string;
  queue_item_id: string;
  command_id: string;
  command_label: string;
  program: string;
  args: string[];
  cwd: string;
  status: string;
  exit_code: number | null;
  stdout_preview: string;
  stderr_preview: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  duration_ms: number;
  error_message: string | null;
  command_summary: string[];
  source: string;
  no_git_mutations: boolean;
  no_commit_push: boolean;
  ai_context_status: string;
};

export async function runQueueValidationSuite(
  request: RunQueueValidationSuiteRequest,
): Promise<QueueValidationSuiteRun> {
  const response = await invoke<TauriQueueValidationSuiteRun>(
    "run_queue_validation_suite",
    {
      request: {
        workspace_id: request.workspaceId,
        queue_item_id: request.queueItemId,
        requested_by_surface: request.requestedBySurface,
        cwd: request.cwd,
        stop_on_first_failure: request.stopOnFirstFailure ?? false,
        commands: request.commands.map((command) => ({
          command_id: command.commandId,
          title: command.title,
          program: command.program,
          args: command.args,
          cwd: command.cwd,
          timeout_ms: command.timeoutMs ?? null,
          stdout_cap_bytes: command.stdoutCapBytes ?? null,
          stderr_cap_bytes: command.stderrCapBytes ?? null,
          allowed_exit_codes: command.allowedExitCodes,
          safety_category: command.safetyCategory,
          source: command.source,
        })),
      },
    },
  );

  return normalizeQueueValidationSuiteRun(response);
}

function normalizeQueueValidationSuiteRun(
  response: TauriQueueValidationSuiteRun,
): QueueValidationSuiteRun {
  return {
    validationRunId: response.validation_run_id,
    workspaceId: response.workspace_id,
    queueItemId: response.queue_item_id,
    requestedBySurface: response.requested_by_surface,
    status: response.status,
    taskValidationStatus: normalizeTaskValidationStatus(
      response.task_validation_status,
    ),
    commandResults: response.command_results.map(normalizeCommandRun),
    evidence: response.evidence.map(normalizeCommandEvidence),
    warnings: response.warnings,
    errors: response.errors,
    durationMs: response.duration_ms,
    noGitMutations: response.no_git_mutations,
    noCommitPush: response.no_commit_push,
  };
}

function normalizeCommandRun(
  command: TauriQueueValidationCommandRun,
): QueueValidationCommandRun {
  return {
    commandId: command.command_id,
    title: command.title,
    status: command.status,
    exitCode: command.exit_code,
    allowedExitCodes: command.allowed_exit_codes,
    cwd: command.cwd,
    stdoutPreview: command.stdout_preview,
    stderrPreview: command.stderr_preview,
    stdoutTruncated: command.stdout_truncated,
    stderrTruncated: command.stderr_truncated,
    durationMs: command.duration_ms,
    errorMessage: command.error_message,
    commandSummary: command.command_summary,
    warnings: command.warnings,
    errors: command.errors,
  };
}

function normalizeCommandEvidence(
  evidence: TauriQueueValidationCommandEvidence,
): QueueValidationCommandEvidence {
  return {
    evidenceId: evidence.evidence_id,
    validationRunId: evidence.validation_run_id,
    workspaceId: evidence.workspace_id,
    queueItemId: evidence.queue_item_id,
    commandId: evidence.command_id,
    commandLabel: evidence.command_label,
    program: evidence.program,
    args: evidence.args,
    cwd: evidence.cwd,
    status: evidence.status,
    exitCode: evidence.exit_code,
    stdoutPreview: evidence.stdout_preview,
    stderrPreview: evidence.stderr_preview,
    stdoutTruncated: evidence.stdout_truncated,
    stderrTruncated: evidence.stderr_truncated,
    durationMs: evidence.duration_ms,
    errorMessage: evidence.error_message,
    commandSummary: evidence.command_summary,
    source: evidence.source,
    noGitMutations: evidence.no_git_mutations,
    noCommitPush: evidence.no_commit_push,
    aiContextStatus: evidence.ai_context_status,
  };
}

function normalizeTaskValidationStatus(
  status: string,
): QueueValidationSuiteRun["taskValidationStatus"] {
  if (
    status === "not_started" ||
    status === "validating" ||
    status === "passed" ||
    status === "failed" ||
    status === "needs_review"
  ) {
    return status;
  }

  return "needs_review";
}
