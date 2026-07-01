import type {
  WorkspaceAgentQueueBridge,
  WorkspaceAgentQueueControlState,
} from "../../../workspaceAgentQueueBridge";
import type {
  AgentQueueItemAggregate,
  AgentQueueCompletionCommandResult,
  AgentQueueFailureCommandResult,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
  AgentQueueWorkflowAction,
  AgentQueueWorkflowReport,
  AgentQueueWorkflowResumeBlocker,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowRun,
  AgentQueueWorkflowSlotReconciliation,
  AgentQueueWorkflowTaskResumeSnapshot,
} from "../../../../workspace/types";
import {
  createQueueBackendCapabilityPort,
  type QueueBackendCapabilityPort,
} from "../queueBackendCapabilityPort";
import {
  buildQueueCapabilityNextAction,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../../capabilities/queueCapabilityContracts";
import { createInMemoryQueueDogfoodLifecycleAdapterApi } from "../queueAgentDogfoodLifecycleController";
import { createDefaultQueueAgentAdapterApi } from "../queueAgentCapabilities";
import {
  createQueueAgentItemsPreview,
  queueAgentCreatedItem,
  queueNextActionUnavailableFields,
  QUEUE_ACTIVITY_EVENTS,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentAggregateNextAction,
  type QueueAgentCapabilityStatus,
  type QueueAgentControlGetInput,
  type QueueAgentControlGetResult,
  type QueueAgentControlSetManualEnabledInput,
  type QueueAgentControlSetManualEnabledResult,
  type QueueAgentCreateItemsRequest,
  type QueueAgentCreateItemsResult,
  type QueueAgentCreatedItem,
  type QueueAgentEnableInput,
  type QueueAgentEnableResult,
  type QueueAgentExecutorTarget,
  type QueueAgentLifecycleTaskSeed,
  type QueueAgentLifecycleAgentFinishedInput,
  type QueueAgentLifecycleGetInput,
  type QueueAgentLifecycleGetOutput,
  type QueueAgentLifecycleHandlerContext,
  type QueueAgentLifecycleTransitionOutput,
  type QueueAgentListItemsInput,
  type QueueAgentListItemsResult,
  type QueueAgentFailInput,
  type QueueAgentMarkDoneInput,
  type QueueAgentPromoteDraftResult,
  type QueueAgentPromptPackInput,
  type QueueAgentRunApprovalPolicy,
  type QueueAgentRunSandbox,
  type QueueAgentNextActionFields,
  type QueueAgentReviewAckInput,
  type QueueAgentReviewCreateMessageInput,
  type QueueAgentReviewEvidenceBundleInput,
  type QueueAgentReviewEvidenceBundleOutput,
  type QueueAgentStartRunAttemptResult,
  type QueueAgentTaskReadiness,
  type QueueAgentTaskSummary,
  type QueueAgentUpdateRunSettingsInput,
  type QueueAgentUpdateRunSettingsResult,
  type QueueAgentWorkflowActionCountSummary,
  type QueueAgentWorkflowFocusedAction,
  type QueueAgentWorkflowActionSummary,
  type QueueAgentWorkflowBlockerSummary,
  type QueueAgentWorkflowGetInput,
  type QueueAgentWorkflowGetReportInput,
  type QueueAgentWorkflowGetResult,
  type QueueAgentWorkflowListInput,
  type QueueAgentWorkflowListResult,
  type QueueAgentWorkflowNoMutationFlags,
  type QueueAgentWorkflowPlanResumeInput,
  type QueueAgentWorkflowPlanResumeResult,
  type QueueAgentWorkflowReadActionLogInput,
  type QueueAgentWorkflowReadActionLogResult,
  type QueueAgentWorkflowRefMaps,
  type QueueAgentWorkflowReportDiagnostics,
  type QueueAgentWorkflowReportResult,
  type QueueAgentWorkflowResumeDiagnostics,
  type QueueAgentWorkflowRunSummary,
  type QueueAgentWorkflowSafeJsonValue,
  type QueueAgentWorkflowSlotBindingSummary,
} from "../queueAgentCapabilityTypes";
import type {
  QueueUpdateItemPatch,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "../../../queue/agentQueueWidgetApiTypes";
import {
  boundedText,
  firstString,
  isRecord,
  safeWorkflowText,
  stringFieldFromRecordOrNull,
} from "./queueBridgePrimitiveHelpers";
import {
  type WorkflowActionSlotResolution,
  workflowActionSlotResolution,
  workflowDiagnosticRefMaps,
  workflowRefRecord,
  workflowSlotBindingsFromRun,
} from "./queueBridgeWorkflowRefs";
import {
  boundedDiagnosticText,
  safeWorkflowJsonSummary,
  tryParseWorkflowJson,
  workflowExactRefsFromJson,
} from "./queueBridgeWorkflowRedaction";

export function isRetryableWorkerEvidencePlanBlocker(blockerCode: string | null) {
  return (
    blockerCode === "retryable_worker_evidence_failure" ||
    blockerCode === "retryable_worker_evidence_action_repair"
  );
}

export function workflowActionSummary(
  action: AgentQueueWorkflowAction,
): QueueAgentWorkflowActionSummary {
  return {
    actionId: action.actionId,
    actionType: action.actionType,
    attemptCount: action.attemptCount,
    blockerCode: action.blockerCode ?? null,
    blockerMessage: boundedText(action.blockerMessage),
    completedAt: action.completedAt ?? null,
    createdAt: action.createdAt,
    idempotencyKey: safeWorkflowText(action.idempotencyKey, 240),
    resultRefs: safeWorkflowJsonSummary(action.resultRefsJson),
    startedAt: action.startedAt ?? null,
    status: action.status,
    stepId: action.stepId,
    targetRefs: safeWorkflowJsonSummary(action.targetRefsJson),
    updatedAt: action.updatedAt,
  };
}

export function workflowReportDiagnostics(
  report: AgentQueueWorkflowReport,
  refs: QueueAgentWorkflowRefMaps,
  slotBindings: Record<string, QueueAgentWorkflowSlotBindingSummary>,
): QueueAgentWorkflowReportDiagnostics {
  const startWorker = workflowStartWorkerDiagnostics(
    report.actions,
    slotBindings,
    refs,
  );
  const missingRefs = startWorkerMissingRefs(startWorker, refs);
  const diagnosticRefs = workflowDiagnosticRefMaps(refs, startWorker.slot);

  return {
    recoveryState: {
      canDiagnoseWorkerEvidence:
        startWorker.actionPresent &&
        missingRefs.length === 0 &&
        startWorker.status === "completed",
      missingRefs,
      suspectedBlocker: workflowReportSuspectedBlocker(
        startWorker,
        missingRefs,
      ),
    },
    refMaps: diagnosticRefs,
    startWorker,
  };
}

export function workflowResumeDiagnostics(
  plan: AgentQueueWorkflowResumePlan,
  refs: QueueAgentWorkflowRefMaps,
): QueueAgentWorkflowResumeDiagnostics {
  const slotBindings = workflowSlotBindingsFromRun(plan.workflowRun, refs);
  const startWorker = workflowStartWorkerDiagnostics(
    plan.actions,
    slotBindings,
    refs,
  );
  const startWorkerMissing = startWorkerMissingRefs(startWorker, refs);
  const blockers = plan.blockers.map(workflowResumeBlockerSummary);
  const missingRefs = blockers.filter(
    (blocker) =>
      Boolean(blocker.missingRequiredField) &&
      !isRetryableWorkerEvidencePlanBlocker(blocker.blockerCode),
  );
  const workerState = workflowResumeWorkerState(plan, startWorker);
  const diagnosticRefs = workflowDiagnosticRefMaps(refs, startWorker.slot);
  const workerRunning =
    workerState.workerRunState === "running" ||
    workerState.latestRunStatus === "running";
  const refsIncomplete =
    startWorkerMissing.length > 0 ||
    missingRefs.length > 0 ||
    plan.status === "blocked_incomplete_workflow_action_refs";
  const atWorkerEvidence =
    plan.nextPhase === "worker_evidence" &&
    (plan.nextStep === "waiting_for_worker_evidence" ||
      plan.nextStep === "record_worker_evidence");
  const safeToRecordWorkerEvidence =
    atWorkerEvidence &&
    !workerRunning &&
    !refsIncomplete &&
    (plan.status === "waiting_for_worker_evidence" ||
      plan.status === "retryable_worker_evidence_failure" ||
      plan.status === "retryable_worker_evidence_action_repair" ||
      plan.status === "resume_ready" ||
      plan.status === "resume_read_only_ready");

  return {
    blockers,
    continuationRefs: diagnosticRefs,
    missingRefs,
    nextPhase: plan.nextPhase ?? null,
    nextStep: plan.nextStep ?? null,
    reasonIfNotSafe: safeToRecordWorkerEvidence
      ? null
      : workerRunning
        ? "worker_running"
        : refsIncomplete
          ? "refs_incomplete"
          : atWorkerEvidence
            ? "planner_not_ready"
            : "planner_not_at_worker_evidence",
    recoveredRefs: diagnosticRefs,
    safeToRecordWorkerEvidence,
    startWorkerRefCheck: {
      actionPresent: startWorker.actionPresent,
      actionStatus: startWorker.status,
      executionTargetHashPresent: startWorker.hasExecutionTargetHash,
      missingRefs: startWorkerMissing,
      runIdPresent: startWorker.hasRunId,
      settingsHashPresent: startWorker.hasSettingsHash,
      slotPresent: startWorker.hasSlot,
      taskIdPresent: startWorker.hasTaskId,
    },
    staleHistory: workflowResumeStaleHistory(plan.actions),
    status: plan.status,
    workerState,
  };
}

export function workflowResumeStaleHistory(
  actions: readonly AgentQueueWorkflowAction[],
) {
  return actions
    .filter(isStaleWorkerEvidenceHistoryAction)
    .slice(0, 10)
    .map(workflowActionSummary);
}

export function isStaleWorkerEvidenceHistoryAction(action: AgentQueueWorkflowAction) {
  if (
    action.actionType === "queue.workflow.runner" &&
    action.status === "failed" &&
    (action.stepId === "runner.worker_evidence" ||
      workflowActionPhase(action) === "worker_evidence")
  ) {
    return true;
  }

  if (action.actionType !== "record_worker_evidence" || action.status === "completed") {
    return false;
  }
  if (workflowActionResultField(action, ["evidenceBundleId", "evidence_bundle_id"])) {
    return false;
  }
  const blockerCode = action.blockerCode ?? null;
  const resultStatus = workflowActionResultField(action, ["commandStatus", "status"]);
  return (
    blockerCode === "failed_unexpected" ||
    blockerCode === "incomplete_workflow_action_refs" ||
    blockerCode === "precondition_failed" ||
    blockerCode === "worker_outcome_mismatch" ||
    blockerCode === "workflow_run_terminal" ||
    resultStatus === "failed_unexpected" ||
    resultStatus === "precondition_failed"
  );
}

export function workflowActionPhase(action: AgentQueueWorkflowAction) {
  return firstString([
    workflowActionTargetField(action, ["phase"]),
    workflowActionResultField(action, ["phase"]),
  ]);
}

export function workflowActionTargetField(
  action: AgentQueueWorkflowAction,
  keys: readonly string[],
) {
  return stringFieldFromRecordOrNull(
    workflowRawRefRecord(action.targetRefsJson),
    keys,
  );
}

export function workflowActionResultField(
  action: AgentQueueWorkflowAction,
  keys: readonly string[],
) {
  return stringFieldFromRecordOrNull(
    workflowRawRefRecord(action.resultRefsJson),
    keys,
  );
}

export function workflowRawRefRecord(json: string | null | undefined) {
  const parsed = tryParseWorkflowJson(json);
  return isRecord(parsed) ? parsed : null;
}

export function workflowStartWorkerDiagnostics(
  actions: readonly AgentQueueWorkflowAction[],
  slotBindings: Record<string, QueueAgentWorkflowSlotBindingSummary>,
  refs: QueueAgentWorkflowRefMaps,
) {
  const action = selectStartWorkerAction(actions, slotBindings);
  if (!action) {
    return {
      actionId: null,
      actionPresent: false,
      blockerCode: null,
      blockerMessage: null,
      derivedSlot: null,
      executionTargetHash: null,
      hasExecutionTargetHash: false,
      hasRunId: false,
      hasSettingsHash: false,
      hasSlot: false,
      hasTaskId: false,
      idempotencyKey: null,
      recoveredFromTaskId: false,
      resultRefs: null,
      runId: null,
      settingsHash: null,
      slot: null,
      status: null,
      targetRefs: null,
      taskId: null,
    };
  }

  const targetRefs = workflowExactRefsFromJson(action.targetRefsJson);
  const resultRefs = workflowExactRefsFromJson(action.resultRefsJson);
  const targetRecord = workflowRefRecord(targetRefs);
  const resultRecord = workflowRefRecord(resultRefs);
  const slotResolution = workflowActionSlotResolution(action, slotBindings);
  const slot = slotResolution.slot;
  const binding = slot ? slotBindings[slot] : null;
  const runId = firstString([
    stringFieldFromRecordOrNull(resultRecord, ["runId", "run_id"]),
    binding?.runId,
    slot ? refs.runIdsBySlot[slot] : null,
  ]);
  const taskId = firstString([
    stringFieldFromRecordOrNull(targetRecord, ["taskId", "task_id"]),
    stringFieldFromRecordOrNull(resultRecord, ["taskId", "task_id"]),
    binding?.taskId,
    slot ? refs.taskIdsBySlot[slot] : null,
  ]);
  const settingsHash = firstString([
    stringFieldFromRecordOrNull(targetRecord, [
      "settingsHash",
      "settings_hash",
    ]),
    stringFieldFromRecordOrNull(resultRecord, [
      "settingsHash",
      "settings_hash",
    ]),
    binding?.settingsHash,
  ]);
  const executionTargetHash = firstString([
    stringFieldFromRecordOrNull(targetRecord, [
      "executionTargetHash",
      "execution_target_hash",
    ]),
    stringFieldFromRecordOrNull(resultRecord, [
      "executionTargetHash",
      "execution_target_hash",
    ]),
    binding?.executionTargetHash,
  ]);

  return {
    actionId: action.actionId,
    actionPresent: true,
    blockerCode: action.blockerCode ?? null,
    blockerMessage: boundedDiagnosticText(action.blockerMessage),
    derivedSlot: slotResolution.derivedSlot,
    executionTargetHash,
    hasExecutionTargetHash: Boolean(executionTargetHash),
    hasRunId: Boolean(runId),
    hasSettingsHash: Boolean(settingsHash),
    hasSlot: Boolean(slot),
    hasTaskId: Boolean(taskId),
    idempotencyKey: action.idempotencyKey,
    recoveredFromTaskId: slotResolution.recoveredFromTaskId,
    resultRefs,
    runId,
    settingsHash,
    slot,
    status: action.status,
    targetRefs,
    taskId,
  };
}

export function selectStartWorkerAction(
  actions: readonly AgentQueueWorkflowAction[],
  slotBindings: Record<string, QueueAgentWorkflowSlotBindingSummary>,
) {
  const startWorkerActions = actions.filter(
    (action) => action.actionType === "start_worker",
  );
  if (startWorkerActions.length <= 1) {
    return startWorkerActions[0] ?? null;
  }

  const upstreamActions = startWorkerActions.filter(
    (action) =>
      workflowActionSlotResolution(action, slotBindings).slot === "upstream",
  );
  return upstreamActions.length === 1 ? upstreamActions[0] : startWorkerActions[0];
}

export function startWorkerMissingRefs(
  startWorker: ReturnType<typeof workflowStartWorkerDiagnostics>,
  refs: QueueAgentWorkflowRefMaps,
) {
  if (!startWorker.actionPresent) {
    return ["startWorker.action"];
  }

  const missing: string[] = [];
  if (!startWorker.hasSlot) {
    missing.push("startWorker.targetRefs.slot");
  }
  if (!startWorker.hasTaskId) {
    missing.push("startWorker.targetRefs.taskId");
  }
  if (!startWorker.hasSettingsHash) {
    missing.push("startWorker.targetRefs.settingsHash");
  }
  if (!startWorker.hasExecutionTargetHash) {
    missing.push("startWorker.targetRefs.executionTargetHash");
  }
  if (!startWorker.hasRunId) {
    missing.push("startWorker.resultRefs.runId");
  }
  if (
    startWorker.slot &&
    startWorker.taskId &&
    refs.taskIdsBySlot[startWorker.slot] !== startWorker.taskId
  ) {
    missing.push(`diagnostics.refMaps.taskIdsBySlot.${startWorker.slot}`);
  }
  if (
    startWorker.slot &&
    startWorker.runId &&
    refs.runIdsBySlot[startWorker.slot] !== startWorker.runId
  ) {
    missing.push(`diagnostics.refMaps.runIdsBySlot.${startWorker.slot}`);
  }

  return missing;
}

export function workflowReportSuspectedBlocker(
  startWorker: ReturnType<typeof workflowStartWorkerDiagnostics>,
  missingRefs: readonly string[],
) {
  if (!startWorker.actionPresent) {
    return "start_worker_action_missing";
  }
  if (startWorker.status !== "completed") {
    return "start_worker_action_not_completed";
  }
  if (missingRefs.length > 0) {
    return "start_worker_refs_incomplete";
  }
  return null;
}

export function workflowResumeWorkerState(
  plan: AgentQueueWorkflowResumePlan,
  startWorker: ReturnType<typeof workflowStartWorkerDiagnostics>,
): QueueAgentWorkflowResumeDiagnostics["workerState"] {
  const reconciliation =
    findWorkflowSlotReconciliation(plan.slotReconciliations, startWorker) ??
    null;
  const snapshot =
    plan.taskSnapshots.find(
      (candidate) =>
        candidate.taskId === startWorker.taskId ||
        candidate.latestRunId === startWorker.runId,
    ) ?? null;

  return {
    evidenceState:
      snapshot?.evidenceState ?? reconciliation?.aggregateEvidenceState ?? null,
    latestRunId: snapshot?.latestRunId ?? null,
    latestRunStatus: snapshot?.latestRunStatus ?? null,
    runExists: reconciliation?.runExists ?? null,
    runId: reconciliation?.runId ?? startWorker.runId,
    taskExists: reconciliation?.taskExists ?? null,
    taskId: reconciliation?.taskId ?? snapshot?.taskId ?? startWorker.taskId,
    ticketState:
      snapshot?.ticketState ?? reconciliation?.aggregateTicketState ?? null,
    workerRunState: snapshot?.workerRunState ?? null,
  };
}

export function findWorkflowSlotReconciliation(
  reconciliations: readonly AgentQueueWorkflowSlotReconciliation[],
  startWorker: ReturnType<typeof workflowStartWorkerDiagnostics>,
) {
  return (
    reconciliations.find(
      (candidate) => startWorker.slot && candidate.slot === startWorker.slot,
    ) ??
    reconciliations.find(
      (candidate) =>
        startWorker.taskId && candidate.taskId === startWorker.taskId,
    ) ??
    reconciliations.find(
      (candidate) => startWorker.runId && candidate.runId === startWorker.runId,
    ) ??
    (reconciliations.length === 1 ? reconciliations[0] : null)
  );
}

export function workflowRunBlockers(
  workflowRun: AgentQueueWorkflowRun,
): QueueAgentWorkflowBlockerSummary[] {
  const blockerReason = boundedText(workflowRun.blockerReason);
  if (!blockerReason) {
    return [];
  }

  return [
    {
      blockerCode: "workflow_blocker",
      blockerMessage: blockerReason,
    },
  ];
}

export function workflowActionBlockers(
  actions: readonly AgentQueueWorkflowAction[],
): QueueAgentWorkflowBlockerSummary[] {
  return actions
    .filter((action) => Boolean(action.blockerCode || action.blockerMessage))
    .slice(0, 25)
    .map((action) => ({
      blockerCode: action.blockerCode ?? "workflow_action_blocker",
      blockerMessage:
        boundedText(action.blockerMessage) ??
        `Workflow action ${action.actionType} is ${action.status}.`,
    }));
}

export function workflowResumeBlockerSummary(
  blocker: AgentQueueWorkflowResumeBlocker,
): QueueAgentWorkflowBlockerSummary {
  return {
    blockerCode: blocker.blockerCode,
    blockerMessage: boundedText(blocker.blockerMessage) ?? blocker.blockerCode,
    completionDecisionId: blocker.completionDecisionId,
    evidenceBundleId: blocker.evidenceBundleId,
    failureDecisionId: blocker.failureDecisionId,
    messageId: blocker.messageId,
    missingRequiredField: blocker.missingRequiredField,
    runId: blocker.runId,
    slot: blocker.slot,
    taskId: blocker.taskId,
  };
}

export function workflowTaskSnapshot(
  snapshot: AgentQueueWorkflowTaskResumeSnapshot,
): QueueAgentWorkflowPlanResumeResult["taskSnapshots"][number] {
  return {
    dependencyState: snapshot.dependencyState,
    evidenceState: snapshot.evidenceState,
    latestCompletionDecisionId: snapshot.latestCompletionDecisionId,
    latestEvidenceBundleId: snapshot.latestEvidenceBundleId,
    latestFailureDecisionId: snapshot.latestFailureDecisionId,
    latestReviewMessageId: snapshot.latestReviewMessageId,
    latestRunId: snapshot.latestRunId,
    reviewState: snapshot.reviewState,
    taskId: snapshot.taskId,
    ticketState: snapshot.ticketState,
    validationState: snapshot.validationState,
    workerRunState: snapshot.workerRunState,
  };
}
