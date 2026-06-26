import type { HobitAgentWorkflowRequestEnvelopeReadResult } from "../broker";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import {
  dispatchQueueWorkflowBackendStep,
  isBackendOwnedQueueWorkflowPhase,
  isLegacyFrontendQueueWorkflowPhase,
} from "./queueWorkflowBackendStepDispatcher";
import type {
  AgentQueueWorkflowJsonValue,
  AgentQueueWorkflowFinalizationStepResult,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowReviewStepResult,
  AgentQueueWorkflowRunnerReportRecordResult,
  AgentQueueWorkflowStartResult,
  AgentQueueWorkflowWorkerEvidenceStepResult,
  ExecuteAgentQueueWorkflowFinalizationStepRequest,
  ExecuteAgentQueueWorkflowReviewStepRequest,
  RecordAgentQueueWorkflowRunnerReportAction,
  RecordAgentQueueWorkflowRunnerReportRequest,
  RecordAgentQueueWorkflowWorkerEvidenceRequest,
  StartAgentQueueWorkflowRequest,
} from "../../../workspace/types";
import {
  runQueueWorkflowCreateSetupStartRunner,
  runQueueWorkflowReadOnlyRunner,
  type QueueWorkflowCreateSetupStartPort,
  type QueueWorkflowReadPort,
  type QueueWorkflowRunnerRequest,
  type QueueWorkflowRunnerResult,
} from "./queueWorkflowRunner";
import { validateQueueWorkflowRequest } from "./queueWorkflowRequestValidation";

export type QueueWorkflowRunnerRuntimePhase =
  | "create_setup_start"
  | "finalization"
  | "read"
  | "review"
  | "worker_evidence";

export type QueueWorkflowRunnerRuntimeStatus =
  | "blocked"
  | "completed"
  | "deferred"
  | "failed_unexpected"
  | "invalid_request"
  | "paused"
  | "unavailable"
  | "unsupported";

export type QueueWorkflowRunnerRuntimePorts = {
  createSetupStartPort?: QueueWorkflowCreateSetupStartPort | null;
  readPort?: QueueWorkflowReadPort | null;
};

export type QueueWorkflowPersistencePort = {
  planAgentQueueWorkflowResume: (request: {
    expectedVersion?: number | null;
    workflowRunId: string;
    workspaceId: string;
  }) => Promise<AgentQueueWorkflowResumePlan | null>;
  recordAgentQueueWorkflowRunnerReport: (
    request: RecordAgentQueueWorkflowRunnerReportRequest,
  ) => Promise<AgentQueueWorkflowRunnerReportRecordResult>;
  executeAgentQueueWorkflowWorkerEvidenceStep?: (
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
  ) => Promise<AgentQueueWorkflowWorkerEvidenceStepResult>;
  executeAgentQueueWorkflowReviewStep?: (
    request: ExecuteAgentQueueWorkflowReviewStepRequest,
  ) => Promise<AgentQueueWorkflowReviewStepResult>;
  executeAgentQueueWorkflowFinalizationStep?: (
    request: ExecuteAgentQueueWorkflowFinalizationStepRequest,
  ) => Promise<AgentQueueWorkflowFinalizationStepResult>;
  startAgentQueueWorkflow: (
    request: StartAgentQueueWorkflowRequest,
  ) => Promise<AgentQueueWorkflowStartResult>;
};

export type QueueWorkflowRunnerRuntimeAdapterInput = {
  actorId?: string | null;
  ports?: QueueWorkflowRunnerRuntimePorts | null;
  queueBridge?: WorkspaceAgentQueueBridge | null;
  workflowPersistence?: QueueWorkflowPersistencePort | null;
  workflowRequestRead: HobitAgentWorkflowRequestEnvelopeReadResult;
  workspaceId?: string | null;
};

export type QueueWorkflowRunnerRuntimeResult = {
  actionLedgerSummaryCount?: number;
  blockers: readonly string[];
  invoked: boolean;
  moduleId: string | null;
  persistedActionCount?: number;
  persistenceStatus?: string | null;
  persistentStatus?: string | null;
  phase: QueueWorkflowRunnerRuntimePhase | null;
  phasesExecuted: readonly string[];
  evidenceStepResult?: AgentQueueWorkflowWorkerEvidenceStepResult;
  finalizationStepResult?: AgentQueueWorkflowFinalizationStepResult;
  reviewStepResult?: AgentQueueWorkflowReviewStepResult;
  recordResult?: AgentQueueWorkflowRunnerReportRecordResult;
  requestId: string | null;
  requestHashConflict?: AgentQueueWorkflowStartResult["conflict"];
  resumePlan?: AgentQueueWorkflowResumePlan;
  runnerResult?: QueueWorkflowRunnerResult;
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  unsupportedReason?: string;
  validationReasons: readonly string[];
  validationStatus?: string;
  workflowId: string | null;
  workflowRunId?: string | null;
  workflowStartStatus?: AgentQueueWorkflowStartResult["status"] | null;
};

const QUEUE_MODULE_ID = "queue";
const DEFAULT_ACTOR_ID = "workspace-agent";
const CREATE_SETUP_START_WORKFLOWS = new Set([
  "dependency_acceptance_smoke",
  "dependency_failure_smoke",
]);
const SUPPORTED_REVIEW_DEFERRED_WORKFLOWS = new Set(["review_acceptance"]);

export async function runQueueWorkflowRunnerRuntimeAdapter({
  actorId,
  ports,
  queueBridge,
  workflowPersistence,
  workflowRequestRead,
  workspaceId,
}: QueueWorkflowRunnerRuntimeAdapterInput): Promise<QueueWorkflowRunnerRuntimeResult> {
  if (workflowRequestRead.status !== "valid") {
    return notInvoked({
      blockers: workflowRequestRead.status === "invalid" ? workflowRequestRead.reasons : [],
      status: "invalid_request",
      summary:
        workflowRequestRead.status === "invalid"
          ? "Invalid Hobit workflow request; Queue workflow runner was not invoked."
          : "No Hobit workflow request was available; Queue workflow runner was not invoked.",
      validationReasons:
        workflowRequestRead.status === "invalid" ? workflowRequestRead.reasons : [],
    });
  }

  const request = workflowRequestRead.envelope;
  if (request.moduleId !== QUEUE_MODULE_ID) {
    return notInvoked({
      moduleId: request.moduleId,
      requestId: request.requestId,
      status: "unsupported",
      summary:
        "Queue workflow runner only handles moduleId queue; no workflow runner was invoked.",
      unsupportedReason: "module_not_queue",
      validationReasons: workflowRequestRead.validation.reasons,
      validationStatus: workflowRequestRead.validation.status,
      workflowId: request.workflowId,
    });
  }

  if (
    !workflowRequestRead.validation.ok &&
    workflowRequestRead.validation.reasonCode !== "input_validation_deferred"
  ) {
    return notInvoked({
      blockers: workflowRequestRead.validation.reasons,
      moduleId: request.moduleId,
      requestId: request.requestId,
      status:
        workflowRequestRead.validation.reasonCode === "workflow_not_declared" ||
        workflowRequestRead.validation.reasonCode === "workflow_unavailable"
          ? "unsupported"
          : "invalid_request",
      summary:
        "Queue workflow request was not runner-supported; Queue workflow runner was not invoked.",
      unsupportedReason: workflowRequestRead.validation.reasonCode,
      validationReasons: workflowRequestRead.validation.reasons,
      validationStatus: workflowRequestRead.validation.status,
      workflowId: request.workflowId,
    });
  }

  const phaseSelection = resolveRuntimePhase(request);
  if (!phaseSelection.ok) {
    return notInvoked({
      blockers: [phaseSelection.reason],
      moduleId: request.moduleId,
      requestId: request.requestId,
      status: phaseSelection.status,
      summary: phaseSelection.reason,
      unsupportedReason: phaseSelection.reasonCode,
      validationReasons: workflowRequestRead.validation.reasons,
      validationStatus: workflowRequestRead.validation.status,
      workflowId: request.workflowId,
    });
  }

  const validation = validateQueueWorkflowRequest({
    ...(request.grant ? { grant: request.grant } : {}),
    ...(request.inputs ? { inputs: request.inputs } : {}),
    moduleId: request.moduleId,
    workflowId: request.workflowId,
  });
  if (
    !validation.ok &&
    !(
      validation.status === "input_validation_deferred" &&
      phaseSelection.phase === "review" &&
      SUPPORTED_REVIEW_DEFERRED_WORKFLOWS.has(request.workflowId)
    )
  ) {
    return notInvoked({
      blockers: validation.reasons,
      moduleId: request.moduleId,
      requestId: request.requestId,
      status:
        validation.status === "input_validation_deferred"
          ? "deferred"
          : "invalid_request",
      summary:
        validation.status === "input_validation_deferred"
          ? "Queue workflow input validation is deferred for this workflow; Queue workflow runner was not invoked."
          : "Queue workflow validation failed; Queue workflow runner was not invoked.",
      unsupportedReason: validation.status,
      validationReasons: validation.reasons,
      validationStatus: validation.status,
      workflowId: request.workflowId,
    });
  }

  const normalizedWorkspaceId = workspaceId?.trim() ?? "";
  if (!workflowPersistence || !normalizedWorkspaceId) {
    return notInvoked({
      blockers: ["Queue workflow persistence is unavailable."],
      moduleId: request.moduleId,
      requestId: request.requestId,
      status: "unavailable",
      summary:
        "Queue workflow persistence is unavailable; Queue workflow runner was not invoked.",
      validationReasons: validation.reasons,
      validationStatus: validation.status,
      workflowId: request.workflowId,
    });
  }

  const baseRunnerRequest: QueueWorkflowRunnerRequest = {
    ...(request.grant ? { grant: request.grant } : {}),
    ...(request.inputs ? { inputs: request.inputs } : {}),
    moduleId: request.moduleId,
    requestId: request.requestId,
    workflowId: request.workflowId,
  };
  const typedWorkflowRunId = workflowRunIdFromMetadata(request.metadata);
  let runnerRequest = baseRunnerRequest;
  let selectedPhase = phaseSelection.phase;
  let persistenceStatus: string | null = null;
  let persistentStatus: string | null = null;
  let resumePlan: AgentQueueWorkflowResumePlan | undefined;
  let workflowRunId: string | null = null;
  let workflowStartStatus: AgentQueueWorkflowStartResult["status"] | null = null;

  if (typedWorkflowRunId) {
    const planned = await workflowPersistence.planAgentQueueWorkflowResume({
      workflowRunId: typedWorkflowRunId,
      workspaceId: normalizedWorkspaceId,
    });
    if (!planned) {
      return notInvoked({
        blockers: ["Queue workflow run was not found for resume planning."],
        moduleId: request.moduleId,
        persistenceStatus: "resume_not_found",
        requestId: request.requestId,
        status: "blocked",
        summary:
          "Queue workflow run was not found; Queue workflow runner was not invoked.",
        validationReasons: validation.reasons,
        validationStatus: validation.status,
        workflowId: request.workflowId,
        workflowRunId: typedWorkflowRunId,
      });
    }

    resumePlan = planned;
    workflowRunId = planned.workflowRun.workflowRunId;
    persistentStatus = planned.workflowRun.status;
    const resumeDecision = resumeDecisionForPlan({
      fallbackPhase: selectedPhase,
      plan: planned,
      request: baseRunnerRequest,
    });
    if (!resumeDecision.ok) {
      return notInvoked({
        blockers: resumeDecision.blockers,
        moduleId: request.moduleId,
        persistenceStatus: "resume_planned",
        persistentStatus,
        phase: resumeDecision.phase ?? selectedPhase,
        requestId: request.requestId,
        resumePlan: planned,
        status: resumeDecision.status,
        summary: resumeDecision.summary,
        validationReasons: validation.reasons,
        validationStatus: validation.status,
        workflowId: request.workflowId,
        workflowRunId,
      });
    }

    selectedPhase = resumeDecision.phase;
    runnerRequest = runnerRequestFromResumePlan({
      phase: selectedPhase,
      plan: planned,
      request: baseRunnerRequest,
    });
    persistenceStatus = "resume_planned";
  } else {
    if (selectedPhase === "worker_evidence" || selectedPhase === "finalization") {
      const phaseLabel =
        selectedPhase === "worker_evidence"
          ? "Queue worker evidence recording"
          : "Queue workflow finalization";
      return notInvoked({
        blockers: [`${phaseLabel} requires metadata.workflowRunId.`],
        moduleId: request.moduleId,
        requestId: request.requestId,
        status: "blocked",
        summary: `${phaseLabel} requires a persisted workflowRunId; no workflow was started.`,
        validationReasons: validation.reasons,
        validationStatus: validation.status,
        workflowId: request.workflowId,
      });
    }
    const startResult = await workflowPersistence.startAgentQueueWorkflow(
      startRequestForWorkflow({
        actorId: actorId?.trim() || DEFAULT_ACTOR_ID,
        phase: selectedPhase,
        request: baseRunnerRequest,
        workspaceId: normalizedWorkspaceId,
      }),
    );
    workflowStartStatus = startResult.status;
    workflowRunId = startResult.workflowRun?.workflowRunId ?? null;
    persistentStatus = startResult.workflowRun?.status ?? null;

    if (startResult.status === "conflict") {
      return notInvoked({
        blockers: [
          startResult.conflict?.conflictMessage ??
            "Queue workflow requestId conflicts with a different persisted request hash.",
        ],
        moduleId: request.moduleId,
        persistenceStatus: "conflict",
        persistentStatus,
        requestHashConflict: startResult.conflict,
        requestId: request.requestId,
        status: "blocked",
        summary:
          "Queue workflow requestId/hash conflict; Queue workflow runner was not invoked.",
        validationReasons: validation.reasons,
        validationStatus: validation.status,
        workflowId: request.workflowId,
        workflowRunId,
        workflowStartStatus,
      });
    }

    if (!startResult.workflowRun || startResult.status === "invalid_input") {
      return notInvoked({
        blockers: [
          startResult.blocker?.blockerMessage ??
            "Queue workflow start failed before runner invocation.",
        ],
        moduleId: request.moduleId,
        persistenceStatus: startResult.status,
        requestId: request.requestId,
        status: "blocked",
        summary:
          "Queue workflow start failed; Queue workflow runner was not invoked.",
        validationReasons: validation.reasons,
        validationStatus: validation.status,
        workflowId: request.workflowId,
        workflowRunId,
        workflowStartStatus,
      });
    }

    persistenceStatus =
      startResult.status === "already_exists" ? "reused" : "started";
  }

  if (isBackendOwnedQueueWorkflowPhase(selectedPhase)) {
    return dispatchQueueWorkflowBackendStep({
      actorId: actorId?.trim() || DEFAULT_ACTOR_ID,
      persistenceStatus,
      persistentStatus,
      phase: selectedPhase,
      request: runnerRequest,
      resumePlan,
      validationReasons: validation.reasons,
      validationStatus: validation.status,
      workflowPersistence,
      workflowRunId: workflowRunId!,
      workspaceId: normalizedWorkspaceId,
      workflowStartStatus,
    });
  }

  const runtimePorts =
    ports ??
    createQueueWorkflowRunnerRuntimePortsFromQueueBridge({
      actorId: actorId?.trim() || DEFAULT_ACTOR_ID,
      queueBridge,
    });
  const runnerResult = await runSelectedRunner({
    phase: selectedPhase,
    ports: runtimePorts,
    request: runnerRequest,
    validation,
    workflowRunId: workflowRunId!,
  });
  const recordRequest = recordRequestForRunnerResult({
    phase: selectedPhase,
    runnerResult,
    workflowRunId: workflowRunId!,
    workspaceId: normalizedWorkspaceId,
  });
  const recordResult =
    await workflowPersistence.recordAgentQueueWorkflowRunnerReport(
      recordRequest,
    );
  const recordBlockers = blockersFromRecordResult(recordResult);
  const runtimeStatus = runtimeStatusFromRunner(runnerResult.status);
  const finalStatus =
    recordResult.status === "recorded" ? runtimeStatus : "blocked";
  const persistentRecordedStatus =
    recordResult.workflowRun?.status ?? persistentStatus;

  return {
    actionLedgerSummaryCount: Math.max(
      recordRequest.actions.length,
      recordResult.actions.length,
    ),
    blockers: [
      ...runnerResult.blockers.map((blocker) => blocker.message),
      ...recordBlockers,
    ],
    invoked: true,
    moduleId: request.moduleId,
    persistedActionCount: recordResult.actions.length,
    persistenceStatus:
      recordResult.status === "recorded" ? persistenceStatus : recordResult.status,
    persistentStatus: persistentRecordedStatus,
    phase: selectedPhase,
    phasesExecuted: phasesExecuted(runnerResult, selectedPhase),
    recordResult,
    requestId: request.requestId,
    resumePlan,
    runnerResult,
    status: finalStatus,
    summary:
      recordResult.status === "recorded"
        ? runnerResult.report.summary
        : `Queue workflow runner completed, but workflow report persistence returned ${recordResult.status}.`,
    validationReasons: validation.reasons,
    validationStatus: validation.status,
    workflowId: request.workflowId,
    workflowRunId,
    workflowStartStatus,
  };
}

export function createQueueWorkflowRunnerRuntimePortsFromQueueBridge({
  queueBridge,
}: {
  actorId: string;
  queueBridge?: WorkspaceAgentQueueBridge | null;
}): QueueWorkflowRunnerRuntimePorts {
  return {
    createSetupStartPort: queueBridge
      ? createCreateSetupStartPort(queueBridge)
      : null,
    readPort: queueBridge ? createReadPort(queueBridge) : null,
  };
}

async function runSelectedRunner({
  phase,
  ports,
  request,
  validation,
  workflowRunId,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  ports: QueueWorkflowRunnerRuntimePorts;
  request: QueueWorkflowRunnerRequest;
  validation: Parameters<typeof runQueueWorkflowReadOnlyRunner>[0]["validation"];
  workflowRunId: string;
}) {
  if (phase === "create_setup_start") {
    return runQueueWorkflowCreateSetupStartRunner({
      createSetupStartPort: ports.createSetupStartPort,
      request,
      validation,
      workflowRunId,
    });
  }

  if (!isLegacyFrontendQueueWorkflowPhase(phase)) {
    throw new Error(`Backend-owned Queue workflow phase ${phase} must use the backend step dispatcher.`);
  }

  return runQueueWorkflowReadOnlyRunner({
    readPort: ports.readPort,
    request,
    validation,
  });
}

function createReadPort(
  queueBridge: WorkspaceAgentQueueBridge,
): QueueWorkflowReadPort | null {
  if (!queueBridge.getItemAggregate || !queueBridge.listItemAggregates) {
    return null;
  }

  return {
    getEvidenceBundle: queueBridge.getWorkerEvidenceBundle
      ? (request) =>
          queueBridge.getWorkerEvidenceBundle!({
            ...(request.runId ? { runId: request.runId } : {}),
            taskId: request.taskId,
          })
      : undefined,
    getLifecycle: (taskId) => queueBridge.getItemAggregate!({ taskId }),
    getQueueItemAggregate: (taskId) => queueBridge.getItemAggregate!({ taskId }),
    listQueueItemAggregates: () => queueBridge.listItemAggregates!(),
  };
}

function createCreateSetupStartPort(
  queueBridge: WorkspaceAgentQueueBridge,
): QueueWorkflowCreateSetupStartPort | null {
  if (
    !queueBridge.applyWorkflowRunSettings ||
    !queueBridge.getQueueControlState ||
    !queueBridge.materializeWorkflowTaskSlot ||
    !queueBridge.promoteWorkflowTaskSlot ||
    !queueBridge.startWorkflowAssignedTask
  ) {
    return null;
  }

  return {
    applyRunSettings: (request) =>
      queueBridge.applyWorkflowRunSettings!(request),
    getQueueControlState: () => queueBridge.getQueueControlState!(),
    materializeTaskSlot: (request) =>
      queueBridge.materializeWorkflowTaskSlot!(request),
    promoteTaskSlot: (request) =>
      queueBridge.promoteWorkflowTaskSlot!(request),
    startWorkerForSlot: (request) =>
      queueBridge.startWorkflowAssignedTask!(request),
  };
}

function resolveRuntimePhase(
  request: QueueWorkflowRunnerRequest,
):
  | { ok: true; phase: QueueWorkflowRunnerRuntimePhase }
  | {
      ok: false;
      reason: string;
      reasonCode: string;
      status: "deferred" | "unsupported";
    } {
  const explicitPhase = stringInput(request.inputs, "phase");
  if (explicitPhase) {
    if (
      explicitPhase === "create_setup_start" ||
      explicitPhase === "read" ||
      explicitPhase === "review" ||
      explicitPhase === "finalization" ||
      explicitPhase === "worker_evidence"
    ) {
      return { ok: true, phase: explicitPhase };
    }

    return {
      ok: false,
      reason: `Queue workflow runner phase ${explicitPhase} is not supported.`,
      reasonCode: "unsupported_runner_phase",
      status: "unsupported",
    };
  }

  if (request.workflowId === "review_acceptance") {
    return { ok: true, phase: "review" };
  }

  if (CREATE_SETUP_START_WORKFLOWS.has(request.workflowId)) {
    return { ok: true, phase: "create_setup_start" };
  }

  if (request.workflowId === "terminal_failure") {
    return {
      ok: false,
      reason:
        "terminal_failure workflow runner integration is deferred; no Queue runner phase was invoked.",
      reasonCode: "terminal_failure_deferred",
      status: "deferred",
    };
  }

  return { ok: true, phase: "read" };
}

function runtimeStatusFromRunner(
  status: QueueWorkflowRunnerResult["status"],
): QueueWorkflowRunnerRuntimeStatus {
  if (
    status === "completed" ||
    status === "review_acknowledged" ||
    status === "review_completed" ||
    status === "finalization_already_done" ||
    status === "finalization_already_failed" ||
    status === "finalization_completed"
  ) {
    return "completed";
  }

  if (
    status === "paused" ||
    status === "awaiting_worker_completion" ||
    status === "awaiting_review" ||
    status === "evidence_recorded" ||
    status === "evidence_already_recorded" ||
    status === "worker_running" ||
    status === "finalization_needs_confirmation"
  ) {
    return "paused";
  }

  if (status === "invalid_request" || status === "finalization_invalid_input") {
    return "invalid_request";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  if (
    status === "failed_unexpected" ||
    status === "finalization_failed_unexpected"
  ) {
    return "failed_unexpected";
  }

  if (
    status === "review_not_supported_for_workflow" ||
    status === "finalization_not_supported_for_workflow"
  ) {
    return "unsupported";
  }

  return "blocked";
}

function phasesExecuted(
  runnerResult: QueueWorkflowRunnerResult,
  selectedPhase: QueueWorkflowRunnerRuntimePhase,
): readonly string[] {
  const phases = [
    selectedPhase,
    ...runnerResult.steps.map((step) => step.phase),
  ]
    .filter(
      (phase): phase is NonNullable<typeof phase> => phase !== undefined,
    );
  return [...new Set(phases)];
}

function startRequestForWorkflow({
  actorId,
  phase,
  request,
  workspaceId,
}: {
  actorId: string;
  phase: QueueWorkflowRunnerRuntimePhase;
  request: QueueWorkflowRunnerRequest;
  workspaceId: string;
}): StartAgentQueueWorkflowRequest {
  const slotBindings = slotBindingsFromInputs(request.inputs);
  return {
    actionLogSummary: {
      phase,
      runnerStatus: "requested",
      summary: "Queue workflow runner requested.",
    },
    actorId,
    currentStep: `${phase}_requested`,
    grantSummary: sanitizeJsonValue(request.grant),
    idempotencyKeys: {},
    inputsSnapshot: sanitizeJsonValue(request.inputs),
    mutationRefs: {},
    phase: workflowPhaseForRuntimePhase(phase),
    requestId: request.requestId,
    slotBindings,
    variables: {
      phase,
      requestId: request.requestId,
      workflowId: request.workflowId,
    },
    workflowId: request.workflowId,
    workspaceId,
  };
}

function recordRequestForRunnerResult({
  phase,
  runnerResult,
  workflowRunId,
  workspaceId,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  runnerResult: QueueWorkflowRunnerResult;
  workflowRunId: string;
  workspaceId: string;
}): RecordAgentQueueWorkflowRunnerReportRequest {
  const runtimeStatus = runtimeStatusFromRunner(runnerResult.status);
  const actions = actionSummariesForRunnerResult({
    phase,
    runnerResult,
    workflowRunId,
  });
  const blockers = runnerResult.blockers.map((blocker) => ({
    fieldPath: blocker.fieldPath,
    message: blocker.message,
    reasonCode: blocker.reasonCode,
    slot: blocker.slot,
    taskId: blocker.taskId,
  }));

  return {
    actionLogSummary: sanitizeJsonValue({
      actionCount: actions.length,
      blockers,
      refs: workflowReportRefs(runnerResult),
      phasesExecuted: phasesExecuted(runnerResult, phase),
      runnerStatus: runnerResult.status,
      summary: runnerResult.report.summary,
    }),
    actions,
    blockerReason: blockers.length > 0 ? blockers[0]?.message : null,
    currentStep: currentStepForRunnerResult(phase, runtimeStatus),
    idempotencyKeys: actions.map((action) => action.idempotencyKey),
    mutationRefs: mutationRefsForRunnerResult(runnerResult),
    pauseReason:
      persistedRunStatusFromRunner(phase, runtimeStatus) === "paused"
        ? pauseReasonForRunnerResult(phase, runnerResult)
        : null,
    phase: workflowPhaseForRuntimePhase(phase),
    slotBindings: null,
    status: persistedRunStatusFromRunner(phase, runtimeStatus),
    variables: sanitizeJsonValue({
      evidenceBundleIdsBySlot: runnerResult.variables.evidenceBundleIdsBySlot,
      messageIdsBySlot: runnerResult.variables.messageIdsBySlot,
      requestId: runnerResult.variables.requestId,
      runIdsBySlot: runnerResult.variables.runIdsBySlot,
      scopedEvidenceBundleIds: runnerResult.variables.scopedEvidenceBundleIds,
      scopedMessageIds: runnerResult.variables.scopedMessageIds,
      scopedRunIds: runnerResult.variables.scopedRunIds,
      scopedTaskIds: runnerResult.variables.scopedTaskIds,
      slots: runnerResult.variables.slots,
      taskIdsBySlot: runnerResult.variables.taskIdsBySlot,
      workflowId: runnerResult.variables.workflowId,
    }),
    workflowRunId,
    workspaceId,
  };
}

function workflowReportRefs(
  runnerResult: QueueWorkflowRunnerResult,
): AgentQueueWorkflowJsonValue {
  return sanitizeJsonValue(
    stripUndefined({
      downstreamTaskId:
        runnerResult.report.createSetupStart.downstreamTaskId ??
        runnerResult.variables.taskIdsBySlot.downstream,
      evidenceBundleId:
        runnerResult.report.workerEvidence.evidenceBundleId ??
        runnerResult.variables.evidenceBundleIdsBySlot.upstream,
      messageId:
        runnerResult.report.review.messageId ??
        runnerResult.variables.messageIdsBySlot.upstream,
      runId:
        runnerResult.report.createSetupStart.start?.runId ??
        runnerResult.report.workerEvidence.runId ??
        runnerResult.variables.runIdsBySlot.upstream,
      upstreamTaskId:
        runnerResult.report.createSetupStart.upstreamTaskId ??
        runnerResult.variables.taskIdsBySlot.upstream,
    }),
  );
}

function actionSummariesForRunnerResult({
  phase,
  runnerResult,
  workflowRunId,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  runnerResult: QueueWorkflowRunnerResult;
  workflowRunId: string;
}): RecordAgentQueueWorkflowRunnerReportAction[] {
  const actions: RecordAgentQueueWorkflowRunnerReportAction[] = [];

  for (const taskId of runnerResult.report.taskReads) {
    actions.push({
      actionType: "queue.lifecycle.get",
      idempotencyKey: `${workflowRunId}:queue.lifecycle.get:task:${taskId}`,
      resultRefs: { status: "read" },
      status: "completed",
      stepId: `read.aggregate:${taskId}`,
      targetRefs: { taskId },
    });
  }

  for (const evidenceRead of runnerResult.report.evidenceReads) {
    const keyParts = [
      workflowRunId,
      "queue.evidence.lookup",
      evidenceRead.taskId,
      evidenceRead.runId ?? "no-run",
      evidenceRead.evidenceBundleId ?? "latest",
    ];
    actions.push({
      actionType: "queue.evidence.lookup",
      idempotencyKey: keyParts.join(":"),
      resultRefs: {
        evidenceBundleId: evidenceRead.evidenceBundleId ?? null,
        runId: evidenceRead.runId ?? null,
        status: "read",
      },
      status: "completed",
      stepId: `read.evidence:${evidenceRead.taskId}`,
      targetRefs: stripNullish({
        evidenceBundleId: evidenceRead.evidenceBundleId,
        runId: evidenceRead.runId,
        taskId: evidenceRead.taskId,
      }),
    });
  }

  if (runnerResult.status.includes("failed_unexpected") && actions.length === 0) {
    actions.push({
      actionType: "queue.workflow.runner",
      blockerCode: runnerResult.blockers[0]?.reasonCode,
      blockerMessage: runnerResult.blockers[0]?.message,
      idempotencyKey: `${workflowRunId}:queue.workflow.runner:${phase}:${runnerResult.requestId}`,
      resultRefs: {
        runnerStatus: runnerResult.status,
        summary: runnerResult.report.summary,
      },
      status: "failed",
      stepId: `runner.${phase}`,
      targetRefs: {
        phase,
        requestId: runnerResult.requestId,
        workflowId: runnerResult.workflowId,
      },
    });
  }

  return actions;
}

function runnerRequestFromResumePlan({
  phase,
  plan,
  request,
}: {
  phase: QueueWorkflowRunnerRuntimePhase;
  plan: AgentQueueWorkflowResumePlan;
  request: QueueWorkflowRunnerRequest;
}): QueueWorkflowRunnerRequest {
  const persistedInputs = parseJsonRecord(plan.workflowRun.inputsSnapshotJson);
  const persistedBindings = parseJsonRecord(plan.workflowRun.slotBindingsJson);
  const bindingInputs = inputsFromResumeBindings({
    persistedBindings,
    plan,
  });

  return {
    ...(request.grant ? { grant: request.grant } : {}),
    inputs: stripUndefined({
      ...persistedInputs,
      ...bindingInputs,
      ...(request.inputs ?? {}),
      phase,
    }),
    moduleId: request.moduleId,
    requestId: request.requestId,
    workflowId: request.workflowId,
  };
}

function inputsFromResumeBindings({
  persistedBindings,
  plan,
}: {
  persistedBindings: Record<string, unknown>;
  plan: AgentQueueWorkflowResumePlan;
}) {
  const taskIdsBySlot: Record<string, string> = {};
  const runIdsBySlot: Record<string, string> = {};
  const evidenceBundleIdsBySlot: Record<string, string> = {};
  const messageIdsBySlot: Record<string, string> = {};
  const reviewAcknowledgedBySlot: Record<string, boolean> = {};

  for (const [slot, rawBinding] of Object.entries(persistedBindings)) {
    if (!isRecord(rawBinding)) continue;
    assignString(taskIdsBySlot, slot, rawBinding.taskId);
    assignString(runIdsBySlot, slot, rawBinding.runId);
    assignString(evidenceBundleIdsBySlot, slot, rawBinding.evidenceBundleId);
    assignString(messageIdsBySlot, slot, rawBinding.messageId);
  }

  for (const reconciliation of plan.slotReconciliations) {
    assignString(taskIdsBySlot, reconciliation.slot, reconciliation.taskId);
    assignString(runIdsBySlot, reconciliation.slot, reconciliation.runId);
    assignString(
      evidenceBundleIdsBySlot,
      reconciliation.slot,
      reconciliation.evidenceBundleId,
    );
    assignString(messageIdsBySlot, reconciliation.slot, reconciliation.messageId);
    if (isAckedReviewStatus(reconciliation.reviewMessageStatus)) {
      reviewAcknowledgedBySlot[reconciliation.slot] = true;
    }
  }

  return stripUndefined({
    evidenceBundleIdsBySlot,
    messageIdsBySlot,
    reviewAcknowledgedBySlot,
    runIdsBySlot,
    taskIdsBySlot,
  });
}

function resumeDecisionForPlan({
  fallbackPhase,
  plan,
  request,
}: {
  fallbackPhase: QueueWorkflowRunnerRuntimePhase;
  plan: AgentQueueWorkflowResumePlan;
  request: QueueWorkflowRunnerRequest;
}):
  | { ok: true; phase: QueueWorkflowRunnerRuntimePhase }
  | {
      blockers: readonly string[];
      ok: false;
      phase?: QueueWorkflowRunnerRuntimePhase;
      status: QueueWorkflowRunnerRuntimeStatus;
      summary: string;
    } {
  const plannedPhase = runtimePhaseFromWorkflowPhase(plan.nextPhase) ?? fallbackPhase;
  if (
    plan.status === "terminal_completed" ||
    plan.status === "terminal_failed" ||
    plan.status === "terminal_cancelled"
  ) {
    return {
      blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
      ok: false,
      phase: plannedPhase,
      status: plan.status === "terminal_completed" ? "completed" : "blocked",
      summary: plan.reportSummary,
    };
  }

  if (plan.requiredFreshGrant && !request.grant) {
    return {
      blockers: ["Fresh structured Queue workflow grant is required."],
      ok: false,
      phase: plannedPhase,
      status: "blocked",
      summary:
        "Queue workflow resume requires a fresh structured grant; Queue workflow runner was not invoked.",
    };
  }

  if (
    plan.nextStep === "awaiting_worker_completion" ||
    plan.nextStep === "worker_running_waiting_for_evidence"
  ) {
    return {
      blockers: [],
      ok: false,
      phase: "worker_evidence",
      status: "paused",
      summary:
        "Queue workflow worker is still running; worker evidence was not recorded.",
    };
  }

  if (plan.status === "resume_read_only_ready") {
    return {
      ok: true,
      phase: plannedPhase === "create_setup_start" ? plannedPhase : "read",
    };
  }

  if (
    isWorkerEvidenceResumeStep(plan) &&
    workerEvidenceResumeAllowedByPlan(plan)
  ) {
    if (!hasTypedWorkerEvidenceInput(request)) {
      return {
        blockers: ["Typed inputs.workerEvidence is required to record worker evidence."],
        ok: false,
        phase: "worker_evidence",
        status: "paused",
        summary:
          "Queue workflow worker completion/evidence input is missing; evidence was not recorded.",
      };
    }
    return { ok: true, phase: "worker_evidence" };
  }

  if (isWorkerEvidenceResumeStep(plan)) {
    return {
      blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
      ok: false,
      phase: "worker_evidence",
      status: plan.status === "failed_unexpected" ? "failed_unexpected" : "blocked",
      summary: plan.reportSummary,
    };
  }

  if (isReviewResumeStep(plan)) {
    if (!reviewResumeAllowedByPlan(plan)) {
      return {
        blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
        ok: false,
        phase: "review",
        status: plan.status === "failed_unexpected" ? "failed_unexpected" : "blocked",
        summary: plan.reportSummary,
      };
    }
    return { ok: true, phase: "review" };
  }

  if (plan.requiredConfirmation || plan.status === "blocked_missing_confirmation") {
    if (plannedPhase === "finalization") {
      return { ok: true, phase: plannedPhase };
    }
    if (
      !(
        plannedPhase === "create_setup_start" &&
        plan.nextStep === "start_worker_ready"
      )
    ) {
      return {
        blockers: [
          "Fresh confirmation may only resume supported finalization or worker-start phases.",
        ],
        ok: false,
        phase: plannedPhase,
        status: "blocked",
        summary:
          "Queue workflow resume requested confirmation for an unsupported phase; Queue workflow runner was not invoked.",
      };
    }
    if (request.grant?.confirmationToken !== "operator-confirmed") {
      return {
        blockers: ["Fresh exact structured confirmationToken is required."],
        ok: false,
        phase: plannedPhase,
        status: "paused",
        summary:
          "Queue workflow resume requires fresh exact structured confirmation; Queue workflow runner was not invoked.",
      };
    }
    return { ok: true, phase: plannedPhase };
  }

  if (
    plan.status === "blocked_missing_task" ||
    plan.status === "blocked_state_mismatch" ||
    plan.status === "blocked_missing_review_ack" ||
    plan.status === "blocked_missing_evidence" ||
    plan.status === "blocked_stale_grant" ||
    plan.status === "blocked_settings_mismatch" ||
    plan.status === "blocked_promote_state_mismatch" ||
    plan.status === "blocked_executor_mismatch" ||
    plan.status === "blocked_incomplete_slot_binding" ||
    plan.status === "blocked_incomplete_workflow_action_refs" ||
    plan.status === "blocked_dependency_edge_missing" ||
    plan.status === "unsupported_phase" ||
    plan.status === "failed_unexpected" ||
    plan.status === "version_conflict"
  ) {
    return {
      blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
      ok: false,
      phase: plannedPhase,
      status: plan.status === "failed_unexpected" ? "failed_unexpected" : "blocked",
      summary: plan.reportSummary,
    };
  }

  if (
    plan.status === "resume_ready" ||
    plan.status === "waiting_for_run_settings" ||
    plan.status === "waiting_for_promote"
  ) {
    return {
      ok: true,
      phase: plannedPhase,
    };
  }

  return {
    blockers: plan.blockers.map((blocker) => blocker.blockerMessage),
    ok: false,
    phase: plannedPhase,
    status: "blocked",
    summary: plan.reportSummary,
  };
}

function isWorkerEvidenceResumeStep(plan: AgentQueueWorkflowResumePlan): boolean {
  return (
    plan.nextPhase === "worker_evidence" ||
    plan.nextStep === "waiting_for_worker_evidence" ||
    plan.nextStep === "worker_evidence_required"
  );
}

function workerEvidenceResumeAllowedByPlan(
  plan: AgentQueueWorkflowResumePlan,
): boolean {
  return (
    plan.status === "retryable_worker_evidence_failure" ||
    plan.status === "retryable_worker_evidence_action_repair" ||
    plan.status === "waiting_for_worker_evidence"
  );
}

function isReviewResumeStep(plan: AgentQueueWorkflowResumePlan): boolean {
  return (
    plan.nextPhase === "review" &&
    (plan.nextStep === "review_create_ready" ||
      plan.nextStep === "review_ack_ready" ||
      plan.nextStep === "awaiting_review")
  );
}

function reviewResumeAllowedByPlan(plan: AgentQueueWorkflowResumePlan): boolean {
  return (
    plan.status === "resume_ready" ||
    plan.status === "retryable_review_failure_before_mutation" ||
    (plan.status === "blocked_missing_review_ack" &&
      plan.nextStep === "review_ack_ready")
  );
}

function workflowRunIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const value = metadata?.workflowRunId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasTypedWorkerEvidenceInput(
  request: QueueWorkflowRunnerRequest,
): boolean {
  const workerEvidence = recordRecord(request.inputs, "workerEvidence");
  return (
    stringValue(workerEvidence.slot) === "upstream" &&
    Boolean(stringValue(workerEvidence.taskId)) &&
    Boolean(stringValue(workerEvidence.runId)) &&
    ["completed", "not_completed", "failed"].includes(
      stringValue(workerEvidence.outcome) ?? "",
    )
  );
}

function blockersFromRecordResult(
  result: AgentQueueWorkflowRunnerReportRecordResult,
): string[] {
  return [
    result.blocker?.blockerMessage,
    result.conflict?.conflictMessage,
  ].filter((message): message is string => Boolean(message));
}

function persistedRunStatusFromRunner(
  phase: QueueWorkflowRunnerRuntimePhase,
  runtimeStatus: QueueWorkflowRunnerRuntimeStatus,
) {
  if (runtimeStatus === "failed_unexpected") return "failed";
  if (
    runtimeStatus === "blocked" ||
    runtimeStatus === "invalid_request" ||
    runtimeStatus === "unavailable" ||
    runtimeStatus === "unsupported"
  ) {
    return "blocked";
  }
  return "paused";
}

function currentStepForRunnerResult(
  phase: QueueWorkflowRunnerRuntimePhase,
  runtimeStatus: QueueWorkflowRunnerRuntimeStatus,
) {
  if (phase === "create_setup_start" && runtimeStatus === "paused") {
    return "awaiting_worker_completion";
  }
  if (phase === "worker_evidence" && runtimeStatus === "paused") {
    return "awaiting_review";
  }
  if (runtimeStatus === "failed_unexpected") return `${phase}_failed_unexpected`;
  if (runtimeStatus === "blocked") return `${phase}_blocked`;
  if (phase === "review" && runtimeStatus === "completed") return "review_ack";
  if (phase === "read" && runtimeStatus === "completed") return "read_complete";
  return `${phase}_${runtimeStatus}`;
}

function workflowPhaseForRuntimePhase(phase: QueueWorkflowRunnerRuntimePhase) {
  if (phase === "create_setup_start") return "run_start";
  if (phase === "review") return "review";
  if (phase === "worker_evidence") return "worker_evidence";
  return "worker_evidence";
}

function runtimePhaseFromWorkflowPhase(
  phase: string | null,
): QueueWorkflowRunnerRuntimePhase | null {
  if (phase === "decision" || phase === "closed") return "finalization";
  if (phase === "review") return "review";
  if (phase === "worker_evidence") return "worker_evidence";
  if (phase === "setup" || phase === "run_start") return "create_setup_start";
  if (phase === "intake") {
    return "read";
  }
  return null;
}

function pauseReasonForRunnerResult(
  phase: QueueWorkflowRunnerRuntimePhase,
  runnerResult: QueueWorkflowRunnerResult,
) {
  if (
    phase === "create_setup_start" &&
    (runnerResult.status === "awaiting_worker_completion" ||
      runnerResult.status === "worker_running")
  ) {
    return "awaiting_worker_completion";
  }
  if (phase === "worker_evidence" && runnerResult.status === "awaiting_review") {
    return "awaiting_review";
  }

  return "awaiting_next_typed_workflow_request";
}

function mutationRefsForRunnerResult(
  runnerResult: QueueWorkflowRunnerResult,
): AgentQueueWorkflowJsonValue {
  const createSetupStart = runnerResult.report.createSetupStart;
  const workerEvidence = runnerResult.report.workerEvidence;
  const review = runnerResult.report.review;
  return sanitizeJsonValue(
    stripUndefined({
      createSetupStartStatus: createSetupStart.status,
      downstreamTaskId: createSetupStart.downstreamTaskId,
      evidenceBundleId: workerEvidence.evidenceBundleId,
      recordWorkerEvidenceStatus: workerEvidence.commandStatus,
      executionTargetHash: createSetupStart.runSettings?.executionTargetHash,
      executionTargetKind: createSetupStart.runSettings?.executionTargetKind,
      settingsHash: createSetupStart.runSettings?.settingsHash,
      startedRunId: createSetupStart.start?.runId,
      upstreamTaskId: createSetupStart.upstreamTaskId,
      workerEvidenceRunId: workerEvidence.runId,
      workerEvidenceTaskId: workerEvidence.taskId,
      reviewAckStatus: review.ackStatus,
      reviewCreateStatus: review.createStatus,
      reviewMessageId: review.messageId,
      reviewTaskId: review.taskId,
    }),
  );
}

function slotBindingsFromInputs(
  inputs: QueueWorkflowRunnerRequest["inputs"],
): AgentQueueWorkflowJsonValue {
  const taskIdsBySlot = recordRecord(inputs, "taskIdsBySlot");
  const runIdsBySlot = recordRecord(inputs, "runIdsBySlot");
  const evidenceBundleIdsBySlot = recordRecord(inputs, "evidenceBundleIdsBySlot");
  const messageIdsBySlot = recordRecord(inputs, "messageIdsBySlot");
  const slots = new Set([
    ...Object.keys(taskIdsBySlot),
    ...Object.keys(runIdsBySlot),
    ...Object.keys(evidenceBundleIdsBySlot),
    ...Object.keys(messageIdsBySlot),
  ]);
  const bindings: Record<string, unknown> = {};
  for (const slot of slots) {
    bindings[slot] = stripUndefined({
      evidenceBundleId: stringValue(evidenceBundleIdsBySlot[slot]),
      messageId: stringValue(messageIdsBySlot[slot]),
      runId: stringValue(runIdsBySlot[slot]),
      taskId: stringValue(taskIdsBySlot[slot]),
    });
  }
  return sanitizeJsonValue(bindings);
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeJsonValue(value: unknown): AgentQueueWorkflowJsonValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue) as AgentQueueWorkflowJsonValue;
  }
  if (isRecord(value)) {
    const next: Record<string, AgentQueueWorkflowJsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "confirmationToken" || typeof item === "undefined") continue;
      next[key] = sanitizeJsonValue(item);
    }
    return next;
  }
  return null;
}

function stripNullish(value: Record<string, unknown>): AgentQueueWorkflowJsonValue {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) next[key] = item;
  }
  return sanitizeJsonValue(next);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key] = item;
  }
  return next as T;
}

function assignString(
  target: Record<string, string>,
  key: string,
  value: unknown,
) {
  const text = stringValue(value);
  if (text) target[key] = text;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAckedReviewStatus(value: string | null): boolean {
  return value === "acked" || value === "acknowledged" || value === "done";
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
  actionLedgerSummaryCount,
  blockers = [],
  moduleId = null,
  persistedActionCount,
  persistenceStatus,
  persistentStatus,
  phase = null,
  requestId = null,
  requestHashConflict,
  resumePlan,
  status,
  summary,
  unsupportedReason,
  validationReasons = [],
  validationStatus,
  workflowId = null,
  workflowRunId = null,
  workflowStartStatus,
}: {
  actionLedgerSummaryCount?: number;
  blockers?: readonly string[];
  moduleId?: string | null;
  persistedActionCount?: number;
  persistenceStatus?: string | null;
  persistentStatus?: string | null;
  phase?: QueueWorkflowRunnerRuntimePhase | null;
  requestId?: string | null;
  requestHashConflict?: AgentQueueWorkflowStartResult["conflict"];
  resumePlan?: AgentQueueWorkflowResumePlan;
  status: QueueWorkflowRunnerRuntimeStatus;
  summary: string;
  unsupportedReason?: string;
  validationReasons?: readonly string[];
  validationStatus?: string;
  workflowId?: string | null;
  workflowRunId?: string | null;
  workflowStartStatus?: AgentQueueWorkflowStartResult["status"] | null;
}): QueueWorkflowRunnerRuntimeResult {
  return {
    ...(typeof actionLedgerSummaryCount === "number"
      ? { actionLedgerSummaryCount }
      : {}),
    blockers,
    invoked: false,
    moduleId,
    ...(typeof persistedActionCount === "number" ? { persistedActionCount } : {}),
    ...(persistenceStatus ? { persistenceStatus } : {}),
    ...(persistentStatus ? { persistentStatus } : {}),
    phase,
    phasesExecuted: [],
    ...(requestHashConflict ? { requestHashConflict } : {}),
    requestId,
    ...(resumePlan ? { resumePlan } : {}),
    status,
    summary,
    ...(unsupportedReason ? { unsupportedReason } : {}),
    validationReasons,
    ...(validationStatus ? { validationStatus } : {}),
    workflowId,
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(workflowStartStatus ? { workflowStartStatus } : {}),
  };
}

function stringInput(
  inputs: QueueWorkflowRunnerRequest["inputs"],
  fieldName: string,
): string | null {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return null;
  }

  const value = inputs[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
