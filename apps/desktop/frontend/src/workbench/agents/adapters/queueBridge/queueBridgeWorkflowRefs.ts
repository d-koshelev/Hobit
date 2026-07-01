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
  firstString,
  isRecord,
  normalizedString,
  recordFieldFromRecord,
  stringFieldFromRecord,
  stringFieldFromRecordOrNull,
} from "./queueBridgePrimitiveHelpers";
import {
  isRawWorkflowLogKey,
  isSensitiveWorkflowKey,
  tryParseWorkflowJson,
  workflowExactRefsFromJson,
} from "./queueBridgeWorkflowRedaction";

const WORKFLOW_DIAGNOSTIC_REF_MAP_LIMIT = 25;

export function workflowDiagnosticRefMaps(
  refs: QueueAgentWorkflowRefMaps,
  prioritySlot: string | null,
): QueueAgentWorkflowRefMaps {
  return {
    completionDecisionIdsBySlot: boundedWorkflowRefRecord(
      refs.completionDecisionIdsBySlot,
      prioritySlot,
    ),
    evidenceBundleIdsBySlot: boundedWorkflowRefRecord(
      refs.evidenceBundleIdsBySlot,
      prioritySlot,
    ),
    failureDecisionIdsBySlot: boundedWorkflowRefRecord(
      refs.failureDecisionIdsBySlot,
      prioritySlot,
    ),
    messageIdsBySlot: boundedWorkflowRefRecord(
      refs.messageIdsBySlot,
      prioritySlot,
    ),
    runIdsBySlot: boundedWorkflowRefRecord(refs.runIdsBySlot, prioritySlot),
    taskIdsBySlot: boundedWorkflowRefRecord(refs.taskIdsBySlot, prioritySlot),
  };
}

export function boundedWorkflowRefRecord(
  refs: Record<string, string>,
  prioritySlot: string | null,
): Record<string, string> {
  const output: Record<string, string> = {};
  if (prioritySlot && refs[prioritySlot]) {
    output[prioritySlot] = refs[prioritySlot];
  }

  for (const [slot, value] of Object.entries(refs)) {
    if (Object.keys(output).length >= WORKFLOW_DIAGNOSTIC_REF_MAP_LIMIT) {
      break;
    }
    if (output[slot]) {
      continue;
    }
    output[slot] = value;
  }

  return output;
}

export function workflowSlotBindingsFromRun(
  workflowRun: AgentQueueWorkflowRun,
  refs: QueueAgentWorkflowRefMaps,
): Record<string, QueueAgentWorkflowSlotBindingSummary> {
  const parsed = tryParseWorkflowJson(workflowRun.slotBindingsJson);
  const bindingRecords = isRecord(parsed) ? parsed : {};
  const slots = new Set<string>([
    ...Object.keys(bindingRecords),
    ...Object.keys(refs.taskIdsBySlot),
    ...Object.keys(refs.runIdsBySlot),
    ...Object.keys(refs.evidenceBundleIdsBySlot),
    ...Object.keys(refs.messageIdsBySlot),
    ...Object.keys(refs.completionDecisionIdsBySlot),
    ...Object.keys(refs.failureDecisionIdsBySlot),
  ]);
  const output: Record<string, QueueAgentWorkflowSlotBindingSummary> = {};

  for (const slot of [...slots].slice(0, 25)) {
    const normalizedSlot = normalizedString(slot);
    if (!normalizedSlot) {
      continue;
    }

    const binding = workflowSlotBindingSummary(
      normalizedSlot,
      isRecord(bindingRecords[slot])
        ? (bindingRecords[slot] as Record<string, unknown>)
        : null,
      refs,
    );
    if (workflowSlotBindingHasData(binding)) {
      output[normalizedSlot] = binding;
    }
  }

  return output;
}

export function workflowSlotBindingSummary(
  slot: string,
  binding: Record<string, unknown> | null,
  refs: QueueAgentWorkflowRefMaps,
): QueueAgentWorkflowSlotBindingSummary {
  const executionTarget = recordFieldFromRecord(binding, [
    "executionTarget",
    "execution_target",
  ]);
  const executionTargetKind = firstString([
    stringFieldFromRecordOrNull(binding, [
      "executionTargetKind",
      "execution_target_kind",
      "kind",
    ]),
    stringFieldFromRecordOrNull(executionTarget, ["kind", "targetKind"]),
  ]);
  const providerId = firstString([
    stringFieldFromRecordOrNull(binding, ["providerId", "provider_id"]),
    stringFieldFromRecordOrNull(executionTarget, ["providerId", "provider_id"]),
  ]);

  return {
    completionDecisionId:
      stringFieldFromRecordOrNull(binding, [
        "completionDecisionId",
        "completion_decision_id",
      ]) ?? refs.completionDecisionIdsBySlot[slot] ?? null,
    evidenceBundleId:
      stringFieldFromRecordOrNull(binding, [
        "evidenceBundleId",
        "evidence_bundle_id",
      ]) ?? refs.evidenceBundleIdsBySlot[slot] ?? null,
    executionTarget:
      executionTargetKind || providerId
        ? {
            kind: executionTargetKind,
            providerId,
          }
        : null,
    executionTargetHash: stringFieldFromRecordOrNull(binding, [
      "executionTargetHash",
      "execution_target_hash",
    ]),
    failureDecisionId:
      stringFieldFromRecordOrNull(binding, [
        "failureDecisionId",
        "failure_decision_id",
      ]) ?? refs.failureDecisionIdsBySlot[slot] ?? null,
    messageId:
      stringFieldFromRecordOrNull(binding, [
        "messageId",
        "message_id",
        "reviewMessageId",
        "review_message_id",
      ]) ?? refs.messageIdsBySlot[slot] ?? null,
    runId:
      stringFieldFromRecordOrNull(binding, ["runId", "run_id"]) ??
      refs.runIdsBySlot[slot] ??
      null,
    settingsHash: stringFieldFromRecordOrNull(binding, [
      "settingsHash",
      "settings_hash",
    ]),
    taskId:
      stringFieldFromRecordOrNull(binding, ["taskId", "task_id"]) ??
      refs.taskIdsBySlot[slot] ??
      null,
    taskSpecHash: stringFieldFromRecordOrNull(binding, [
      "taskSpecHash",
      "task_spec_hash",
    ]),
  };
}

export function workflowSlotBindingHasData(
  binding: QueueAgentWorkflowSlotBindingSummary,
) {
  return Boolean(
    binding.taskId ||
      binding.taskSpecHash ||
      binding.settingsHash ||
      binding.executionTargetHash ||
      binding.executionTarget ||
      binding.runId ||
      binding.evidenceBundleId ||
      binding.messageId ||
      binding.completionDecisionId ||
      binding.failureDecisionId,
  );
}

export function workflowRefsFromActions(
  actions: readonly AgentQueueWorkflowAction[],
): QueueAgentWorkflowRefMaps {
  const refs = emptyWorkflowRefMaps();
  for (const action of actions) {
    mergeWorkflowRefMapsInto(refs, workflowRefsFromJson(action.targetRefsJson));
    mergeWorkflowRefMapsInto(refs, workflowRefsFromJson(action.resultRefsJson));
  }
  return refs;
}

export function workflowRefsFromSlotReconciliations(
  reconciliations: readonly AgentQueueWorkflowSlotReconciliation[],
): QueueAgentWorkflowRefMaps {
  const refs = emptyWorkflowRefMaps();
  for (const reconciliation of reconciliations) {
    addWorkflowRefsForSlot(refs, reconciliation.slot, reconciliation);
  }
  return refs;
}

export function workflowRefsFromTaskSnapshots(
  snapshots: readonly AgentQueueWorkflowTaskResumeSnapshot[],
): QueueAgentWorkflowRefMaps {
  const refs = emptyWorkflowRefMaps();
  for (const snapshot of snapshots) {
    addWorkflowRef(refs.taskIdsBySlot, snapshot.taskId, snapshot.taskId);
    addWorkflowRef(refs.runIdsBySlot, snapshot.taskId, snapshot.latestRunId);
    addWorkflowRef(
      refs.evidenceBundleIdsBySlot,
      snapshot.taskId,
      snapshot.latestEvidenceBundleId,
    );
    addWorkflowRef(
      refs.messageIdsBySlot,
      snapshot.taskId,
      snapshot.latestReviewMessageId,
    );
    addWorkflowRef(
      refs.completionDecisionIdsBySlot,
      snapshot.taskId,
      snapshot.latestCompletionDecisionId,
    );
    addWorkflowRef(
      refs.failureDecisionIdsBySlot,
      snapshot.taskId,
      snapshot.latestFailureDecisionId,
    );
  }
  return refs;
}

export function workflowRefsFromJson(
  json: string | null | undefined,
): QueueAgentWorkflowRefMaps {
  const parsed = tryParseWorkflowJson(json);
  if (parsed === null) {
    return emptyWorkflowRefMaps();
  }

  const refs = emptyWorkflowRefMaps();
  collectWorkflowRefs(refs, parsed, null);
  return refs;
}

export function collectWorkflowRefs(
  refs: QueueAgentWorkflowRefMaps,
  value: unknown,
  fallbackSlot: string | null,
) {
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 50)) {
      collectWorkflowRefs(refs, item, fallbackSlot);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const slot =
    stringFieldFromRecord(value, ["slot", "slotId", "taskSlot", "task_slot"]) ??
    fallbackSlot;
  if (slot) {
    addWorkflowRefsForSlot(refs, slot, value);
  }

  for (const [key, child] of Object.entries(value).slice(0, 50)) {
    collectWorkflowRefs(refs, child, isRecord(child) ? key : slot);
  }
}

export function addWorkflowRefsForSlot(
  refs: QueueAgentWorkflowRefMaps,
  slot: string,
  value: Record<string, unknown>,
) {
  addWorkflowRef(
    refs.taskIdsBySlot,
    slot,
    stringFieldFromRecord(value, ["taskId", "task_id"]),
  );
  addWorkflowRef(
    refs.runIdsBySlot,
    slot,
    stringFieldFromRecord(value, ["runId", "run_id"]),
  );
  addWorkflowRef(
    refs.evidenceBundleIdsBySlot,
    slot,
    stringFieldFromRecord(value, ["evidenceBundleId", "evidence_bundle_id"]),
  );
  addWorkflowRef(
    refs.messageIdsBySlot,
    slot,
    stringFieldFromRecord(value, [
      "messageId",
      "reviewMessageId",
      "message_id",
      "review_message_id",
    ]),
  );
  addWorkflowRef(
    refs.completionDecisionIdsBySlot,
    slot,
    stringFieldFromRecord(value, [
      "completionDecisionId",
      "completion_decision_id",
    ]),
  );
  addWorkflowRef(
    refs.failureDecisionIdsBySlot,
    slot,
    stringFieldFromRecord(value, [
      "failureDecisionId",
      "failure_decision_id",
    ]),
  );
}

export function addWorkflowRef(
  target: Record<string, string>,
  slot: string,
  value: string | null | undefined,
) {
  const safeSlot = normalizedString(slot);
  const safeValue = normalizedString(value);
  if (safeSlot && safeValue) {
    target[safeSlot] = safeValue;
  }
}

export function mergeWorkflowRefMaps(
  ...maps: readonly QueueAgentWorkflowRefMaps[]
): QueueAgentWorkflowRefMaps {
  const merged = emptyWorkflowRefMaps();
  for (const refs of maps) {
    mergeWorkflowRefMapsInto(merged, refs);
  }
  return merged;
}

export function mergeWorkflowRefMapsInto(
  target: QueueAgentWorkflowRefMaps,
  source: QueueAgentWorkflowRefMaps,
) {
  Object.assign(target.taskIdsBySlot, source.taskIdsBySlot);
  Object.assign(target.runIdsBySlot, source.runIdsBySlot);
  Object.assign(target.evidenceBundleIdsBySlot, source.evidenceBundleIdsBySlot);
  Object.assign(target.messageIdsBySlot, source.messageIdsBySlot);
  Object.assign(
    target.completionDecisionIdsBySlot,
    source.completionDecisionIdsBySlot,
  );
  Object.assign(
    target.failureDecisionIdsBySlot,
    source.failureDecisionIdsBySlot,
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

export type WorkflowActionSlotResolution = {
  ambiguous: boolean;
  derivedSlot: string | null;
  recoveredFromTaskId: boolean;
  slot: string | null;
};

export function workflowActionSlotResolution(
  action: AgentQueueWorkflowAction,
  slotBindings: Record<string, QueueAgentWorkflowSlotBindingSummary>,
): WorkflowActionSlotResolution {
  const directSlot = workflowActionSlot(action);
  if (directSlot) {
    return {
      ambiguous: false,
      derivedSlot: null,
      recoveredFromTaskId: false,
      slot: directSlot,
    };
  }

  const taskId = workflowActionTaskId(action);
  if (!taskId) {
    return {
      ambiguous: false,
      derivedSlot: null,
      recoveredFromTaskId: false,
      slot: null,
    };
  }

  const matches = Object.entries(slotBindings).filter(
    ([, binding]) => binding.taskId === taskId,
  );
  const realSlotMatches = matches.filter(
    ([slot, binding]) => normalizedString(slot) !== binding.taskId,
  );
  const candidateMatches =
    realSlotMatches.length > 0 ? realSlotMatches : matches;
  if (
    candidateMatches.length !== 1 ||
    normalizedString(candidateMatches[0]?.[0]) === taskId
  ) {
    return {
      ambiguous: candidateMatches.length > 1 || matches.length > 1,
      derivedSlot: null,
      recoveredFromTaskId: false,
      slot: null,
    };
  }

  return {
    ambiguous: false,
    derivedSlot: candidateMatches[0][0],
    recoveredFromTaskId: true,
    slot: candidateMatches[0][0],
  };
}

export function workflowActionSlot(action: AgentQueueWorkflowAction) {
  const targetRefs = workflowRefRecord(
    workflowExactRefsFromJson(action.targetRefsJson),
  );
  const resultRefs = workflowRefRecord(
    workflowExactRefsFromJson(action.resultRefsJson),
  );
  return firstString([
    stringFieldFromRecordOrNull(targetRefs, ["slot", "slotId", "taskSlot"]),
    stringFieldFromRecordOrNull(resultRefs, ["slot", "slotId", "taskSlot"]),
  ]);
}

export function workflowActionTaskId(action: AgentQueueWorkflowAction) {
  const targetRefs = workflowRefRecord(
    workflowExactRefsFromJson(action.targetRefsJson),
  );
  const resultRefs = workflowRefRecord(
    workflowExactRefsFromJson(action.resultRefsJson),
  );
  return firstString([
    stringFieldFromRecordOrNull(targetRefs, ["taskId", "task_id"]),
    stringFieldFromRecordOrNull(resultRefs, ["taskId", "task_id"]),
  ]);
}

export function workflowRefRecord(
  value: QueueAgentWorkflowSafeJsonValue | null,
): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function exactWorkflowRefRecord(
  record: Record<string, unknown>,
): Record<string, QueueAgentWorkflowSafeJsonValue> {
  const output: Record<string, QueueAgentWorkflowSafeJsonValue> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveWorkflowKey(key) || isRawWorkflowLogKey(key)) {
      continue;
    }

    if (isExactWorkflowRefKey(key) && typeof value === "string") {
      const normalized = normalizedString(value);
      if (normalized) {
        output[key] = normalized;
      }
      continue;
    }

    if (isExactWorkflowRefKey(key) && typeof value === "boolean") {
      output[key] = value;
      continue;
    }

    if (key === "executionTarget" && isRecord(value)) {
      const target = exactWorkflowExecutionTargetRef(value);
      if (Object.keys(target).length > 0) {
        output[key] = target;
      }
    }
  }

  return output;
}

export function exactWorkflowExecutionTargetRef(
  record: Record<string, unknown>,
): Record<string, QueueAgentWorkflowSafeJsonValue> {
  const output: Record<string, QueueAgentWorkflowSafeJsonValue> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!isExactWorkflowExecutionTargetKey(key) || typeof value !== "string") {
      continue;
    }
    const normalized = normalizedString(value);
    if (normalized) {
      output[key] = normalized;
    }
  }
  return output;
}

export function isExactWorkflowRefKey(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return (
    normalized === "actionid" ||
    normalized === "completiondecisionid" ||
    normalized === "dependencyedgehash" ||
    normalized === "dependencyspechash" ||
    normalized === "evidencebundleid" ||
    normalized === "executiontargethash" ||
    normalized === "executorwidgetid" ||
    normalized === "failuredecisionid" ||
    normalized === "messageid" ||
    normalized === "providerid" ||
    normalized === "queueownerwidgetinstanceid" ||
    normalized === "reviewmessageid" ||
    normalized === "runid" ||
    normalized === "settingshash" ||
    normalized === "slot" ||
    normalized === "slotid" ||
    normalized === "taskid" ||
    normalized === "taskslot" ||
    normalized === "taskslothash" ||
    normalized === "taskspechash" ||
    normalized === "workflowactionid" ||
    normalized === "workflowrunid"
  );
}

export function isExactWorkflowExecutionTargetKey(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return (
    normalized === "executorwidgetid" ||
    normalized === "kind" ||
    normalized === "providerid" ||
    normalized === "queueownerwidgetinstanceid"
  );
}


