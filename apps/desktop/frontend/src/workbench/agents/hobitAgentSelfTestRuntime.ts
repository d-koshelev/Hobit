import type {
  HobitAgentCapabilityId,
  HobitAgentCapabilityRegistry,
  HobitAgentRoleId,
} from "./hobitAgentCapabilityRuntime";
import {
  createActionRequest,
  evaluateCapabilityPolicy,
  findCapability,
  listAvailableCapabilities,
  listSelfTestCapabilities,
} from "./hobitAgentCapabilityRuntime";

export type HobitAgentSelfTestStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";

export type HobitAgentSelfTestInstruction = {
  body: string;
  id: "hobit.agent.selfTest";
  title: string;
};

export type HobitAgentSelfTestRequest = {
  agentRoleId: HobitAgentRoleId;
  capabilityIds: HobitAgentCapabilityId[];
  dryRun: boolean;
  requestId: string;
};

export type HobitAgentSelfTestCase = {
  capabilityId: HobitAgentCapabilityId;
  caseId: string;
  dryRun: boolean;
  expectedAvailable: boolean;
};

export type HobitAgentSelfTestResult = {
  blockedReason?: string;
  capabilityId: HobitAgentCapabilityId;
  caseId: string;
  dryRun: boolean;
  hiddenSideEffectFlags: string[];
  message: string;
  status: HobitAgentSelfTestStatus;
};

export type HobitAgentSelfTestReport = {
  instruction: HobitAgentSelfTestInstruction;
  request: HobitAgentSelfTestRequest;
  results: HobitAgentSelfTestResult[];
  summary: {
    blocked: number;
    failed: number;
    hiddenSideEffectFlags: number;
    passed: number;
    skipped: number;
    total: number;
  };
};

export function createSelfTestInstruction(): HobitAgentSelfTestInstruction {
  return {
    body: [
      "Run Hobit agent API self-test.",
      "Check every capability available to you.",
      "Use dry-run or safe mode.",
      "Do not perform hidden side effects.",
      "Return a structured passed, failed, skipped, and blocked report.",
      "Do not call shell or Codex unless a self-test capability explicitly allows it.",
    ].join(" "),
    id: "hobit.agent.selfTest",
    title: "Hobit agent API self-test",
  };
}

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

export function createSelfTestReport({
  instruction = createSelfTestInstruction(),
  request,
  results,
}: {
  instruction?: HobitAgentSelfTestInstruction;
  request: HobitAgentSelfTestRequest;
  results: readonly HobitAgentSelfTestResult[];
}): HobitAgentSelfTestReport {
  const stableResults = [...results].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );

  return {
    instruction,
    request,
    results: stableResults,
    summary: summarizeSelfTestReport(stableResults),
  };
}

export function summarizeSelfTestReport(
  reportOrResults: HobitAgentSelfTestReport | readonly HobitAgentSelfTestResult[],
): HobitAgentSelfTestReport["summary"] {
  const results = isSelfTestReport(reportOrResults)
    ? reportOrResults.results
    : reportOrResults;

  return {
    blocked: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "blocked",
    ).length,
    failed: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "failed",
    ).length,
    hiddenSideEffectFlags: results.reduce(
      (count: number, result: HobitAgentSelfTestResult) =>
        count + result.hiddenSideEffectFlags.length,
      0,
    ),
    passed: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "passed",
    ).length,
    skipped: results.filter(
      (result: HobitAgentSelfTestResult) => result.status === "skipped",
    ).length,
    total: results.length,
  };
}

function isSelfTestReport(
  value: HobitAgentSelfTestReport | readonly HobitAgentSelfTestResult[],
): value is HobitAgentSelfTestReport {
  return !Array.isArray(value);
}

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
