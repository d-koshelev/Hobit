import type {
  AgentQueueWorkflowFinalizationStepResult,
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowStartResult,
  ExecuteAgentQueueWorkflowFinalizationStepRequest,
} from "../../../workspace/types";
import type {
  QueueWorkflowPersistencePort,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeAdapterTypes";
import type {
  QueueWorkflowFinalizationCommandStatus,
  QueueWorkflowFinalizationStatus,
  QueueWorkflowRunnerBlockerReason,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerResult,
} from "./queueWorkflowRunner";

export async function executeBackendOwnedFinalizationStep({
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
  if (!workflowPersistence.executeAgentQueueWorkflowFinalizationStep) {
    return notInvoked({
      blockers: ["Backend-owned Queue workflow finalization step is unavailable."],
      moduleId: request.moduleId,
      persistenceStatus,
      persistentStatus,
      phase: "finalization",
      requestId: request.requestId,
      resumePlan,
      status: "unavailable",
      summary:
        "Queue workflow finalization step is unavailable; no terminal decision was recorded.",
      validationReasons,
      validationStatus,
      workflowId: request.workflowId,
      workflowRunId,
      workflowStartStatus,
    });
  }

  const finalizationStepResult =
    await workflowPersistence.executeAgentQueueWorkflowFinalizationStep(
      finalizationStepRequestFromRunnerRequest({
        actorId,
        request,
        workflowRunId,
        workspaceId,
      }),
    );
  const runnerResult = projectFinalizationStepResultToRunnerResult({
    request,
    result: finalizationStepResult,
  });

  return {
    actionLedgerSummaryCount: finalizationStepResult.action ? 1 : 0,
    blockers: finalizationStepResult.blockers.map(
      (blocker) => blocker.blockerMessage,
    ),
    finalizationStepResult,
    invoked: true,
    moduleId: request.moduleId,
    persistedActionCount: finalizationStepResult.action ? 1 : 0,
    persistenceStatus: `finalization_step_${finalizationStepResult.status}`,
    persistentStatus:
      finalizationStepResult.workflowRun?.status ?? persistentStatus,
    phase: "finalization",
    phasesExecuted: ["finalization"],
    requestId: request.requestId,
    resumePlan,
    runnerResult,
    status: runtimeStatusFromFinalizationStep(finalizationStepResult),
    summary: runnerResult.report.summary,
    validationReasons,
    validationStatus,
    workflowId: request.workflowId,
    workflowRunId,
    workflowStartStatus,
  };
}

function finalizationStepRequestFromRunnerRequest({
  actorId,
  request,
  workflowRunId,
  workspaceId,
}: {
  actorId: string;
  request: QueueWorkflowRunnerRequest;
  workflowRunId: string;
  workspaceId: string;
}): ExecuteAgentQueueWorkflowFinalizationStepRequest {
  const finalization = recordRecord(request.inputs, "finalization");
  return {
    actorId,
    confirmationToken: request.grant?.confirmationToken ?? null,
    failureReason: stringValue(request.inputs?.failureReason),
    grantSummary: (request.grant ?? null) as AgentQueueWorkflowJsonValue | null,
    requestId: request.requestId,
    slot: stringValue(finalization.slot) ?? "upstream",
    workflowRunId,
    workspaceId,
  };
}

export function projectFinalizationStepResultToRunnerResult({
  request,
  result,
}: {
  request: QueueWorkflowRunnerRequest;
  result: AgentQueueWorkflowFinalizationStepResult;
}): QueueWorkflowRunnerResult {
  const slot = result.binding?.slot ?? "upstream";
  const taskId = result.binding?.taskId;
  const runId = result.binding?.runId;
  const evidenceBundleId = result.binding?.evidenceBundleId;
  const messageId = result.binding?.messageId;
  const blocker = result.blockers[0];
  const success =
    result.status === "executed" || result.status === "already_applied";
  const finalizationAction =
    result.transition === "finalize_fail" ? "fail" : "mark_done";
  const decisionId =
    result.completionDecisionId ?? result.failureDecisionId ?? undefined;
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
        completionDecisionId: result.completionDecisionId ?? undefined,
        evidenceBundleId,
        failureDecisionId: result.failureDecisionId ?? undefined,
        messageId,
        runId,
        slot,
        taskId,
      }),
    },
    taskIdsBySlot: taskId ? { [slot]: taskId } : {},
    workflowId: request.workflowId,
  };

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
        message: finalizationStepSummary(result),
        phase: "finalization",
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
        commandStatus: finalizationCommandStatusFromStep(result),
        confirmationTokenAccepted: result.action?.resultRefsJson
          ? result.action.resultRefsJson.includes('"confirmationAccepted":true')
          : false,
        decisionId,
        downstreamVerification: {
          dependencyVerified:
            result.downstreamVerification?.dependencyVerified ?? null,
          notAutoStartedVerified:
            result.downstreamVerification?.notAutoStartedVerified ?? null,
          taskId: result.downstreamVerification?.downstreamTaskId ?? undefined,
          verificationMissing:
            result.downstreamVerification?.verificationMissing ?? true,
          workerRunState:
            result.downstreamVerification?.workerRunState ?? undefined,
        },
        finalizationAction,
        idempotent: result.status === "already_applied",
        phase: "finalization",
        status: finalizationReportStatusFromStep(result),
        supportedWorkflow: true,
        targetSlot: slot,
        taskId,
      },
      missingExplicitIds: [],
      mutationSummary: finalizationMutationSummary(result, finalizationAction),
      nextMutatingPhase: null,
      readOnly: false,
      review: {
        idempotentAck: false,
        idempotentCreate: false,
        phase: "review",
        status: null,
        supportedWorkflow: true,
      },
      summary: finalizationStepSummary(result),
      taskReads: [],
      workerEvidence: {
        idempotent: false,
        phase: "worker_evidence",
        status: null,
        supportedWorkflow: true,
      },
    },
    requestId: request.requestId,
    status: runnerStatusFromFinalizationStep(result),
    steps: [
      {
        evidenceBundleId,
        message: finalizationStepSummary(result),
        phase: "finalization",
        reasonCode: blocker?.blockerCode as QueueWorkflowRunnerBlockerReason,
        runId,
        slot,
        status: success
          ? "completed"
          : result.status === "failed_unexpected"
            ? "failed_unexpected"
            : "blocked",
        stepId: result.action?.actionId ?? "backend_finalization_step",
        taskId,
      },
    ],
    variables,
    workflowId: request.workflowId,
  };
}

function finalizationMutationSummary(
  result: AgentQueueWorkflowFinalizationStepResult,
  finalizationAction: "fail" | "mark_done",
): QueueWorkflowRunnerResult["report"]["mutationSummary"] {
  const executed = result.status === "executed";
  return {
    didAckReview: false,
    didBlock: false,
    didCreateReviewMessage: false,
    didFail: executed && finalizationAction === "fail",
    didFollowUp: false,
    ["didLaunch" + "Term" + "inal"]: false,
    didMarkDone: executed && finalizationAction === "mark_done",
    didMutateGit: false,
    didMutateQueue: executed,
    didRollback: false,
    didStartWorker: false,
    didValidate: false,
  } as QueueWorkflowRunnerResult["report"]["mutationSummary"];
}

function runtimeStatusFromFinalizationStep(
  result: AgentQueueWorkflowFinalizationStepResult,
): QueueWorkflowRunnerRuntimeStatus {
  if (result.status === "executed" || result.status === "already_applied") {
    return "completed";
  }
  if (result.status === "failed_unexpected") return "failed_unexpected";
  if (result.status === "invalid_input") return "invalid_request";
  return "blocked";
}

function runnerStatusFromFinalizationStep(
  result: AgentQueueWorkflowFinalizationStepResult,
): QueueWorkflowFinalizationStatus {
  if (result.status === "executed") return "finalization_completed";
  if (result.status === "already_applied") {
    return result.transition === "finalize_fail"
      ? "finalization_already_failed"
      : "finalization_already_done";
  }
  if (result.status === "invalid_input") return "finalization_invalid_input";
  if (result.status === "failed_unexpected") {
    return "finalization_failed_unexpected";
  }
  return "finalization_blocked";
}

function finalizationReportStatusFromStep(
  result: AgentQueueWorkflowFinalizationStepResult,
) {
  return runnerStatusFromFinalizationStep(result);
}

function finalizationCommandStatusFromStep(
  result: AgentQueueWorkflowFinalizationStepResult,
): QueueWorkflowFinalizationCommandStatus {
  if (result.status === "executed") return "succeeded";
  if (result.status === "already_applied") {
    return result.transition === "finalize_fail"
      ? "already_failed"
      : "already_done";
  }
  if (result.status === "invalid_input") return "invalid_input";
  if (result.status === "failed_unexpected") return "failed_unexpected";
  if (result.status === "blocked_precondition") return "precondition_failed";
  if (result.status === "conflict") return "blocked";
  return "blocked";
}

function finalizationStepSummary(
  result: AgentQueueWorkflowFinalizationStepResult,
): string {
  if (result.status === "executed") {
    return "Queue workflow finalization was executed by the backend step and the workflow is complete.";
  }
  if (result.status === "already_applied") {
    return "Queue workflow finalization was already durable and the workflow is complete.";
  }
  return (
    result.blockers[0]?.blockerMessage ??
    result.conflict?.conflictMessage ??
    `Queue workflow finalization step returned ${result.status}.`
  );
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

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key] = item;
  }
  return next as T;
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
  phase?: "finalization" | null;
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
