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

export function normalizeChangedFilesSummary(value: readonly string[] | string | undefined) {
  if (Array.isArray(value)) {
    const changedFiles = value.map((item) => item.trim()).filter(Boolean);
    return changedFiles.length > 0 ? changedFiles.join(", ") : undefined;
  }

  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function cleanString(value: string | null | undefined) {
  return value?.trim() || undefined;
}

export function missingRunSettingsBlockers({
  hasApprovalPolicy,
  hasCodexExecutable,
  hasPrompt,
  hasSandbox,
  hasWorkspace,
}: {
  hasApprovalPolicy: boolean;
  hasCodexExecutable: boolean;
  hasPrompt: boolean;
  hasSandbox: boolean;
  hasWorkspace: boolean;
}) {
  return [
    hasPrompt ? null : "Missing prompt.",
    hasWorkspace ? null : "Missing workspace.",
    hasCodexExecutable ? null : "Missing Codex executable.",
    hasSandbox ? null : "Missing sandbox.",
    hasApprovalPolicy ? null : "Missing approval policy.",
  ].filter((reason): reason is string => Boolean(reason));
}

export function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => Boolean(value.trim())))];
}

export function shouldBlockQueueAgentRun(code: string) {
  return (
    code !== "manual_policy" &&
    code !== "missing_executor" &&
    code !== "missing_prompt" &&
    code !== "missing_execution_workspace"
  );
}

export function boundedItemLimit(limit: number | undefined) {
  return Math.max(1, Math.min(50, limit ?? 25));
}

export function countBy(values: readonly string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = normalizedString(value);
    if (key) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

export function isRunnableStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

export function isFinalStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isSupportedSandbox(
  value: string | null | undefined,
): value is QueueAgentRunSandbox {
  return (
    value === "danger_full_access" ||
    value === "read_only" ||
    value === "workspace_write"
  );
}

export function isSupportedApprovalPolicy(
  value: string | null | undefined,
): value is QueueAgentRunApprovalPolicy {
  return value === "never" || value === "on_request" || value === "untrusted";
}

export function boundedText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}

export function boundedLongText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength)}...`
    : trimmed;
}

export function safeWorkflowText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  const redacted = trimmed
    .replace(/operator-confirmed/g, "[redacted-confirmation-token]")
    .replace(/confirmationToken/gi, "confirmation-token-redacted")
    .replace(/confirmation_token/gi, "confirmation-token-redacted");
  return redacted.length > maxLength
    ? `${redacted.slice(0, maxLength)}...`
    : redacted;
}

export function normalizedString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function missingCapabilitiesFromSummary(
  value: QueueAgentWorkflowSafeJsonValue | null,
) {
  if (!isRecord(value)) {
    return [];
  }

  const candidates = [
    value.missingCapability,
    value.missingCapabilities,
    value.missing_capability,
    value.missing_capabilities,
  ];
  const missingCapabilities = candidates.flatMap((candidate) => {
    if (typeof candidate === "string") {
      return [candidate];
    }

    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is string => typeof item === "string",
      );
    }

    return [];
  });
  return uniqueStrings(missingCapabilities);
}

export function nextActionFromSummary(
  value: QueueAgentWorkflowSafeJsonValue | null,
): QueueAgentWorkflowSafeJsonValue | null {
  if (!isRecord(value)) {
    return null;
  }

  const nextAction = value.nextAction ?? value.next_action;
  return nextAction === undefined
    ? null
    : (nextAction as QueueAgentWorkflowSafeJsonValue);
}

export function stringFieldFromValue(
  value: QueueAgentWorkflowSafeJsonValue | null,
  fieldNames: readonly string[],
) {
  return isRecord(value) ? stringFieldFromRecord(value, fieldNames) : null;
}

export function stringFieldFromRecord(
  record: Record<string, unknown>,
  fieldNames: readonly string[],
) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (typeof value === "string") {
      const normalized = normalizedString(value);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

export function stringFieldFromRecordOrNull(
  record: Record<string, unknown> | null,
  fieldNames: readonly string[],
) {
  return record ? stringFieldFromRecord(record, fieldNames) : null;
}

export function recordFieldFromRecord(
  record: Record<string, unknown> | null,
  fieldNames: readonly string[],
): Record<string, unknown> | null {
  if (!record) {
    return null;
  }

  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (isRecord(value)) {
      return value;
    }
  }

  return null;
}

export function firstString(values: readonly (string | null | undefined)[]) {
  return values.find((value): value is string => Boolean(value)) ?? null;
}

export function hasOwn<TObject extends object, TKey extends PropertyKey>(
  object: TObject,
  key: TKey,
): object is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

