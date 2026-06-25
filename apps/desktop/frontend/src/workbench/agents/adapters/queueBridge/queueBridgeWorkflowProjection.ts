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
  boundedItemLimit,
  boundedLongText,
  boundedText,
  countBy,
  firstString,
  isRecord,
  missingCapabilitiesFromSummary,
  normalizedString,
  nextActionFromSummary,
  safeWorkflowText,
  stringFieldFromValue,
  stringFieldFromRecordOrNull,
} from "./queueBridgePrimitiveHelpers";
import {
  mergeWorkflowRefMaps,
  workflowActionSlotResolution,
  type WorkflowActionSlotResolution,
  workflowDiagnosticRefMaps,
  workflowRefRecord,
  workflowRefsFromActions,
  workflowRefsFromJson,
  workflowRefsFromSlotReconciliations,
  workflowRefsFromTaskSnapshots,
  workflowSlotBindingsFromRun,
} from "./queueBridgeWorkflowRefs";
import {
  boundedDiagnosticText,
  safeWorkflowJsonSummary,
  tryParseWorkflowJson,
  workflowExactRefsFromJson,
} from "./queueBridgeWorkflowRedaction";
import {
  workflowActionBlockers,
  workflowReportDiagnostics,
  workflowResumeDiagnostics,
  workflowResumeBlockerSummary,
  workflowRunBlockers,
  workflowTaskSnapshot,
} from "./queueBridgeWorkflowDiagnostics";

export function workflowRunSummary(
  workflowRun: AgentQueueWorkflowRun,
): QueueAgentWorkflowRunSummary {
  const actionLogSummary = safeWorkflowJsonSummary(
    workflowRun.actionLogSummaryJson,
  );

  return {
    ...workflowNoMutationFlags(),
    ...workflowRefsFromRun(workflowRun),
    actionLogSummary,
    blockers: workflowRunBlockers(workflowRun),
    completedAt: workflowRun.completedAt ?? null,
    createdAt: workflowRun.createdAt,
    currentStep: workflowRun.currentStep ?? null,
    missingCapabilities: missingCapabilitiesFromSummary(actionLogSummary),
    phase: workflowRun.phase,
    requestId: workflowRun.requestId,
    slotBindingsSummary: safeWorkflowJsonSummary(
      workflowRun.slotBindingsJson,
    ),
    status: workflowRun.status,
    updatedAt: workflowRun.updatedAt,
    variablesSummary: safeWorkflowJsonSummary(workflowRun.variablesJson),
    version: workflowRun.version,
    workflowId: workflowRun.workflowId,
    workflowRunId: workflowRun.workflowRunId,
    workspaceId: workflowRun.workspaceId,
  };
}

export function workflowReportResult(
  report: AgentQueueWorkflowReport,
): QueueAgentWorkflowReportResult {
  const workflowRun = report.workflowRun;
  const actionLogSummary = safeWorkflowJsonSummary(
    workflowRun.actionLogSummaryJson,
  );
  const refs = mergeWorkflowRefMaps(
    workflowRefsFromRun(workflowRun),
    workflowRefsFromActions(report.actions),
  );
  const actionSummaries = report.actions
    .slice(0, 25)
    .map(workflowActionSummary);
  const slotBindings = workflowSlotBindingsFromRun(workflowRun, refs);
  return {
    ...workflowNoMutationFlags(),
    ...refs,
    actionSummaryCount: report.actions.length,
    actionCountSummary: workflowActionCountSummary(report.actions),
    actionSummaries,
    blockers: [
      ...workflowRunBlockers(workflowRun),
      ...workflowActionBlockers(report.actions),
    ],
    completedAt: workflowRun.completedAt ?? null,
    currentStep: workflowRun.currentStep ?? null,
    diagnostics: workflowReportDiagnostics(report, refs, slotBindings),
    nextAction: nextActionFromSummary(actionLogSummary),
    nextPhase: stringFieldFromValue(actionLogSummary, [
      "nextPhase",
      "next_phase",
    ]),
    nextStep: stringFieldFromValue(actionLogSummary, ["nextStep", "next_step"]),
    persistentStatus: workflowRun.status,
    phase: workflowRun.phase,
    reportSummary: boundedLongText(report.reportSummary, 2000),
    requestId: workflowRun.requestId,
    resumeAvailable: report.resumeAvailable,
    resumeStatus: report.resumeStatus,
    slotBindings,
    slotBindingsSummary: safeWorkflowJsonSummary(workflowRun.slotBindingsJson),
    status: workflowRun.status,
    truncatedActionSummaries: report.actions.length > actionSummaries.length,
    variablesSummary: safeWorkflowJsonSummary(workflowRun.variablesJson),
    workflowId: workflowRun.workflowId,
    workflowRunId: workflowRun.workflowRunId,
    workspaceId: workflowRun.workspaceId,
  };
}

export function workflowPlanResumeResult(
  plan: AgentQueueWorkflowResumePlan,
): QueueAgentWorkflowPlanResumeResult {
  const workflowRun = plan.workflowRun;
  const refs = mergeWorkflowRefMaps(
    workflowRefsFromRun(workflowRun),
    workflowRefsFromActions(plan.actions),
    workflowRefsFromSlotReconciliations(plan.slotReconciliations),
    workflowRefsFromTaskSnapshots(plan.taskSnapshots),
  );

  return {
    ...workflowNoMutationFlags(),
    ...refs,
    actionCountSummary: workflowActionCountSummary(plan.actions),
    actionSummaries: plan.actions.slice(0, 25).map(workflowActionSummary),
    blockers: plan.blockers.map(workflowResumeBlockerSummary),
    diagnostics: workflowResumeDiagnostics(plan, refs),
    missingRefs: plan.blockers
      .filter(
        (blocker) =>
          Boolean(blocker.missingRequiredField) &&
          !isRetryableWorkerEvidencePlanBlocker(blocker.blockerCode),
      )
      .map(workflowResumeBlockerSummary),
    nextPhase: plan.nextPhase ?? null,
    nextStep: plan.nextStep ?? null,
    persistentStatus: workflowRun.status,
    reconciledVariablesSummary: safeWorkflowJsonSummary(
      plan.reconciledVariablesJson,
    ),
    reportSummary: boundedLongText(plan.reportSummary, 2000),
    requiredConfirmation: plan.requiredConfirmation,
    requiredContinuationRefs: refs,
    requiredFreshGrant: plan.requiredFreshGrant,
    resumeAvailable: plan.resumeAvailable,
    resumeStatus: plan.status,
    slotReconciliations: plan.slotReconciliations
      .slice(0, 25)
      .map(workflowSlotReconciliationSummary),
    status: workflowRun.status,
    taskSnapshots: plan.taskSnapshots.slice(0, 25).map(workflowTaskSnapshot),
    terminalStatus: plan.terminalStatus ?? null,
    workflowId: workflowRun.workflowId,
    workflowRunId: workflowRun.workflowRunId,
    workspaceId: workflowRun.workspaceId,
  };
}

export function workflowSlotReconciliationSummary(
  reconciliation: AgentQueueWorkflowSlotReconciliation,
): QueueAgentWorkflowPlanResumeResult["slotReconciliations"][number] {
  return {
    aggregateDependencyState: reconciliation.aggregateDependencyState,
    aggregateEvidenceState: reconciliation.aggregateEvidenceState,
    aggregateReviewState: reconciliation.aggregateReviewState,
    aggregateTicketState: reconciliation.aggregateTicketState,
    blockerCode: reconciliation.blockerCode,
    completionDecisionExists: reconciliation.completionDecisionExists,
    completionDecisionId: reconciliation.completionDecisionId,
    evidenceBundleId: reconciliation.evidenceBundleId,
    evidenceExists: reconciliation.evidenceExists,
    executorWidgetId: reconciliation.executorWidgetId,
    failureDecisionExists: reconciliation.failureDecisionExists,
    failureDecisionId: reconciliation.failureDecisionId,
    messageId: reconciliation.messageId,
    reviewMessageExists: reconciliation.reviewMessageExists,
    reviewMessageStatus: reconciliation.reviewMessageStatus,
    runExists: reconciliation.runExists,
    runId: reconciliation.runId,
    slot: reconciliation.slot,
    taskExists: reconciliation.taskExists,
    taskId: reconciliation.taskId,
  };
}

export function isRetryableWorkerEvidencePlanBlocker(blockerCode: string | null) {
  return (
    blockerCode === "retryable_worker_evidence_failure" ||
    blockerCode === "retryable_worker_evidence_action_repair"
  );
}

export function workflowActionLogResult(
  report: AgentQueueWorkflowReport,
  input: Required<
    Pick<QueueAgentWorkflowReadActionLogInput, "workflowRunId">
  > &
    Omit<QueueAgentWorkflowReadActionLogInput, "workflowRunId">,
): QueueAgentWorkflowReadActionLogResult {
  const statusFilter = normalizedString(input.status);
  const actionTypeFilter = normalizedString(input.actionType);
  const slotFilter = normalizedString(input.slot);
  const includeRefs = input.includeRefs === true;
  const refs = mergeWorkflowRefMaps(
    workflowRefsFromRun(report.workflowRun),
    workflowRefsFromActions(report.actions),
  );
  const slotBindings = workflowSlotBindingsFromRun(report.workflowRun, refs);
  const filteredActions = report.actions.filter((action) => {
    if (statusFilter && action.status !== statusFilter) {
      return false;
    }
    if (actionTypeFilter && action.actionType !== actionTypeFilter) {
      return false;
    }
    if (
      slotFilter &&
      workflowActionSlotResolution(action, slotBindings).slot !== slotFilter
    ) {
      return false;
    }
    return true;
  });
  const limit = boundedItemLimit(input.limit);
  const boundedActions = filteredActions.slice(0, limit);
  const focused = workflowFocusedActionResult(filteredActions, {
    actionTypeFilter,
    includeRefs,
    limit,
    slotFilter,
    slotBindings,
  });

  return {
    ...workflowNoMutationFlags(),
    actionCountSummary: workflowActionCountSummary(filteredActions),
    actionTypeFilter,
    ambiguous: focused.ambiguous,
    actions: boundedActions.map(workflowActionSummary),
    blocker: focused.blocker,
    derivedSlot: focused.derivedSlot,
    focusedAction: focused.focusedAction,
    includeRefs,
    limit,
    matchingActions: focused.matchingActions,
    recoveredFromTaskId: focused.recoveredFromTaskId,
    slotFilter,
    statusFilter,
    total: filteredActions.length,
    truncated: filteredActions.length > boundedActions.length,
    workflowId: report.workflowRun.workflowId,
    workflowRunId: report.workflowRun.workflowRunId,
    workspaceId: report.workflowRun.workspaceId,
  };
}

export function workflowFocusedActionResult(
  actions: readonly AgentQueueWorkflowAction[],
  options: {
    actionTypeFilter: string | null;
    includeRefs: boolean;
    limit: number;
    slotFilter: string | null;
    slotBindings: Record<string, QueueAgentWorkflowSlotBindingSummary>;
  },
): Pick<
  QueueAgentWorkflowReadActionLogResult,
  | "ambiguous"
  | "blocker"
  | "derivedSlot"
  | "focusedAction"
  | "matchingActions"
  | "recoveredFromTaskId"
> {
  const focusRequested = Boolean(
    options.actionTypeFilter || options.slotFilter,
  );
  if (!focusRequested) {
    return {
      ambiguous: false,
      blocker: null,
      derivedSlot: null,
      focusedAction: null,
      matchingActions: [],
      recoveredFromTaskId: false,
    };
  }

  if (actions.length === 0) {
    return {
      ambiguous: false,
      blocker: {
        blockerCode: "no_matching_action",
        blockerMessage:
          "No workflow action matched the requested actionType/slot filter.",
        missingRequiredField: options.actionTypeFilter
          ? "actionType"
          : "slot",
        slot: options.slotFilter,
      },
      derivedSlot: null,
      focusedAction: null,
      matchingActions: [],
      recoveredFromTaskId: false,
    };
  }

  if (actions.length > 1) {
    return {
      ambiguous: true,
      blocker: {
        blockerCode: "ambiguous_matching_action",
        blockerMessage:
          "Multiple workflow actions matched the requested actionType/slot filter.",
        missingRequiredField: null,
        slot: options.slotFilter,
      },
      derivedSlot: null,
      focusedAction: null,
      matchingActions: actions
        .slice(0, options.limit)
        .map((action) =>
          workflowFocusedAction(action, {
            includeRefs: options.includeRefs,
            slotResolution: workflowActionSlotResolution(
              action,
              options.slotBindings,
            ),
          }),
        ),
      recoveredFromTaskId: false,
    };
  }

  const slotResolution = workflowActionSlotResolution(
    actions[0],
    options.slotBindings,
  );
  return {
    ambiguous: false,
    blocker: null,
    derivedSlot: slotResolution.derivedSlot,
    focusedAction: workflowFocusedAction(actions[0], {
      includeRefs: options.includeRefs,
      slotResolution,
    }),
    matchingActions: [],
    recoveredFromTaskId: slotResolution.recoveredFromTaskId,
  };
}

export function workflowFocusedAction(
  action: AgentQueueWorkflowAction,
  options: {
    includeRefs: boolean;
    slotResolution: WorkflowActionSlotResolution;
  },
): QueueAgentWorkflowFocusedAction {
  return {
    actionId: action.actionId,
    actionType: action.actionType,
    blockerCode: action.blockerCode ?? null,
    blockerMessage: boundedDiagnosticText(action.blockerMessage),
    createdAt: action.createdAt,
    derivedSlot: options.slotResolution.derivedSlot,
    idempotencyKey: action.idempotencyKey,
    recoveredFromTaskId: options.slotResolution.recoveredFromTaskId,
    resultRefs: options.includeRefs
      ? workflowExactRefsFromJson(action.resultRefsJson)
      : safeWorkflowJsonSummary(action.resultRefsJson),
    status: action.status,
    targetRefs: options.includeRefs
      ? workflowExactRefsFromJson(action.targetRefsJson)
      : safeWorkflowJsonSummary(action.targetRefsJson),
    updatedAt: action.updatedAt,
  };
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

export function workflowActionCountSummary(
  actions: readonly AgentQueueWorkflowAction[],
): QueueAgentWorkflowActionCountSummary {
  return {
    byActionType: countBy(actions.map((action) => action.actionType)),
    byStatus: countBy(actions.map((action) => action.status)),
    total: actions.length,
  };
}

export function workflowRefsFromRun(
  workflowRun: AgentQueueWorkflowRun,
): QueueAgentWorkflowRefMaps {
  return mergeWorkflowRefMaps(
    workflowRefsFromJson(workflowRun.slotBindingsJson),
    workflowRefsFromJson(workflowRun.variablesJson),
    workflowRefsFromJson(workflowRun.mutationRefsJson),
  );
}

export function emptyWorkflowRefMaps(): QueueAgentWorkflowRefMaps {
  return {
    completionDecisionIdsBySlot: {},
    evidenceBundleIdsBySlot: {},
    failureDecisionIdsBySlot: {},
    messageIdsBySlot: {},
    runIdsBySlot: {},
    taskIdsBySlot: {},
  };
}

export function workflowNoMutationFlags(): QueueAgentWorkflowNoMutationFlags {
  return {
    didAutoRunWorkers: false,
    didExecuteRollback: false,
    didInvokeWorkflowRunner: false,
    didLaunchShell: false,
    didLaunchTerminal: false,
    didMutateEvidence: false,
    didMutateFinalization: false,
    didMutateGit: false,
    didMutateQueue: false,
    didMutateReviews: false,
    didRunValidation: false,
    didStartWorkers: false,
  };
}


