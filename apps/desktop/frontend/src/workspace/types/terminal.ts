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
