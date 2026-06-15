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
    const count = arrayOutputField(result.output, "createdItems")?.length ?? null;
    return count === null
      ? "Queue items created."
      : `Queue items created. Created ${count.toString()} Queue item${count === 1 ? "" : "s"}.`;
  }

  if (result.capabilityId === "queue.selfTest") {
    return result.message || "Queue self-test completed.";
  }

  return result.message || "Hobit action completed.";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
