import type {
  AgentQueueWorkflowAction,
  AgentQueueWorkflowCommandBlocker,
  AgentQueueWorkflowConflict,
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowRun,
} from "./agentQueue";

export type ExecuteAgentQueueWorkflowCreateSetupStartStepRequest = {
  actorId?: string | null;
  confirmationToken?: string | null;
  expectedVersion?: number | null;
  grantSummary?: AgentQueueWorkflowJsonValue | null;
  inputs?: AgentQueueWorkflowJsonValue | null;
  requestId: string;
  workflowId: string;
  workflowRunId?: string | null;
  workspaceId: string;
};

export type AgentQueueWorkflowCreateSetupStartStepStatus =
  | "executed"
  | "already_applied"
  | "blocked_precondition"
  | "conflict"
  | "invalid_input"
  | "failed_unexpected"
  | string;

export type AgentQueueWorkflowCreateSetupStartActionSnapshots = {
  createTaskDownstream: AgentQueueWorkflowAction | null;
  createTaskUpstream: AgentQueueWorkflowAction | null;
  promoteTask: AgentQueueWorkflowAction | null;
  startWorker: AgentQueueWorkflowAction | null;
  updateRunSettings: AgentQueueWorkflowAction | null;
};

export type AgentQueueWorkflowCreateSetupStartQueueControl = {
  status: string;
  version: number;
};

export type AgentQueueWorkflowCreateSetupStartDownstreamVerification = {
  dependencyEdgeExists: boolean;
  downstreamNotStarted: boolean;
  downstreamRunIdAbsent: boolean;
  downstreamTaskExists: boolean;
  downstreamTaskId: string | null;
};

export type AgentQueueWorkflowCreateSetupStartStepResult = {
  actions: AgentQueueWorkflowCreateSetupStartActionSnapshots;
  blockers: AgentQueueWorkflowCommandBlocker[];
  conflict: AgentQueueWorkflowConflict | null;
  downstreamVerification: AgentQueueWorkflowCreateSetupStartDownstreamVerification | null;
  executionTargetHash: string | null;
  executionTargetKind: string | null;
  nextPhase: string | null;
  nextStep: string | null;
  providerId: string | null;
  queueControl: AgentQueueWorkflowCreateSetupStartQueueControl | null;
  requestId: string;
  runIdsBySlot: Record<string, string>;
  settingsHash: string | null;
  slotBindingSnapshot: AgentQueueWorkflowJsonValue | null;
  status: AgentQueueWorkflowCreateSetupStartStepStatus;
  taskIdsBySlot: Record<string, string>;
  transition: "create_setup_start" | string;
  workflowId: string;
  workflowRun: AgentQueueWorkflowRun | null;
  workflowRunId: string | null;
};
