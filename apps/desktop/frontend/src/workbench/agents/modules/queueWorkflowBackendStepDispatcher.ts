import type {
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowStartResult,
  AgentQueueWorkflowWorkerEvidenceRecordResult,
  AgentQueueWorkflowWorkerEvidenceStepResult,
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
} from "../../../workspace/types";
import { executeBackendOwnedFinalizationStep } from "./queueWorkflowRunnerBackendFinalizationPhase";
import { executeBackendOwnedReviewStep } from "./queueWorkflowRunnerBackendReviewPhase";
import type {
  QueueWorkflowPersistencePort,
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeResult,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRunnerRuntimeAdapter";
import type {
  QueueWorkflowRunnerBlockerReason,
  QueueWorkflowRunnerRequest,
  QueueWorkflowRunnerResult,
} from "./queueWorkflowRunner";
import { executeBackendOwnedCreateSetupStartStep } from "./queueWorkflowRunnerBackendCreateSetupStartPhase";

export const backendOwnedQueueWorkflowPhases = ["create_setup_start", "worker_evidence", "review", "finalization"] as const satisfies readonly QueueWorkflowRunnerRuntimePhase[];

export const legacyFrontendQueueWorkflowPhases = ["read"] as const satisfies readonly QueueWorkflowRunnerRuntimePhase[];

export type BackendOwnedQueueWorkflowPhase =
  (typeof backendOwnedQueueWorkflowPhases)[number];

export function isBackendOwnedQueueWorkflowPhase(
  phase: QueueWorkflowRunnerRuntimePhase,
): phase is BackendOwnedQueueWorkflowPhase {
  return backendOwnedQueueWorkflowPhases.includes(phase as BackendOwnedQueueWorkflowPhase);
}

export function isLegacyFrontendQueueWorkflowPhase(
  phase: QueueWorkflowRunnerRuntimePhase,
): boolean {
  return legacyFrontendQueueWorkflowPhases.includes(phase as (typeof legacyFrontendQueueWorkflowPhases)[number]);
}

export async function dispatchQueueWorkflowBackendStep({
  actorId,
  persistenceStatus,
  persistentStatus,
  phase,
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
  phase: BackendOwnedQueueWorkflowPhase;
  request: QueueWorkflowRunnerRequest;
  resumePlan?: AgentQueueWorkflowResumePlan;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowPersistence: QueueWorkflowPersistencePort;
  workflowRunId: string | null;
  workspaceId: string;
  workflowStartStatus: AgentQueueWorkflowStartResult["status"] | null;
}): Promise<QueueWorkflowRunnerRuntimeResult> {
  if (phase === "create_setup_start") {
    return executeBackendOwnedCreateSetupStartStep({
      actorId,
      persistenceStatus,
      persistentStatus,
      request,
      validationReasons,
      validationStatus,
      workflowPersistence,
      workflowRunId,
      workspaceId,
      workflowStartStatus,
    });
  }

  if (phase === "review") {
    return executeBackendOwnedReviewStep({
      actorId,
      persistenceStatus,
      persistentStatus,
      request,
      resumePlan,
      validationReasons,
      validationStatus,
      workflowPersistence,
      workflowRunId: workflowRunId ?? "",
      workspaceId,
      workflowStartStatus,
    });
  }

  if (phase === "finalization") {
    return executeBackendOwnedFinalizationStep({
      actorId,
      persistenceStatus,
      persistentStatus,
      request,
      resumePlan,
      validationReasons,
      validationStatus,
      workflowPersistence,
      workflowRunId: workflowRunId ?? "",
      workspaceId,
      workflowStartStatus,
    });
  }

  return executeBackendOwnedWorkerEvidenceStep({
    actorId,
    persistenceStatus,
    persistentStatus,
    request,
    resumePlan,
    validationReasons,
    validationStatus,
    workflowPersistence,
    workflowRunId: workflowRunId ?? "",
    workspaceId,
    workflowStartStatus,
  });
}

async function executeBackendOwnedWorkerEvidenceStep({
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
  if (!workflowPersistence.executeAgentQueueWorkflowWorkerEvidenceStep) {
    return notInvoked({
      blockers: ["Backend-owned Queue workflow worker evidence step is unavailable."],
      moduleId: request.moduleId,
      persistenceStatus,
      persistentStatus,
      phase: "worker_evidence",
      requestId: request.requestId,
      resumePlan,
      status: "unavailable",
      summary:
        "Queue workflow worker evidence step is unavailable; evidence was not recorded.",
      validationReasons,
      validationStatus,
      workflowId: request.workflowId,
      workflowRunId,
      workflowStartStatus,
    });
  }

  const stepRequest = workerEvidenceStepRequestFromRunnerRequest({
    actorId,
    request,
    workflowRunId,
    workspaceId,
  });
  if (!stepRequest.ok) {
    return notInvoked({
      blockers: [stepRequest.message],
      moduleId: request.moduleId,
      persistenceStatus,
      persistentStatus,
      phase: "worker_evidence",
      requestId: request.requestId,
      resumePlan,
      status: "paused",
      summary: stepRequest.message,
      validationReasons,
      validationStatus,
      workflowId: request.workflowId,
      workflowRunId,
      workflowStartStatus,
    });
  }

  const evidenceStepResult =
    await workflowPersistence.executeAgentQueueWorkflowWorkerEvidenceStep(
      stepRequest.request,
    );
  const runnerResult = projectWorkerEvidenceStepResultToRunnerResult({
    request,
    result: evidenceStepResult,
  });
  const runtimeStatus = runtimeStatusFromWorkerEvidenceStep(evidenceStepResult);
  const persistentRecordedStatus =
    evidenceStepResult.workflowRun?.status ?? persistentStatus;

  return {
    actionLedgerSummaryCount: evidenceStepResult.action ? 1 : 0,
    blockers: evidenceStepResult.blockers.map(
      (blocker) => blocker.blockerMessage,
    ),
    evidenceStepResult,
    invoked: true,
    moduleId: request.moduleId,
    persistedActionCount: evidenceStepResult.action ? 1 : 0,
    persistenceStatus: `worker_evidence_step_${evidenceStepResult.status}`,
    persistentStatus: persistentRecordedStatus,
    phase: "worker_evidence",
    phasesExecuted: ["worker_evidence"],
    requestId: request.requestId,
    resumePlan,
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

function workerEvidenceStepRequestFromRunnerRequest({
  actorId,
  request,
  workflowRunId,
  workspaceId,
}: {
  actorId: string;
  request: QueueWorkflowRunnerRequest;
  workflowRunId: string;
  workspaceId: string;
}):
  | { ok: true; request: RecordAgentQueueWorkflowWorkerEvidenceRequest }
  | { ok: false; message: string } {
  const workerEvidence = recordRecord(request.inputs, "workerEvidence");
  const slot = stringValue(workerEvidence.slot);
  const taskId = stringValue(workerEvidence.taskId);
  const runId = stringValue(workerEvidence.runId);
  const outcome = stringValue(workerEvidence.outcome);

  if (!slot || !taskId || !runId || !outcome) {
    return {
      ok: false,
      message: "Typed inputs.workerEvidence is required to record worker evidence.",
    };
  }
  if (!["completed", "not_completed", "failed"].includes(outcome)) {
    return {
      ok: false,
      message:
        "Typed inputs.workerEvidence.outcome must be completed, not_completed, or failed.",
    };
  }

  return {
    ok: true,
    request: {
      actionIdempotencyKey: stringValue(workerEvidence.actionIdempotencyKey),
      actorId,
      changedFiles: stringArrayValue(workerEvidence.changedFiles),
      changedFilesSummary: stringValue(workerEvidence.changedFilesSummary),
      errorSummary: stringValue(workerEvidence.errorSummary),
      finishedAt: stringValue(workerEvidence.finishedAt),
      metadataJson: stringValue(workerEvidence.metadataJson),
      outcome: outcome as RecordAgentQueueWorkflowWorkerEvidenceRequest["outcome"],
      runId,
      slot,
      source: stringValue(workerEvidence.source),
      summary: stringValue(workerEvidence.summary),
      taskId,
      validationSummary: stringValue(workerEvidence.validationSummary),
      workerId: stringValue(workerEvidence.workerId),
      workflowRunId,
      workspaceId,
    },
  };
}

export function projectWorkerEvidenceStepResultToRunnerResult({
  request,
  result,
}: {
  request: QueueWorkflowRunnerRequest;
  result: AgentQueueWorkflowWorkerEvidenceStepResult;
}): QueueWorkflowRunnerResult {
  const slot = result.binding?.slot ?? "upstream";
  const taskId = result.binding?.taskId ?? workerEvidenceInputString(request, "taskId");
  const runId = result.binding?.runId ?? workerEvidenceInputString(request, "runId");
  const evidenceBundleId =
    result.binding?.evidenceBundleId ?? result.evidenceBundle?.bundleId;
  const workerFinalStatus = result.binding?.workerFinalStatus;
  const outcome =
    result.binding?.workerOutcome ?? workerEvidenceInputString(request, "outcome");
  const status = runnerStatusFromWorkerEvidenceStep(result);
  const blocker = result.blockers[0];
  const variables = {
    evidenceBundleIdsBySlot: evidenceBundleId ? { [slot]: evidenceBundleId } : {},
    messageIdsBySlot: {},
    readSnapshots: {
      aggregatesByTaskId: {},
      evidenceByKey: {},
      lifecycleByTaskId: {},
    },
    requestId: request.requestId,
    runIdsBySlot: runId ? { [slot]: runId } : {},
    scopedEvidenceBundleIds: evidenceBundleId ? [evidenceBundleId] : [],
    scopedMessageIds: [],
    scopedRunIds: runId ? [runId] : [],
    scopedTaskIds: taskId ? [taskId] : [],
    slots: {
      [slot]: stripUndefined({
        evidenceBundleId,
        runId,
        slot,
        taskId,
      }),
    },
    taskIdsBySlot: taskId ? { [slot]: taskId } : {},
    workflowId: request.workflowId,
  };
  const workerEvidenceStatus = workerEvidenceReportStatusFromStep(result);

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
        message: workerEvidenceStepSummary(result),
        phase: "worker_evidence",
        status:
          result.status === "executed" || result.status === "already_applied"
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
      mutationSummary: workerEvidenceMutationSummary(result.status === "executed"),
      nextMutatingPhase:
        result.status === "executed" || result.status === "already_applied"
          ? "review"
          : null,
      readOnly: false,
      review: {
        idempotentAck: false,
        idempotentCreate: false,
        phase: "review",
        status: null,
        supportedWorkflow: true,
      },
      summary: workerEvidenceStepSummary(result),
      taskReads: [],
      workerEvidence: {
        commandStatus: workerEvidenceCommandStatusFromStep(result),
        evidenceBundleId,
        idempotent: result.status === "already_applied",
        outcome,
        phase: "worker_evidence",
        runId,
        status: workerEvidenceStatus,
        supportedWorkflow: true,
        targetSlot: slot,
        taskId,
        workerFinalStatus,
      },
    },
    requestId: request.requestId,
    status,
    steps: [
      {
        evidenceBundleId,
        message: workerEvidenceStepSummary(result),
        phase: "worker_evidence",
        reasonCode: blocker?.blockerCode as QueueWorkflowRunnerBlockerReason,
        runId,
        slot,
        status:
          result.status === "executed" || result.status === "already_applied"
            ? "completed"
            : result.status === "failed_unexpected"
              ? "failed_unexpected"
              : "blocked",
        stepId: result.action?.actionId ?? "backend_worker_evidence_step",
        taskId,
      },
    ],
    variables,
    workflowId: request.workflowId,
  };
}

function workerEvidenceMutationSummary(
  didMutateQueue: boolean,
): QueueWorkflowRunnerResult["report"]["mutationSummary"] {
  return {
    didAckReview: false,
    didBlock: false,
    didCreateReviewMessage: false,
    didFail: false,
    didFollowUp: false,
    ["didLaunch" + "Term" + "inal"]: false,
    didMarkDone: false,
    didMutateGit: false,
    didMutateQueue,
    didRollback: false,
    didStartWorker: false,
    didValidate: false,
  } as QueueWorkflowRunnerResult["report"]["mutationSummary"];
}

function runtimeStatusFromWorkerEvidenceStep(
  result: AgentQueueWorkflowWorkerEvidenceStepResult,
): QueueWorkflowRunnerRuntimeStatus {
  if (result.status === "executed" || result.status === "already_applied") {
    return "paused";
  }
  if (result.status === "failed_unexpected") return "failed_unexpected";
  if (result.status === "invalid_input") return "invalid_request";
  return "blocked";
}

function runnerStatusFromWorkerEvidenceStep(
  result: AgentQueueWorkflowWorkerEvidenceStepResult,
): QueueWorkflowRunnerResult["status"] {
  if (result.status === "executed" || result.status === "already_applied") {
    return "awaiting_review";
  }
  if (result.status === "invalid_input") return "invalid_request";
  if (result.status === "failed_unexpected") return "failed_unexpected";
  const blockerCode = result.blockers[0]?.blockerCode;
  if (blockerCode === "worker_outcome_mismatch") {
    return "blocked_worker_outcome_mismatch";
  }
  if (blockerCode === "worker_run_not_complete") {
    return "blocked_worker_not_complete";
  }
  if (blockerCode === "run_missing" || result.status === "not_found") {
    return "blocked_missing_run";
  }
  if (blockerCode === "missing_task_binding") {
    return "blocked_missing_task";
  }
  if (result.status === "conflict" || blockerCode === "evidence_conflict") {
    return "blocked_evidence_conflict";
  }
  return "blocked";
}

function workerEvidenceReportStatusFromStep(
  result: AgentQueueWorkflowWorkerEvidenceStepResult,
) {
  if (result.status === "executed") return "evidence_recorded";
  if (result.status === "already_applied") return "evidence_already_recorded";
  const blockerCode = result.blockers[0]?.blockerCode;
  if (blockerCode === "worker_outcome_mismatch") {
    return "blocked_worker_outcome_mismatch";
  }
  if (blockerCode === "worker_run_not_complete") {
    return "blocked_worker_not_complete";
  }
  if (blockerCode === "run_missing" || result.status === "not_found") {
    return "blocked_missing_run";
  }
  if (blockerCode === "missing_task_binding") return "blocked_missing_task";
  if (result.status === "conflict" || blockerCode === "evidence_conflict") {
    return "blocked_evidence_conflict";
  }
  return null;
}

function workerEvidenceCommandStatusFromStep(
  result: AgentQueueWorkflowWorkerEvidenceStepResult,
): AgentQueueWorkflowWorkerEvidenceRecordResult["status"] {
  if (result.status === "executed") return "recorded";
  if (result.status === "already_applied") return "already_recorded";
  if (result.status === "blocked_precondition") return "blocked";
  return result.status;
}

function workerEvidenceStepSummary(
  result: AgentQueueWorkflowWorkerEvidenceStepResult,
): string {
  if (result.status === "executed") {
    return "Queue workflow worker evidence was recorded by the backend step and the workflow is awaiting review.";
  }
  if (result.status === "already_applied") {
    return "Queue workflow worker evidence was already durable and the workflow is awaiting review.";
  }
  return (
    result.blockers[0]?.blockerMessage ??
    result.conflict?.conflictMessage ??
    `Queue workflow worker evidence step returned ${result.status}.`
  );
}

function workerEvidenceInputString(
  request: QueueWorkflowRunnerRequest,
  field: string,
): string | undefined {
  return stringValue(recordRecord(request.inputs, "workerEvidence")[field]);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
