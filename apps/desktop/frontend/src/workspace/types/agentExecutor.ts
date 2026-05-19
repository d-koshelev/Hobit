import type { WidgetLogEntry } from "./core";

export type DirectWorkSandbox = "read_only" | "workspace_write";

export type DirectWorkApprovalPolicy = "never" | "on_request" | "untrusted";

export type RunCodexDirectWorkRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  codexExecutable: string;
  repoRoot: string;
  operatorPrompt: string;
  sandbox: DirectWorkSandbox;
  approvalPolicy: DirectWorkApprovalPolicy;
  timeoutMs?: number | null;
  stdoutCapBytes?: number | null;
  stderrCapBytes?: number | null;
};

export type DirectWorkValidationProfile = "fast" | "changed" | "full";

export type RunDirectWorkValidationRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repoRoot: string;
  validationProfile: DirectWorkValidationProfile;
  timeoutMs?: number | null;
  stdoutCapBytes?: number | null;
  stderrCapBytes?: number | null;
};

export type CancelCodexDirectWorkRunRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  runId: string;
};

export type ForceKillCodexDirectWorkRunRequest =
  CancelCodexDirectWorkRunRequest;

export type ListAgentExecutorRunsRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  limit?: number | null;
};

export type GetAgentExecutorRunDetailRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  runId: string;
};

export type GetAgentExecutorDiffSummaryRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repoRoot: string;
  maxFiles?: number | null;
  maxPatchBytesPerFile?: number | null;
  includePatchPreview?: boolean | null;
};

export type AgentExecutorRunHistory = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  runs: AgentExecutorRunSummary[];
};

export type AgentExecutorRunSummary = {
  runId: string;
  status: string;
  commandKind: string | null;
  resultType: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  title: string;
  repoRoot: string | null;
  mode: string | null;
  validationProfile: string | null;
  validationStatus: string | null;
  hasResult: boolean;
  logCount: number | null;
};

export type AgentExecutorRunDetail = {
  summary: AgentExecutorRunSummary;
  resultId: string | null;
  resultStatus: string | null;
  resultSummary: string | null;
  resultContent: string | null;
  resultPayload: string | null;
  finalMessage: string | null;
  stdoutPreview: string | null;
  stderrPreview: string | null;
  errorMessage: string | null;
  validationProfile: string | null;
  validationStatus: string | null;
  changedFilesSummary: string | null;
  logs: WidgetLogEntry[];
};

export type AgentExecutorDiffSummary = {
  repoRoot: string;
  status: string;
  files: AgentExecutorDiffFileSummary[];
  summary: AgentExecutorDiffTotals;
  errorMessage: string | null;
  commandSummary: GitDiffCommandSummary[];
};

export type AgentExecutorDiffFileSummary = {
  path: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  conflicted: boolean;
  additions: number | null;
  deletions: number | null;
  patchPreview: string | null;
  patchTruncated: boolean;
};

export type AgentExecutorDiffTotals = {
  totalFiles: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  totalAdditions: number | null;
  totalDeletions: number | null;
};

export type GitDiffCommandSummary = {
  program: string;
  args: string[];
};

export type CancelCodexDirectWorkRunResponse = {
  runId: string;
  status: string;
  message: string;
  cancellationRequested: boolean;
};

export type ForceKillCodexDirectWorkRunResponse = {
  runId: string;
  status: string;
  message: string;
  forceKillRequested: boolean;
};

export type StartCodexDirectWorkStreamRequest = RunCodexDirectWorkRequest;

export type DirectWorkStreamEventKind =
  | "started"
  | "stdout_line"
  | "stderr_line"
  | "codex_json_event"
  | "final_message"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type DirectWorkStreamEvent = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  runId: string;
  eventKind: DirectWorkStreamEventKind;
  line: string | null;
  text: string | null;
  parsedCodexEventType: string | null;
  status: string | null;
  elapsedMs: number;
  isFinal: boolean;
  errorMessage: string | null;
  stderrPreview: string | null;
  exitCode: number | null;
  finalStatus: string | null;
  failedStage: string | null;
};

export type StartCodexDirectWorkStreamResponse = {
  runId: string;
  status: string;
};

export type RunCodexDirectWorkResponse = {
  runId: string;
  resultId: string;
  resultType: string;
  executorKind: string;
  mode: string;
  repoRoot: string;
  sandbox: DirectWorkSandbox;
  approvalPolicy: DirectWorkApprovalPolicy;
  commandSummary: string[];
  status: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  finalMessage: string | null;
  durationMs: number;
  errorMessage: string | null;
  noAutoCommit: boolean;
  noAutoPush: boolean;
  gitMutationsPerformedByHobit: boolean;
};

export type RunDirectWorkValidationResponse = {
  runId: string;
  resultId: string;
  resultType: string;
  profile: DirectWorkValidationProfile;
  status: string;
  runStatus: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
  errorMessage: string | null;
  commandSummary: string[];
  repoRoot: string;
  noGitMutations: boolean;
  noCommitPush: boolean;
  gitMutationsPerformedByHobit: boolean;
};
