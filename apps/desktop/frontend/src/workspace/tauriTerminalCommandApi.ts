import { invoke } from "@tauri-apps/api/core";
import type {
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
} from "./types";

type TauriRunTerminalCommandResponse = {
  run_id: string;
  status: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  duration_ms: number;
  error_message: string | null;
};

export async function runTerminalCommand(
  request: RunTerminalCommandRequest,
): Promise<RunTerminalCommandResponse | null> {
  const response = await invoke<TauriRunTerminalCommandResponse | null>(
    "run_terminal_command",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        program: request.program,
        args: request.args,
        working_directory: request.workingDirectory,
        timeout_ms: request.timeoutMs ?? null,
        stdout_cap_bytes: request.stdoutCapBytes ?? null,
        stderr_cap_bytes: request.stderrCapBytes ?? null,
      },
    },
  );

  return response ? normalizeRunTerminalCommandResponse(response) : null;
}

function normalizeRunTerminalCommandResponse(
  response: TauriRunTerminalCommandResponse,
): RunTerminalCommandResponse {
  return {
    runId: response.run_id,
    status: response.status,
    exitCode: response.exit_code,
    stdout: response.stdout,
    stderr: response.stderr,
    stdoutTruncated: response.stdout_truncated,
    stderrTruncated: response.stderr_truncated,
    durationMs: response.duration_ms,
    errorMessage: response.error_message,
  };
}
