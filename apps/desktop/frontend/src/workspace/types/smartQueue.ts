export type SmartQueueState = "paused" | "active" | "draining" | "stopped";

export type SmartQueueTaskHumanStatus =
  | "ready"
  | "waiting_dependency"
  | "running"
  | "review"
  | "needs_decision"
  | "blocked"
  | "failed"
  | "closed"
  | "cancelled";

export type SmartQueueDependencyGate =
  | "none"
  | "waiting"
  | "satisfied"
  | "failed"
  | "blocked";

export type SmartQueueBlockerKind =
  | "dependency_failed"
  | "dependency_blocked"
  | "missing_config"
  | "validation_requires_decision"
  | "worker_unavailable"
  | "dirty_worktree"
  | "missing_prompt"
  | "requires_human_input";

export type SmartQueueRole =
  | "queue_importer"
  | "queue_coordinator"
  | "queue_scheduler"
  | "worker_agent"
  | "workspace_agent_assistance"
  | "human_operator";

export type QueueCoordinatorDecisionKind =
  | "start_task"
  | "retry_task"
  | "request_review"
  | "request_validation"
  | "request_assistance"
  | "block_task"
  | "fail_task"
  | "close_task"
  | "cancel_task"
  | "pause_queue"
  | "drain_queue"
  | "stop_queue";

export type WorkerStuckReportKind =
  | "validation_failure"
  | "exec_failure"
  | "missing_context"
  | "dirty_worktree"
  | "dependency_failed";

export type QueueCoordinatorDecisionAction =
  | "retry_same"
  | "retry_with_modified_prompt"
  | "move_blocked"
  | "mark_failed"
  | "request_human_input"
  | "request_workspace_agent_assistance"
  | "rollback_proposal";

export type QueueCoordinatorDecisionStatus =
  | "needs_decision"
  | "blocked"
  | "failed"
  | "assistance_requested";

export type WorkerStuckReportFlags = {
  canRetrySame?: boolean;
  hasPromptModificationSuggestion?: boolean;
  needsWorkspaceAgentAssistance?: boolean;
  needsHumanInput?: boolean;
  environmentOrToolIssue?: boolean;
  retryCountExceeded?: boolean;
  hasRollbackRecommendation?: boolean;
};

export type WorkerStuckReport = {
  reportId: string;
  workspaceId: string;
  queueId: string;
  batchId?: string;
  taskId: string;
  workerId?: string;
  kind: WorkerStuckReportKind;
  summary: string;
  retryCount: number;
  maxRetryCount: number;
  dependencyTaskIds?: string[];
  validationSummary?: string;
  createdAt: string;
  flags?: WorkerStuckReportFlags;
};

export type QueueCoordinatorDecision = {
  decisionId: string;
  workspaceId: string;
  queueId: string;
  batchId?: string;
  taskId?: string;
  action: QueueCoordinatorDecisionAction;
  status: QueueCoordinatorDecisionStatus;
  reason: string;
  blockerKind?: SmartQueueBlockerKind;
  assistanceRequest?: QueueAssistanceRequest;
  retryCount: number;
  maxRetryCount: number;
  createdAt: string;
  decidedBy: "queue_coordinator" | "human_operator";
  requiresApproval: boolean;
  approvedBy?: string;
};

export type QueueAssistanceResponseKind =
  | "explanation"
  | "options"
  | "draft_prompt"
  | "decision_recommendation";

export type QueueAssistanceRequestTarget =
  | "workspace_agent"
  | "human_operator";

export type QueueAssistanceVisibleContext = {
  taskTitle?: string;
  taskPromptPreview?: string;
  dependencyTaskIds?: string[];
  workerReportPreview?: string;
  validationSummary?: string;
  blockerSummary?: string;
};

export type QueueAssistanceRequest = {
  requestId: string;
  workspaceId: string;
  queueId: string;
  batchId?: string;
  taskId?: string;
  requestedBy: "queue_coordinator" | "human_operator";
  target: QueueAssistanceRequestTarget;
  reason: SmartQueueBlockerKind;
  question: string;
  visibleContext: QueueAssistanceVisibleContext;
  allowedResponseKinds: QueueAssistanceResponseKind[];
  createdAt: string;
};

export type QueueAssistanceResponse = {
  responseId: string;
  requestId: string;
  responder: "workspace_agent" | "human_operator";
  responseKind: QueueAssistanceResponseKind;
  summary: string;
  recommendedDecision?: Exclude<
    QueueCoordinatorDecisionKind,
    "start_task" | "request_assistance"
  >;
  proposedPrompt?: string;
  warnings: string[];
  createdAt: string;
  requiresCoordinatorDecision: true;
};
