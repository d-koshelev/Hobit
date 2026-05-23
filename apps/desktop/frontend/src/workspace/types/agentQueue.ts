import type { RunCodexDirectWorkRequest } from "./agentExecutor";

export type CreateAgentQueueItemFromProposalRequest = {
  workspaceId: string;
  workbenchId: string;
  sourceRunId: string;
  sourceResultId: string;
};

export type GetAgentQueueSnapshotRequest = {
  workspaceId: string;
  workbenchId: string;
};

export type AgentQueueTaskStatus =
  | "draft"
  | "queued"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "review_needed";

export type AgentQueueTaskExecutionPolicy =
  | "manual"
  | "auto"
  | "after_previous_success";

export type CreateAgentQueueTaskRequest = {
  workspaceId: string;
  title: string;
  description: string;
  prompt: string;
  status: AgentQueueTaskStatus;
  priority: number;
  executionPolicy?: AgentQueueTaskExecutionPolicy;
};

export type ListAgentQueueTasksRequest = { workspaceId: string };

export type GetAgentQueueTaskRequest = {
  workspaceId: string;
  queueItemId: string;
};

export type DeleteAgentQueueTaskRequest = GetAgentQueueTaskRequest;

export type UpdateAgentQueueTaskRequest = {
  workspaceId: string;
  queueItemId: string;
  title: string;
  description: string;
  prompt: string;
  status: AgentQueueTaskStatus;
  priority: number;
  executionPolicy?: AgentQueueTaskExecutionPolicy;
};

export type AssignAgentQueueTaskToExecutorRequest = GetAgentQueueTaskRequest & {
  executorWidgetInstanceId: string;
};

export type ClearAgentQueueTaskAssignmentRequest = GetAgentQueueTaskRequest;

export type StartAssignedAgentQueueTaskRequest = Omit<
  RunCodexDirectWorkRequest,
  "workbenchId" | "widgetInstanceId" | "operatorPrompt"
> & {
  queueItemId: string;
};

export type StartAssignedAgentQueueTaskResponse = {
  workspaceId: string;
  queueItemId: string;
  workbenchId: string;
  executorWidgetInstanceId: string;
  runId: string;
  status: string;
};

export type AgentQueueTaskRunSource =
  | "manual"
  | "autorun"
  | "sequential_runner"
  | "unknown";

export type AgentQueueTaskRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "review_needed"
  | "unknown";

export type AgentQueueTaskRunReviewStatus = "review_needed" | "unknown";

export type GetAgentQueueTaskLatestRunLinkRequest = GetAgentQueueTaskRequest;

export type ListAgentQueueTaskRunLinksRequest = GetAgentQueueTaskRequest;

export type AgentQueueTaskRunLinkSummary = {
  linkId: string;
  workspaceId: string;
  queueTaskId: string;
  executorWidgetId: string;
  directWorkRunId: string;
  source: AgentQueueTaskRunSource;
  status: AgentQueueTaskRunStatus;
  startedAt: string;
  completedAt: string | null;
  validationStatus: string | null;
  reviewStatus: AgentQueueTaskRunReviewStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type StartAgentQueueRunnerPolicyRequest = {
  stopOnFailure?: boolean;
  stopOnReviewNeeded?: boolean;
  stopOnCancel?: boolean;
};

export type StartAgentQueueRunnerSessionRequest = {
  workspaceId: string;
  executorWidgetInstanceId: string;
  codexExecutable: string;
  repoRoot: string;
  sandbox: RunCodexDirectWorkRequest["sandbox"];
  approvalPolicy: RunCodexDirectWorkRequest["approvalPolicy"];
  timeoutMs?: number;
  stdoutCapBytes?: number;
  stderrCapBytes?: number;
  policy?: StartAgentQueueRunnerPolicyRequest;
};

export type AgentQueueRunnerPolicy = {
  requireOperatorStart: boolean;
  oneTaskAtATime: boolean;
  stopOnFailure: boolean;
  stopOnReviewNeeded: boolean;
  stopOnCancel: boolean;
  allowHiddenExecution: boolean;
  durableResume: boolean;
};

export type AgentQueueRunnerSnapshot = {
  sessionId: string | null;
  status: string;
  isActive: boolean;
  isSessionOnly: boolean;
  policy: AgentQueueRunnerPolicy;
  activeQueueItemId: string | null;
  waitingRunId: string | null;
  finalRunStatus: string | null;
  lastReconciledAt: string | null;
  stopReason: string | null;
};

export type AgentQueueSnapshot = {
  workspaceId: string;
  workbenchId: string;
  items: AgentQueueItem[];
};

export type AgentQueueItem = {
  id: string;
  workspaceId: string;
  workbenchId: string;
  sourceRunId: string;
  sourceResultId: string;
  sourceWidgetInstanceId: string;
  sourceWidgetTitle: string;
  title: string;
  status: string;
  decisionStatus: string;
  promptSummary: string;
  proposalSummary: string;
  approvedContextSummary: string;
  proposedPlan: string[];
  proposedActions: AgentQueueProposalAction[];
  proposalOnlyMock: boolean;
  noLlmCalled: boolean;
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  createdAt: string;
  updatedAt: string;
  payloadJson: string;
};

export type AgentQueueProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

export type AgentQueueTask = {
  queueItemId: string;
  workspaceId: string;
  title: string;
  description: string;
  prompt: string;
  status: AgentQueueTaskStatus;
  priority: number;
  executionPolicy?: AgentQueueTaskExecutionPolicy;
  assignedExecutorWidgetId: string | null;
  createdAt: string;
  updatedAt: string;
};
