import type { HobitAgentCapabilityId } from "../capabilities";
import type { HobitAgentId, HobitAgentRuntimeState } from "../runtime";
import type { HobitAgentSelfTestStatus } from "./types";

export type HobitAgentApiSmokeStatus = HobitAgentSelfTestStatus;

export type HobitAgentApiSmokeInstruction = {
  body: string;
  id: "hobit.agent.apiSmoke";
  title: string;
};

export type HobitAgentApiSmokeRequest = {
  createdAt?: string;
  dryRun: true;
  instructionId: HobitAgentApiSmokeInstruction["id"];
  messageBody?: string;
  messageId?: string;
  requestId: string;
  requiredCapabilityIds?: readonly HobitAgentCapabilityId[];
  targetAgentId: HobitAgentId;
  testerAgentId: HobitAgentId;
};

export type HobitAgentApiSmokeCase = {
  capabilityId: HobitAgentCapabilityId;
  caseId: string;
  expectedResultDescription: string;
  title: string;
};

export type HobitAgentApiSmokeResult = {
  blockedReason?: string;
  capabilityId: HobitAgentCapabilityId;
  caseId: string;
  evidence: string[];
  message: string;
  status: HobitAgentApiSmokeStatus;
};

export type HobitAgentApiSmokeHiddenSideEffectFlags = {
  codexRun: false;
  gitMutation: false;
  queueMutation: false;
  rollbackExecution: false;
  shellCommand: false;
  terminalLaunch: false;
  widgetViewCreation: false;
  workerStart: false;
};

export type HobitAgentApiSmokeReport = {
  checkedCapabilities: HobitAgentCapabilityId[];
  createdAt: string;
  finalStatus: HobitAgentApiSmokeStatus;
  hiddenSideEffectFlags: HobitAgentApiSmokeHiddenSideEffectFlags;
  instructionId: HobitAgentApiSmokeInstruction["id"];
  productFacingSummary: string;
  reportId: string;
  results: HobitAgentApiSmokeResult[];
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
  targetAgentId: HobitAgentId;
  testerAgentId: HobitAgentId;
};

export type HobitAgentApiSmokeRunResult = {
  report: HobitAgentApiSmokeReport;
  state: HobitAgentRuntimeState;
};

export const HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES = [
  "agent.status.read",
  "agent.history.read",
  "agent.message.send",
  "agent.capabilities.read",
  "agent.selfTest.run",
] as const satisfies readonly HobitAgentCapabilityId[];

const HOBIT_AGENT_API_SMOKE_CASES: HobitAgentApiSmokeCase[] = [
  {
    capabilityId: "agent.status.read",
    caseId: "agent.apiSmoke:status.read",
    expectedResultDescription:
      "The tester can read the target agent status through the runtime API.",
    title: "Read agent status",
  },
  {
    capabilityId: "agent.capabilities.read",
    caseId: "agent.apiSmoke:capabilities.read",
    expectedResultDescription:
      "The tester can read the target capability manifest and required agent API entries.",
    title: "Read agent capabilities",
  },
  {
    capabilityId: "agent.message.send",
    caseId: "agent.apiSmoke:message.send",
    expectedResultDescription:
      "The tester can send one typed safe self-test message to the target agent.",
    title: "Send agent message",
  },
  {
    capabilityId: "agent.history.read",
    caseId: "agent.apiSmoke:history.read",
    expectedResultDescription:
      "The tester can read bounded target history and verify the smoke message evidence.",
    title: "Read bounded history",
  },
  {
    capabilityId: "agent.selfTest.run",
    caseId: "agent.apiSmoke:selfTest.run",
    expectedResultDescription:
      "The tester can invoke the safe peer self-test helper for the target agent.",
    title: "Run peer self-test",
  },
];

export function createAgentApiSmokeInstruction():
  HobitAgentApiSmokeInstruction {
  return {
    body: [
      "Check every agent API/capability available to you using safe self-tests.",
      "Use safe self-test mode only.",
      "Cover agent.status.read, agent.history.read, agent.message.send, agent.capabilities.read, and agent.selfTest.run when available.",
      "Report passed, failed, skipped, or blocked for each checked API.",
      "Do not perform hidden side effects, Codex runs, shell commands, Queue mutation, Terminal launch, Git mutation, rollback execution, worker start, or widget/view creation.",
    ].join(" "),
    id: "hobit.agent.apiSmoke",
    title: "Hobit agent API smoke",
  };
}

export function createAgentApiSmokeRequest({
  createdAt = "2026-01-01T00:00:00.000Z",
  messageBody,
  messageId,
  requestId,
  requiredCapabilityIds = HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES,
  targetAgentId,
  testerAgentId,
}: Omit<
  HobitAgentApiSmokeRequest,
  "dryRun" | "instructionId" | "requiredCapabilityIds"
> & {
  requiredCapabilityIds?: readonly HobitAgentCapabilityId[];
}): HobitAgentApiSmokeRequest {
  return {
    createdAt,
    dryRun: true,
    instructionId: "hobit.agent.apiSmoke",
    ...(messageBody ? { messageBody } : {}),
    ...(messageId ? { messageId } : {}),
    requestId,
    requiredCapabilityIds: [...requiredCapabilityIds],
    targetAgentId,
    testerAgentId,
  };
}

export function createAgentApiSmokeCases({
  capabilityIds,
}: {
  capabilityIds: readonly HobitAgentCapabilityId[];
}): HobitAgentApiSmokeCase[] {
  return capabilityIds
    .filter((capabilityId) => capabilityId.startsWith("agent."))
    .map((capabilityId) => {
      const supportedCase = HOBIT_AGENT_API_SMOKE_CASES.find(
        (smokeCase) => smokeCase.capabilityId === capabilityId,
      );

      return (
        supportedCase ?? {
          capabilityId,
          caseId: `${capabilityId}:api-smoke`,
          expectedResultDescription:
            "This agent API exists in the manifest, but no safe smoke case is implemented yet.",
          title: `${capabilityId} smoke`,
        }
      );
    });
}
