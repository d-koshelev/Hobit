import type {
  WorkflowGrant,
  WorkflowInputs,
} from "../broker/workflowGrantInputSplit";
import type {
  AgentQueueControlStatus,
  AgentQueueItemAggregate,
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
} from "../../../workspace/types";
import type { QueueWorkflowId } from "./queueWorkflowModuleMetadata";
import type { QueueWorkflowRequestValidationResult } from "./queueWorkflowRequestValidation";

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
  executorWidgetId?: string;
  messageId?: string;
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
    executorWidgetId?: string;
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

const QUEUE_MODULE_ID = "queue";
const QUEUE_FINALIZATION_CONFIRMATION_TOKEN = "operator-confirmed";
const DEPENDENCY_WORKFLOWS = new Set<string>([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
]);
const REVIEW_WORKFLOWS = new Set<string>([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
  "review_acceptance",
]);
const VALIDATION_DEFERRED_WORKFLOWS = new Set<string>([
  "review_acceptance",
  "terminal_failure",
]);
const DEPENDENCY_REQUIRED_SLOTS = ["upstream", "downstream"] as const;
const MUTATION_SUMMARY: QueueWorkflowRunnerReport["mutationSummary"] = {
  didAckReview: false,
  didBlock: false,
  didCreateReviewMessage: false,
  didFail: false,
  didFollowUp: false,
  didLaunchTerminal: false,
  didMarkDone: false,
  didMutateGit: false,
  didMutateQueue: false,
  didRollback: false,
  didStartWorker: false,
  didValidate: false,
};

const EMPTY_REVIEW_REPORT: QueueWorkflowReviewReport = {
  idempotentAck: false,
  idempotentCreate: false,
  phase: "review",
  status: null,
  supportedWorkflow: false,
};

const EMPTY_WORKER_EVIDENCE_REPORT: QueueWorkflowWorkerEvidenceReport = {
  idempotent: false,
  phase: "worker_evidence",
  status: null,
  supportedWorkflow: false,
};

const EMPTY_DOWNSTREAM_VERIFICATION: QueueWorkflowDownstreamVerificationReport = {
  dependencyVerified: null,
  notAutoStartedVerified: null,
  verificationMissing: true,
};

const EMPTY_FINALIZATION_REPORT: QueueWorkflowFinalizationReport = {
  confirmationTokenAccepted: false,
  downstreamVerification: EMPTY_DOWNSTREAM_VERIFICATION,
  idempotent: false,
  phase: "finalization",
  status: null,
  supportedWorkflow: false,
};

const EMPTY_CREATE_SETUP_START_REPORT: QueueWorkflowCreateSetupStartReport = {
  materializedSlots: {},
  phase: "create_setup_start",
  status: null,
  supportedWorkflow: false,
};

export async function runQueueWorkflowReadOnlyRunner(
  input: QueueWorkflowRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);

  const validationBlocker = validateRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      reasonCode: validationBlocker.reasonCode,
      status:
        validationBlocker.reasonCode === "input_validation_deferred"
          ? "paused"
          : "blocked",
      stepId: "validate_request",
    });
    return result({
      blockers,
      events,
      reportSummary: validationBlocker.message,
      status:
        validationBlocker.reasonCode === "input_validation_deferred"
          ? "paused"
          : "invalid_request",
      steps,
      variables,
    });
  }

  if (VALIDATION_DEFERRED_WORKFLOWS.has(input.request.workflowId)) {
    const blocker = blockerForDeferredWorkflow(input.request.workflowId);
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "paused",
      stepId: "defer_workflow",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "paused",
      steps,
      variables,
    });
  }

  if (!DEPENDENCY_WORKFLOWS.has(input.request.workflowId)) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.workflowId",
      message: `${input.request.workflowId} is not supported by the read-only Queue workflow runner.`,
      reasonCode: "workflow_not_supported_read_only",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "select_workflow",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "blocked",
      steps,
      variables,
    });
  }

  const readTaskIds = explicitReadTaskIds(variables);
  const missingSlotBlockers = missingDependencySlotBlockers(variables);
  blockers.push(...missingSlotBlockers);

  if (readTaskIds.length === 0) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.inputs.taskIdsBySlot",
      message:
        "Read-only Queue workflow runner requires explicit existing task ids for dependency smoke inspection.",
      reasonCode: "read_only_runner_requires_existing_tasks",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "paused",
      stepId: "resolve_explicit_task_ids",
    });
    return result({
      blockers,
      events,
      reportSummary:
        "Paused before Queue reads because no explicit existing task ids were supplied.",
      status: "paused",
      steps,
      variables,
    });
  }

  if (!input.readPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow read port is unavailable.",
      reasonCode: "read_port_unavailable",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_read_port",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  try {
    await readTaskSnapshots({
      events,
      readPort: input.readPort,
      steps,
      taskIds: readTaskIds,
      variables,
    });

    const evidenceBlockers = await readEvidenceSnapshots({
      events,
      readPort: input.readPort,
      request: input.request,
      steps,
      variables,
    });
    blockers.push(...evidenceBlockers);
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue workflow read failed unexpectedly.",
      reasonCode: "failed_unexpected",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "read_failed",
    });
    return result({
      blockers,
      events,
      reportSummary: blocker.message,
      status: "failed_unexpected",
      steps,
      variables,
    });
  }

  const missingAggregateBlockers = missingAggregateBlockersForReads(
    variables,
    readTaskIds,
  );
  blockers.push(...missingAggregateBlockers);

  const status = finalStatus(blockers);
  return result({
    blockers,
    events,
    reportSummary:
      status === "completed"
        ? "Read-only Queue workflow inspection completed without Queue mutation."
        : "Read-only Queue workflow inspection paused or blocked with explicit diagnostics.",
    status,
    steps,
    variables,
  });
}

export async function runQueueWorkflowCreateSetupStartRunner(
  input: QueueWorkflowCreateSetupStartRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };
  let createSetupStartReport = createSetupStartReportForInput(input);

  const validationBlocker = validateCreateSetupStartRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "validate",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_create_setup_start_request",
    });
    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status:
        validationBlocker.reasonCode === "missing_workflow_run_id"
          ? "blocked_materialization"
          : "invalid_request",
      steps,
      variables,
    });
  }

  if (!input.createSetupStartPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow create/setup/start port is unavailable.",
      reasonCode: "materialization_port_unavailable",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "setup",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_create_setup_start_port",
    });
    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  const requestInput = resolveCreateSetupStartInput(input.request);
  if (!requestInput.ok) {
    blockers.push(requestInput.blocker);
    pushStep(steps, events, {
      message: requestInput.blocker.message,
      phase: "setup",
      reasonCode: requestInput.blocker.reasonCode,
      status: "blocked",
      stepId: "resolve_create_setup_start_inputs",
    });
    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: requestInput.blocker.message,
      status:
        requestInput.blocker.reasonCode === "missing_run_settings"
          ? "blocked_setup"
          : "blocked_materialization",
      steps,
      variables,
    });
  }

  try {
    const upstreamMaterialize =
      await input.createSetupStartPort.materializeTaskSlot({
        dependsOnSlots: requestInput.value.upstream.dependsOnSlots,
        slot: "upstream",
        taskSpec: requestInput.value.upstream.taskSpec,
        taskSpecHash: requestInput.value.upstream.taskSpecHash,
        workflowRunId: input.workflowRunId,
      });
    createSetupStartReport = updateCreateSetupStartReportMaterialize(
      createSetupStartReport,
      upstreamMaterialize,
      "upstream",
    );
    const upstreamMaterializeBlocker = blockerForMaterializeResult(
      upstreamMaterialize,
      "upstream",
    );
    if (upstreamMaterializeBlocker) {
      blockers.push(upstreamMaterializeBlocker);
      pushStep(steps, events, {
        message: upstreamMaterializeBlocker.message,
        phase: "setup",
        reasonCode: upstreamMaterializeBlocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "materialize_task_slot:upstream",
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_materialization",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: upstreamMaterializeBlocker.message,
        status: "blocked_materialization",
        steps,
        variables,
      });
    }
    const upstreamBinding = upstreamMaterialize.binding!;
    setMaterializedSlotVariables(variables, upstreamBinding);
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || upstreamMaterialize.status === "created";
    pushStep(steps, events, {
      message: `Queue workflow upstream task ${upstreamBinding.taskId} ${materializeVerb(upstreamMaterialize.status)}.`,
      phase: "setup",
      slot: "upstream",
      status: "completed",
      stepId: "materialize_task_slot:upstream",
      taskId: upstreamBinding.taskId,
    });

    const downstreamMaterialize =
      await input.createSetupStartPort.materializeTaskSlot({
        dependsOnSlots: requestInput.value.downstream.dependsOnSlots,
        slot: "downstream",
        taskSpec: requestInput.value.downstream.taskSpec,
        taskSpecHash: requestInput.value.downstream.taskSpecHash,
        workflowRunId: input.workflowRunId,
      });
    createSetupStartReport = updateCreateSetupStartReportMaterialize(
      createSetupStartReport,
      downstreamMaterialize,
      "downstream",
    );
    const downstreamMaterializeBlocker = blockerForMaterializeResult(
      downstreamMaterialize,
      "downstream",
    );
    if (downstreamMaterializeBlocker) {
      blockers.push(downstreamMaterializeBlocker);
      pushStep(steps, events, {
        message: downstreamMaterializeBlocker.message,
        phase: "setup",
        reasonCode: downstreamMaterializeBlocker.reasonCode,
        slot: "downstream",
        status: "blocked",
        stepId: "materialize_task_slot:downstream",
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_materialization",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: downstreamMaterializeBlocker.message,
        status: "blocked_materialization",
        steps,
        variables,
      });
    }
    const downstreamBinding = downstreamMaterialize.binding!;
    setMaterializedSlotVariables(variables, downstreamBinding);
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue ||
      downstreamMaterialize.status === "created";
    pushStep(steps, events, {
      message: `Queue workflow downstream task ${downstreamBinding.taskId} ${materializeVerb(downstreamMaterialize.status)} with explicit upstream dependency.`,
      phase: "setup",
      slot: "downstream",
      status: "completed",
      stepId: "materialize_task_slot:downstream",
      taskId: downstreamBinding.taskId,
    });

    const applySettings = await input.createSetupStartPort.applyRunSettings({
      runSettings: requestInput.value.runSettings,
      slot: "upstream",
      taskId: upstreamBinding.taskId,
      workflowRunId: input.workflowRunId,
    });
    createSetupStartReport = updateCreateSetupStartReportRunSettings(
      createSetupStartReport,
      applySettings,
    );
    const applySettingsBlocker = blockerForApplyRunSettingsResult(applySettings);
    if (applySettingsBlocker) {
      blockers.push(applySettingsBlocker);
      pushStep(steps, events, {
        message: applySettingsBlocker.message,
        phase: "setup",
        reasonCode: applySettingsBlocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "apply_run_settings:upstream",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_setup",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: applySettingsBlocker.message,
        status: "blocked_setup",
        steps,
        variables,
      });
    }
    const settingsBinding = applySettings.binding!;
    setRunSettingsSlotVariables(variables, settingsBinding);
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || applySettings.status === "applied";
    pushStep(steps, events, {
      message: `Queue workflow upstream run settings ${setupVerb(applySettings.status)}.`,
      phase: "setup",
      slot: "upstream",
      status: "completed",
      stepId: "apply_run_settings:upstream",
      taskId: settingsBinding.taskId,
    });

    const promote = await input.createSetupStartPort.promoteTaskSlot({
      settingsHash: settingsBinding.settingsHash,
      slot: "upstream",
      taskId: upstreamBinding.taskId,
      taskSpecHash: upstreamBinding.taskSpecHash,
      workflowRunId: input.workflowRunId,
    });
    createSetupStartReport = updateCreateSetupStartReportPromote(
      createSetupStartReport,
      promote,
    );
    const promoteBlocker = blockerForPromoteResult(promote);
    if (promoteBlocker) {
      blockers.push(promoteBlocker);
      pushStep(steps, events, {
        message: promoteBlocker.message,
        phase: "setup",
        reasonCode: promoteBlocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "promote_task_slot:upstream",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_setup",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: promoteBlocker.message,
        status: "blocked_setup",
        steps,
        variables,
      });
    }
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || promote.status === "promoted";
    pushStep(steps, events, {
      message: `Queue workflow upstream task ${promoteVerb(promote.status)}.`,
      phase: "setup",
      slot: "upstream",
      status: "completed",
      stepId: "promote_task_slot:upstream",
      taskId: promote.binding?.taskId ?? upstreamBinding.taskId,
    });

    const queueControl = await input.createSetupStartPort.getQueueControlState();
    createSetupStartReport = {
      ...createSetupStartReport,
      queueControl: {
        status: queueControl?.status ?? null,
        version: queueControl?.version ?? null,
      },
    };
    if (queueControl?.status !== "manual_enabled") {
      const blocker: QueueWorkflowRunnerBlocker = {
        message:
          "Queue workflow worker start requires backend QueueControlState manual_enabled.",
        reasonCode: "blocked_queue_control",
        taskId: upstreamBinding.taskId,
      };
      blockers.push(blocker);
      pushStep(steps, events, {
        message: blocker.message,
        phase: "run_start",
        reasonCode: blocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "verify_queue_control",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_queue_control",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: blocker.message,
        status: "blocked_queue_control",
        steps,
        variables,
      });
    }
    pushStep(steps, events, {
      message: `Queue control verified manual_enabled${typeof queueControl.version === "number" ? ` v${queueControl.version}` : ""}.`,
      phase: "run_start",
      slot: "upstream",
      status: "completed",
      stepId: "verify_queue_control",
      taskId: upstreamBinding.taskId,
    });

    const confirmation = resolveCreateSetupStartConfirmation(input.request);
    if (!confirmation.ok) {
      blockers.push(confirmation.blocker);
      pushStep(steps, events, {
        message: confirmation.blocker.message,
        phase: "run_start",
        reasonCode: confirmation.blocker.reasonCode,
        slot: "upstream",
        status: "blocked",
        stepId: "confirm_worker_start",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_worker_start",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: confirmation.blocker.message,
        status: "blocked_worker_start",
        steps,
        variables,
      });
    }

    const startActionIdempotencyKey = workflowStartIdempotencyKey({
      executorWidgetId: settingsBinding.executorWidgetId,
      settingsHash: settingsBinding.settingsHash,
      taskId: upstreamBinding.taskId,
      workflowRunId: input.workflowRunId,
    });
    const start = await input.createSetupStartPort.startWorkerForSlot({
      approvalPolicy: requestInput.value.runSettings.approvalPolicy as StartAssignedAgentQueueTaskRequest["approvalPolicy"],
      codexExecutable: requestInput.value.runSettings.codexExecutable,
      queueItemId: upstreamBinding.taskId,
      repoRoot: requestInput.value.runSettings.executionWorkspace,
      sandbox: requestInput.value.runSettings.sandbox as StartAssignedAgentQueueTaskRequest["sandbox"],
      stderrCapBytes: requestInput.value.stderrCapBytes,
      stdoutCapBytes: requestInput.value.stdoutCapBytes,
      timeoutMs: requestInput.value.timeoutMs,
      workflowStartContext: {
        actionIdempotencyKey: startActionIdempotencyKey,
        confirmationToken: confirmation.token,
        expectedQueueControlVersion:
          requestInput.value.expectedQueueControlVersion ??
          queueControl.version ??
          null,
        executorWidgetId: settingsBinding.executorWidgetId,
        settingsHash: settingsBinding.settingsHash,
        taskId: upstreamBinding.taskId,
        workflowRunId: input.workflowRunId,
      },
    });
    const startBlocker = blockerForStartResult(start);
    createSetupStartReport = updateCreateSetupStartReportStart(
      createSetupStartReport,
      start,
      upstreamBinding.taskId,
    );
    if (startBlocker) {
      blockers.push(startBlocker);
      pushStep(steps, events, {
        message: startBlocker.message,
        phase: "run_start",
        reasonCode: startBlocker.reasonCode,
        runId: start.runId,
        slot: "upstream",
        status: "blocked",
        stepId: "start_worker:upstream",
        taskId: upstreamBinding.taskId,
      });
      return result({
        blockers,
        createSetupStartReport: {
          ...createSetupStartReport,
          status: "blocked_worker_start",
        },
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: startBlocker.message,
        status: "blocked_worker_start",
        steps,
        variables,
      });
    }

    setStartedSlotVariables(variables, "upstream", start);
    mutationSummary.didStartWorker = start.status === "started";
    mutationSummary.didMutateQueue =
      mutationSummary.didMutateQueue || start.status === "started";
    const finalCreateSetupStatus: QueueWorkflowCreateSetupStartStatus =
      start.currentRunState === "running" || start.status === "already_started"
        ? "worker_running"
        : "awaiting_worker_completion";
    createSetupStartReport = {
      ...createSetupStartReport,
      status: finalCreateSetupStatus,
    };
    pushStep(steps, events, {
      message: `Queue workflow upstream worker ${start.status}; runId ${start.runId}.`,
      phase: "run_start",
      runId: start.runId,
      slot: "upstream",
      status: "paused",
      stepId: "start_worker:upstream",
      taskId: upstreamBinding.taskId,
    });

    return result({
      blockers,
      createSetupStartReport,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: createSetupStartSummary({
        report: createSetupStartReport,
        workflowId: input.request.workflowId,
      }),
      status: "awaiting_worker_completion",
      steps,
      variables,
    });
  } catch (error) {
    const blocker = blockerForCreateSetupStartError(error);
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "run_start",
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "create_setup_start_error",
    });
    return result({
      blockers,
      createSetupStartReport: {
        ...createSetupStartReport,
        status: "blocked_worker_start",
      },
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "blocked_worker_start",
      steps,
      variables,
    });
  }
}

export async function runQueueWorkflowWorkerEvidenceRunner(
  input: QueueWorkflowWorkerEvidenceRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };
  let workerEvidenceReport = workerEvidenceReportForInput(input);

  const validationBlocker = validateWorkerEvidenceRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "worker_evidence",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_worker_evidence_request",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status: "invalid_request",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: "blocked_evidence_missing",
      },
    });
  }

  if (!input.workerEvidencePort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow worker evidence port is unavailable.",
      reasonCode: "worker_evidence_port_unavailable",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "worker_evidence",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_worker_evidence_port",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: "blocked_evidence_missing",
      },
    });
  }

  const evidenceInput = resolveWorkerEvidenceInput(input);
  if (!evidenceInput.ok) {
    blockers.push(evidenceInput.blocker);
    pushStep(steps, events, {
      message: evidenceInput.blocker.message,
      phase: "worker_evidence",
      reasonCode: evidenceInput.blocker.reasonCode,
      status: "paused",
      stepId: "resolve_worker_evidence_inputs",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: evidenceInput.blocker.message,
      status: "awaiting_worker_completion",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: workerEvidenceBlockedStatus(evidenceInput.blocker.reasonCode),
      },
    });
  }

  try {
    workerEvidenceReport = {
      ...workerEvidenceReport,
      outcome: evidenceInput.value.outcome,
      runId: evidenceInput.value.runId,
      status: "recording_worker_evidence",
      targetSlot: evidenceInput.value.slot,
      taskId: evidenceInput.value.taskId,
    };
    pushStep(steps, events, {
      message: `Recording Queue worker evidence for ${evidenceInput.value.taskId}/${evidenceInput.value.runId}.`,
      phase: "worker_evidence",
      runId: evidenceInput.value.runId,
      slot: evidenceInput.value.slot,
      status: "completed",
      stepId: "record_worker_evidence",
      taskId: evidenceInput.value.taskId,
    });

    const recordResult =
      await input.workerEvidencePort.recordWorkerEvidenceForSlot({
        actionIdempotencyKey: evidenceInput.value.actionIdempotencyKey,
        actorId: evidenceInput.value.actorId,
        changedFiles: evidenceInput.value.changedFiles,
        changedFilesSummary: evidenceInput.value.changedFilesSummary,
        errorSummary: evidenceInput.value.errorSummary,
        finishedAt: evidenceInput.value.finishedAt,
        metadataJson: evidenceInput.value.metadataJson,
        outcome: evidenceInput.value.outcome,
        runId: evidenceInput.value.runId,
        slot: evidenceInput.value.slot,
        source: evidenceInput.value.source,
        summary: evidenceInput.value.summary,
        taskId: evidenceInput.value.taskId,
        validationSummary: evidenceInput.value.validationSummary,
        workerId: evidenceInput.value.workerId,
        workflowRunId: input.workflowRunId,
      });

    const evidenceBundleId =
      recordResult.binding?.evidenceBundleId ??
      recordResult.evidenceBundle?.bundleId;
    const finalStatus = workerEvidenceStatusForRecordResult(recordResult);
    workerEvidenceReport = {
      ...workerEvidenceReport,
      commandStatus: recordResult.status,
      evidenceBundleId,
      idempotent: recordResult.status === "already_recorded",
      outcome:
        recordResult.binding?.workerOutcome ??
        recordResult.evidenceBundle?.outcome ??
        evidenceInput.value.outcome,
      status: finalStatus,
      workerFinalStatus: recordResult.binding?.workerFinalStatus,
    };

    if (
      recordResult.status === "recorded" ||
      recordResult.status === "already_recorded"
    ) {
      if (evidenceBundleId) {
        setWorkerEvidenceSlotVariables(variables, {
          evidenceBundleId,
          runId: evidenceInput.value.runId,
          slot: evidenceInput.value.slot,
          taskId: evidenceInput.value.taskId,
        });
      }
      mutationSummary.didMutateQueue = recordResult.status === "recorded";
      pushStep(steps, events, {
        evidenceBundleId,
        message: `Queue worker evidence ${recordResult.status}; workflow is ready for review.`,
        phase: "worker_evidence",
        runId: evidenceInput.value.runId,
        slot: evidenceInput.value.slot,
        status: "paused",
        stepId: "worker_evidence_recorded",
        taskId: evidenceInput.value.taskId,
      });
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: `Queue worker evidence ${recordResult.status}; review remains a separate phase.`,
        status: "awaiting_review",
        steps,
        variables,
        workerEvidenceReport,
      });
    }

    const blocker = workerEvidenceBlockerFromRecordResult(
      recordResult,
      evidenceInput.value,
    );
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "worker_evidence",
      reasonCode: blocker.reasonCode,
      runId: evidenceInput.value.runId,
      slot: evidenceInput.value.slot,
      status: "blocked",
      stepId: "worker_evidence_blocked",
      taskId: evidenceInput.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: finalStatus,
      steps,
      variables,
      workerEvidenceReport,
    });
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue workflow worker evidence recording failed unexpectedly.",
      reasonCode: "failed_unexpected",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "worker_evidence",
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "worker_evidence_error",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "failed_unexpected",
      steps,
      variables,
      workerEvidenceReport: {
        ...workerEvidenceReport,
        status: "blocked_evidence_missing",
      },
    });
  }
}

type QueueWorkflowResolvedTaskSlotInput = {
  dependsOnSlots: string[];
  taskSpec: MaterializeAgentQueueWorkflowTaskSlotRequest["taskSpec"];
  taskSpecHash?: string | null;
};

type QueueWorkflowResolvedRunSettingsInput = {
  expectedQueueControlVersion?: number | null;
  runSettings: ApplyAgentQueueWorkflowRunSettingsRequest["runSettings"];
  stderrCapBytes?: number | null;
  stdoutCapBytes?: number | null;
  timeoutMs?: number | null;
};

type QueueWorkflowResolvedCreateSetupStartInput = {
  downstream: QueueWorkflowResolvedTaskSlotInput;
  expectedQueueControlVersion?: number | null;
  runSettings: ApplyAgentQueueWorkflowRunSettingsRequest["runSettings"];
  stderrCapBytes?: number | null;
  stdoutCapBytes?: number | null;
  timeoutMs?: number | null;
  upstream: QueueWorkflowResolvedTaskSlotInput;
};

type QueueWorkflowCreateSetupStartInputResolution =
  | { ok: true; value: QueueWorkflowResolvedCreateSetupStartInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowCreateSetupStartConfirmationResolution =
  | { ok: true; token: string }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowResolvedWorkerEvidenceInput =
  QueueWorkflowRecordWorkerEvidenceRequest & {
    outcome: AgentQueueWorkerEvidenceOutcome;
  };

type QueueWorkflowWorkerEvidenceInputResolution =
  | { ok: true; value: QueueWorkflowResolvedWorkerEvidenceInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

function createSetupStartReportForInput(
  input: QueueWorkflowCreateSetupStartRunnerInput,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...EMPTY_CREATE_SETUP_START_REPORT,
    supportedWorkflow: DEPENDENCY_WORKFLOWS.has(input.request.workflowId),
    workflowRunId: input.workflowRunId,
  };
}

function workerEvidenceReportForInput(
  input: QueueWorkflowWorkerEvidenceRunnerInput,
): QueueWorkflowWorkerEvidenceReport {
  return {
    ...EMPTY_WORKER_EVIDENCE_REPORT,
    supportedWorkflow: DEPENDENCY_WORKFLOWS.has(input.request.workflowId),
  };
}

function validateWorkerEvidenceRunnerBoundary({
  request,
  validation,
  workflowRunId,
}: QueueWorkflowWorkerEvidenceRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue worker evidence workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (!DEPENDENCY_WORKFLOWS.has(request.workflowId)) {
    return {
      fieldPath: "$.workflowId",
      message:
        "Worker evidence recording is supported only for dependency Queue workflows.",
      reasonCode: "worker_evidence_not_supported_for_workflow",
    };
  }

  if (!workflowRunId.trim()) {
    return {
      fieldPath: "$.metadata.workflowRunId",
      message: "Queue worker evidence recording requires a workflowRunId.",
      reasonCode: "missing_workflow_run_id",
    };
  }

  return null;
}

function resolveWorkerEvidenceInput(
  input: QueueWorkflowWorkerEvidenceRunnerInput,
): QueueWorkflowWorkerEvidenceInputResolution {
  const workerEvidence = recordRecord(input.request.inputs, "workerEvidence");
  if (!workerEvidence || !Object.keys(workerEvidence).length) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence",
        message:
          "Queue worker evidence recording requires typed inputs.workerEvidence.",
        reasonCode: "worker_evidence_missing_input",
      },
      ok: false,
    };
  }

  const requestedWorkflowRunId = recordString(workerEvidence, "workflowRunId");
  if (requestedWorkflowRunId && requestedWorkflowRunId !== input.workflowRunId) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.workflowRunId",
        message:
          "Queue worker evidence workflowRunId must match the persisted workflow run.",
        reasonCode: "worker_evidence_invalid_input",
      },
      ok: false,
    };
  }

  const slot = recordString(workerEvidence, "slot");
  if (slot !== "upstream") {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.slot",
        message:
          "Queue worker evidence recording currently requires slot upstream.",
        reasonCode: "worker_evidence_invalid_input",
      },
      ok: false,
    };
  }

  const taskId = recordString(workerEvidence, "taskId");
  if (!taskId) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.taskId",
        message: "Queue worker evidence recording requires typed taskId.",
        reasonCode: "worker_evidence_missing_task",
        slot,
      },
      ok: false,
    };
  }

  const runId = recordString(workerEvidence, "runId");
  if (!runId) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.runId",
        message: "Queue worker evidence recording requires typed runId.",
        reasonCode: "worker_evidence_missing_run",
        slot,
        taskId,
      },
      ok: false,
    };
  }

  const outcome = recordString(workerEvidence, "outcome");
  if (!isWorkerEvidenceOutcome(outcome)) {
    return {
      blocker: {
        fieldPath: "$.inputs.workerEvidence.outcome",
        message:
          "Queue worker evidence recording requires a typed worker outcome.",
        reasonCode: "worker_evidence_invalid_input",
        slot,
        taskId,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      actionIdempotencyKey: recordString(
        workerEvidence,
        "actionIdempotencyKey",
      ),
      actorId: recordString(workerEvidence, "actorId"),
      changedFiles: stringArray(workerEvidence.changedFiles),
      changedFilesSummary: recordString(workerEvidence, "changedFilesSummary"),
      errorSummary: recordString(workerEvidence, "errorSummary"),
      finishedAt: recordString(workerEvidence, "finishedAt"),
      metadataJson: recordString(workerEvidence, "metadataJson"),
      outcome,
      runId,
      slot,
      source: recordString(workerEvidence, "source"),
      summary: recordString(workerEvidence, "summary"),
      taskId,
      validationSummary: recordString(workerEvidence, "validationSummary"),
      workerId: recordString(workerEvidence, "workerId"),
      workflowRunId: input.workflowRunId,
    },
  };
}

function isWorkerEvidenceOutcome(
  value: string | undefined,
): value is AgentQueueWorkerEvidenceOutcome {
  return value === "completed" || value === "not_completed" || value === "failed";
}

function workerEvidenceStatusForRecordResult(
  result: AgentQueueWorkflowWorkerEvidenceRecordResult,
): QueueWorkflowWorkerEvidenceStatus {
  if (result.status === "recorded") return "evidence_recorded";
  if (result.status === "already_recorded") return "evidence_already_recorded";
  if (result.status === "conflict") return "blocked_evidence_conflict";
  return workerEvidenceBlockedStatus(
    blockerReasonFromEvidenceCode(result.blocker?.blockerCode),
  );
}

function workerEvidenceBlockedStatus(
  reasonCode: QueueWorkflowRunnerBlockerReason,
): QueueWorkflowWorkerEvidenceStatus {
  if (reasonCode === "worker_not_complete") return "blocked_worker_not_complete";
  if (reasonCode === "worker_evidence_missing_task") return "blocked_missing_task";
  if (reasonCode === "worker_evidence_missing_run") return "blocked_missing_run";
  if (reasonCode === "worker_evidence_conflict") return "blocked_evidence_conflict";
  return "blocked_evidence_missing";
}

function workerEvidenceBlockerFromRecordResult(
  result: AgentQueueWorkflowWorkerEvidenceRecordResult,
  request: QueueWorkflowResolvedWorkerEvidenceInput,
): QueueWorkflowRunnerBlocker {
  const reasonCode =
    result.status === "conflict"
      ? "worker_evidence_conflict"
      : blockerReasonFromEvidenceCode(result.blocker?.blockerCode);
  return {
    fieldPath: result.blocker?.missingRequiredField ?? "$.inputs.workerEvidence",
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue worker evidence recording returned ${result.status}.`,
    reasonCode,
    slot: request.slot,
    taskId: request.taskId,
  };
}

function blockerReasonFromEvidenceCode(
  code: string | null | undefined,
): QueueWorkflowRunnerBlockerReason {
  switch (code) {
    case "missing_task_binding":
    case "slot_task_mismatch":
      return "worker_evidence_missing_task";
    case "missing_run_binding":
    case "run_missing":
    case "slot_run_mismatch":
      return "worker_evidence_missing_run";
    case "worker_not_complete":
      return "worker_not_complete";
    case "ambiguous_worker_state":
      return "worker_state_ambiguous";
    case "evidence_conflict":
    case "evidence_metadata_conflict":
    case "record_worker_evidence_action_ref_conflict":
    case "record_worker_evidence_action_result_conflict":
      return "worker_evidence_conflict";
    case "invalid_worker_evidence":
      return "worker_evidence_invalid_input";
    default:
      return "worker_evidence_blocked";
  }
}

function setWorkerEvidenceSlotVariables(
  variables: QueueWorkflowVariables,
  binding: {
    evidenceBundleId: string;
    runId: string;
    slot: string;
    taskId: string;
  },
) {
  const current = variables.slots[binding.slot] ?? { slot: binding.slot };
  const next = {
    ...current,
    evidenceBundleId: binding.evidenceBundleId,
    runId: binding.runId,
    slot: binding.slot,
    taskId: binding.taskId,
  };
  variables.slots[binding.slot] = next;
  variables.evidenceBundleIdsBySlot[binding.slot] = binding.evidenceBundleId;
  variables.runIdsBySlot[binding.slot] = binding.runId;
  variables.taskIdsBySlot[binding.slot] = binding.taskId;
}

function validateCreateSetupStartRunnerBoundary({
  request,
  validation,
  workflowRunId,
}: QueueWorkflowCreateSetupStartRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue create/setup/start workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.status === "input_validation_deferred") {
    return {
      fieldPath: "$.workflowId",
      message:
        "Queue create/setup/start workflow runner requires fully validated dependency workflow inputs.",
      reasonCode: "input_validation_deferred",
    };
  }

  if (!validation.ok) {
    return {
      fieldPath: validation.fieldPath,
      message: validation.message,
      reasonCode: "invalid_request",
    };
  }

  if (validation.status !== "workflow_valid_not_executable") {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow request has not passed Queue workflow validation.",
      reasonCode: "invalid_request",
    };
  }

  if (!DEPENDENCY_WORKFLOWS.has(request.workflowId)) {
    return {
      fieldPath: "$.workflowId",
      message: `${request.workflowId} is not supported by the Queue create/setup/start workflow runner.`,
      reasonCode: "workflow_not_supported_read_only",
    };
  }

  if (!workflowRunId.trim()) {
    return {
      fieldPath: "$.metadata.workflowRunId",
      message: "Queue create/setup/start workflow runner requires a durable workflowRunId.",
      reasonCode: "missing_workflow_run_id",
    };
  }

  return null;
}

function resolveCreateSetupStartInput(
  request: QueueWorkflowRunnerRequest,
): QueueWorkflowCreateSetupStartInputResolution {
  const upstream = resolveTaskSlotInput(request, "upstream");
  if (!upstream.ok) {
    return upstream;
  }
  const downstream = resolveTaskSlotInput(request, "downstream");
  if (!downstream.ok) {
    return downstream;
  }
  if (!downstream.value.dependsOnSlots.includes("upstream")) {
    return {
      blocker: {
        fieldPath: "$.inputs.tasks",
        message:
          "Queue create/setup/start requires downstream.dependsOnSlots to explicitly include upstream.",
        reasonCode: "blocked_materialization",
        slot: "downstream",
      },
      ok: false,
    };
  }

  const runSettings = resolveRunSettingsInput(request);
  if (!runSettings.ok) {
    return runSettings;
  }

  return {
    ok: true,
    value: {
      downstream: downstream.value,
      expectedQueueControlVersion: runSettings.value.expectedQueueControlVersion,
      runSettings: runSettings.value.runSettings,
      stderrCapBytes: runSettings.value.stderrCapBytes,
      stdoutCapBytes: runSettings.value.stdoutCapBytes,
      timeoutMs: runSettings.value.timeoutMs,
      upstream: upstream.value,
    },
  };
}

function resolveTaskSlotInput(
  request: QueueWorkflowRunnerRequest,
  slot: "downstream" | "upstream",
):
  | { ok: true; value: QueueWorkflowResolvedTaskSlotInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false } {
  const tasks = Array.isArray(request.inputs?.tasks) ? request.inputs.tasks : [];
  const task = tasks.find(
    (candidate) =>
      isRecord(candidate) && cleanString(candidate.slot) === slot,
  );
  if (!isRecord(task)) {
    return {
      blocker: {
        fieldPath: "$.inputs.tasks",
        message: `Queue create/setup/start requires typed taskSpec for slot ${slot}.`,
        reasonCode: "missing_task_spec",
        slot,
      },
      ok: false,
    };
  }

  const title = cleanString(task.title);
  const prompt = cleanString(task.prompt);
  if (!title || !prompt) {
    return {
      blocker: {
        fieldPath: "$.inputs.tasks",
        message: `Queue create/setup/start requires non-empty title and prompt for slot ${slot}.`,
        reasonCode: "missing_task_spec",
        slot,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      dependsOnSlots: stringArray(task.dependsOnSlots),
      taskSpec: stripUndefined({
        description: cleanString(task.description) ?? null,
        priority: numberInput(task.priority),
        prompt,
        status: cleanString(task.status) ?? null,
        title,
      }),
      taskSpecHash: cleanString(task.taskSpecHash) ?? null,
    },
  };
}

function resolveRunSettingsInput(
  request: QueueWorkflowRunnerRequest,
):
  | { ok: true; value: QueueWorkflowResolvedRunSettingsInput }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false } {
  const runSettingsInput = recordRecord(request.inputs, "runSettings");
  if (!runSettingsInput) {
    return {
      blocker: {
        fieldPath: "$.inputs.runSettings",
        message: "Queue create/setup/start requires typed upstream runSettings.",
        reasonCode: "missing_run_settings",
      },
      ok: false,
    };
  }

  const codexExecutable = recordString(runSettingsInput, "codexExecutable");
  const executionWorkspace = recordString(runSettingsInput, "workspaceRoot");
  const sandbox = recordString(runSettingsInput, "sandbox");
  const approvalPolicy = recordString(runSettingsInput, "approvalPolicy");
  const executionPolicy = recordString(runSettingsInput, "executionPolicy");
  const executorWidgetId = recordString(runSettingsInput, "executorWidgetId");
  if (
    !codexExecutable ||
    !executionWorkspace ||
    !sandbox ||
    !approvalPolicy ||
    !executionPolicy ||
    !executorWidgetId
  ) {
    return {
      blocker: {
        fieldPath: "$.inputs.runSettings",
        message:
          "Queue create/setup/start requires codexExecutable, workspaceRoot, sandbox, approvalPolicy, executionPolicy, and executorWidgetId.",
        reasonCode: "missing_run_settings",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      expectedQueueControlVersion: numberInput(
        runSettingsInput.expectedQueueControlVersion ??
          request.inputs?.expectedQueueControlVersion,
      ),
      runSettings: {
        approvalPolicy,
        codexExecutable,
        executionPolicy,
        executionWorkspace,
        executorWidgetId,
        sandbox,
      },
      stderrCapBytes: numberInput(runSettingsInput.stderrCapBytes),
      stdoutCapBytes: numberInput(runSettingsInput.stdoutCapBytes),
      timeoutMs: numberInput(runSettingsInput.timeoutMs),
    },
  };
}

function resolveCreateSetupStartConfirmation(
  request: QueueWorkflowRunnerRequest,
): QueueWorkflowCreateSetupStartConfirmationResolution {
  const token = cleanString(request.grant?.confirmationToken);
  if (!token) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue worker start requires exact structured confirmationToken.",
        reasonCode: "start_confirmation_required",
      },
      ok: false,
    };
  }

  if (token !== QUEUE_FINALIZATION_CONFIRMATION_TOKEN) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue worker start confirmationToken must exactly equal operator-confirmed.",
        reasonCode: "start_confirmation_invalid",
      },
      ok: false,
    };
  }

  return { ok: true, token };
}

function updateCreateSetupStartReportMaterialize(
  report: QueueWorkflowCreateSetupStartReport,
  materialize: AgentQueueWorkflowMaterializeTaskSlotResult,
  slot: string,
): QueueWorkflowCreateSetupStartReport {
  const binding = materialize.binding;
  return stripUndefined({
    ...report,
    downstreamTaskId:
      slot === "downstream" ? binding?.taskId : report.downstreamTaskId,
    materializedSlots: {
      ...report.materializedSlots,
      [slot]: stripUndefined({
        dependencyTaskIds: binding?.dependencyTaskIds,
        dependsOnSlots: binding?.dependsOnSlots,
        status: materialize.status,
        taskId: binding?.taskId,
        taskSpecHash: binding?.taskSpecHash,
      }),
    },
    upstreamTaskId:
      slot === "upstream" ? binding?.taskId : report.upstreamTaskId,
  });
}

function updateCreateSetupStartReportRunSettings(
  report: QueueWorkflowCreateSetupStartReport,
  setup: AgentQueueWorkflowApplyRunSettingsResult,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...report,
    runSettings: stripUndefined({
      executorWidgetId: setup.binding?.executorWidgetId,
      settingsHash: setup.binding?.settingsHash,
      slot: setup.binding?.slot ?? "upstream",
      status: setup.status,
      taskId: setup.binding?.taskId,
    }),
  };
}

function updateCreateSetupStartReportPromote(
  report: QueueWorkflowCreateSetupStartReport,
  promote: AgentQueueWorkflowPromoteTaskSlotResult,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...report,
    promote: stripUndefined({
      slot: promote.binding?.slot ?? "upstream",
      status: promote.status,
      taskId: promote.binding?.taskId,
    }),
  };
}

function updateCreateSetupStartReportStart(
  report: QueueWorkflowCreateSetupStartReport,
  start: StartAssignedAgentQueueTaskResponse,
  fallbackTaskId: string,
): QueueWorkflowCreateSetupStartReport {
  return {
    ...report,
    start: stripUndefined({
      actionIdempotencyKey: start.actionIdempotencyKey,
      runId: start.runId,
      status: start.status,
      taskId: start.queueItemId || fallbackTaskId,
    }),
  };
}

function blockerForMaterializeResult(
  result: AgentQueueWorkflowMaterializeTaskSlotResult,
  slot: string,
): QueueWorkflowRunnerBlocker | null {
  if ((result.status === "created" || result.status === "reused") && result.binding) {
    return null;
  }
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue workflow task slot ${slot} materialization stopped with status ${result.status}.`,
    reasonCode: "blocked_materialization",
    slot,
    taskId: result.binding?.taskId ?? result.task?.queueItemId,
  };
}

function blockerForApplyRunSettingsResult(
  result: AgentQueueWorkflowApplyRunSettingsResult,
): QueueWorkflowRunnerBlocker | null {
  if ((result.status === "applied" || result.status === "reused") && result.binding) {
    return null;
  }
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue workflow run settings stopped with status ${result.status}.`,
    reasonCode: "blocked_setup",
    slot: "upstream",
    taskId: result.binding?.taskId ?? result.task?.queueItemId,
  };
}

function blockerForPromoteResult(
  result: AgentQueueWorkflowPromoteTaskSlotResult,
): QueueWorkflowRunnerBlocker | null {
  if ((result.status === "promoted" || result.status === "reused") && result.binding) {
    return null;
  }
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      result.conflict?.conflictMessage ??
      `Queue workflow promote stopped with status ${result.status}.`,
    reasonCode: "blocked_setup",
    slot: "upstream",
    taskId: result.binding?.taskId ?? result.task?.queueItemId,
  };
}

function blockerForStartResult(
  result: StartAssignedAgentQueueTaskResponse,
): QueueWorkflowRunnerBlocker | null {
  if (
    (result.status === "started" || result.status === "already_started") &&
    result.runId
  ) {
    return null;
  }

  const blockerCode = result.blocker?.blockerCode;
  return {
    fieldPath: result.blocker?.missingRequiredField ?? undefined,
    message:
      result.blocker?.blockerMessage ??
      `Queue workflow worker start stopped with status ${result.status}.`,
    reasonCode:
      blockerCode === "orphaned_start" || blockerCode === "start_state_unknown"
        ? "worker_start_orphan"
        : "blocked_worker_start",
    taskId: result.queueItemId,
  };
}

function blockerForCreateSetupStartError(error: unknown): QueueWorkflowRunnerBlocker {
  return {
    message:
      error instanceof Error
        ? error.message
        : "Queue workflow create/setup/start failed unexpectedly.",
    reasonCode: "blocked_worker_start",
  };
}

function setMaterializedSlotVariables(
  variables: QueueWorkflowVariables,
  binding: NonNullable<AgentQueueWorkflowMaterializeTaskSlotResult["binding"]>,
) {
  const current = variables.slots[binding.slot] ?? { slot: binding.slot };
  variables.slots[binding.slot] = stripUndefined({
    ...current,
    taskId: binding.taskId,
    taskSpecHash: binding.taskSpecHash,
  });
  variables.taskIdsBySlot[binding.slot] = binding.taskId;
  if (!variables.scopedTaskIds.includes(binding.taskId)) {
    variables.scopedTaskIds.push(binding.taskId);
  }
}

function setRunSettingsSlotVariables(
  variables: QueueWorkflowVariables,
  binding: NonNullable<AgentQueueWorkflowApplyRunSettingsResult["binding"]>,
) {
  const current = variables.slots[binding.slot] ?? { slot: binding.slot };
  variables.slots[binding.slot] = stripUndefined({
    ...current,
    executorWidgetId: binding.executorWidgetId,
    settingsHash: binding.settingsHash,
    taskId: binding.taskId,
  });
  variables.taskIdsBySlot[binding.slot] = binding.taskId;
}

function setStartedSlotVariables(
  variables: QueueWorkflowVariables,
  slot: string,
  start: StartAssignedAgentQueueTaskResponse,
) {
  const current = variables.slots[slot] ?? { slot };
  variables.slots[slot] = stripUndefined({
    ...current,
    runId: start.runId,
    taskId: start.queueItemId,
  });
  variables.runIdsBySlot[slot] = start.runId;
  if (!variables.scopedRunIds.includes(start.runId)) {
    variables.scopedRunIds.push(start.runId);
  }
}

function workflowStartIdempotencyKey({
  executorWidgetId,
  settingsHash,
  taskId,
  workflowRunId,
}: {
  executorWidgetId: string;
  settingsHash: string;
  taskId: string;
  workflowRunId: string;
}) {
  return `${workflowRunId}:start_worker:${taskId}:${executorWidgetId}:${settingsHash}`;
}

function createSetupStartSummary({
  report,
  workflowId,
}: {
  report: QueueWorkflowCreateSetupStartReport;
  workflowId: string;
}) {
  const control = report.queueControl?.status ?? "unknown";
  const runId = report.start?.runId ?? "no-run";
  return [
    `Queue workflow ${workflowId} run ${report.workflowRunId ?? "unknown"} reached awaiting_worker_completion.`,
    `Tasks: upstream=${report.upstreamTaskId ?? "missing"}, downstream=${report.downstreamTaskId ?? "missing"}.`,
    `Settings=${report.runSettings?.status ?? "missing"}, promote=${report.promote?.status ?? "missing"}, Queue control=${control}, worker=${report.start?.status ?? "missing"} runId=${runId}.`,
    "Paused before evidence recording; review/finalization/downstream start were not run.",
  ].join(" ");
}

function materializeVerb(status: string) {
  return status === "created" ? "created" : "reused";
}

function setupVerb(status: string) {
  return status === "applied" ? "applied" : "reused";
}

function promoteVerb(status: string) {
  return status === "promoted" ? "promoted" : "reused";
}

export async function runQueueWorkflowReviewRunner(
  input: QueueWorkflowReviewRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };

  const validationBlocker = validateReviewRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "validate",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_review_request",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status: "invalid_request",
      steps,
      variables,
    });
  }

  if (!REVIEW_WORKFLOWS.has(input.request.workflowId)) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.workflowId",
      message: `${input.request.workflowId} is not supported by the Queue review workflow runner.`,
      reasonCode: "review_not_supported_for_workflow",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "select_review_workflow",
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReport({
        status: "review_not_supported_for_workflow",
        supportedWorkflow: false,
      }),
      status: "review_not_supported_for_workflow",
      steps,
      variables,
    });
  }

  const target = resolveReviewTarget(input.request, variables);
  if (!target.ok) {
    blockers.push(target.blocker);
    pushStep(steps, events, {
      message: target.blocker.message,
      phase: "review",
      reasonCode: target.blocker.reasonCode,
      slot: target.blocker.slot,
      status: "blocked",
      stepId: "resolve_review_target",
      taskId: target.blocker.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: target.blocker.message,
      reviewReport: reviewReport({
        status: "review_blocked_missing_task_or_run",
        supportedWorkflow: true,
        targetSlot: target.blocker.slot,
        taskId: target.blocker.taskId,
      }),
      status: "review_blocked_missing_task_or_run",
      steps,
      variables,
    });
  }

  const reviewReportDraft = reviewReport({
    evidenceBundleId: target.value.evidenceBundleId,
    messageId: target.value.messageId,
    runId: target.value.runId,
    status: null,
    supportedWorkflow: true,
    targetSlot: target.value.targetSlot,
    taskId: target.value.taskId,
  });

  if (!input.readPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow read port is unavailable.",
      reasonCode: "read_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_review_read_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReportDraft,
      status: "unavailable",
      steps,
      variables,
    });
  }

  if (!input.reviewPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow review port is unavailable.",
      reasonCode: "review_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_review_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReportDraft,
      status: "unavailable",
      steps,
      variables,
    });
  }

  try {
    await readTaskSnapshots({
      events,
      readPort: input.readPort,
      steps,
      taskIds: [target.value.taskId],
      variables,
    });

    const aggregateBlockers = missingAggregateBlockersForReads(variables, [
      target.value.taskId,
    ]);
    if (aggregateBlockers.length > 0) {
      blockers.push(...aggregateBlockers);
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary:
          "Queue review workflow blocked because the explicit task aggregate was not found.",
        reviewReport: reviewReportDraft,
        status: "blocked",
        steps,
        variables,
      });
    }

    const evidence = await resolveReviewEvidence({
      events,
      readPort: input.readPort,
      steps,
      target: target.value,
      variables,
    });
    reviewReportDraft.evidenceState = evidence.evidenceState;
    if (!evidence.ok) {
      blockers.push(evidence.blocker);
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: evidence.blocker.message,
        reviewReport: reviewReport({
          ...reviewReportDraft,
          status: "review_blocked_missing_evidence",
        }),
        status: "review_blocked_missing_evidence",
        steps,
        variables,
      });
    }

    reviewReportDraft.evidenceBundleId = evidence.evidenceBundleId;
    reviewReportDraft.runId = evidence.runId;
    setSlotVariable(variables, target.value.targetSlot, {
      evidenceBundleId: evidence.evidenceBundleId,
      runId: evidence.runId,
    });

    let messageId = target.value.messageId;
    let createStatus: QueueWorkflowReviewReport["createStatus"] =
      messageId ? "skipped_existing_message" : undefined;
    let idempotentCreate = false;

    if (messageId) {
      pushStep(steps, events, {
        message:
          "Skipped review message creation because a typed messageId was already supplied.",
        messageId,
        phase: "review",
        status: "skipped",
        stepId: `skip_review_create:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
    } else {
      const createResult = await input.reviewPort.createReviewMessage(
        stripUndefined({
          evidenceBundleId: evidence.evidenceBundleId,
          messageBody: target.value.messageBody,
          runId: evidence.runId,
          taskId: target.value.taskId,
        }),
      );
      createStatus = createResult.status;
      reviewReportDraft.createStatus = createStatus;

      if (createResult.status === "succeeded") {
        messageId = cleanString(createResult.messageId);
        if (!messageId) {
          const blocker: QueueWorkflowRunnerBlocker = {
            message:
              "Queue review create succeeded without returning a messageId.",
            reasonCode: "failed_unexpected",
            taskId: target.value.taskId,
          };
          blockers.push(blocker);
          pushStep(steps, events, {
            message: blocker.message,
            phase: "review",
            reasonCode: blocker.reasonCode,
            status: "failed_unexpected",
            stepId: `create_review_missing_message:${target.value.taskId}`,
            taskId: target.value.taskId,
          });
          return result({
            blockers,
            events,
            mutationSummary,
            readOnly: false,
            reportSummary: blocker.message,
            reviewReport: reviewReport({
              ...reviewReportDraft,
              status: "review_completed",
            }),
            status: "failed_unexpected",
            steps,
            variables,
          });
        }
        mutationSummary.didCreateReviewMessage = true;
        mutationSummary.didMutateQueue = true;
        pushStep(steps, events, {
          evidenceBundleId: evidence.evidenceBundleId,
          message: "Queue review message created.",
          messageId,
          phase: "review",
          runId: evidence.runId,
          status: "completed",
          stepId: `create_review:${target.value.taskId}`,
          taskId: target.value.taskId,
        });
      } else if (createResult.status === "already_exists") {
        messageId = messageIdFromCreateResult(createResult);
        idempotentCreate = true;
        if (!messageId) {
          const blocker: QueueWorkflowRunnerBlocker = {
            message:
              createResult.message ??
              "Queue review message already exists, but no existing messageId was returned.",
            reasonCode: "review_message_already_exists",
            taskId: target.value.taskId,
          };
          blockers.push(blocker);
          pushStep(steps, events, {
            message: blocker.message,
            phase: "review",
            reasonCode: blocker.reasonCode,
            status: "blocked",
            stepId: `create_review_already_exists_missing_message:${target.value.taskId}`,
            taskId: target.value.taskId,
          });
          return result({
            blockers,
            events,
            mutationSummary,
            readOnly: false,
            reportSummary: blocker.message,
            reviewReport: reviewReport({
              ...reviewReportDraft,
              createStatus,
              idempotentCreate,
              status: "review_message_already_exists",
            }),
            status: "review_message_already_exists",
            steps,
            variables,
          });
        }
        pushStep(steps, events, {
          evidenceBundleId: evidence.evidenceBundleId,
          message: "Queue review message already exists; using existing messageId.",
          messageId,
          phase: "review",
          reasonCode: "review_message_already_exists",
          runId: evidence.runId,
          status: "completed",
          stepId: `create_review_already_exists:${target.value.taskId}`,
          taskId: target.value.taskId,
        });
      } else {
        const blocker = blockerForCreateReviewResult(
          createResult,
          target.value.taskId,
        );
        blockers.push(blocker);
        pushStep(steps, events, {
          evidenceBundleId: evidence.evidenceBundleId,
          message: blocker.message,
          phase: "review",
          reasonCode: blocker.reasonCode,
          runId: evidence.runId,
          status:
            createResult.status === "failed_unexpected"
              ? "failed_unexpected"
              : "blocked",
          stepId: `create_review_blocked:${target.value.taskId}`,
          taskId: target.value.taskId,
        });
        return result({
          blockers,
          events,
          mutationSummary,
          readOnly: false,
          reportSummary: blocker.message,
          reviewReport: reviewReport({
            ...reviewReportDraft,
            createStatus,
            status: null,
          }),
          status:
            createResult.status === "failed_unexpected"
              ? "failed_unexpected"
              : createResult.status === "unavailable"
                ? "unavailable"
                : "blocked",
          steps,
          variables,
        });
      }
    }

    if (!messageId) {
      const blocker: QueueWorkflowRunnerBlocker = {
        message: "Queue review ACK requires messageId.",
        reasonCode: "review_ack_missing_message_id",
        taskId: target.value.taskId,
      };
      blockers.push(blocker);
      pushStep(steps, events, {
        message: blocker.message,
        phase: "review",
        reasonCode: blocker.reasonCode,
        status: "blocked",
        stepId: `ack_review_missing_message:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary: blocker.message,
        reviewReport: reviewReport({
          ...reviewReportDraft,
          createStatus,
          idempotentCreate,
          status: "review_completed",
        }),
        status: "blocked",
        steps,
        variables,
      });
    }

    reviewReportDraft.messageId = messageId;
    setSlotVariable(variables, target.value.targetSlot, { messageId });

    const ackResult = await input.reviewPort.ackReviewMessage({
      messageId,
      taskId: target.value.taskId,
    });
    const idempotentAck =
      ackResult.status === "already_done" || ackResult.status === "already_exists";

    if (ackResult.status === "succeeded" || idempotentAck) {
      if (ackResult.status === "succeeded") {
        mutationSummary.didAckReview = true;
        mutationSummary.didMutateQueue = true;
      }
      pushStep(steps, events, {
        message:
          ackResult.status === "succeeded"
            ? "Queue review acknowledged."
            : "Queue review ACK is already durable; treating as idempotent.",
        messageId,
        phase: "review",
        reasonCode: idempotentAck ? "review_ack_already_done" : undefined,
        status: "completed",
        stepId: `ack_review:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
      return result({
        blockers,
        events,
        mutationSummary,
        readOnly: false,
        reportSummary:
          "Queue review workflow acknowledged review message without finalization.",
        reviewReport: reviewReport({
          ...reviewReportDraft,
          ackStatus: ackResult.status,
          createStatus,
          idempotentAck,
          idempotentCreate,
          messageId,
          status: "review_acknowledged",
        }),
        status: "review_acknowledged",
        steps,
        variables,
      });
    }

    const blocker = blockerForAckReviewResult(ackResult, target.value.taskId);
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      messageId,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status:
        ackResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : "blocked",
      stepId: `ack_review_blocked:${target.value.taskId}`,
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReport({
        ...reviewReportDraft,
        ackStatus: ackResult.status,
        createStatus,
        idempotentCreate,
        messageId,
        status: "review_completed",
      }),
      status:
        ackResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : ackResult.status === "unavailable"
            ? "unavailable"
            : "blocked",
      steps,
      variables,
    });
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue review workflow failed unexpectedly.",
      reasonCode: "failed_unexpected",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "review",
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "review_failed",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      reviewReport: reviewReport({
        ...reviewReportDraft,
        status: null,
      }),
      status: "failed_unexpected",
      steps,
      variables,
    });
  }
}

export async function runQueueWorkflowFinalizationRunner(
  input: QueueWorkflowFinalizationRunnerInput,
): Promise<QueueWorkflowRunnerResult> {
  const steps: QueueWorkflowRunnerStep[] = [];
  const events: QueueWorkflowRunnerEvent[] = [];
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  const variables = buildVariables(input.request);
  const mutationSummary = { ...MUTATION_SUMMARY };

  const validationBlocker = validateFinalizationRunnerBoundary(input);
  if (validationBlocker) {
    blockers.push(validationBlocker);
    pushStep(steps, events, {
      message: validationBlocker.message,
      phase: "validate",
      reasonCode: validationBlocker.reasonCode,
      status: "blocked",
      stepId: "validate_finalization_request",
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        status: "finalization_invalid_input",
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: validationBlocker.message,
      status: "finalization_invalid_input",
      steps,
      variables,
    });
  }

  if (!DEPENDENCY_WORKFLOWS.has(input.request.workflowId)) {
    const blocker: QueueWorkflowRunnerBlocker = {
      fieldPath: "$.workflowId",
      message: `${input.request.workflowId} is not supported by the Queue finalization workflow runner.`,
      reasonCode: "finalization_not_supported_for_workflow",
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status: "blocked",
      stepId: "select_finalization_workflow",
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        status: "finalization_not_supported_for_workflow",
        supportedWorkflow: false,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "finalization_not_supported_for_workflow",
      steps,
      variables,
    });
  }

  const target = resolveFinalizationTarget(input.request, variables);
  if (!target.ok) {
    blockers.push(target.blocker);
    pushStep(steps, events, {
      message: target.blocker.message,
      phase: "finalization",
      reasonCode: target.blocker.reasonCode,
      slot: target.blocker.slot,
      status: "blocked",
      stepId: "resolve_finalization_target",
      taskId: target.blocker.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        finalizationAction:
          input.request.workflowId === "dependency_failure_smoke"
            ? "fail"
            : "mark_done",
        status: "finalization_blocked",
        supportedWorkflow: true,
        targetSlot: target.blocker.slot,
        taskId: target.blocker.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: target.blocker.message,
      status: "finalization_blocked",
      steps,
      variables,
    });
  }

  const confirmation = resolveFinalizationConfirmation(input.request);
  if (!confirmation.ok) {
    blockers.push(confirmation.blocker);
    pushStep(steps, events, {
      message: confirmation.blocker.message,
      phase: "finalization",
      reasonCode: confirmation.blocker.reasonCode,
      status:
        confirmation.status === "finalization_needs_confirmation"
          ? "paused"
          : "blocked",
      stepId: `confirm_finalization:${target.value.taskId}`,
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        failureReason: target.value.failureReason,
        finalizationAction: target.value.action,
        status: confirmation.status,
        supportedWorkflow: true,
        targetSlot: target.value.targetSlot,
        taskId: target.value.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: confirmation.blocker.message,
      status: confirmation.status,
      steps,
      variables,
    });
  }

  if (!input.readPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow read port is unavailable.",
      reasonCode: "read_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_finalization_read_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        failureReason: target.value.failureReason,
        finalizationAction: target.value.action,
        status: "finalization_blocked",
        supportedWorkflow: true,
        targetSlot: target.value.targetSlot,
        taskId: target.value.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  if (!input.finalizationPort) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue workflow finalization port is unavailable.",
      reasonCode: "finalization_port_unavailable",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: "open_finalization_port",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        failureReason: target.value.failureReason,
        finalizationAction: target.value.action,
        status: "finalization_blocked",
        supportedWorkflow: true,
        targetSlot: target.value.targetSlot,
        taskId: target.value.taskId,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "unavailable",
      steps,
      variables,
    });
  }

  const baseFinalizationReport = finalizationReport({
    confirmationTokenAccepted: true,
    failureReason: target.value.failureReason,
    finalizationAction: target.value.action,
    supportedWorkflow: true,
    targetSlot: target.value.targetSlot,
    taskId: target.value.taskId,
  });

  try {
    await readTaskSnapshots({
      events,
      readPort: input.readPort,
      steps,
      taskIds: [target.value.taskId],
      variables,
    });

    const aggregateBlockers = missingAggregateBlockersForReads(variables, [
      target.value.taskId,
    ]);
    if (aggregateBlockers.length > 0) {
      blockers.push(...aggregateBlockers);
      return result({
        blockers,
        events,
        finalizationReport: {
          ...baseFinalizationReport,
          status: "finalization_blocked",
        },
        mutationSummary,
        readOnly: false,
        reportSummary:
          "Queue finalization workflow blocked because the explicit upstream aggregate was not found.",
        status: "finalization_blocked",
        steps,
        variables,
      });
    }

    const reviewPrecondition = reviewAcknowledgedForFinalization({
      request: input.request,
      snapshot: snapshotForTask(variables, target.value.taskId),
      target: target.value,
    });
    if (!reviewPrecondition.ok) {
      blockers.push(reviewPrecondition.blocker);
      pushStep(steps, events, {
        message: reviewPrecondition.blocker.message,
        phase: "finalization",
        reasonCode: reviewPrecondition.blocker.reasonCode,
        status: "blocked",
        stepId: `check_review_ack:${target.value.taskId}`,
        taskId: target.value.taskId,
      });
      return result({
        blockers,
        events,
        finalizationReport: {
          ...baseFinalizationReport,
          status: "finalization_blocked",
        },
        mutationSummary,
        readOnly: false,
        reportSummary: reviewPrecondition.blocker.message,
        status: "finalization_blocked",
        steps,
        variables,
      });
    }

    const commandResult =
      target.value.action === "mark_done"
        ? await input.finalizationPort.markDone(
            stripUndefined({
              confirmationToken: confirmation.token,
              messageId: target.value.messageId,
              reason: target.value.reason,
              runId: target.value.runId,
              taskId: target.value.taskId,
            }),
          )
        : await input.finalizationPort.failItem(
            stripUndefined({
              confirmationToken: confirmation.token,
              evidenceBundleId: target.value.evidenceBundleId,
              messageId: target.value.messageId,
              reason: target.value.failureReason!,
              runId: target.value.runId,
              taskId: target.value.taskId,
            }),
          );

    if (commandResult.aggregate) {
      variables.readSnapshots.aggregatesByTaskId[target.value.taskId] =
        commandResult.aggregate;
      variables.readSnapshots.lifecycleByTaskId[target.value.taskId] =
        commandResult.aggregate;
    }

    const status = finalizationStatusForCommandResult(
      commandResult.status,
      target.value.action,
    );
    const idempotent =
      status === "finalization_already_done" ||
      status === "finalization_already_failed";

    if (
      status === "finalization_completed" ||
      status === "finalization_already_done" ||
      status === "finalization_already_failed"
    ) {
      if (commandResult.status === "succeeded") {
        if (target.value.action === "mark_done") {
          mutationSummary.didMarkDone = true;
        } else {
          mutationSummary.didFail = true;
        }
        mutationSummary.didMutateQueue = true;
      }

      pushStep(steps, events, {
        message: finalizationSuccessMessage(commandResult.status, target.value.action),
        phase: "finalization",
        status: "completed",
        stepId: `${target.value.action}:${target.value.taskId}`,
        taskId: target.value.taskId,
      });

      const downstreamVerification = await verifyDownstreamAfterFinalization({
        action: target.value.action,
        downstreamTaskId: target.value.downstreamTaskId,
        events,
        readPort: input.readPort,
        steps,
        variables,
      });

      return result({
        blockers,
        events,
        finalizationReport: finalizationReport({
          ...baseFinalizationReport,
          commandStatus: commandResult.status,
          downstreamVerification,
          idempotent,
          status,
        }),
        mutationSummary,
        readOnly: false,
        reportSummary:
          target.value.action === "mark_done"
            ? "Queue acceptance finalization completed for explicit upstream task."
            : "Queue failure finalization completed for explicit upstream task.",
        status,
        steps,
        variables,
      });
    }

    const blocker = blockerForFinalizationResult(
      commandResult,
      target.value.action,
      target.value.taskId,
    );
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status:
        status === "finalization_failed_unexpected"
          ? "failed_unexpected"
          : "blocked",
      stepId: `${target.value.action}_blocked:${target.value.taskId}`,
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        ...baseFinalizationReport,
        commandStatus: commandResult.status,
        status:
          status === "unavailable" ? "finalization_blocked" : status,
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status,
      steps,
      variables,
    });
  } catch (error) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        error instanceof Error
          ? error.message
          : "Queue finalization workflow failed unexpectedly.",
      reasonCode: "failed_unexpected",
      taskId: target.value.taskId,
    };
    blockers.push(blocker);
    pushStep(steps, events, {
      message: blocker.message,
      phase: "finalization",
      reasonCode: blocker.reasonCode,
      status: "failed_unexpected",
      stepId: "finalization_failed",
      taskId: target.value.taskId,
    });
    return result({
      blockers,
      events,
      finalizationReport: finalizationReport({
        ...baseFinalizationReport,
        status: "finalization_failed_unexpected",
      }),
      mutationSummary,
      readOnly: false,
      reportSummary: blocker.message,
      status: "finalization_failed_unexpected",
      steps,
      variables,
    });
  }
}

type QueueWorkflowFinalizationAction = "fail" | "mark_done";

type QueueWorkflowFinalizationTarget = {
  action: QueueWorkflowFinalizationAction;
  downstreamTaskId?: string;
  evidenceBundleId?: string;
  failureReason?: string;
  messageId?: string;
  reason?: string;
  runId?: string;
  targetSlot: "upstream";
  taskId: string;
};

type QueueWorkflowFinalizationTargetResolution =
  | { ok: true; value: QueueWorkflowFinalizationTarget }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowFinalizationConfirmationResolution =
  | { ok: true; token: string }
  | {
      blocker: QueueWorkflowRunnerBlocker;
      ok: false;
      status: "finalization_invalid_input" | "finalization_needs_confirmation";
    };

type QueueWorkflowReviewPreconditionResolution =
  | { ok: true }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowReviewTarget = {
  evidenceBundleId?: string;
  messageBody?: string;
  messageId?: string;
  runId?: string;
  targetSlot?: string;
  taskId: string;
};

type QueueWorkflowReviewTargetResolution =
  | { ok: true; value: QueueWorkflowReviewTarget }
  | { blocker: QueueWorkflowRunnerBlocker; ok: false };

type QueueWorkflowReviewEvidenceResolution =
  | {
      evidenceBundleId: string;
      evidenceState: string;
      ok: true;
      runId?: string;
    }
  | {
      blocker: QueueWorkflowRunnerBlocker;
      evidenceState: string;
      ok: false;
    };

function validateReviewRunnerBoundary({
  request,
  validation,
}: QueueWorkflowReviewRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue review workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.status === "input_validation_deferred") {
    return null;
  }

  if (!validation.ok) {
    return {
      fieldPath: validation.fieldPath,
      message: validation.message,
      reasonCode: "invalid_request",
    };
  }

  if (validation.status !== "workflow_valid_not_executable") {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow request has not passed Queue workflow validation.",
      reasonCode: "invalid_request",
    };
  }

  return null;
}

function resolveReviewTarget(
  request: QueueWorkflowRunnerRequest,
  variables: QueueWorkflowVariables,
): QueueWorkflowReviewTargetResolution {
  if (DEPENDENCY_WORKFLOWS.has(request.workflowId)) {
    const slot = variables.slots.upstream;
    const taskId = slot?.taskId;
    if (!taskId) {
      return {
        blocker: {
          fieldPath: "$.inputs.taskIdsBySlot.upstream",
          message:
            "Queue dependency review phase requires explicit upstream taskId.",
          reasonCode: "review_blocked_missing_task_or_run",
          slot: "upstream",
        },
        ok: false,
      };
    }

    if (!slot.runId && !slot.evidenceBundleId) {
      return {
        blocker: {
          fieldPath: "$.inputs.runIdsBySlot.upstream",
          message:
            "Queue dependency review phase requires explicit upstream runId or evidenceBundleId.",
          reasonCode: "review_blocked_missing_task_or_run",
          slot: "upstream",
          taskId,
        },
        ok: false,
      };
    }

    return {
      ok: true,
      value: stripUndefined({
        evidenceBundleId: slot.evidenceBundleId,
        messageId: slot.messageId,
        runId: slot.runId,
        targetSlot: "upstream",
        taskId,
      }),
    };
  }

  if (request.workflowId === "review_acceptance") {
    const inputs = request.inputs;
    const taskId = firstString(
      recordString(inputs, "taskId"),
      recordString(recordRecord(inputs, "task"), "taskId"),
      recordString(recordRecord(inputs, "workerEvidence"), "taskId"),
      recordString(recordRecord(inputs, "reviewMessage"), "taskId"),
    );
    if (!taskId) {
      return {
        blocker: {
          fieldPath: "$.inputs.taskId",
          message:
            "Queue review_acceptance phase requires explicit taskId.",
          reasonCode: "review_blocked_missing_task_or_run",
        },
        ok: false,
      };
    }

    const runId = firstString(
      recordString(inputs, "runId"),
      recordString(recordRecord(inputs, "task"), "runId"),
      recordString(recordRecord(inputs, "workerEvidence"), "runId"),
      recordString(recordRecord(inputs, "reviewMessage"), "runId"),
    );
    const evidenceBundleId = firstString(
      recordString(inputs, "evidenceBundleId"),
      recordString(recordRecord(inputs, "workerEvidence"), "evidenceBundleId"),
      recordString(recordRecord(inputs, "reviewMessage"), "evidenceBundleId"),
    );
    if (!runId && !evidenceBundleId) {
      return {
        blocker: {
          fieldPath: "$.inputs.runId",
          message:
            "Queue review_acceptance phase requires explicit runId or evidenceBundleId.",
          reasonCode: "review_blocked_missing_task_or_run",
          taskId,
        },
        ok: false,
      };
    }

    return {
      ok: true,
      value: stripUndefined({
        evidenceBundleId,
        messageBody: firstString(
          recordString(inputs, "messageBody"),
          recordString(recordRecord(inputs, "reviewMessage"), "messageBody"),
        ),
        messageId: firstString(
          recordString(inputs, "messageId"),
          recordString(recordRecord(inputs, "reviewMessage"), "messageId"),
        ),
        runId,
        targetSlot: "review",
        taskId,
      }),
    };
  }

  return {
    blocker: {
      fieldPath: "$.workflowId",
      message: `${request.workflowId} is not supported by the Queue review workflow runner.`,
      reasonCode: "review_not_supported_for_workflow",
    },
    ok: false,
  };
}

async function resolveReviewEvidence({
  events,
  readPort,
  steps,
  target,
  variables,
}: {
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  steps: QueueWorkflowRunnerStep[];
  target: QueueWorkflowReviewTarget;
  variables: QueueWorkflowVariables;
}): Promise<QueueWorkflowReviewEvidenceResolution> {
  if (!readPort.getEvidenceBundle) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue evidence read API is unavailable.",
      reasonCode: "evidence_read_unavailable",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      status: "unavailable",
      stepId: `read_review_evidence_unavailable:${target.taskId}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState: "unavailable", ok: false };
  }

  const evidenceRequest = stripUndefined({
    evidenceBundleId: target.evidenceBundleId,
    runId: target.runId,
    taskId: target.taskId,
  });
  const evidence = await readPort.getEvidenceBundle(evidenceRequest);
  variables.readSnapshots.evidenceByKey[evidenceKey(evidenceRequest)] =
    evidence;

  const evidenceState = evidence?.state ?? "missing";
  const bundle = evidence?.evidenceBundle ?? null;
  if (evidenceState !== "available" || !bundle) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        evidenceState === "missing"
          ? "Queue review evidence was not returned."
          : `Queue review evidence is not available: ${evidenceState}.`,
      reasonCode: "review_blocked_missing_evidence",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      evidenceBundleId: target.evidenceBundleId,
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      runId: target.runId,
      status: "blocked",
      stepId: `read_review_evidence:${evidenceKey(evidenceRequest)}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState, ok: false };
  }

  if (target.evidenceBundleId && bundle.bundleId !== target.evidenceBundleId) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message:
        "Queue review evidence bundle did not match the explicit evidenceBundleId.",
      reasonCode: "review_blocked_missing_evidence",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      evidenceBundleId: target.evidenceBundleId,
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      runId: target.runId,
      status: "blocked",
      stepId: `read_review_evidence_mismatch:${evidenceKey(evidenceRequest)}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState, ok: false };
  }

  if (target.runId && bundle.runId !== target.runId) {
    const blocker: QueueWorkflowRunnerBlocker = {
      message: "Queue review evidence run did not match the explicit runId.",
      reasonCode: "review_blocked_missing_evidence",
      taskId: target.taskId,
    };
    pushStep(steps, events, {
      evidenceBundleId: bundle.bundleId,
      message: blocker.message,
      phase: "read",
      reasonCode: blocker.reasonCode,
      runId: target.runId,
      status: "blocked",
      stepId: `read_review_evidence_run_mismatch:${evidenceKey(evidenceRequest)}`,
      taskId: target.taskId,
    });
    return { blocker, evidenceState, ok: false };
  }

  pushStep(steps, events, {
    evidenceBundleId: bundle.bundleId,
    message: "Queue review evidence bundle read from backend.",
    phase: "read",
    runId: bundle.runId,
    status: "completed",
    stepId: `read_review_evidence:${evidenceKey(evidenceRequest)}`,
    taskId: target.taskId,
  });

  return {
    evidenceBundleId: bundle.bundleId,
    evidenceState,
    ok: true,
    runId: bundle.runId,
  };
}

function blockerForCreateReviewResult(
  createResult: QueueWorkflowCreateReviewMessageResult,
  taskId: string,
): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: createResult.fieldPath,
    message:
      createResult.message ??
      createResult.blocker?.blockerMessage ??
      `Queue review message creation stopped with status ${createResult.status}.`,
    reasonCode:
      createResult.status === "invalid_input"
        ? "review_create_invalid_input"
        : createResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : "review_create_blocked",
    taskId,
  };
}

function blockerForAckReviewResult(
  ackResult: QueueWorkflowAckReviewMessageResult,
  taskId: string,
): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: ackResult.fieldPath,
    message:
      ackResult.message ??
      `Queue review ACK stopped with status ${ackResult.status}.`,
    reasonCode:
      ackResult.status === "invalid_input"
        ? "review_ack_invalid_input"
        : ackResult.status === "failed_unexpected"
          ? "failed_unexpected"
          : "review_ack_blocked",
    taskId,
  };
}

function messageIdFromCreateResult(
  createResult: QueueWorkflowCreateReviewMessageResult,
): string | undefined {
  return (
    cleanString(createResult.messageId) ??
    cleanString(createResult.existingMessageId) ??
    cleanString(createResult.blocker?.existingMessageId)
  );
}

function reviewReport(
  report: Partial<QueueWorkflowReviewReport>,
): QueueWorkflowReviewReport {
  return {
    ...EMPTY_REVIEW_REPORT,
    ...stripUndefined(report),
  };
}

function finalizationReport(
  report: Partial<QueueWorkflowFinalizationReport>,
): QueueWorkflowFinalizationReport {
  return {
    ...EMPTY_FINALIZATION_REPORT,
    ...stripUndefined(report),
    downstreamVerification: {
      ...EMPTY_DOWNSTREAM_VERIFICATION,
      ...stripUndefined(report.downstreamVerification ?? {}),
    },
  };
}

function validateFinalizationRunnerBoundary({
  request,
  validation,
}: QueueWorkflowFinalizationRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue finalization workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.status === "input_validation_deferred") {
    return null;
  }

  if (!validation.ok) {
    if (onlyMissingFailureReason(validation)) {
      return null;
    }
    return {
      fieldPath: validation.fieldPath,
      message: validation.message,
      reasonCode: "invalid_request",
    };
  }

  if (validation.status !== "workflow_valid_not_executable") {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow request has not passed Queue workflow validation.",
      reasonCode: "invalid_request",
    };
  }

  return null;
}

function onlyMissingFailureReason(
  validation: QueueWorkflowRequestValidationResult,
): boolean {
  if (validation.ok || !("issues" in validation)) {
    return false;
  }
  return (
    validation.workflowId === "dependency_failure_smoke" &&
    validation.issues.length > 0 &&
    validation.issues.every(
      (issue) =>
        issue.fieldPath === "$.inputs.failureReason" &&
        issue.reasonCode === "missing_required_input",
    )
  );
}

function resolveFinalizationTarget(
  request: QueueWorkflowRunnerRequest,
  variables: QueueWorkflowVariables,
): QueueWorkflowFinalizationTargetResolution {
  const slot = variables.slots.upstream;
  const taskId = slot?.taskId;
  if (!taskId) {
    return {
      blocker: {
        fieldPath: "$.inputs.taskIdsBySlot.upstream",
        message:
          "Queue dependency finalization phase requires explicit upstream taskId.",
        reasonCode: "finalization_missing_upstream_task_id",
        slot: "upstream",
      },
      ok: false,
    };
  }

  if (request.workflowId === "dependency_acceptance_smoke") {
    return {
      ok: true,
      value: stripUndefined({
        action: "mark_done",
        downstreamTaskId: variables.slots.downstream?.taskId,
        messageId: slot.messageId,
        reason: finalizationReason(request),
        runId: slot.runId,
        targetSlot: "upstream",
        taskId,
      }),
    };
  }

  if (request.workflowId === "dependency_failure_smoke") {
    const failureReason = finalizationFailureReason(request);
    if (!failureReason) {
      return {
        blocker: {
          fieldPath: "$.inputs.failureReason",
          message:
            "Queue dependency failure finalization requires explicit failureReason.",
          reasonCode: "finalization_missing_failure_reason",
          slot: "upstream",
          taskId,
        },
        ok: false,
      };
    }

    return {
      ok: true,
      value: stripUndefined({
        action: "fail",
        downstreamTaskId: variables.slots.downstream?.taskId,
        evidenceBundleId: slot.evidenceBundleId,
        failureReason,
        messageId: slot.messageId,
        runId: slot.runId,
        targetSlot: "upstream",
        taskId,
      }),
    };
  }

  return {
    blocker: {
      fieldPath: "$.workflowId",
      message: `${request.workflowId} is not supported by the Queue finalization workflow runner.`,
      reasonCode: "finalization_not_supported_for_workflow",
    },
    ok: false,
  };
}

function resolveFinalizationConfirmation(
  request: QueueWorkflowRunnerRequest,
): QueueWorkflowFinalizationConfirmationResolution {
  const token = cleanString(request.grant?.confirmationToken);
  if (!token) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue finalization requires exact structured confirmationToken.",
        reasonCode: "finalization_confirmation_required",
      },
      ok: false,
      status: "finalization_needs_confirmation",
    };
  }

  if (token !== QUEUE_FINALIZATION_CONFIRMATION_TOKEN) {
    return {
      blocker: {
        fieldPath: "$.grant.confirmationToken",
        message:
          "Queue finalization confirmationToken must exactly equal operator-confirmed.",
        reasonCode: "finalization_confirmation_invalid",
      },
      ok: false,
      status: "finalization_invalid_input",
    };
  }

  return { ok: true, token };
}

function reviewAcknowledgedForFinalization({
  request,
  snapshot,
  target,
}: {
  request: QueueWorkflowRunnerRequest;
  snapshot: QueueWorkflowLifecycleSnapshot | null;
  target: QueueWorkflowFinalizationTarget;
}): QueueWorkflowReviewPreconditionResolution {
  if (explicitReviewAcknowledged(request, target.targetSlot)) {
    return { ok: true };
  }

  const reviewState = snapshotString(snapshot, "reviewState");
  const allowedStates =
    target.action === "mark_done"
      ? ["done", "in_review", "reviewed"]
      : ["failed", "in_review", "reviewed"];
  if (reviewState && allowedStates.includes(reviewState)) {
    return { ok: true };
  }

  return {
    blocker: {
      fieldPath: "$.inputs.reviewAcknowledgedBySlot.upstream",
      message:
        "Queue finalization requires an ACKed review state for the explicit upstream task.",
      reasonCode: "finalization_review_ack_required",
      slot: target.targetSlot,
      taskId: target.taskId,
    },
    ok: false,
  };
}

async function verifyDownstreamAfterFinalization({
  action,
  downstreamTaskId,
  events,
  readPort,
  steps,
  variables,
}: {
  action: QueueWorkflowFinalizationAction;
  downstreamTaskId?: string;
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
}): Promise<QueueWorkflowDownstreamVerificationReport> {
  if (!downstreamTaskId) {
    return {
      ...EMPTY_DOWNSTREAM_VERIFICATION,
      missingReason: "missing_downstream_task_id",
      verificationMissing: true,
    };
  }

  const aggregate = await readPort.getQueueItemAggregate(downstreamTaskId);
  variables.readSnapshots.aggregatesByTaskId[downstreamTaskId] = aggregate;
  pushStep(steps, events, {
    message: aggregate
      ? `Read downstream Queue aggregate for ${downstreamTaskId}.`
      : `Downstream Queue aggregate not found for ${downstreamTaskId}.`,
    phase: "verification",
    reasonCode: aggregate ? undefined : "aggregate_not_found",
    status: aggregate ? "completed" : "blocked",
    stepId: `verify_downstream_aggregate:${downstreamTaskId}`,
    taskId: downstreamTaskId,
  });

  const lifecycle = readPort.getLifecycle
    ? await readPort.getLifecycle(downstreamTaskId)
    : aggregate;
  variables.readSnapshots.lifecycleByTaskId[downstreamTaskId] = lifecycle;
  pushStep(steps, events, {
    message: lifecycle
      ? `Read downstream Queue lifecycle for ${downstreamTaskId}.`
      : `Downstream Queue lifecycle not found for ${downstreamTaskId}.`,
    phase: "verification",
    reasonCode: lifecycle ? undefined : "aggregate_not_found",
    status: lifecycle ? "completed" : "blocked",
    stepId: `verify_downstream_lifecycle:${downstreamTaskId}`,
    taskId: downstreamTaskId,
  });

  const snapshot = lifecycle ?? aggregate;
  if (!snapshot) {
    return {
      ...EMPTY_DOWNSTREAM_VERIFICATION,
      missingReason: "snapshot_unavailable",
      taskId: downstreamTaskId,
      verificationMissing: true,
    };
  }

  const dependencyState = snapshotString(snapshot, "dependencyState");
  const workerRunState = snapshotString(snapshot, "workerRunState");
  const expectedDependencyState =
    action === "mark_done" ? "ready" : "failed_upstream";
  const dependencyVerified = dependencyState
    ? action === "mark_done"
      ? dependencyState === "ready" || dependencyState === "none"
      : dependencyState === "failed_upstream"
    : null;
  const notAutoStartedVerified = workerRunState
    ? workerRunState === "not_started"
    : null;

  return stripUndefined({
    dependencyState,
    dependencyVerified,
    expectedDependencyState,
    notAutoStartedVerified,
    snapshot,
    taskId: downstreamTaskId,
    verificationMissing: false,
    workerRunState,
  });
}

function finalizationStatusForCommandResult(
  status: QueueWorkflowFinalizationCommandStatus,
  action: QueueWorkflowFinalizationAction,
): QueueWorkflowFinalizationStatus | "unavailable" {
  if (status === "succeeded") {
    return "finalization_completed";
  }
  if (status === "already_done") {
    return action === "mark_done"
      ? "finalization_already_done"
      : "finalization_blocked";
  }
  if (status === "already_failed") {
    return action === "fail"
      ? "finalization_already_failed"
      : "finalization_blocked";
  }
  if (status === "invalid_input") {
    return "finalization_invalid_input";
  }
  if (status === "needs_confirmation") {
    return "finalization_needs_confirmation";
  }
  if (status === "failed_unexpected") {
    return "finalization_failed_unexpected";
  }
  if (status === "unavailable") {
    return "unavailable";
  }
  return "finalization_blocked";
}

function blockerForFinalizationResult(
  commandResult: QueueWorkflowFinalizationCommandResult,
  action: QueueWorkflowFinalizationAction,
  taskId: string,
): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: commandResult.fieldPath,
    message:
      commandResult.message ??
      commandResult.blocker?.blockerMessage ??
      `Queue ${finalizationActionLabel(action)} finalization stopped with status ${commandResult.status}.`,
    reasonCode:
      commandResult.status === "invalid_input"
        ? "finalization_invalid_input"
        : commandResult.status === "needs_confirmation"
          ? "finalization_confirmation_required"
          : commandResult.status === "policy_blocked"
            ? "finalization_policy_blocked"
            : commandResult.status === "failed_unexpected"
              ? "failed_unexpected"
              : "finalization_command_blocked",
    taskId,
  };
}

function finalizationSuccessMessage(
  status: QueueWorkflowFinalizationCommandStatus,
  action: QueueWorkflowFinalizationAction,
): string {
  if (status === "already_done" || status === "already_failed") {
    return `Queue ${finalizationActionLabel(action)} finalization is already durable; treating as idempotent.`;
  }
  return `Queue ${finalizationActionLabel(action)} finalization completed.`;
}

function finalizationActionLabel(action: QueueWorkflowFinalizationAction) {
  return action === "mark_done" ? "accepted completion" : "terminal failure";
}

function finalizationReason(
  request: QueueWorkflowRunnerRequest,
): string | undefined {
  const finalizationInput = recordRecord(request.inputs, "finalization");
  return firstString(
    recordString(finalizationInput, "reason"),
    recordString(request.inputs, "reason"),
  );
}

function finalizationFailureReason(
  request: QueueWorkflowRunnerRequest,
): string | undefined {
  const finalizationInput = recordRecord(request.inputs, "finalization");
  return firstString(
    recordString(finalizationInput, "failureReason"),
    recordString(finalizationInput, "reason"),
    recordString(request.inputs, "failureReason"),
  );
}

function explicitReviewAcknowledged(
  request: QueueWorkflowRunnerRequest,
  slot: string,
): boolean {
  return booleanRecord(request.inputs?.reviewAcknowledgedBySlot)[slot] === true;
}

function snapshotForTask(
  variables: QueueWorkflowVariables,
  taskId: string,
): QueueWorkflowLifecycleSnapshot | null {
  return (
    variables.readSnapshots.lifecycleByTaskId[taskId] ??
    variables.readSnapshots.aggregatesByTaskId[taskId] ??
    null
  );
}

function snapshotString(
  snapshot: QueueWorkflowLifecycleSnapshot | null | undefined,
  fieldName: "dependencyState" | "reviewState" | "ticketState" | "workerRunState",
): string | undefined {
  if (!snapshot) {
    return undefined;
  }
  const snapshotRecord = snapshot as Record<string, unknown>;
  const aggregate = snapshotRecord["aggregate"];
  if (isRecord(aggregate)) {
    return recordString(aggregate, fieldName);
  }
  return recordString(snapshotRecord, fieldName);
}

function setSlotVariable(
  variables: QueueWorkflowVariables,
  slot: string | undefined,
  values: Pick<
    QueueWorkflowSlotVariables,
    "evidenceBundleId" | "messageId" | "runId"
  >,
) {
  if (!slot) {
    return;
  }

  const current = variables.slots[slot] ?? { slot };
  const next = stripUndefined({
    ...current,
    evidenceBundleId: values.evidenceBundleId ?? current.evidenceBundleId,
    messageId: values.messageId ?? current.messageId,
    runId: values.runId ?? current.runId,
    slot,
  });
  variables.slots[slot] = next;
  if (next.evidenceBundleId) {
    variables.evidenceBundleIdsBySlot[slot] = next.evidenceBundleId;
  }
  if (next.messageId) {
    variables.messageIdsBySlot[slot] = next.messageId;
  }
  if (next.runId) {
    variables.runIdsBySlot[slot] = next.runId;
  }
}

function validateRunnerBoundary({
  request,
  validation,
}: QueueWorkflowRunnerInput): QueueWorkflowRunnerBlocker | null {
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return {
      fieldPath: "$.moduleId",
      message: "Queue workflow runner only accepts moduleId queue.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.workflowId !== request.workflowId) {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow validation result does not match the request workflowId.",
      reasonCode: "invalid_request",
    };
  }

  if (validation.status === "input_validation_deferred") {
    return null;
  }

  if (!validation.ok) {
    return {
      fieldPath: validation.fieldPath,
      message: validation.message,
      reasonCode: "invalid_request",
    };
  }

  if (validation.status !== "workflow_valid_not_executable") {
    return {
      fieldPath: "$.workflowId",
      message: "Queue workflow request has not passed Queue workflow validation.",
      reasonCode: "invalid_request",
    };
  }

  return null;
}

function blockerForDeferredWorkflow(workflowId: string): QueueWorkflowRunnerBlocker {
  return {
    fieldPath: "$.inputs",
    message: `${workflowId} input validation is deferred; the read-only runner will not inspect or execute it yet.`,
    reasonCode: "input_validation_deferred",
  };
}

async function readTaskSnapshots({
  events,
  readPort,
  steps,
  taskIds,
  variables,
}: {
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  steps: QueueWorkflowRunnerStep[];
  taskIds: readonly string[];
  variables: QueueWorkflowVariables;
}) {
  for (const taskId of taskIds) {
    const aggregate = await readPort.getQueueItemAggregate(taskId);
    variables.readSnapshots.aggregatesByTaskId[taskId] = aggregate;
    pushStep(steps, events, {
      message: aggregate
        ? `Read Queue aggregate for ${taskId}.`
        : `Queue aggregate not found for ${taskId}.`,
      reasonCode: aggregate ? undefined : "aggregate_not_found",
      status: aggregate ? "completed" : "blocked",
      stepId: `read_aggregate:${taskId}`,
      taskId,
    });

    const lifecycle = readPort.getLifecycle
      ? await readPort.getLifecycle(taskId)
      : aggregate;
    variables.readSnapshots.lifecycleByTaskId[taskId] = lifecycle;
    pushStep(steps, events, {
      message: lifecycle
        ? `Read Queue lifecycle for ${taskId}.`
        : `Queue lifecycle not found for ${taskId}.`,
      reasonCode: lifecycle ? undefined : "aggregate_not_found",
      status: lifecycle ? "completed" : "blocked",
      stepId: `read_lifecycle:${taskId}`,
      taskId,
    });
  }
}

async function readEvidenceSnapshots({
  events,
  readPort,
  request,
  steps,
  variables,
}: {
  events: QueueWorkflowRunnerEvent[];
  readPort: QueueWorkflowReadPort;
  request: QueueWorkflowRunnerRequest;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
}): Promise<QueueWorkflowRunnerBlocker[]> {
  const evidenceRequests = explicitEvidenceRequests(request, variables);
  const blockers: QueueWorkflowRunnerBlocker[] = [];

  for (const evidenceRequest of evidenceRequests) {
    if (!evidenceRequest.runId && !evidenceRequest.evidenceBundleId) {
      blockers.push({
        fieldPath: "$.inputs.evidenceReads",
        message:
          "Evidence inspection requires explicit taskId plus runId or evidenceBundleId.",
        reasonCode: "missing_explicit_evidence_ids",
        taskId: evidenceRequest.taskId,
      });
      pushStep(steps, events, {
        message:
          "Skipped evidence read because explicit runId or evidenceBundleId was missing.",
        reasonCode: "missing_explicit_evidence_ids",
        status: "paused",
        stepId: `skip_evidence:${evidenceRequest.taskId}`,
        taskId: evidenceRequest.taskId,
      });
      continue;
    }

    if (!readPort.getEvidenceBundle) {
      blockers.push({
        message: "Queue evidence read API is unavailable.",
        reasonCode: "evidence_read_unavailable",
        taskId: evidenceRequest.taskId,
      });
      pushStep(steps, events, {
        message: "Queue evidence read API is unavailable.",
        reasonCode: "evidence_read_unavailable",
        status: "unavailable",
        stepId: `read_evidence_unavailable:${evidenceRequest.taskId}`,
        taskId: evidenceRequest.taskId,
      });
      continue;
    }

    const evidence = await readPort.getEvidenceBundle(evidenceRequest);
    variables.readSnapshots.evidenceByKey[evidenceKey(evidenceRequest)] =
      evidence;
    pushStep(steps, events, {
      evidenceBundleId: evidenceRequest.evidenceBundleId,
      message: evidence
        ? `Read Queue evidence for ${evidenceRequest.taskId}.`
        : `Queue evidence not found for ${evidenceRequest.taskId}.`,
      runId: evidenceRequest.runId,
      status: "completed",
      stepId: `read_evidence:${evidenceKey(evidenceRequest)}`,
      taskId: evidenceRequest.taskId,
    });
  }

  return blockers;
}

function buildVariables(request: QueueWorkflowRunnerRequest): QueueWorkflowVariables {
  const taskIdsBySlot = stringRecord(request.inputs?.taskIdsBySlot);
  const runIdsBySlot = stringRecord(request.inputs?.runIdsBySlot);
  const evidenceBundleIdsBySlot = stringRecord(
    request.inputs?.evidenceBundleIdsBySlot,
  );
  const messageIdsBySlot = stringRecord(request.inputs?.messageIdsBySlot);
  const slots = slotVariables({
    evidenceBundleIdsBySlot,
    inputs: request.inputs,
    messageIdsBySlot,
    runIdsBySlot,
    taskIdsBySlot,
  });

  return {
    evidenceBundleIdsBySlot,
    messageIdsBySlot,
    readSnapshots: {
      aggregatesByTaskId: {},
      evidenceByKey: {},
      lifecycleByTaskId: {},
    },
    requestId: request.requestId,
    runIdsBySlot,
    scopedEvidenceBundleIds: stringArray(request.grant?.scope?.evidenceBundleIds),
    scopedMessageIds: stringArray(request.grant?.scope?.messageIds),
    scopedRunIds: stringArray(request.grant?.scope?.runIds),
    scopedTaskIds: stringArray(request.grant?.scope?.taskIds),
    slots,
    taskIdsBySlot,
    workflowId: request.workflowId,
  };
}

function slotVariables({
  evidenceBundleIdsBySlot,
  inputs,
  messageIdsBySlot,
  runIdsBySlot,
  taskIdsBySlot,
}: {
  evidenceBundleIdsBySlot: Record<string, string>;
  inputs?: WorkflowInputs;
  messageIdsBySlot: Record<string, string>;
  runIdsBySlot: Record<string, string>;
  taskIdsBySlot: Record<string, string>;
}): Record<string, QueueWorkflowSlotVariables> {
  const slots = new Set<string>();
  const taskTemplates = Array.isArray(inputs?.tasks) ? inputs.tasks : [];

  for (const task of taskTemplates) {
    if (isRecord(task) && typeof task.slot === "string" && task.slot.trim()) {
      slots.add(task.slot.trim());
    }
  }
  for (const slot of Object.keys(taskIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(runIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(evidenceBundleIdsBySlot)) slots.add(slot);
  for (const slot of Object.keys(messageIdsBySlot)) slots.add(slot);

  const variables: Record<string, QueueWorkflowSlotVariables> = {};
  for (const slot of slots) {
    variables[slot] = stripUndefined({
      evidenceBundleId: evidenceBundleIdsBySlot[slot],
      messageId: messageIdsBySlot[slot],
      runId: runIdsBySlot[slot],
      slot,
      taskId: taskIdsBySlot[slot],
    });
  }

  return variables;
}

function explicitReadTaskIds(variables: QueueWorkflowVariables): string[] {
  return uniqueStrings([
    ...Object.values(variables.taskIdsBySlot),
    ...variables.scopedTaskIds,
  ]);
}

function missingDependencySlotBlockers(
  variables: QueueWorkflowVariables,
): QueueWorkflowRunnerBlocker[] {
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  for (const slot of DEPENDENCY_REQUIRED_SLOTS) {
    if (!variables.taskIdsBySlot[slot]) {
      blockers.push({
        fieldPath: `$.inputs.taskIdsBySlot.${slot}`,
        message: `Read-only dependency workflow inspection requires explicit existing task id for slot ${slot}.`,
        reasonCode: "missing_explicit_task_ids",
        slot,
      });
    }
  }

  return blockers;
}

function explicitEvidenceRequests(
  request: QueueWorkflowRunnerRequest,
  variables: QueueWorkflowVariables,
): QueueWorkflowEvidenceReadRequest[] {
  const requests: QueueWorkflowEvidenceReadRequest[] = [];
  const evidenceReads = Array.isArray(request.inputs?.evidenceReads)
    ? request.inputs.evidenceReads
    : [];

  for (const item of evidenceReads) {
    if (!isRecord(item) || !nonEmptyString(item.taskId)) {
      continue;
    }
    requests.push(
      stripUndefined({
        evidenceBundleId: nonEmptyString(item.evidenceBundleId)
          ? item.evidenceBundleId.trim()
          : undefined,
        runId: nonEmptyString(item.runId) ? item.runId.trim() : undefined,
        taskId: item.taskId.trim(),
      }),
    );
  }

  for (const slot of Object.values(variables.slots)) {
    if (!slot.taskId || (!slot.runId && !slot.evidenceBundleId)) {
      continue;
    }
    requests.push(
      stripUndefined({
        evidenceBundleId: slot.evidenceBundleId,
        runId: slot.runId,
        taskId: slot.taskId,
      }),
    );
  }

  return uniqueEvidenceRequests(requests);
}

function missingAggregateBlockersForReads(
  variables: QueueWorkflowVariables,
  taskIds: readonly string[],
): QueueWorkflowRunnerBlocker[] {
  const blockers: QueueWorkflowRunnerBlocker[] = [];
  for (const taskId of taskIds) {
    if (variables.readSnapshots.aggregatesByTaskId[taskId] === null) {
      blockers.push({
        message: `Queue aggregate not found for explicit task id ${taskId}.`,
        reasonCode: "aggregate_not_found",
        taskId,
      });
    }
  }
  return blockers;
}

function finalStatus(
  blockers: readonly QueueWorkflowRunnerBlocker[],
): QueueWorkflowRunnerStatus {
  if (blockers.length === 0) {
    return "completed";
  }
  if (
    blockers.some((blocker) =>
      [
        "input_validation_deferred",
        "missing_explicit_evidence_ids",
        "missing_explicit_task_ids",
        "read_only_runner_requires_existing_tasks",
      ].includes(blocker.reasonCode),
    )
  ) {
    return "paused";
  }
  if (
    blockers.some((blocker) =>
      ["evidence_read_unavailable", "read_port_unavailable"].includes(
        blocker.reasonCode,
      ),
    )
  ) {
    return "unavailable";
  }
  if (
    blockers.some((blocker) => blocker.reasonCode === "failed_unexpected")
  ) {
    return "failed_unexpected";
  }
  return "blocked";
}

function result({
  blockers,
  createSetupStartReport = EMPTY_CREATE_SETUP_START_REPORT,
  events,
  finalizationReport = EMPTY_FINALIZATION_REPORT,
  mutationSummary = MUTATION_SUMMARY,
  readOnly = true,
  reportSummary,
  reviewReport = EMPTY_REVIEW_REPORT,
  status,
  steps,
  variables,
  workerEvidenceReport = EMPTY_WORKER_EVIDENCE_REPORT,
}: {
  blockers: QueueWorkflowRunnerBlocker[];
  createSetupStartReport?: QueueWorkflowCreateSetupStartReport;
  events: QueueWorkflowRunnerEvent[];
  finalizationReport?: QueueWorkflowFinalizationReport;
  mutationSummary?: QueueWorkflowRunnerReport["mutationSummary"];
  readOnly?: boolean;
  reportSummary: string;
  reviewReport?: QueueWorkflowReviewReport;
  status: QueueWorkflowRunnerStatus;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
  workerEvidenceReport?: QueueWorkflowWorkerEvidenceReport;
}): QueueWorkflowRunnerResult {
  const evidenceReads = Object.keys(variables.readSnapshots.evidenceByKey).map(
    evidenceRequestFromKey,
  );

  return {
    blockers,
    events,
    report: {
      createSetupStart: { ...createSetupStartReport },
      evidenceReads,
      finalization: { ...finalizationReport },
      missingExplicitIds: blockers
        .filter((blocker) =>
          [
            "missing_explicit_evidence_ids",
            "missing_explicit_task_ids",
            "read_only_runner_requires_existing_tasks",
          ].includes(blocker.reasonCode),
        )
        .map((blocker) => blocker.fieldPath ?? blocker.reasonCode),
      mutationSummary: { ...mutationSummary },
      nextMutatingPhase: nextMutatingPhase(variables.workflowId),
      readOnly,
      review: { ...reviewReport },
      summary: reportSummary,
      taskReads: Object.keys(variables.readSnapshots.aggregatesByTaskId),
      workerEvidence: { ...workerEvidenceReport },
    },
    requestId: variables.requestId,
    status,
    steps,
    variables,
    workflowId: variables.workflowId,
  };
}

function nextMutatingPhase(workflowId: string): string | null {
  switch (workflowId as QueueWorkflowId) {
    case "dependency_acceptance_smoke":
      return "Create/setup/start can materialize dependency slots, apply upstream settings, promote upstream, start the explicit upstream worker, and pause awaiting worker completion; worker evidence, review, and accepted-completion finalization remain separate typed phases.";
    case "dependency_failure_smoke":
      return "Create/setup/start can materialize dependency slots, apply upstream settings, promote upstream, start the explicit upstream worker, and pause awaiting worker completion; worker evidence, review, and terminal-failure finalization remain separate typed phases.";
    case "review_acceptance":
    case "terminal_failure":
      return null;
  }
}

function pushStep(
  steps: QueueWorkflowRunnerStep[],
  events: QueueWorkflowRunnerEvent[],
  step: QueueWorkflowRunnerStep,
) {
  steps.push(stripUndefined(step));
  events.push(
    stripUndefined({
      message: step.message,
      phase: step.phase,
      reasonCode: step.reasonCode,
      slot: step.slot,
      status: step.status,
      taskId: step.taskId,
    }),
  );
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.trim()) {
      record[key] = item.trim();
    }
  }
  return record;
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  const record: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "boolean") {
      record[key] = item;
    }
  }
  return record;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueEvidenceRequests(
  requests: readonly QueueWorkflowEvidenceReadRequest[],
): QueueWorkflowEvidenceReadRequest[] {
  const seen = new Set<string>();
  const unique: QueueWorkflowEvidenceReadRequest[] = [];
  for (const request of requests) {
    const key = evidenceKey(request);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(request);
  }
  return unique;
}

function evidenceKey(request: QueueWorkflowEvidenceReadRequest): string {
  return [
    request.taskId,
    request.runId ?? "",
    request.evidenceBundleId ?? "",
  ].join("|");
}

function evidenceRequestFromKey(key: string): QueueWorkflowEvidenceReadRequest {
  const [taskId = "", runId = "", evidenceBundleId = ""] = key.split("|");
  return stripUndefined({
    evidenceBundleId: evidenceBundleId || undefined,
    runId: runId || undefined,
    taskId,
  });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function numberInput(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstString(
  ...values: readonly (string | null | undefined)[]
): string | undefined {
  return values.find((value): value is string => Boolean(value));
}

function recordString(
  value: unknown,
  fieldName: string,
): string | undefined {
  return isRecord(value) ? cleanString(value[fieldName]) : undefined;
}

function recordRecord(
  value: unknown,
  fieldName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[fieldName];
  return isRecord(fieldValue) ? fieldValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
