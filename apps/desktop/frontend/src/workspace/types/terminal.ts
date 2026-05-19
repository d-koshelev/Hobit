export type RunTerminalCommandRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  program: string;
  args: string[];
  workingDirectory: string;
  timeoutMs?: number | null;
  stdoutCapBytes?: number | null;
  stderrCapBytes?: number | null;
};

export type RunTerminalCommandResponse = {
  runId: string;
  status: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
  errorMessage: string | null;
};

export type CreateTerminalPtySessionRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  shell: string;
  shellArgs: string[];
  workingDirectory: string;
  cols?: number | null;
  rows?: number | null;
  outputBufferCapBytes?: number | null;
};

export type TerminalPtySessionActionRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  sessionId: string;
};

export type WriteTerminalPtySessionRequest = TerminalPtySessionActionRequest & {
  data: string;
};

export type ResizeTerminalPtySessionRequest =
  TerminalPtySessionActionRequest & {
    cols: number;
    rows: number;
  };

export type ListTerminalPtySessionsRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId?: string | null;
};

export type TerminalPtySession = {
  sessionId: string;
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  shell: string;
  shellArgs: string[];
  workingDirectory: string;
  cols: number;
  rows: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  output: TerminalPtyOutput;
};

export type TerminalPtyOutput = {
  chunks: TerminalPtyOutputChunk[];
  totalBufferedBytes: number;
  droppedBytes: number;
  capBytes: number;
};

export type TerminalPtyOutputChunk = {
  sequence: number;
  streamKind: string;
  text: string;
  byteLen: number;
};
