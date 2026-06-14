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
