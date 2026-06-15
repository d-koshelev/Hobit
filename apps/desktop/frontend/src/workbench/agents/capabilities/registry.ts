import { HOBIT_AGENT_INITIAL_CAPABILITIES } from "./manifest";
import type {
  HobitAgentCapability,
  HobitAgentCapabilityId,
  HobitAgentCapabilityRegistry,
} from "./types";
import type { HobitAgentRoleId } from "../context/types";

export function createHobitAgentCapabilityRegistry(
  capabilities: readonly HobitAgentCapability[] = HOBIT_AGENT_INITIAL_CAPABILITIES,
): HobitAgentCapabilityRegistry {
  return {
    capabilities: [...capabilities].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    version: "hobit-agent-capability-runtime.v0",
  };
}

export function listAvailableCapabilities(
  registry: HobitAgentCapabilityRegistry,
  roleId?: HobitAgentRoleId,
): HobitAgentCapability[] {
  return registry.capabilities.filter(
    (capability) =>
      capability.availability.status === "available" &&
      (!roleId || capability.allowedAgentRoles.includes(roleId)),
  );
}

export function findCapability(
  registry: HobitAgentCapabilityRegistry,
  capabilityId: HobitAgentCapabilityId,
): HobitAgentCapability | null {
  return (
    registry.capabilities.find((capability) => capability.id === capabilityId) ??
    null
  );
}

export function listSelfTestCapabilities(
  registry: HobitAgentCapabilityRegistry,
  roleId?: HobitAgentRoleId,
): HobitAgentCapability[] {
  return listAvailableCapabilities(registry, roleId).filter(
    (capability) => capability.supportsSelfTest,
  );
}
