import type {
  HobitAgentActionRequest,
  HobitAgentActionResult,
  HobitAgentActionStatus,
  HobitAgentAuditEvent,
  HobitAgentHiddenSideEffectFlags,
} from "./types";
import type { HobitAgentPolicyDecision } from "../capabilities/policy";
import type { HobitAgentCapabilityId } from "../capabilities/types";
import type { HobitAgentId } from "../runtime/hobitMultiAgentRuntime";
import type { HobitAgentRoleId } from "../context/types";

export function createNoHiddenSideEffectFlags(): HobitAgentHiddenSideEffectFlags {
  return {
    noCodexRun: false,
    noGitMutation: false,
    noQueueMutation: false,
    noRollbackExecution: false,
    noShellCommand: false,
    noTerminalLaunch: false,
    noWorkerStart: false,
  };
}

export function createActionRequest({
  agentId = "hobit.agent.requester",
  agentRole,
  agentRoleId,
  capabilityId,
  confirmationToken = null,
  createdAt = "2026-01-01T00:00:00.000Z",
  dryRun = false,
  input = {},
  reason = null,
  rawRequestId,
  requestedAt = null,
  requestId,
  requestIdSource,
}: {
  agentId?: HobitAgentId;
  agentRole?: HobitAgentRoleId;
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  createdAt?: string;
  dryRun?: boolean;
  input?: unknown;
  reason?: string | null;
  rawRequestId?: string | null;
  requestedAt?: string | null;
  requestId?: string;
  requestIdSource?: HobitAgentActionRequest["requestIdSource"];
}): HobitAgentActionRequest {
  const resolvedAgentRole = agentRole ?? agentRoleId;
  const resolvedRequestId = requestId ?? `${capabilityId}:request`;

  return {
    agentId,
    agentRole: resolvedAgentRole,
    agentRoleId,
    capabilityId,
    confirmationToken,
    createdAt,
    dryRun,
    input,
    reason,
    ...(rawRequestId !== undefined ? { rawRequestId } : {}),
    requestedAt: requestedAt ?? createdAt,
    requestId: resolvedRequestId,
    ...(requestIdSource ? { requestIdSource } : {}),
  };
}

export function createActionResult<TOutput = unknown>({
  auditEvents = [],
  capabilityId,
  dryRun = false,
  hiddenSideEffectFlags = createNoHiddenSideEffectFlags(),
  message,
  output,
  policyDecision,
  policyReasons = [],
  requestId = `${capabilityId}:request`,
  status = "succeeded",
}: {
  auditEvents?: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  hiddenSideEffectFlags?: HobitAgentHiddenSideEffectFlags;
  message: string;
  output?: TOutput;
  policyDecision?: HobitAgentPolicyDecision;
  policyReasons?: string[];
  requestId?: string;
  status?: HobitAgentActionStatus;
}): HobitAgentActionResult<TOutput> {
  return {
    auditEvents,
    capabilityId,
    dryRun,
    hiddenSideEffectFlags,
    message,
    ok: status === "succeeded",
    output,
    ...(policyDecision ? { policyDecision } : {}),
    policyReasons,
    requestId,
    status,
  };
}

export function createUnavailableActionResult({
  capabilityId,
  dryRun = false,
  message,
  policyDecision,
  reason,
  requestId = `${capabilityId}:request`,
}: {
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  message?: string;
  policyDecision?: HobitAgentPolicyDecision;
  reason: string;
  requestId?: string;
}): HobitAgentActionResult {
  return {
    auditEvents: [],
    capabilityId,
    dryRun,
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message: message ?? reason,
    ok: false,
    ...(policyDecision ? { policyDecision } : {}),
    policyReasons: [reason],
    requestId,
    status: "unavailable",
    unavailableReason: reason,
  };
}

export function createPolicyBlockedActionResult({
  capabilityId,
  dryRun = false,
  policyDecision,
  reasons,
  requestId = `${capabilityId}:request`,
}: {
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  policyDecision?: HobitAgentPolicyDecision;
  reasons: readonly string[];
  requestId?: string;
}): HobitAgentActionResult {
  return {
    auditEvents: [],
    capabilityId,
    dryRun,
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message: reasons[0] ?? "Capability was blocked by policy.",
    ok: false,
    ...(policyDecision ? { policyDecision } : {}),
    policyReasons: [...reasons],
    requestId,
    status: "policy_blocked",
  };
}
