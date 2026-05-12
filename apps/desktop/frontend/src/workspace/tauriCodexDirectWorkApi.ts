import { invoke } from "@tauri-apps/api/core";
import type {
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
} from "./types";

type TauriRunCodexDirectWorkResponse = {
  run_id: string;
  result_id: string;
  result_type: string;
  executor_kind: string;
  mode: string;
  repo_root: string;
  sandbox: "read_only" | "workspace_write";
  approval_policy: "never" | "on_request" | "untrusted";
  command_summary: string[];
  status: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  final_message: string | null;
  duration_ms: number;
  error_message: string | null;
  no_auto_commit: boolean;
  no_auto_push: boolean;
  git_mutations_performed_by_hobit: boolean;
};

export async function runCodexDirectWork(
  request: RunCodexDirectWorkRequest,
): Promise<RunCodexDirectWorkResponse | null> {
  const response = await invoke<TauriRunCodexDirectWorkResponse | null>(
    "run_codex_direct_work",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        repo_root: request.repoRoot,
        operator_prompt: request.operatorPrompt,
        sandbox: request.sandbox,
        approval_policy: request.approvalPolicy,
        timeout_ms: request.timeoutMs ?? null,
        stdout_cap_bytes: request.stdoutCapBytes ?? null,
        stderr_cap_bytes: request.stderrCapBytes ?? null,
      },
    },
  );

  return response ? normalizeRunCodexDirectWorkResponse(response) : null;
}

function normalizeRunCodexDirectWorkResponse(
  response: TauriRunCodexDirectWorkResponse,
): RunCodexDirectWorkResponse {
  return {
    runId: response.run_id,
    resultId: response.result_id,
    resultType: response.result_type,
    executorKind: response.executor_kind,
    mode: response.mode,
    repoRoot: response.repo_root,
    sandbox: response.sandbox,
    approvalPolicy: response.approval_policy,
    commandSummary: response.command_summary,
    status: response.status,
    exitCode: response.exit_code,
    stdout: response.stdout,
    stderr: response.stderr,
    stdoutTruncated: response.stdout_truncated,
    stderrTruncated: response.stderr_truncated,
    finalMessage: response.final_message,
    durationMs: response.duration_ms,
    errorMessage: response.error_message,
    noAutoCommit: response.no_auto_commit,
    noAutoPush: response.no_auto_push,
    gitMutationsPerformedByHobit: response.git_mutations_performed_by_hobit,
  };
}
