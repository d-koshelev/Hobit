import type {
  WorkflowGrant,
  WorkflowInputs,
} from "../../broker/workflowGrantInputSplit";
import type {
  AgentQueueControlStatus,
  AgentQueueItemAggregate,
  AgentQueueWorkflowExecutionTarget,
  AgentQueueWorkflowApplyRunSettingsResult,
  AgentQueueWorkflowMaterializeTaskSlotResult,
  AgentQueueWorkflowPromoteTaskSlotResult,
  AgentQueueWorkflowWorkerEvidenceRecordResult,
  AgentQueueReviewCreateMessageBlocker,
  AgentQueueReviewMessage,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerEvidenceOutcome,
  ApplyAgentQueueWorkflowRunSettingsRequest,
  MaterializeAgentQueueWorkflowTaskSlotRequest,
  PromoteAgentQueueWorkflowTaskSlotRequest,
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
} from "../../../../workspace/types";
import type { QueueWorkflowRequestValidationResult } from "../queueWorkflowRequestValidation";

export type QueueWorkflowRunnerStatus =
  | "completed"
  | "blocked"
  | "paused"
  | "invalid_request"
  | "unavailable"
  | "failed_unexpected"
  | QueueWorkflowCreateSetupStartStatus
  | QueueWorkflowWorkerEvidenceStatus
  | QueueWorkflowFinalizationStatus
  | QueueWorkflowReviewStatus;

export type QueueWorkflowCreateSetupStartStatus =
  | "materializing_tasks"
  | "applying_run_settings"
  | "promoting_task"
  | "verifying_queue_control"
  | "starting_worker"
  | "awaiting_worker_completion"
  | "worker_running"
  | "blocked_materialization"
  | "blocked_setup"
  | "blocked_queue_control"
  | "blocked_worker_start";

export type QueueWorkflowReviewStatus =
  | "review_acknowledged"
  | "review_blocked_missing_evidence"
  | "review_blocked_missing_task_or_run"
  | "review_completed"
  | "review_message_already_exists"
  | "review_not_supported_for_workflow";

export type QueueWorkflowWorkerEvidenceStatus =
  | "recording_worker_evidence"
  | "evidence_recorded"
  | "evidence_already_recorded"
  | "blocked_worker_outcome_mismatch"
  | "blocked_worker_not_complete"
  | "blocked_missing_run"
  | "blocked_missing_task"
  | "blocked_evidence_conflict"
  | "blocked_evidence_missing"
  | "awaiting_review";

export type QueueWorkflowFinalizationStatus =
  | "finalization_already_done"
  | "finalization_already_failed"
  | "finalization_blocked"
  | "finalization_completed"
  | "finalization_failed_unexpected"
  | "finalization_invalid_input"
  | "finalization_needs_confirmation"
  | "finalization_not_supported_for_workflow";

export type QueueWorkflowRunnerStepStatus =
  | "completed"
  | "blocked"
  | "paused"
  | "skipped"
  | "unavailable"
  | "failed_unexpected";

export type QueueWorkflowRunnerBlockerReason =
  | "aggregate_not_found"
  | "blocked_materialization"
  | "blocked_queue_control"
  | "blocked_setup"
  | "blocked_worker_start"
  | "evidence_read_unavailable"
  | "failed_unexpected"
  | "finalization_command_blocked"
  | "finalization_confirmation_invalid"
  | "finalization_confirmation_required"
  | "finalization_invalid_input"
  | "finalization_missing_failure_reason"
  | "finalization_missing_upstream_task_id"
  | "finalization_not_supported_for_workflow"
  | "finalization_policy_blocked"
  | "finalization_port_unavailable"
  | "finalization_review_ack_required"
  | "input_validation_deferred"
  | "invalid_request"
  | "materialization_port_unavailable"
  | "missing_explicit_evidence_ids"
  | "missing_explicit_task_ids"
  | "missing_task_spec"
  | "missing_workflow_run_id"
  | "missing_run_settings"
  | "read_only_runner_requires_existing_tasks"
  | "read_port_unavailable"
  | "review_ack_already_done"
  | "review_ack_blocked"
  | "review_ack_invalid_input"
  | "review_ack_missing_message_id"
  | "review_blocked_missing_evidence"
  | "review_blocked_missing_task_or_run"
  | "review_create_blocked"
  | "review_create_invalid_input"
  | "review_message_already_exists"
  | "review_not_supported_for_workflow"
  | "review_port_unavailable"
  | "setup_port_unavailable"
  | "start_confirmation_invalid"
  | "start_confirmation_required"
  | "worker_start_orphan"
  | "worker_start_port_unavailable"
  | "worker_evidence_blocked"
  | "worker_evidence_conflict"
  | "worker_evidence_invalid_input"
  | "worker_evidence_missing_input"
  | "worker_evidence_missing_run"
  | "worker_evidence_missing_task"
  | "worker_evidence_not_supported_for_workflow"
  | "worker_evidence_port_unavailable"
  | "worker_not_complete"
  | "worker_outcome_mismatch"
  | "worker_run_state_mismatch"
  | "worker_state_ambiguous"
  | "workflow_not_supported_read_only";

export type QueueWorkflowRunnerBlocker = {
  fieldPath?: string;
  message: string;
  reasonCode: QueueWorkflowRunnerBlockerReason;
  slot?: string;
  taskId?: string;
};

export type QueueWorkflowRunnerPhase =
  | "finalization"
  | "read"
  | "review"
  | "run_start"
  | "setup"
  | "validate"
  | "verification"
  | "worker_evidence";

export type QueueWorkflowRunnerEvent = {
  message: string;
  phase?: QueueWorkflowRunnerPhase;
  reasonCode?: QueueWorkflowRunnerBlockerReason;
  slot?: string;
  status: QueueWorkflowRunnerStepStatus;
  taskId?: string;
  timestamp?: string;
};

export type QueueWorkflowRunnerStep = {
  evidenceBundleId?: string;
  message: string;
  messageId?: string;
  phase?: QueueWorkflowRunnerPhase;
  reasonCode?: QueueWorkflowRunnerBlockerReason;
  runId?: string;
  slot?: string;
  status: QueueWorkflowRunnerStepStatus;
  stepId: string;
  taskId?: string;
};

export type QueueWorkflowLifecycleSnapshot =
  | AgentQueueItemAggregate
  | {
      aggregate?: AgentQueueItemAggregate | null;
      blockers?: readonly unknown[];
      dependencyState?: string;
      evidenceState?: string;
      reviewState?: string;
      taskId?: string;
      ticketState?: string;
      workerRunState?: string;
    };

export type QueueWorkflowEvidenceReadRequest = {
  evidenceBundleId?: string;
  runId?: string;
  taskId: string;
};

export type QueueWorkflowReadPort = {
  getEvidenceBundle?: (
    request: QueueWorkflowEvidenceReadRequest,
  ) => Promise<AgentQueueWorkerEvidenceQueryResult | null>;
  getLifecycle?: (
    taskId: string,
  ) => Promise<QueueWorkflowLifecycleSnapshot | null>;
  getQueueItemAggregate: (
    taskId: string,
  ) => Promise<AgentQueueItemAggregate | null>;
  listQueueItemAggregates: () => Promise<readonly AgentQueueItemAggregate[]>;
};

export type QueueWorkflowReviewCommandStatus =
  | "already_done"
  | "already_exists"
  | "blocked"
  | "failed_unexpected"
  | "invalid_input"
  | "needs_confirmation"
  | "policy_blocked"
  | "precondition_failed"
  | "succeeded"
  | "unavailable";

export type QueueWorkflowCreateReviewMessageRequest = {
  evidenceBundleId: string;
  messageBody?: string;
  runId?: string;
  taskId: string;
};

export type QueueWorkflowAckReviewMessageRequest = {
  messageId: string;
  taskId: string;
};

export type QueueWorkflowCreateReviewMessageResult = {
  aggregate?: AgentQueueItemAggregate | null;
  blocker?: AgentQueueReviewCreateMessageBlocker | null;
  durable?: boolean;
  evidenceBundleId?: string | null;
  existingMessageId?: string | null;
  fieldPath?: string;
  fieldPaths?: readonly string[];
  message?: string;
  messageId?: string | null;
  reasonCode?: string;
  reviewMessage?: AgentQueueReviewMessage | null;
  runId?: string | null;
  status: QueueWorkflowReviewCommandStatus;
  taskId?: string;
};

export type QueueWorkflowAckReviewMessageResult = {
  aggregate?: AgentQueueItemAggregate | null;
  durable?: boolean;
  fieldPath?: string;
  fieldPaths?: readonly string[];
  message?: string;
  messageId?: string | null;
  reasonCode?: string;
  reviewMessage?: AgentQueueReviewMessage | null;
  status: QueueWorkflowReviewCommandStatus;
  taskId?: string;
};

export type QueueWorkflowReviewPort = {
  ackReviewMessage: (
    request: QueueWorkflowAckReviewMessageRequest,
  ) => Promise<QueueWorkflowAckReviewMessageResult>;
  createReviewMessage: (
    request: QueueWorkflowCreateReviewMessageRequest,
  ) => Promise<QueueWorkflowCreateReviewMessageResult>;
};

export type QueueWorkflowFinalizationCommandStatus =
  | "already_done"
  | "already_failed"
  | "blocked"
  | "failed_unexpected"
  | "invalid_input"
  | "needs_confirmation"
  | "policy_blocked"
  | "precondition_failed"
  | "succeeded"
  | "unavailable";

export type QueueWorkflowFinalizationBlocker = {
  blockerCode?: string | null;
  blockerMessage?: string | null;
  dependencyState?: string | null;
  evidenceBundleId?: string | null;
  evidenceState?: string | null;
  missingRequiredField?: string | null;
  nextSuggestedCapability?: string | null;
  reviewState?: string | null;
  runId?: string | null;
  taskId?: string | null;
  ticketState?: string | null;
  validationState?: string | null;
  workerRunState?: string | null;
};

export type QueueWorkflowMarkDoneRequest = {
  confirmationToken: string;
  messageId?: string;
  reason?: string;
  runId?: string;
  taskId: string;
};

export type QueueWorkflowFailItemRequest = {
  confirmationToken: string;
  evidenceBundleId?: string;
  messageId?: string;
  reason: string;
  runId?: string;
  taskId: string;
};

export type QueueWorkflowFinalizationCommandResult = {
  aggregate?: AgentQueueItemAggregate | null;
  blocker?: QueueWorkflowFinalizationBlocker | null;
  decisionId?: string | null;
  durable?: boolean;
  evidenceBundleId?: string | null;
  fieldPath?: string;
  fieldPaths?: readonly string[];
  message?: string;
  reasonCode?: string;
  runId?: string | null;
  status: QueueWorkflowFinalizationCommandStatus;
  taskId?: string;
};

export type QueueWorkflowFinalizationPort = {
  failItem: (
    request: QueueWorkflowFailItemRequest,
  ) => Promise<QueueWorkflowFinalizationCommandResult>;
  markDone: (
    request: QueueWorkflowMarkDoneRequest,
  ) => Promise<QueueWorkflowFinalizationCommandResult>;
};

export type QueueWorkflowQueueControlState = {
  backendOwned?: boolean;
  globalExecutionState?: string | null;
  queueEnabled?: boolean;
  status?: AgentQueueControlStatus | string | null;
  version?: number | null;
};

export type QueueWorkflowCreateSetupStartPort = {
  applyRunSettings: (
    request: Omit<ApplyAgentQueueWorkflowRunSettingsRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowApplyRunSettingsResult>;
  getQueueControlState: () =>
    | Promise<QueueWorkflowQueueControlState | null>
    | QueueWorkflowQueueControlState
    | null;
  materializeTaskSlot: (
    request: Omit<MaterializeAgentQueueWorkflowTaskSlotRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowMaterializeTaskSlotResult>;
  promoteTaskSlot: (
    request: Omit<PromoteAgentQueueWorkflowTaskSlotRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkflowPromoteTaskSlotResult>;
  startWorkerForSlot: (
    request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
};

export type QueueWorkflowRecordWorkerEvidenceRequest = Omit<
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
  "workspaceId"
>;

export type QueueWorkflowWorkerEvidencePort = {
  recordWorkerEvidenceForSlot: (
    request: QueueWorkflowRecordWorkerEvidenceRequest,
  ) => Promise<AgentQueueWorkflowWorkerEvidenceRecordResult>;
};

export type QueueWorkflowRunnerRequest = {
  grant?: WorkflowGrant;
  inputs?: WorkflowInputs;
  moduleId: string;
  requestId: string;
  workflowId: string;
};

export type QueueWorkflowSlotVariables = {
  evidenceBundleId?: string;
  executionTargetHash?: string;
  executionTargetKind?: string;
  executorWidgetId?: string | null;
  messageId?: string;
  providerId?: string;
  queueOwnerWidgetInstanceId?: string;
  runId?: string;
  settingsHash?: string;
  slot: string;
  taskId?: string;
  taskSpecHash?: string;
};

export type QueueWorkflowReadSnapshots = {
  aggregatesByTaskId: Record<string, AgentQueueItemAggregate | null>;
  evidenceByKey: Record<string, AgentQueueWorkerEvidenceQueryResult | null>;
  lifecycleByTaskId: Record<string, QueueWorkflowLifecycleSnapshot | null>;
};

export type QueueWorkflowVariables = {
  evidenceBundleIdsBySlot: Record<string, string>;
  messageIdsBySlot: Record<string, string>;
  readSnapshots: QueueWorkflowReadSnapshots;
  runIdsBySlot: Record<string, string>;
  scopedEvidenceBundleIds: string[];
  scopedMessageIds: string[];
  scopedRunIds: string[];
  scopedTaskIds: string[];
  slots: Record<string, QueueWorkflowSlotVariables>;
  taskIdsBySlot: Record<string, string>;
  workflowId: string;
  requestId: string;
};

export type QueueWorkflowRunnerReport = {
  createSetupStart: QueueWorkflowCreateSetupStartReport;
  evidenceReads: QueueWorkflowEvidenceReadRequest[];
  finalization: QueueWorkflowFinalizationReport;
  missingExplicitIds: string[];
  mutationSummary: {
    didAckReview: boolean;
    didBlock: boolean;
    didCreateReviewMessage: boolean;
    didFail: boolean;
    didFollowUp: boolean;
    didLaunchTerminal: boolean;
    didMarkDone: boolean;
    didMutateGit: boolean;
    didMutateQueue: boolean;
    didRollback: boolean;
    didStartWorker: boolean;
    didValidate: boolean;
  };
  nextMutatingPhase: string | null;
  readOnly: boolean;
  review: QueueWorkflowReviewReport;
  summary: string;
  taskReads: string[];
  workerEvidence: QueueWorkflowWorkerEvidenceReport;
};

export type QueueWorkflowCreateSetupStartReport = {
  downstreamTaskId?: string;
  materializedSlots: Record<
    string,
    {
      dependencyTaskIds?: readonly string[];
      dependsOnSlots?: readonly string[];
      status: string;
      taskId?: string;
      taskSpecHash?: string;
    }
  >;
  phase: "create_setup_start";
  promote?: {
    slot: string;
    status: string;
    taskId?: string;
  };
  queueControl?: {
    status?: string | null;
    version?: number | null;
  };
  runSettings?: {
    executionTargetHash?: string;
    executionTargetKind?: string;
    executorWidgetId?: string | null;
    providerId?: string;
    queueOwnerWidgetInstanceId?: string | null;
    settingsHash?: string;
    slot: string;
    status: string;
    taskId?: string;
  };
  start?: {
    actionIdempotencyKey?: string | null;
    runId?: string;
    status: string;
    taskId?: string;
  };
  status: QueueWorkflowCreateSetupStartStatus | null;
  supportedWorkflow: boolean;
  upstreamTaskId?: string;
  workflowRunId?: string;
};

export type QueueWorkflowDownstreamVerificationReport = {
  dependencyState?: string;
  dependencyVerified: boolean | null;
  expectedDependencyState?: string;
  missingReason?: "missing_downstream_task_id" | "snapshot_unavailable";
  notAutoStartedVerified: boolean | null;
  snapshot?: QueueWorkflowLifecycleSnapshot | null;
  taskId?: string;
  verificationMissing: boolean;
  workerRunState?: string;
};

export type QueueWorkflowFinalizationReport = {
  commandStatus?: QueueWorkflowFinalizationCommandStatus;
  confirmationTokenAccepted: boolean;
  decisionId?: string;
  downstreamVerification: QueueWorkflowDownstreamVerificationReport;
  failureReason?: string;
  finalizationAction?: "fail" | "mark_done";
  idempotent: boolean;
  phase: "finalization";
  status: QueueWorkflowFinalizationStatus | null;
  supportedWorkflow: boolean;
  targetSlot?: string;
  taskId?: string;
};

export type QueueWorkflowReviewReport = {
  ackStatus?: QueueWorkflowReviewCommandStatus;
  createStatus?: QueueWorkflowReviewCommandStatus | "skipped_existing_message";
  evidenceBundleId?: string;
  evidenceState?: string;
  idempotentAck: boolean;
  idempotentCreate: boolean;
  messageId?: string;
  phase: "review";
  runId?: string;
  status: QueueWorkflowReviewStatus | null;
  supportedWorkflow: boolean;
  targetSlot?: string;
  taskId?: string;
};

export type QueueWorkflowWorkerEvidenceReport = {
  commandStatus?: AgentQueueWorkflowWorkerEvidenceRecordResult["status"];
  evidenceBundleId?: string;
  idempotent: boolean;
  outcome?: AgentQueueWorkerEvidenceOutcome | string;
  phase: "worker_evidence";
  runId?: string;
  status: QueueWorkflowWorkerEvidenceStatus | null;
  supportedWorkflow: boolean;
  targetSlot?: string;
  taskId?: string;
  workerFinalStatus?: string;
};

export type QueueWorkflowRunnerResult = {
  blockers: QueueWorkflowRunnerBlocker[];
  events: QueueWorkflowRunnerEvent[];
  report: QueueWorkflowRunnerReport;
  requestId: string;
  status: QueueWorkflowRunnerStatus;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
  workflowId: string;
};

export type QueueWorkflowRunnerInput = {
  readPort?: QueueWorkflowReadPort | null;
  request: QueueWorkflowRunnerRequest;
  validation: QueueWorkflowRequestValidationResult;
};

export type QueueWorkflowReviewRunnerInput = QueueWorkflowRunnerInput & {
  reviewPort?: QueueWorkflowReviewPort | null;
};

export type QueueWorkflowFinalizationRunnerInput = QueueWorkflowRunnerInput & {
  finalizationPort?: QueueWorkflowFinalizationPort | null;
};

export type QueueWorkflowWorkerEvidenceRunnerInput = QueueWorkflowRunnerInput & {
  workerEvidencePort?: QueueWorkflowWorkerEvidencePort | null;
  workflowRunId: string;
};

export type QueueWorkflowCreateSetupStartRunnerInput =
  QueueWorkflowRunnerInput & {
    createSetupStartPort?: QueueWorkflowCreateSetupStartPort | null;
    resumeNextPhase?: string | null;
    resumeNextStep?: string | null;
    workflowRunId: string;
  };
