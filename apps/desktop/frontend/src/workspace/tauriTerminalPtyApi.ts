import { invoke } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";
import {
  isHomeRelativeTerminalWorkingDirectory,
  resolveTerminalWorkingDirectoryWithHome,
} from "./types";
import type {
  CreateTerminalPtySessionRequest,
  ListTerminalPtySessionsRequest,
  ResizeTerminalPtySessionRequest,
  TerminalPtyOutput,
  TerminalPtyOutputChunk,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  WriteTerminalPtySessionRequest,
} from "./types";

type TauriTerminalPtySession = {
  session_id: string;
  workspace_id: string;
  workbench_id: string;
  widget_instance_id: string;
  shell: string;
  shell_args: string[];
  working_directory: string;
  cols: number;
  rows: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  exit_code: number | null;
  error_message: string | null;
  output: TauriTerminalPtyOutput;
};

type TauriTerminalPtyOutput = {
  chunks: TauriTerminalPtyOutputChunk[];
  total_buffered_bytes: number;
  dropped_bytes: number;
  cap_bytes: number;
};

type TauriTerminalPtyOutputChunk = {
  sequence: number;
  stream_kind: string;
  text: string;
  byte_len: number;
};

export async function createTerminalPtySession(
  request: CreateTerminalPtySessionRequest,
): Promise<TerminalPtySession | null> {
  const workingDirectory = await resolveTerminalPtyWorkingDirectoryForRequest(
    request.workingDirectory,
  );
  const response = await invoke<TauriTerminalPtySession | null>(
    "create_terminal_pty_session",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        shell: request.shell,
        shell_args: request.shellArgs,
        working_directory: workingDirectory,
        cols: request.cols ?? null,
        rows: request.rows ?? null,
        output_buffer_cap_bytes: request.outputBufferCapBytes ?? null,
      },
    },
  );

  return response ? normalizeTerminalPtySession(response) : null;
}

export async function writeTerminalPtySession(
  request: WriteTerminalPtySessionRequest,
): Promise<TerminalPtySession | null> {
  return invokeTerminalPtyAction("write_terminal_pty_session", {
    ...scopedRequest(request),
    data: request.data,
  });
}

export async function resizeTerminalPtySession(
  request: ResizeTerminalPtySessionRequest,
): Promise<TerminalPtySession | null> {
  return invokeTerminalPtyAction("resize_terminal_pty_session", {
    ...scopedRequest(request),
    cols: request.cols,
    rows: request.rows,
  });
}

export async function stopTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return invokeTerminalPtyAction(
    "stop_terminal_pty_session",
    scopedRequest(request),
  );
}

export async function killTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return invokeTerminalPtyAction(
    "kill_terminal_pty_session",
    scopedRequest(request),
  );
}

export async function closeTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return invokeTerminalPtyAction(
    "close_terminal_pty_session",
    scopedRequest(request),
  );
}

export async function getTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return invokeTerminalPtyAction(
    "get_terminal_pty_session",
    scopedRequest(request),
  );
}

export async function listTerminalPtySessions(
  request: ListTerminalPtySessionsRequest,
): Promise<TerminalPtySession[]> {
  const response = await invoke<TauriTerminalPtySession[]>(
    "list_terminal_pty_sessions",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId ?? null,
      },
    },
  );

  return response.map(normalizeTerminalPtySession);
}

async function invokeTerminalPtyAction(
  command: string,
  request: Record<string, unknown>,
): Promise<TerminalPtySession | null> {
  const response = await invoke<TauriTerminalPtySession | null>(command, {
    request,
  });

  return response ? normalizeTerminalPtySession(response) : null;
}

function scopedRequest(request: TerminalPtySessionActionRequest) {
  return {
    workspace_id: request.workspaceId,
    workbench_id: request.workbenchId,
    widget_instance_id: request.widgetInstanceId,
    session_id: request.sessionId,
  };
}

function normalizeTerminalPtySession(
  response: TauriTerminalPtySession,
): TerminalPtySession {
  return {
    sessionId: response.session_id,
    workspaceId: response.workspace_id,
    workbenchId: response.workbench_id,
    widgetInstanceId: response.widget_instance_id,
    shell: response.shell,
    shellArgs: response.shell_args,
    workingDirectory: response.working_directory,
    cols: response.cols,
    rows: response.rows,
    status: response.status,
    startedAt: response.started_at,
    endedAt: response.ended_at,
    exitCode: response.exit_code,
    errorMessage: response.error_message,
    output: normalizeTerminalPtyOutput(response.output),
  };
}

function normalizeTerminalPtyOutput(
  response: TauriTerminalPtyOutput,
): TerminalPtyOutput {
  return {
    chunks: response.chunks.map(normalizeTerminalPtyOutputChunk),
    totalBufferedBytes: response.total_buffered_bytes,
    droppedBytes: response.dropped_bytes,
    capBytes: response.cap_bytes,
  };
}

function normalizeTerminalPtyOutputChunk(
  response: TauriTerminalPtyOutputChunk,
): TerminalPtyOutputChunk {
  return {
    sequence: response.sequence,
    streamKind: response.stream_kind,
    text: response.text,
    byteLen: response.byte_len,
  };
}

async function resolveTerminalPtyWorkingDirectoryForRequest(
  workingDirectory: string,
) {
  if (!isHomeRelativeTerminalWorkingDirectory(workingDirectory)) {
    return workingDirectory;
  }

  try {
    return resolveTerminalWorkingDirectoryWithHome(
      workingDirectory,
      await homeDir(),
    );
  } catch (error) {
    throw new Error(
      `Could not resolve Terminal working directory \`~\`: ${errorToMessage(error)}`,
    );
  }
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "home directory is unavailable.";
}
