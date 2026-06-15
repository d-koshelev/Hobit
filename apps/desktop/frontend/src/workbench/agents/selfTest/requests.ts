import { listAvailableCapabilities } from "../capabilities/registry";
import type {
  HobitAgentCapabilityId,
  HobitAgentCapabilityRegistry,
} from "../capabilities/types";
import type { HobitAgentRoleId } from "../context/types";
import type {
  HobitAgentSelfTestCase,
  HobitAgentSelfTestRequest,
} from "./types";

export function createSelfTestRequest({
  agentRoleId,
  capabilityIds,
  dryRun = true,
  registry,
  requestId = "hobit.agent.selfTest:request",
}: {
  agentRoleId: HobitAgentRoleId;
  capabilityIds?: readonly HobitAgentCapabilityId[];
  dryRun?: boolean;
  registry: HobitAgentCapabilityRegistry;
  requestId?: string;
}): HobitAgentSelfTestRequest {
  return {
    agentRoleId,
    capabilityIds:
      capabilityIds !== undefined
        ? [...capabilityIds]
        : listAvailableCapabilities(registry, agentRoleId).map(
            (capability) => capability.id,
          ),
    dryRun,
    requestId,
  };
}

export function createSelfTestCase({
  capabilityId,
  dryRun = true,
  expectedAvailable = true,
  caseId,
}: {
  capabilityId: HobitAgentCapabilityId;
  dryRun?: boolean;
  expectedAvailable?: boolean;
  caseId?: string;
}): HobitAgentSelfTestCase {
  return {
    capabilityId,
    caseId: caseId ?? `${capabilityId}:self-test`,
    dryRun,
    expectedAvailable,
  };
}
