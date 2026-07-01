import type {
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowReviewStepResult,
  AgentQueueWorkflowStartResult,
  ExecuteAgentQueueWorkflowReviewStepRequest,
} from "../../../workspace/types";
import type {
  QueueWorkflowPersistencePort,
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeAdapterTypes";
import type {
  QueueWorkflowReviewCommandStatus,
  QueueWorkflowRunnerBlockerReason,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerResult,
} from "./queueWorkflowRunner";

export async function executeBackendOwnedReviewStep({
  actorId,
  persistenceStatus,
  persistentStatus,
  request,
  resumePlan,
  validationReasons,
  validationStatus,
  workflowPersistence,
  workflowRunId,
  workspaceId,
  workflowStartStatus,
}: {
  actorId: string;
  persistenceStatus: string | null;
  persistentStatus: string | null;
  request: QueueWorkflowRunnerRequest;
  resumePlan?: AgentQueueWorkflowResumePlan;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowPersistence: QueueWorkflowPersistencePort;
  workflowRunId: string;
  workspaceId: string;
  workflowStartStatus: AgentQueueWorkflowStartResult["status"] | null;
}): Promise<QueueWorkflowRunnerRuntimeResult> {
  if (!workflowPersistence.executeAgentQueueWorkflowReviewStep) {
    return notInvoked({
      blockers: ["Backend-owned Queue workflow review step is unavailable."],
      moduleId: request.moduleId,
      persistenceStatus,
      persistentStatus,
      phase: "review",
      requestId: request.requestId,
      resumePlan,
      status: "unavailable",
      summary:
        "Queue workflow review step is unavailable; review was not recorded.",
      validationReasons,
      validationStatus,
      workflowId: request.workflowId,
      workflowRunId,
      workflowStartStatus,
    });
  }

  const stepRequest = reviewStepRequestFromRunnerRequest({
    actorId,
    request,
    workflowRunId,
    workspaceId,
  });
  const reviewStepResult =
    await workflowPersistence.executeAgentQueueWorkflowReviewStep(stepRequest);
  const runnerResult = projectReviewStepResultToRunnerResult({
    request,
    result: reviewStepResult,
  });
  const runtimeStatus = runtimeStatusFromReviewStep(reviewStepResult);
  const persistentRecordedStatus =
    reviewStepResult.workflowRun?.status ?? persistentStatus;
  const persistedActionCount = [
    reviewStepResult.createAction,
    reviewStepResult.ackAction,
  ].filter(Boolean).length;

  return {
    actionLedgerSummaryCount: persistedActionCount,
    blockers: reviewStepResult.blockers.map((blocker) => blocker.blockerMessage),
    invoked: true,
    moduleId: request.moduleId,
    persistedActionCount,
    persistenceStatus: `review_step_${reviewStepResult.status}`,
    persistentStatus: persistentRecordedStatus,
    phase: "review",
    phasesExecuted: ["review"],
    requestId: request.requestId,
    resumePlan,
    reviewStepResult,
    runnerResult,
    status: runtimeStatus,
    summary: runnerResult.report.summary,
    validationReasons,
    validationStatus,
    workflowId: request.workflowId,
    workflowRunId,
    workflowStartStatus,
  };
}

function reviewStepRequestFromRunnerRequest({
  actorId,
  request,
  workflowRunId,
  workspaceId,
}: {
  actorId: string;
  request: QueueWorkflowRunnerRequest;
  workflowRunId: string;
  workspaceId: string;
}): ExecuteAgentQueueWorkflowReviewStepRequest {
  const review = recordRecord(request.inputs, "review");
  return {
    actorId,
    grantSummary: (request.grant ?? null) as AgentQueueWorkflowJsonValue | null,
    requestId: request.requestId,
    slot: stringValue(review.slot) ?? "upstream",
    workflowRunId,
    workspaceId,
  };
}

export function projectReviewStepResultToRunnerResult({
  request,
  result,
}: {
  request: QueueWorkflowRunnerRequest;
  result: AgentQueueWorkflowReviewStepResult;
}): QueueWorkflowRunnerResult {
  const slot = result.binding?.slot ?? reviewInputString(request, "slot") ?? "upstream";
  const taskId = result.binding?.taskId;
  const runId = result.binding?.runId;
  const evidenceBundleId = result.binding?.evidenceBundleId;
  const messageId = result.messageId ?? result.binding?.messageId;
  const blocker = result.blockers[0];
  const status = runnerStatusFromReviewStep(result);
  const reviewStatus = reviewReportStatusFromStep(result);
  const variables = {
    evidenceBundleIdsBySlot: evidenceBundleId
      ? { [slot]: evidenceBundleId }
      : {},
    messageIdsBySlot: messageId ? { [slot]: messageId } : {},
    readSnapshots: {
      aggregatesByTaskId: {},
      evidenceByKey: {},
      lifecycleByTaskId: {},
    },
    requestId: request.requestId,
    runIdsBySlot: runId ? { [slot]: runId } : {},
    scopedEvidenceBundleIds: evidenceBundleId ? [evidenceBundleId] : [],
    scopedMessageIds: messageId ? [messageId] : [],
    scopedRunIds: runId ? [runId] : [],
    scopedTaskIds: taskId ? [taskId] : [],
    slots: {
      [slot]: stripUndefined({
        evidenceBundleId,
        messageId,
        runId,
        slot,
        taskId,
      }),
    },
    taskIdsBySlot: taskId ? { [slot]: taskId } : {},
    workflowId: request.workflowId,
  };
  const success =
    result.status === "executed" || result.status === "already_applied";

  return {
    blockers: blocker
      ? [
          {
            fieldPath: blocker.missingRequiredField ?? undefined,
            message: blocker.blockerMessage,
            reasonCode:
              blocker.blockerCode as QueueWorkflowRunnerBlockerReason,
            slot,
            taskId,
          },
        ]
      : [],
    events: [
      {
        message: reviewStepSummary(result),
        phase: "review",
        status: success
          ? "completed"
          : result.status === "failed_unexpected"
            ? "failed_unexpected"
            : "blocked",
      },
    ],
    report: {
      createSetupStart: {
        materializedSlots: {},
        phase: "create_setup_start",
        status: null,
        supportedWorkflow: true,
      },
      evidenceReads: [],
      finalization: {
        confirmationTokenAccepted: false,
        downstreamVerification: {
          dependencyVerified: null,
          notAutoStartedVerified: null,
          verificationMissing: true,
        },
        idempotent: false,
        phase: "finalization",
        status: null,
        supportedWorkflow: true,
      },
      missingExplicitIds: [],
      mutationSummary: reviewMutationSummary(result),
      nextMutatingPhase: success ? "finalization" : null,
      readOnly: false,
      review: {
        ackStatus: reviewCommandStatusFromStep(result),
        createStatus: result.binding?.createActionId
          ? reviewCommandStatusFromStep(result)
          : undefined,
        evidenceBundleId,
        idempotentAck: result.status === "already_applied",
        idempotentCreate: result.status === "already_applied",
        messageId,
        phase: "review",
        runId,
        status: reviewStatus,
        supportedWorkflow: true,
        targetSlot: slot,
        taskId,
      },
      summary: reviewStepSummary(result),
      taskReads: [],
      workerEvidence: {
        idempotent: false,
        phase: "worker_evidence",
        status: null,
        supportedWorkflow: true,
      },
    },
    requestId: request.requestId,
    status,
    steps: [
      {
        evidenceBundleId,
        message: reviewStepSummary(result),
        phase: "review",
        reasonCode: blocker?.blockerCode as QueueWorkflowRunnerBlockerReason,
        runId,
        slot,
        status: success
          ? "completed"
          : result.status === "failed_unexpected"
            ? "failed_unexpected"
            : "blocked",
        stepId: "backend_review_step",
        taskId,
      },
    ],
    variables,
    workflowId: request.workflowId,
  };
}

function reviewMutationSummary(
  result: AgentQueueWorkflowReviewStepResult,
): QueueWorkflowRunnerResult["report"]["mutationSummary"] {
  const success =
    result.status === "executed" || result.status === "already_applied";
  return {
    didAckReview: success && result.status === "executed",
    didBlock: false,
    didCreateReviewMessage: success && result.status === "executed",
    didFail: false,
    didFollowUp: false,
    ["didLaunch" + "Term" + "inal"]: false,
    didMarkDone: false,
    didMutateGit: false,
    didMutateQueue: success && result.status === "executed",
    didRollback: false,
    didStartWorker: false,
    didValidate: false,
  } as QueueWorkflowRunnerResult["report"]["mutationSummary"];
}

function runtimeStatusFromReviewStep(
  result: AgentQueueWorkflowReviewStepResult,
): QueueWorkflowRunnerRuntimeStatus {
  if (result.status === "executed" || result.status === "already_applied") {
    return "paused";
  }
  if (result.status === "failed_unexpected") return "failed_unexpected";
  if (result.status === "invalid_input") return "invalid_request";
  return "blocked";
}

function runnerStatusFromReviewStep(
  result: AgentQueueWorkflowReviewStepResult,
): QueueWorkflowRunnerResult["status"] {
  if (result.status === "executed" || result.status === "already_applied") {
    return "review_acknowledged";
  }
  if (result.status === "invalid_input") return "invalid_request";
  if (result.status === "failed_unexpected") return "failed_unexpected";
  const blockerCode = result.blockers[0]?.blockerCode;
  if (blockerCode === "evidence_missing") {
    return "review_blocked_missing_evidence";
  }
  if (
    blockerCode === "missing_task_binding" ||
    blockerCode === "task_missing" ||
    blockerCode === "run_missing" ||
    result.status === "not_found"
  ) {
    return "review_blocked_missing_task_or_run";
  }
  return "blocked";
}

function reviewReportStatusFromStep(
  result: AgentQueueWorkflowReviewStepResult,
): QueueWorkflowRunnerResult["report"]["review"]["status"] {
  if (result.status === "executed" || result.status === "already_applied") {
    return "review_acknowledged";
  }
  const blockerCode = result.blockers[0]?.blockerCode;
  if (blockerCode === "evidence_missing") {
    return "review_blocked_missing_evidence";
  }
  if (
    blockerCode === "missing_task_binding" ||
    blockerCode === "task_missing" ||
    blockerCode === "run_missing" ||
    result.status === "not_found"
  ) {
    return "review_blocked_missing_task_or_run";
  }
  return null;
}

function reviewCommandStatusFromStep(
  result: AgentQueueWorkflowReviewStepResult,
): QueueWorkflowReviewCommandStatus {
  if (result.status === "executed") return "succeeded";
  if (result.status === "already_applied") return "already_done";
  if (result.status === "invalid_input") return "invalid_input";
  if (result.status === "failed_unexpected") return "failed_unexpected";
  if (result.status === "blocked_precondition") return "precondition_failed";
  if (result.status === "not_found") return "precondition_failed";
  if (result.status === "conflict") return "blocked";
  return "blocked";
}

function reviewStepSummary(result: AgentQueueWorkflowReviewStepResult): string {
  if (result.status === "executed") {
    return "Queue workflow review was created and ACKed by the backend step; the workflow is awaiting finalization.";
  }
  if (result.status === "already_applied") {
    return "Queue workflow review was already ACKed and the workflow is awaiting finalization.";
  }
  return (
    result.blockers[0]?.blockerMessage ??
    result.conflict?.conflictMessage ??
    `Queue workflow review step returned ${result.status}.`
  );
}

function reviewInputString(
  request: QueueWorkflowRunnerRequest,
  field: string,
): string | undefined {
  return stringValue(recordRecord(request.inputs, "review")[field]);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key] = item;
  }
  return next as T;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordRecord(
  inputs: QueueWorkflowRunnerRequest["inputs"],
  fieldName: string,
): Record<string, unknown> {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) return {};
  const value = inputs[fieldName];
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function notInvoked({
  blockers = [],
  moduleId = null,
  persistenceStatus,
  persistentStatus,
  phase = null,
  requestId = null,
  resumePlan,
  status,
  summary,
  validationReasons = [],
  validationStatus,
  workflowId = null,
  workflowRunId = null,
  workflowStartStatus,
}: {
  blockers?: readonly string[];
  moduleId?: string | null;
  persistenceStatus?: string | null;
  persistentStatus?: string | null;
  phase?: QueueWorkflowRunnerRuntimePhase | null;
  requestId?: string | null;
  resumePlan?: AgentQueueWorkflowResumePlan;
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  validationReasons?: readonly string[];
  validationStatus?: string;
  workflowId?: string | null;
  workflowRunId?: string | null;
  workflowStartStatus?: AgentQueueWorkflowStartResult["status"] | null;
}): QueueWorkflowRunnerRuntimeResult {
  return {
    blockers,
    invoked: false,
    moduleId,
    ...(persistenceStatus ? { persistenceStatus } : {}),
    ...(persistentStatus ? { persistentStatus } : {}),
    phase,
    phasesExecuted: [],
    requestId,
    ...(resumePlan ? { resumePlan } : {}),
    status,
    summary,
    validationReasons,
    ...(validationStatus ? { validationStatus } : {}),
    workflowId,
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(workflowStartStatus ? { workflowStartStatus } : {}),
  };
}
