import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowCommandBlocker,
  AgentQueueWorkflowConflict,
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowRun,
  GetAgentQueueWorkflowRequest,
} from "./agentQueue";

export type ExecuteAgentQueueWorkflowFinalizationStepRequest =
  GetAgentQueueWorkflowRequest & {
    actorId?: string | null;
    confirmationToken?: string | null;
    expectedVersion?: number | null;
    failureReason?: string | null;
    grantSummary?: AgentQueueWorkflowJsonValue | null;
    requestId?: string | null;
    slot?: string | null;
  };

export type AgentQueueWorkflowFinalizationStepStatus =
  | "executed"
  | "already_applied"
  | "blocked_precondition"
  | "invalid_input"
  | "conflict"
  | "failed_unexpected"
  | string;

export type AgentQueueWorkflowFinalizationBinding = {
  actionIdempotencyKey: string;
  completionDecisionId: string | null;
  evidenceBundleId: string;
  failureDecisionId: string | null;
  finalizationActionId: string | null;
  finalizedAt: string | null;
  messageId: string;
  runId: string;
  slot: string;
  taskId: string;
  terminalStatus: string;
};

export type AgentQueueWorkflowFinalizationDownstreamVerification = {
  dependencyState: string | null;
  dependencyVerified: boolean;
  downstreamTaskId: string | null;
  expectedDependencyState: string;
  latestRunId: string | null;
  notAutoStartedVerified: boolean;
  ticketState: string | null;
  verificationMissing: boolean;
  workerRunState: string | null;
};

export type AgentQueueWorkflowFinalizationStepResult = {
  action: AgentQueueWorkflowAction | null;
  binding: AgentQueueWorkflowFinalizationBinding | null;
  blockers: AgentQueueWorkflowCommandBlocker[];
  completionDecisionId: string | null;
  conflict: AgentQueueWorkflowConflict | null;
  downstreamVerification: AgentQueueWorkflowFinalizationDownstreamVerification | null;
  failureDecisionId: string | null;
  nextPhase: string | null;
  nextStep: string | null;
  status: AgentQueueWorkflowFinalizationStepStatus;
  terminalStatus: string | null;
  transition: "finalize_done" | "finalize_fail" | string;
  workflowId: string | null;
  workflowRun: AgentQueueWorkflowRun | null;
  workflowRunId: string;
};
