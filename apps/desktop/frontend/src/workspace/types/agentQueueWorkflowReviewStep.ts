import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowCommandBlocker,
  AgentQueueWorkflowConflict,
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowRun,
  GetAgentQueueWorkflowRequest,
} from "./agentQueue";

export type ExecuteAgentQueueWorkflowReviewStepRequest =
  GetAgentQueueWorkflowRequest & {
    actorId?: string | null;
    grantSummary?: AgentQueueWorkflowJsonValue | null;
    requestId?: string | null;
    slot?: string | null;
  };

export type AgentQueueWorkflowReviewStepStatus =
  | "executed"
  | "already_applied"
  | "blocked_precondition"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "failed_unexpected"
  | string;

export type AgentQueueWorkflowReviewBinding = {
  ackActionId: string | null;
  ackActionIdempotencyKey: string;
  ackStatus: string;
  createActionId: string | null;
  createActionIdempotencyKey: string;
  evidenceBundleId: string;
  messageId: string;
  reviewAckedAt: string | null;
  reviewCreatedAt: string | null;
  runId: string;
  slot: string;
  taskId: string;
};

export type AgentQueueWorkflowReviewStepResult = {
  ackAction: AgentQueueWorkflowAction | null;
  ackStatus: string | null;
  binding: AgentQueueWorkflowReviewBinding | null;
  blockers: AgentQueueWorkflowCommandBlocker[];
  conflict: AgentQueueWorkflowConflict | null;
  createAction: AgentQueueWorkflowAction | null;
  messageId: string | null;
  nextPhase: string | null;
  nextStep: string | null;
  status: AgentQueueWorkflowReviewStepStatus;
  transition: "review" | string;
  workflowRun: AgentQueueWorkflowRun | null;
  workflowRunId: string;
};
