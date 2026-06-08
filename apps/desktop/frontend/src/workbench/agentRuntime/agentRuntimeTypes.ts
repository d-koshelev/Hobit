export type AgentProviderId = string;

export type AgentRunMode = "direct" | "queue" | "review";

export type AgentRunLifecycle =
  | "draft"
  | "queued"
  | "starting"
  | "running"
  | "awaiting-review"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

export type AgentToolPolicy = {
  allowedTools: readonly string[];
  mode: "none" | "proposal-only" | "provider-tools";
  requiresOperatorApproval: boolean;
};

export type AgentSandboxPolicy = {
  filesystem: "none" | "visible-context-only" | "approved-workspace";
  network: "none" | "provider-runtime-only" | "unrestricted";
  requiresExplicitWorkspace: boolean;
};

export type AgentApprovalPolicy = {
  applyChanges: "never" | "after-review" | "operator-approved";
  createQueueTasks: "never" | "after-review" | "operator-approved";
  executeTools: "never" | "operator-approved";
};

export type AgentProviderCapabilities = {
  approvalPolicy: AgentApprovalPolicy;
  defaultMode: AgentRunMode;
  displayName: string;
  maxPromptChars: number | null;
  providerId: AgentProviderId;
  sandboxPolicy: AgentSandboxPolicy;
  supportedModes: readonly AgentRunMode[];
  supportsCancellation: boolean;
  supportsFileChangeSummary: boolean;
  supportsStreaming: boolean;
  supportsTokenUsage: boolean;
  toolPolicy: AgentToolPolicy;
};

export type AgentContextRef = {
  id: string;
  kind:
    | "visible-chat"
    | "selected-text"
    | "approved-file"
    | "queue-task"
    | "run-metadata"
    | "knowledge"
    | "manual";
  label: string;
  scope: "current-session" | "workspace-local";
  sourceWidgetInstanceId?: string;
};

export type AgentContextSnapshot = {
  contextRefs: readonly AgentContextRef[];
  createdAtMs: number;
  id: string;
  summary: string;
  tokenEstimate: number | null;
  visibleTextPreview?: string;
};

export type AgentRunRequest = {
  contextSnapshot?: AgentContextSnapshot;
  createdAtMs: number;
  id: string;
  metadata?: AgentRunMetadata;
  mode: AgentRunMode;
  prompt: string;
  providerId: AgentProviderId;
  sandboxPolicy: AgentSandboxPolicy;
  toolPolicy: AgentToolPolicy;
  workspaceId: string;
};

export type AgentRunEvent = {
  id: string;
  kind: AgentRunEventKind;
  lifecycle: AgentRunLifecycle;
  message?: string;
  runId: string;
  sequence: number;
  timestampMs: number;
  title: string;
};

export type AgentRunEventKind =
  | "context_materialized"
  | "provider_started"
  | "tool_call"
  | "file_change_detected"
  | "response_received"
  | "validation_suggested"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AgentFileChangeSummary = {
  addedLines?: number;
  deletedLines?: number;
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "unchanged";
};

export type AgentValidationSuggestion = {
  command?: string;
  id: string;
  label: string;
  reason: string;
  status: "suggested" | "running" | "passed" | "failed" | "skipped";
};

export type AgentRunMetadata = {
  completedAtMs?: number;
  contextSnapshotId?: string;
  durationMs?: number | null;
  lifecycle: AgentRunLifecycle;
  mode: AgentRunMode;
  providerId: AgentProviderId;
  queueTaskId?: string;
  runId: string;
  startedAtMs?: number;
  tokenUsage?: AgentTokenUsage | null;
  workspaceId: string;
};

export type AgentRunResult = {
  assistantText?: string;
  errorMessage?: string;
  fileChanges: readonly AgentFileChangeSummary[];
  lifecycle: Extract<
    AgentRunLifecycle,
    "awaiting-review" | "completed" | "failed" | "cancelled" | "blocked"
  >;
  metadata: AgentRunMetadata;
  runId: string;
  validationSuggestions: readonly AgentValidationSuggestion[];
  warnings?: readonly string[];
};
