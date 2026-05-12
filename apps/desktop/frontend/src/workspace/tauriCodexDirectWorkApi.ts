import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  StartCodexDirectWorkStreamRequest,
  StartCodexDirectWorkStreamResponse,
} from "./types";
import { unknownErrorToOptionalMessage } from "./errorDetails";

const DIRECT_WORK_STREAM_EVENT_NAME = "direct-work://event";

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

type TauriStartCodexDirectWorkStreamResponse = {
  run_id: string;
  status: string;
};

type TauriDirectWorkStreamEvent = {
  workspace_id: string;
  workbench_id: string;
  widget_instance_id: string;
  run_id: string;
  event_kind: DirectWorkStreamEvent["eventKind"];
  line: string | null;
  text: string | null;
  parsed_codex_event_type: string | null;
  status: string | null;
  elapsed_ms: number;
  is_final: boolean;
};

export async function runCodexDirectWork(
  request: RunCodexDirectWorkRequest,
): Promise<RunCodexDirectWorkResponse | null> {
  const response = await invokeDirectWork<TauriRunCodexDirectWorkResponse | null>(
    "run_codex_direct_work",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        codex_executable: request.codexExecutable,
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

export async function startCodexDirectWorkStream(
  request: StartCodexDirectWorkStreamRequest,
): Promise<StartCodexDirectWorkStreamResponse | null> {
  const response =
    await invokeDirectWork<TauriStartCodexDirectWorkStreamResponse | null>(
      "start_codex_direct_work_stream",
      {
        request: {
          workspace_id: request.workspaceId,
          workbench_id: request.workbenchId,
          widget_instance_id: request.widgetInstanceId,
          codex_executable: request.codexExecutable,
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

  return response
    ? {
        runId: response.run_id,
        status: response.status,
      }
    : null;
}

export function listenToDirectWorkStreamEvents(
  onEvent: (event: DirectWorkStreamEvent) => void,
): Promise<() => void> {
  return listen<TauriDirectWorkStreamEvent>(
    DIRECT_WORK_STREAM_EVENT_NAME,
    (event) => {
      onEvent(normalizeDirectWorkStreamEvent(event.payload));
    },
  ).catch((error) => {
    throw directWorkApiError(
      "Direct Work stream subscription failed",
      error,
    );
  });
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

function normalizeDirectWorkStreamEvent(
  event: TauriDirectWorkStreamEvent,
): DirectWorkStreamEvent {
  return {
    workspaceId: event.workspace_id,
    workbenchId: event.workbench_id,
    widgetInstanceId: event.widget_instance_id,
    runId: event.run_id,
    eventKind: event.event_kind,
    line: event.line,
    text: event.text,
    parsedCodexEventType: event.parsed_codex_event_type,
    status: event.status,
    elapsedMs: event.elapsed_ms,
    isFinal: event.is_final,
  };
}

async function invokeDirectWork<T>(
  command: string,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw directWorkApiError(`Tauri command ${command} failed`, error);
  }
}

function directWorkApiError(context: string, error: unknown): Error {
  const message = unknownErrorToOptionalMessage(error);
  return new Error(message ? `${context}: ${message}` : context);
}
