import { createActionRequest } from "../broker/results";
import {
  evaluateCapabilityPolicy,
} from "../capabilities/policy";
import {
  findCapability,
  listSelfTestCapabilities,
} from "../capabilities/registry";
import type {
  HobitAgentCapabilityId,
  HobitAgentCapabilityRegistry,
} from "../capabilities/types";
import type { HobitAgentRoleId } from "../context/types";
import type { HobitAgentSelfTestResult } from "./types";

export function createSelfTestResultForCapability({
  agentRoleId,
  capabilityId,
  dryRun,
  expectedAvailable = true,
  registry,
}: {
  agentRoleId: HobitAgentRoleId;
  capabilityId: HobitAgentCapabilityId;
  dryRun: boolean;
  expectedAvailable?: boolean;
  registry: HobitAgentCapabilityRegistry;
}): HobitAgentSelfTestResult {
  const capability = findCapability(registry, capabilityId);
  const caseId = `${capabilityId}:self-test`;
  if (!capability || capability.availability.status === "unavailable") {
    return {
      blockedReason: capability?.availability.reason,
      capabilityId,
      caseId,
      dryRun,
      hiddenSideEffectFlags: [],
      message: expectedAvailable
        ? `${capabilityId} is unavailable.`
        : `${capabilityId} is unavailable as expected.`,
      status: expectedAvailable ? "failed" : "skipped",
    };
  }

  if (!capability.supportsSelfTest) {
    return {
      capabilityId,
      caseId,
      dryRun,
      hiddenSideEffectFlags: [],
      message: `${capabilityId} has no safe self-test capability.`,
      status: "skipped",
    };
  }

  const decision = evaluateCapabilityPolicy(
    registry,
    createActionRequest({
      agentRoleId,
      capabilityId,
      dryRun,
      reason: "self-test",
    }),
  );

  if (!decision.allowed) {
    return {
      blockedReason: decision.reasons.join(" "),
      capabilityId,
      caseId,
      dryRun,
      hiddenSideEffectFlags: [],
      message: decision.reasons[0] ?? `${capabilityId} is blocked by policy.`,
      status: "blocked",
    };
  }

  return {
    capabilityId,
    caseId,
    dryRun,
    hiddenSideEffectFlags: hiddenSideEffectFlagsForCapability(capabilityId),
    message: `${capabilityId} self-test model check passed.`,
    status: "passed",
  };
}

export function listAgentSelfTestCapabilityIds(
  registry: HobitAgentCapabilityRegistry,
  agentRoleId: HobitAgentRoleId,
): HobitAgentCapabilityId[] {
  return listSelfTestCapabilities(registry, agentRoleId).map(
    (capability) => capability.id,
  );
}

function hiddenSideEffectFlagsForCapability(
  capabilityId: HobitAgentCapabilityId,
) {
  return capabilityId === "codex.runTask" ||
    capabilityId === "workspace.shell.runCommand"
    ? ["restricted_execute_capability"]
    : [];
}
