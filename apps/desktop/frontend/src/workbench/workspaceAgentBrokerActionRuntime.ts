import {
  createHobitAgentActionBroker,
  type HobitAgentActionStatus,
  type HobitAgentActionBrokerPolicyOptions,
  type HobitAgentActionRequest,
  type HobitAgentActionResult,
  type HobitAgentBrokerResult,
} from "./agents/broker";
import { createHobitAgentCapabilityRegistry } from "./agents/capabilities";
import {
  createQueueAgentActionHandlers,
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./agents/adapters";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export type WorkspaceAgentHobitActionInvoker = (
  request: HobitAgentActionRequest,
) => Promise<HobitAgentBrokerResult>;

export function createWorkspaceAgentHobitActionInvoker({
  policy,
  workspaceAgentQueueBridge,
}: {
  policy?: HobitAgentActionBrokerPolicyOptions;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge | null;
}): WorkspaceAgentHobitActionInvoker {
  const queueAdapter = createWorkspaceAgentQueueBridgeAdapterApi(
    workspaceAgentQueueBridge,
  );
  const broker = createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(queueAdapter),
    policy: {
      requireDryRunBeforeSideEffectingInvoke: false,
      ...policy,
    },
    registry: createHobitAgentCapabilityRegistry(),
  });

  return (request) => broker.invokeAsync(request);
}

export function workspaceAgentHobitActionResultMessage(
  result: HobitAgentActionResult,
): string {
  switch (result.status) {
    case "succeeded":
      return succeededActionMessage(result);
    case "needs_confirmation":
      return withReason("Action needs confirmation.", result);
    case "dry_run_required":
      return withReason("Action requires dry-run first.", result);
    case "policy_blocked":
      return withReason("Action blocked by policy.", result);
    case "unavailable":
      return withReason("Action unavailable.", result);
    case "invalid_input":
      return withReason("Invalid Hobit action request.", result);
    case "failed":
      return withReason("Hobit action failed.", result);
  }
}

export function workspaceAgentInvalidActionRequestMessage(
  reasons: readonly string[],
): string {
  return withOptionalReason(
    "Invalid Hobit action request.",
    reasons[0] ?? null,
  );
}

export function workspaceAgentHobitActionActivityTitle(
  resultStatus: HobitAgentActionStatus,
  capabilityId?: string,
  dryRun = false,
): string {
  if (resultStatus === "succeeded") {
    if (capabilityId === "queue.targetSingletonQueue") {
      return "Queue target resolved";
    }

    if (capabilityId === "queue.items.list") {
      return "Queue items listed";
    }

    if (capabilityId === "queue.item.updateRunSettings") {
      return "Queue run settings updated";
    }

    if (capabilityId === "queue.item.promoteDraft") {
      return dryRun ? "Queue draft promotion preview prepared" : "Queue draft promoted";
    }

    if (capabilityId === "queue.enable") {
      return dryRun ? "Queue enable preview prepared" : "Queue enabled";
    }

    if (capabilityId === "queue.item.startRun") {
      return "Queue-linked run started";
    }

    const lifecycleTitle = queueLifecycleActivityTitle(capabilityId);
    if (lifecycleTitle) {
      return lifecycleTitle;
    }

    if (
      capabilityId === "queue.preparePromptPackPreview" ||
      ((capabilityId === "queue.createItem" ||
        capabilityId === "queue.createItems" ||
        capabilityId === "queue.importPromptPack") &&
        dryRun)
    ) {
      return "Queue items preview prepared";
    }

    if (
      capabilityId === "queue.createItem" ||
      capabilityId === "queue.createItems" ||
      capabilityId === "queue.importPromptPack"
    ) {
      return "Queue items created";
    }

    return "Hobit action completed";
  }

  if (resultStatus === "needs_confirmation") {
    return "Action needs confirmation";
  }

  if (resultStatus === "dry_run_required") {
    return "Action requires dry-run first";
  }

  if (resultStatus === "policy_blocked") {
    return "Action blocked by policy";
  }

  if (resultStatus === "unavailable") {
    return "Action unavailable";
  }

  if (resultStatus === "invalid_input") {
    return "Invalid Hobit action request";
  }

  return "Hobit action failed";
}

function succeededActionMessage(result: HobitAgentActionResult) {
  if (result.capabilityId === "queue.targetSingletonQueue") {
    return "Queue target resolved.";
  }

  const lifecycleMessage = queueLifecycleSucceededMessage(
    result.capabilityId,
    result.dryRun,
  );
  if (lifecycleMessage) {
    return lifecycleMessage;
  }

  if (
    result.capabilityId === "queue.preparePromptPackPreview" ||
    (result.capabilityId === "queue.createItems" && result.dryRun) ||
    (result.capabilityId === "queue.createItem" && result.dryRun) ||
    (result.capabilityId === "queue.importPromptPack" && result.dryRun)
  ) {
    const count = numberOutputField(result.output, "wouldCreateItems");
    return count === null
      ? "Queue items preview prepared."
      : `Queue items preview prepared. Would create ${count.toString()} Queue item${count === 1 ? "" : "s"}.`;
  }

  if (
    result.capabilityId === "queue.createItem" ||
    result.capabilityId === "queue.createItems" ||
    result.capabilityId === "queue.importPromptPack"
  ) {
    return createdQueueItemsMessage(result);
  }

  if (result.capabilityId === "queue.items.list") {
    return queueItemsListMessage(result);
  }

  if (result.capabilityId === "queue.item.updateRunSettings") {
    return queueRunSettingsMessage(result);
  }

  if (result.capabilityId === "queue.item.promoteDraft") {
    return queuePromoteDraftMessage(result);
  }

  if (result.capabilityId === "queue.enable") {
    return queueEnableMessage(result);
  }

  if (result.capabilityId === "queue.item.startRun") {
    return queueStartRunMessage(result);
  }

  if (result.capabilityId === "queue.selfTest") {
    return result.message || "Queue self-test completed.";
  }

  return result.message || "Hobit action completed.";
}

function createdQueueItemsMessage(result: HobitAgentActionResult) {
  const createdItems = arrayOutputField(result.output, "createdItems");
  if (!createdItems) {
    return "Queue items created.";
  }
  const count = createdItems.length;

  const ids = createdItems
    .map((item) => (isRecord(item) ? stringField(item, "id") : null))
    .filter((item): item is string => Boolean(item));
  const titles = createdItems
    .map((item) => (isRecord(item) ? stringField(item, "title") : null))
    .filter((item): item is string => Boolean(item));
  const blockers = createdItems.flatMap((item) =>
    isRecord(item) && isRecord(item.readiness)
      ? stringArrayField(item.readiness, "blockerReasons")
      : [],
  );
  const parts = [
    `Queue items created. Created ${count.toString()} Queue item${count === 1 ? "" : "s"}.`,
    ids.length > 0 ? `Task id${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.` : null,
    titles.length > 0 ? `Title${titles.length === 1 ? "" : "s"}: ${titles.join("; ")}.` : null,
    blockers.length > 0 ? `Blocker: ${blockers[0]}` : null,
    nextSuggestedCapability(result.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueItemsListMessage(result: HobitAgentActionResult) {
  const items = arrayOutputField(result.output, "items") ?? [];
  const ids = items
    .map((item) => (isRecord(item) ? stringField(item, "taskId") : null))
    .filter((item): item is string => Boolean(item));
  const executors = arrayOutputField(result.output, "availableExecutors") ?? [];
  const executorIds = executors
    .map((item) =>
      isRecord(item) ? stringField(item, "executorWidgetId") : null,
    )
    .filter((item): item is string => Boolean(item));
  const firstBlocker = items
    .flatMap((item) =>
      isRecord(item) ? stringArrayField(item, "blockerReasons") : [],
    )[0];
  const parts = [
    `Queue items listed. Returned ${items.length.toString()} item${items.length === 1 ? "" : "s"}.`,
    ids.length > 0 ? `Task id${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.` : null,
    executorIds.length > 0
      ? `Executor widget id${executorIds.length === 1 ? "" : "s"}: ${executorIds.join(", ")}.`
      : null,
    firstBlocker ? `Blocker: ${firstBlocker}` : null,
    nextSuggestedCapability(result.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueRunSettingsMessage(result: HobitAgentActionResult) {
  const item = recordOutputField(result.output, "item");
  const taskId = stringField(result.output, "taskId") ??
    (isRecord(item) ? stringField(item, "taskId") : null);
  const readiness = isRecord(item) ? stringField(item, "readinessState") : null;
  const firstBlocker = isRecord(item)
    ? stringArrayField(item, "blockerReasons")[0]
    : null;
  const parts = [
    `Queue run settings ${result.dryRun ? "preview prepared" : "updated"}.`,
    taskId ? `Task id: ${taskId}.` : null,
    readiness ? `Readiness: ${readiness}.` : null,
    firstBlocker ? `Blocker: ${firstBlocker}` : null,
    nextSuggestedCapability(result.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queuePromoteDraftMessage(result: HobitAgentActionResult) {
  const item = recordOutputField(result.output, "item");
  const taskId = stringField(result.output, "taskId") ??
    (isRecord(item) ? stringField(item, "taskId") : null);
  const status = isRecord(item) ? stringField(item, "status") : null;
  const firstBlocker = isRecord(item)
    ? stringArrayField(item, "blockerReasons")[0]
    : null;
  const parts = [
    result.dryRun
      ? "Queue draft promotion preview prepared."
      : "Queue draft promoted.",
    taskId ? `Task id: ${taskId}.` : null,
    status ? `Status: ${status}.` : null,
    firstBlocker ? `Blocker: ${firstBlocker}` : null,
    nextSuggestedCapability(result.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueEnableMessage(result: HobitAgentActionResult) {
  const queueEnabled = booleanField(result.output, "queueEnabled");
  const blockers = stringArrayField(result.output, "blockerReasons");
  const parts = [
    result.dryRun
      ? "Queue enable preview prepared."
      : queueEnabled
        ? "Queue enabled."
        : "Queue enable completed.",
    blockers[0] ? `Blocker: ${blockers[0]}` : null,
    nextSuggestedCapability(result.output),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueStartRunMessage(result: HobitAgentActionResult) {
  const taskId =
    stringField(result.output, "taskId") ??
    stringField(result.output, "queueItemId");
  const runId = stringField(result.output, "runId");
  const executorWidgetId = stringField(result.output, "executorWidgetId");
  const parts = [
    "Queue-linked run started.",
    taskId ? `Task id: ${taskId}.` : null,
    runId ? `Run id: ${runId}.` : null,
    executorWidgetId ? `Executor widget id: ${executorWidgetId}.` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ");
}

function queueLifecycleActivityTitle(capabilityId?: string) {
  switch (capabilityId) {
    case "queue.lifecycle.agentFinished":
      return "Queue lifecycle agent finished";
    case "queue.review.createMessage":
      return "Queue review message created";
    case "queue.review.ack":
      return "Queue review acknowledged";
    case "queue.coordinator.approveValidation":
      return "Queue validation approved";
    case "queue.coordinator.addFollowUpPrompt":
      return "Queue follow-up prompt added";
    case "queue.item.markDone":
      return "Queue item marked done";
    case "queue.item.block":
      return "Queue item blocked";
    case "queue.item.fail":
      return "Queue item failed";
    case "queue.lifecycle.get":
      return "Queue lifecycle read";
    case "queue.review.getEvidenceBundle":
      return "Queue review evidence bundle read";
    default:
      return null;
  }
}

function queueLifecycleSucceededMessage(capabilityId: string, dryRun: boolean) {
  const title = queueLifecycleActivityTitle(capabilityId);

  return title ? `${title}${dryRun ? " preview prepared" : ""}.` : null;
}

function withReason(prefix: string, result: HobitAgentActionResult) {
  return withOptionalReason(
    prefix,
    result.policyReasons[0] ?? result.unavailableReason ?? result.message,
  );
}

function withOptionalReason(prefix: string, reason: string | null) {
  const trimmedReason = reason?.trim() ?? "";
  if (!trimmedReason || trimmedReason === prefix.trim()) {
    return prefix;
  }

  return `${prefix} ${trimmedReason}`;
}

function numberOutputField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayOutputField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return Array.isArray(value) ? value : null;
}

function recordOutputField(output: unknown, fieldName: string) {
  return isRecord(output) ? output[fieldName] : undefined;
}

function stringField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return typeof value === "string" && value.trim() ? value : null;
}

function booleanField(output: unknown, fieldName: string) {
  const value = recordOutputField(output, fieldName);
  return typeof value === "boolean" ? value : null;
}

function stringArrayField(output: unknown, fieldName: string): string[] {
  const value = recordOutputField(output, fieldName);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function nextSuggestedCapability(output: unknown) {
  const nextCapability = stringField(output, "nextSuggestedCapability");
  return nextCapability ? `Next: ${nextCapability}.` : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
