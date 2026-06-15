import type {
  HobitAgentCapability,
  HobitAgentCapabilityRegistry,
  HobitAgentCapabilityId,
  HobitAgentCapabilitySideEffect,
} from "../capabilities/types";
import type { HobitAgentPolicyDecision } from "../capabilities/policy";
import type { HobitAgentId } from "../runtime/hobitMultiAgentRuntime";
import type { HobitAgentRoleId } from "../context/types";

export type HobitAgentActionStatus =
  | "succeeded"
  | "failed"
  | "unavailable"
  | "policy_blocked"
  | "needs_confirmation"
  | "dry_run_required"
  | "invalid_input";

export type HobitAgentBrokerStatus = HobitAgentActionStatus;

export type HobitAgentHiddenSideEffectFlags = {
  noCodexRun: false;
  noGitMutation: false;
  noQueueMutation: false;
  noRollbackExecution: false;
  noShellCommand: false;
  noTerminalLaunch: false;
  noWorkerStart: false;
};

export type HobitAgentActionRequest = {
  agentId: HobitAgentId;
  agentRole: HobitAgentRoleId;
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  confirmationToken?: string | null;
  createdAt: string;
  dryRun: boolean;
  input: unknown;
  reason?: string | null;
  requestId: string;
  requestedAt?: string | null;
};

export type HobitAgentAuditEvent = {
  actorAgentId?: HobitAgentId;
  actorRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  eventName: string;
  message: string;
  requestId?: string;
  sideEffectLevel: HobitAgentCapabilitySideEffect;
  timestamp?: string | null;
};

export type HobitAgentActionResult<TOutput = unknown> = {
  auditEvents: HobitAgentAuditEvent[];
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  hiddenSideEffectFlags: HobitAgentHiddenSideEffectFlags;
  message: string;
  ok: boolean;
  output?: TOutput;
  policyDecision?: HobitAgentPolicyDecision;
  policyReasons: string[];
  requestId: string;
  status: HobitAgentActionStatus;
  unavailableReason?: string;
};

export type HobitAgentBrokerResult<TOutput = unknown> = {
  policyDecision: HobitAgentPolicyDecision;
  request: HobitAgentActionRequest;
  result: HobitAgentActionResult<TOutput>;
  status: HobitAgentBrokerStatus;
};

export type HobitAgentActionHandlerContext = {
  auditEvents: HobitAgentAuditEvent[];
  capability: HobitAgentCapability;
  policyDecision: HobitAgentPolicyDecision;
  registry: HobitAgentCapabilityRegistry;
  request: HobitAgentActionRequest;
};

export type HobitAgentActionHandler<TOutput = unknown> = (
  context: HobitAgentActionHandlerContext,
) => HobitAgentActionResult<TOutput>;

export type HobitAgentActionHandlerMap = Partial<
  Record<HobitAgentCapabilityId, HobitAgentActionHandler>
>;

export type HobitAgentActionRequestValidation =
  | {
      ok: true;
      reasons: [];
    }
  | {
      ok: false;
      reasons: string[];
    };

export type HobitAgentActionBroker = {
  readonly registry: HobitAgentCapabilityRegistry;
  invoke<TOutput = unknown>(
    request: HobitAgentActionRequest,
  ): HobitAgentBrokerResult<TOutput>;
};
