import type { HobitAgentCapabilityId } from "../capabilities/types";
import type { HobitAgentRoleId } from "../context/types";

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
