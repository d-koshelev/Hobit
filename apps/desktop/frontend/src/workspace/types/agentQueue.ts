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

export type AgentQueueGlobalExecutionState =
  | "started"
  | "stopped"
  | "stop_kill_requested";

export type AgentQueueTaskValidationStatus =
  | "not_started"
  | "validating"
  | "passed"
  | "failed"
  | "needs_review";

export type AgentQueueTaskItemType =
  | "implementation"
  | "diff_review"
  | "follow_up"
  | "validation";

export type AgentQueueDiffReviewMode =
  | "diff_vs_report"
  | "contract_scope"
  | "general_review";

export type AgentQueueDiffReviewMetadata = {
  sourceCommitHash?: string;
  sourceItemId: string;
  sourceReportId?: string;
  reviewMode: AgentQueueDiffReviewMode;
  reviewTargetSummary: string;
};

export type AgentQueueExecutionPlanPreviewSource =
  | "heuristic"
  | "worker_estimate"
  | "manual";

export type AgentQueueExecutionPlanPreviewStatus =
  | "not_planned"
  | "planned"
  | "needs_split"
  | "stale";

export type AgentQueueExecutionPlanPreviewLevel = "low" | "medium" | "high";

export type AgentQueueExecutionPlanPreview = {
  planId: string;
  itemId: string;
  workerId: string;
  generatedAt: string;
  source: AgentQueueExecutionPlanPreviewSource;
  status: AgentQueueExecutionPlanPreviewStatus;
  estimatedTokenMin: number;
  estimatedTokenMax: number;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  complexity: AgentQueueExecutionPlanPreviewLevel;
  risk: AgentQueueExecutionPlanPreviewLevel;
  steps: string[];
  likelyFilesOrAreas: string[];
  expectedValidationCommands: string[];
  splitRecommendation?: string;
  notes?: string;
};

export type AgentQueueWorkerExecutionReportStatus =
  | "reported"
  | "completed"
  | "failed"
  | "interrupted"
  | "needs_follow_up";

export type AgentQueueWorkerExecutionReportValidationResult =
  | "not_run"
  | "passed"
  | "failed"
  | "partial";

export type AgentQueueWorkerExecutionReport = {
  reportId: string;
  itemId: string;
  workerId: string;
  createdAt: string;
  reportStatus: AgentQueueWorkerExecutionReportStatus;
  summary: string;
  changedFiles: string[];
  commandsRun: string[];
  validationCommandsSuggested: string[];
  validationCommandsRun?: string[];
  validationResult?: AgentQueueWorkerExecutionReportValidationResult;
  commitHash?: string;
  finalGitStatus?: string;
  warnings: string[];
  errors: string[];
  followUpRecommendation?: string;
  rollbackRecommendation?: string;
  rawReportPreview?: string;
};

export type AgentQueueReportKind =
  | "worker_execution"
  | "diff_review"
  | "validation";

export type AgentQueueReportActionType =
  | "open_source_item"
  | "open_linked_diff_review"
  | "mark_ready_for_finalization"
  | "mark_needs_changes"
  | "create_follow_up"
  | "create_diff_review"
  | "mark_rollback_required"
  | "pause_dependent_items"
  | "pause_queue_tag";

export type AgentQueueReportAction = {
  actionId: string;
  type: AgentQueueReportActionType;
  label: string;
  description: string;
  enabled: boolean;
};

export type AgentQueueReportActionCard = {
  cardId: string;
  sourceItemId: string;
  sourceReportId: string;
  sourceItemTitle: string;
  sourceItemDescription?: string;
  sourceItemPrompt?: string;
  sourceItemPriority: number;
  sourceItemStatus: AgentQueueTaskStatus;
  sourceItemType: AgentQueueTaskItemType;
  sourceQueueTag: string;
  sourceQueueTagId?: string;
  sourceValidationStatus?: AgentQueueTaskValidationStatus;
  reportKind: AgentQueueReportKind;
  reportSummary: string;
  reportStatus: string;
  createdAt: string;
  recommendedActions: AgentQueueReportAction[];
  changedFiles: string[];
  warnings: string[];
  errors: string[];
  commitHash?: string;
  followUpRecommendation?: string;
  rollbackRecommendation?: string;
  linkedDiffReviewItemId?: string;
  linkedDiffReviewStatus?: AgentQueueTaskStatus;
  linkedFollowUpItemIds?: string[];
  dependentItemIds?: string[];
};

export type AgentQueueTagPauseReason = "manual" | "edit_review";

export type AgentQueueTagSummary = {
  queueTagId: string;
  queueTagName: string;
  status: "running" | "paused";
  pauseReason: AgentQueueTagPauseReason | null;
  needsCoordinatorReview: boolean;
  itemCount: number;
  runningCount: number;
  validationSummary: Record<AgentQueueTaskValidationStatus, number>;
};

export type AgentQueueWorkerScopeKind = "all" | "queue_tag";

export type AgentQueueWorkerConfig = {
  workerId: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  scopeKind: AgentQueueWorkerScopeKind;
  queueTagId: string | null;
  queueTagName: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentQueueWorkerRequest = {
  workspaceId: string;
  workerId?: string;
  name: string;
  enabled: boolean;
  scopeKind: AgentQueueWorkerScopeKind;
  queueTagId?: string | null;
  queueTagName?: string | null;
  displayOrder: number;
};

export type UpdateAgentQueueWorkerRequest = CreateAgentQueueWorkerRequest & {
  workerId: string;
};

export type DeleteAgentQueueWorkerRequest = {
  workspaceId: string;
  workerId: string;
};

export type ListAgentQueueWorkersRequest = { workspaceId: string };

export type CreateAgentQueueTaskRequest = {
  workspaceId: string;
  title: string;
  description: string;
  prompt: string;
  status: AgentQueueTaskStatus;
  priority: number;
  dependsOn?: string[];
  executionPolicy?: AgentQueueTaskExecutionPolicy;
  itemType?: AgentQueueTaskItemType;
  queueTagId?: string;
  queueTagName?: string;
  validationStatus?: AgentQueueTaskValidationStatus;
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
  dependsOn?: string[];
  executionPolicy?: AgentQueueTaskExecutionPolicy;
  itemType?: AgentQueueTaskItemType;
  queueTagId?: string;
  queueTagName?: string;
  validationStatus?: AgentQueueTaskValidationStatus;
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
  orderIndex?: number;
  dependsOn?: string[];
  diffReview?: AgentQueueDiffReviewMetadata | null;
  executionPolicy?: AgentQueueTaskExecutionPolicy;
  itemType?: AgentQueueTaskItemType;
  queueTagId?: string;
  queueTagName?: string;
  validationStatus?: AgentQueueTaskValidationStatus;
  assignedWorkerId?: string | null;
  executionPlanPreview?: AgentQueueExecutionPlanPreview | null;
  workerExecutionReports?: AgentQueueWorkerExecutionReport[];
  workspaceChatReportCardId?: string;
  workspaceChatReportCardStatus?: "not_shown" | "shown";
  coordinatorStatus?:
    | "not_reported"
    | "worker_reported"
    | "awaiting_validation"
    | "awaiting_coordinator_review"
    | "finalized";
  assignedExecutorWidgetId: string | null;
  createdAt: string;
  updatedAt: string;
};
