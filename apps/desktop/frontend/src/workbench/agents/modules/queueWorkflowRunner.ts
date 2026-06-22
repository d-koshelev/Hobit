import type {
  WorkflowGrant,
  WorkflowInputs,
} from "../broker/workflowGrantInputSplit";
import type {
  AgentQueueItemAggregate,
  AgentQueueReviewCreateMessageBlocker,
  AgentQueueReviewMessage,
  AgentQueueWorkerEvidenceQueryResult,
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
  | QueueWorkflowFinalizationStatus
  | QueueWorkflowReviewStatus;

export type QueueWorkflowReviewStatus =
  | "review_acknowledged"
  | "review_blocked_missing_evidence"
  | "review_blocked_missing_task_or_run"
  | "review_completed"
  | "review_message_already_exists"
  | "review_not_supported_for_workflow";

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
  | "missing_explicit_evidence_ids"
  | "missing_explicit_task_ids"
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
  | "validate"
  | "verification";

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

export type QueueWorkflowRunnerRequest = {
  grant?: WorkflowGrant;
  inputs?: WorkflowInputs;
  moduleId: string;
  requestId: string;
  workflowId: string;
};

export type QueueWorkflowSlotVariables = {
  evidenceBundleId?: string;
  messageId?: string;
  runId?: string;
  slot: string;
  taskId?: string;
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
  events,
  finalizationReport = EMPTY_FINALIZATION_REPORT,
  mutationSummary = MUTATION_SUMMARY,
  readOnly = true,
  reportSummary,
  reviewReport = EMPTY_REVIEW_REPORT,
  status,
  steps,
  variables,
}: {
  blockers: QueueWorkflowRunnerBlocker[];
  events: QueueWorkflowRunnerEvent[];
  finalizationReport?: QueueWorkflowFinalizationReport;
  mutationSummary?: QueueWorkflowRunnerReport["mutationSummary"];
  readOnly?: boolean;
  reportSummary: string;
  reviewReport?: QueueWorkflowReviewReport;
  status: QueueWorkflowRunnerStatus;
  steps: QueueWorkflowRunnerStep[];
  variables: QueueWorkflowVariables;
}): QueueWorkflowRunnerResult {
  const evidenceReads = Object.keys(variables.readSnapshots.evidenceByKey).map(
    evidenceRequestFromKey,
  );

  return {
    blockers,
    events,
    report: {
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
      return "Create/setup/run/evidence phases remain deferred; current explicit runner helpers can inspect Queue state, mutate review message/ACK ledger, or finalize upstream accepted completion when separately invoked with typed ids and confirmation.";
    case "dependency_failure_smoke":
      return "Create/setup/run/evidence phases remain deferred; current explicit runner helpers can inspect Queue state, mutate review message/ACK ledger, or finalize upstream terminal failure when separately invoked with typed ids, failure reason, and confirmation.";
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
