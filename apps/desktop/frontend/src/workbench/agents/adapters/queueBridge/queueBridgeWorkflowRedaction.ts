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
  isRecord,
  normalizedString,
  safeWorkflowText,
} from "./queueBridgePrimitiveHelpers";

export function safeWorkflowJsonSummary(
  json: string | null | undefined,
): QueueAgentWorkflowSafeJsonValue | null {
  const parsed = tryParseWorkflowJson(json);
  if (parsed === null) {
    return null;
  }

  return sanitizeWorkflowJsonValue(parsed, 0);
}

export function workflowExactRefsFromJson(
  json: string | null | undefined,
): QueueAgentWorkflowSafeJsonValue | null {
  const parsed = tryParseWorkflowJson(json);
  if (!isRecord(parsed)) {
    return null;
  }

  const refs = exactWorkflowRefRecord(parsed);
  return Object.keys(refs).length > 0 ? refs : null;
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

export function tryParseWorkflowJson(json: string | null | undefined): unknown | null {
  const trimmed = json?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function sanitizeWorkflowJsonValue(
  value: unknown,
  depth: number,
): QueueAgentWorkflowSafeJsonValue | null {
  if (depth > 4) {
    return "[truncated]";
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return safeWorkflowText(value, 500);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeWorkflowJsonValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value);
  const output: Record<string, QueueAgentWorkflowSafeJsonValue> = {};
  let redactedFieldCount = 0;
  for (const [key, child] of entries.slice(0, 25)) {
    if (isSensitiveWorkflowKey(key) || isRawWorkflowLogKey(key)) {
      redactedFieldCount += 1;
      continue;
    }

    output[key] = sanitizeWorkflowJsonValue(child, depth + 1);
  }

  if (entries.length > 25) {
    output.truncatedFieldCount = entries.length - 25;
  }
  if (redactedFieldCount > 0) {
    output.redactedFieldCount = redactedFieldCount;
  }

  return output;
}

export function isSensitiveWorkflowKey(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return normalized.includes("confirmationtoken");
}

export function isRawWorkflowLogKey(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return (
    normalized.includes("gitoutput") ||
    normalized.includes("providerlog") ||
    normalized.includes("rawstderr") ||
    normalized.includes("rawstdout") ||
    normalized.includes("shelloutput") ||
    normalized.includes("transcript") ||
    normalized.includes("validationoutput") ||
    normalized === "log" ||
    normalized === "logs" ||
    normalized === "rawlog" ||
    normalized === "rawlogs" ||
    normalized === "stderr" ||
    normalized === "stdout"
  );
}

export function boundedDiagnosticText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  const redacted = trimmed
    .replace(/operator-confirmed/g, "[redacted-confirmation-token]")
    .replace(/confirmationToken/gi, "confirmation-token-redacted")
    .replace(/confirmation_token/gi, "confirmation-token-redacted");
  return redacted.length > 500
    ? `${redacted.slice(0, 500)}[truncated]`
    : redacted;
}

