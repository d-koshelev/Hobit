import type {
  HobitAgentCapabilityId,
  HobitAgentCapabilitySideEffect,
} from "../capabilities/types";
import type { HobitAgentPolicyDecision } from "../capabilities/policy";
import type { HobitAgentRoleId } from "../context/types";

export type HobitAgentActionStatus =
  | "succeeded"
  | "failed"
  | "unavailable"
  | "policy_blocked"
  | "needs_confirmation"
  | "dry_run_required";

export type HobitAgentActionRequest = {
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  dryRun: boolean;
  input: unknown;
  reason?: string | null;
  requestId: string;
  requestedAt?: string | null;
};

export type HobitAgentAuditEvent = {
  actorRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  eventName: string;
  message: string;
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  timestamp?: string | null;
};

export type HobitAgentActionResult<TOutput = unknown> = {
  auditEvents: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  message: string;
  ok: boolean;
  output?: TOutput;
  policyReasons: string[];
  status: HobitAgentActionStatus;
  unavailableReason?: string;
};

export type HobitAgentBrokerResult<TOutput = unknown> = {
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult<TOutput>;
};
