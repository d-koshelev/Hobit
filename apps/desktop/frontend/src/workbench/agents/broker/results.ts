import type {
  HobitAgentActionRequest,
  HobitAgentActionResult,
  HobitAgentActionStatus,
  HobitAgentAuditEvent,
} from "./types";
import type { HobitAgentCapabilityId } from "../capabilities/types";
import type { HobitAgentRoleId } from "../context/types";

export function createActionRequest({
  agentRoleId,
  capabilityId,
  confirmationToken = null,
  dryRun = false,
  input = {},
  reason = null,
  requestedAt = null,
  requestId,
}: {
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  dryRun?: boolean;
  input?: unknown;
  reason?: string | null;
  requestedAt?: string | null;
  requestId?: string;
}): HobitAgentActionRequest {
  return {
    agentRoleId,
    capabilityId,
    confirmationToken,
    dryRun,
    input,
    reason,
    requestedAt,
    requestId: requestId ?? `${capabilityId}:request`,
  };
}

export function createActionResult<TOutput = unknown>({
  auditEvents = [],
  capabilityId,
  dryRun = false,
  message,
  output,
  policyReasons = [],
  status = "succeeded",
}: {
  auditEvents?: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  message: string;
  output?: TOutput;
  policyReasons?: string[];
  status?: HobitAgentActionStatus;
}): HobitAgentActionResult<TOutput> {
  return {
    auditEvents,
    capabilityId,
    dryRun,
    message,
    ok: status === "succeeded",
    output,
    policyReasons,
    status,
  };
}

export function createUnavailableActionResult({
  capabilityId,
  message,
  reason,
}: {
  capabilityId: HobitAgentCapabilityId;
  message?: string;
  reason: string;
}): HobitAgentActionResult {
  return {
    auditEvents: [],
    capabilityId,
    dryRun: false,
    message: message ?? reason,
    ok: false,
    policyReasons: [reason],
    status: "unavailable",
    unavailableReason: reason,
  };
}

export function createPolicyBlockedActionResult({
  capabilityId,
  dryRun = false,
  reasons,
}: {
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  reasons: readonly string[];
}): HobitAgentActionResult {
  return {
    auditEvents: [],
    capabilityId,
    dryRun,
    message: reasons[0] ?? "Capability was blocked by policy.",
    ok: false,
    policyReasons: [...reasons],
    status: "policy_blocked",
  };
}
