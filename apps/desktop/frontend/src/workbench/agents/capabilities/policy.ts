import type { HobitAgentActionRequest } from "../broker/types";
import type { HobitAgentRole, HobitAgentRoleId } from "../context/types";
import { findCapability } from "./registry";
import type {
  HobitAgentCapability,
  HobitAgentCapabilityRegistry,
} from "./types";

export type HobitAgentPolicyDecision = {
  allowed: boolean;
  capability?: HobitAgentCapability;
  reasons: string[];
  requiresConfirmation: boolean;
  requiresDryRun: boolean;
  status:
    | "allowed"
    | "unavailable"
    | "blocked"
    | "requires_confirmation"
    | "requires_dry_run";
};

export function canAgentUseCapability(
  role: HobitAgentRole | HobitAgentRoleId,
  capability: HobitAgentCapability,
): boolean {
  const roleId = typeof role === "string" ? role : role.id;
  return (
    capability.availability.status === "available" &&
    capability.allowedAgentRoles.includes(roleId)
  );
}

export function evaluateCapabilityPolicy(
  registry: HobitAgentCapabilityRegistry,
  request: HobitAgentActionRequest,
): HobitAgentPolicyDecision {
  const capability = findCapability(registry, request.capabilityId);
  if (!capability) {
    return {
      allowed: false,
      reasons: [`Capability ${request.capabilityId} is not registered.`],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "unavailable",
    };
  }

  if (capability.availability.status === "unavailable") {
    return {
      allowed: false,
      capability,
      reasons: [capability.availability.reason],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "unavailable",
    };
  }

  if (!capability.allowedAgentRoles.includes(request.agentRoleId)) {
    return {
      allowed: false,
      capability,
      reasons: [
        `Role ${request.agentRoleId} cannot use ${request.capabilityId}.`,
      ],
      requiresConfirmation: false,
      requiresDryRun: false,
      status: "blocked",
    };
  }

  if (requiresDryRun(capability) && !request.dryRun && request.reason === "self-test") {
    return {
      allowed: false,
      capability,
      reasons: [
        `Self-test for ${request.capabilityId} requires dry-run or a test sandbox.`,
      ],
      requiresConfirmation: false,
      requiresDryRun: true,
      status: "requires_dry_run",
    };
  }

  if (requiresConfirmation(capability) && !request.confirmationToken) {
    return {
      allowed: false,
      capability,
      reasons: [
        capability.restricted
          ? `${request.capabilityId} is restricted and requires explicit confirmation.`
          : `${request.capabilityId} requires confirmation.`,
      ],
      requiresConfirmation: true,
      requiresDryRun: false,
      status: "requires_confirmation",
    };
  }

  return {
    allowed: true,
    capability,
    reasons: [],
    requiresConfirmation: false,
    requiresDryRun: false,
    status: "allowed",
  };
}

export function requiresConfirmation(
  capability: HobitAgentCapability,
): boolean {
  return (
    capability.confirmationRequirement === "required" ||
    capability.sideEffectLevel === "destructive"
  );
}

export function requiresDryRun(capability: HobitAgentCapability): boolean {
  return capability.sideEffectLevel !== "read" && capability.supportsDryRun;
}

export function assertCapabilityDoesNotAllowForbiddenSideEffects(
  capability: HobitAgentCapability,
  forbiddenSideEffects: readonly string[],
): true {
  const missing = forbiddenSideEffects.filter(
    (sideEffect) => !capability.forbiddenSideEffects.includes(sideEffect),
  );

  if (missing.length > 0) {
    throw new Error(
      `${capability.id} does not explicitly forbid: ${missing.join(", ")}`,
    );
  }

  return true;
}
