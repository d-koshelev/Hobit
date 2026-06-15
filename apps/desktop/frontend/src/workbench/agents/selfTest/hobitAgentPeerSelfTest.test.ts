// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readdirSync, readFileSync, statSync } from "fs";

import { describe, expect, it } from "vitest";

import type { HobitAgentCapabilityRegistry } from "../capabilities";
import {
  markMessageFailed,
  type HobitAgentHistory,
} from "../messaging";
import {
  createAgentRuntimeState,
  getAgentBoundedHistory,
  HOBIT_TEST_AGENT_A,
  HOBIT_TEST_AGENT_B,
  registerAgent,
  type HobitAgentInstance,
  type HobitAgentRuntimeState,
} from "../runtime";
import {
  createAgentPeerSelfTestInstruction,
  createAgentPeerSelfTestRequest,
  HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES,
  runAgentPeerSelfTest,
  summarizeAgentPeerSelfTestReport,
  type HobitAgentPeerSelfTestResult,
} from "./hobitAgentPeerSelfTest";

describe("hobitAgentPeerSelfTest successful peer checks", () => {
  it("lets Agent A self-test Agent B successfully", () => {
    const result = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        messageId: "peer-message-a-to-b",
        requestId: "peer-request-a-to-b",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("passed");
    expect(result.report.summary).toEqual({
      blocked: 0,
      failed: 0,
      passed: 4,
      skipped: 0,
      total: 4,
    });
    expect(result.report.productSummary).toContain(
      "verified test.agentB through safe in-app agent APIs",
    );
    expect(result.report.checkedCapabilities).toEqual([
      ...HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES,
    ]);
    expect(result.report.messageId).toBe("peer-message-a-to-b");
    expect(result.report.hiddenSideEffectFlags).toEqual({
      codexRun: false,
      gitMutation: false,
      hiddenWorkerStart: false,
      queueMutation: false,
      rollbackExecution: false,
      shellCommand: false,
      terminalLaunch: false,
    });

    expectTargetHistoryContainsMessage(
      result.state,
      "test.agentB",
      "peer-message-a-to-b",
    );
  });

  it("lets Agent B self-test Agent A successfully", () => {
    const result = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        messageId: "peer-message-b-to-a",
        requestId: "peer-request-b-to-a",
        targetAgentId: "test.agentA",
        testerAgentId: "test.agentB",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("passed");
    expect(result.report.testerAgentId).toBe("test.agentB");
    expect(result.report.targetAgentId).toBe("test.agentA");
    expect(result.report.messageId).toBe("peer-message-b-to-a");
    expectTargetHistoryContainsMessage(
      result.state,
      "test.agentA",
      "peer-message-b-to-a",
    );
  });
});

describe("hobitAgentPeerSelfTest blocked and failure cases", () => {
  it("returns a blocked report when the target agent is unavailable", () => {
    const state = registerAgents([HOBIT_TEST_AGENT_A]);
    const result = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        requestId: "peer-request-target-missing",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state,
    });

    expect(result.report.finalStatus).toBe("blocked");
    expect(result.report.statusCheck.status).toBe("blocked");
    expect(result.report.productSummary).toContain("could not complete");
    expect(result.report.messageId).toBeUndefined();
  });

  it("returns a failed report when the target misses a required capability", () => {
    const target = agentWithoutCapability(
      HOBIT_TEST_AGENT_B,
      "agent.selfTest.run",
    );
    const result = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        requestId: "peer-request-missing-capability",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerAgents([HOBIT_TEST_AGENT_A, target]),
    });

    expect(result.report.finalStatus).toBe("failed");
    expect(result.report.capabilityCheck.status).toBe("failed");
    expect(result.report.capabilityCheck.missingCapabilities).toEqual([
      "agent.selfTest.run",
    ]);
    expect(result.report.messageCheck.status).toBe("skipped");
    expect(result.report.summary).toEqual({
      blocked: 0,
      failed: 1,
      passed: 1,
      skipped: 2,
      total: 4,
    });
  });

  it("returns a failed report when message delivery fails", () => {
    const result = runAgentPeerSelfTest({
      adapters: {
        sendMessage: ({ histories, message }) => ({
          error: {
            agentId: message.toAgentId,
            code: "blocked",
            message: "Message delivery blocked by test adapter.",
          },
          histories: [...histories],
          message: markMessageFailed(
            message,
            "Message delivery blocked by test adapter.",
          ),
          ok: false,
          status: "failed",
        }),
      },
      request: createAgentPeerSelfTestRequest({
        requestId: "peer-request-delivery-failure",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("failed");
    expect(result.report.messageCheck.status).toBe("failed");
    expect(result.report.messageCheck.message).toContain(
      "message delivery failed",
    );
    expect(result.report.historyCheck.status).toBe("skipped");
  });

  it("returns a failed report when target history misses the delivered message", () => {
    const result = runAgentPeerSelfTest({
      adapters: {
        afterMessageStateCreated: (state) =>
          removeMessageFromHistory(state, "test.agentB", "peer-message-a-to-b"),
      },
      request: createAgentPeerSelfTestRequest({
        messageId: "peer-message-a-to-b",
        requestId: "peer-request-history-missing",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("failed");
    expect(result.report.messageCheck.status).toBe("passed");
    expect(result.report.historyCheck.status).toBe("failed");
    expect(result.report.historyCheck.message).toContain("history is missing");
  });

  it("supports unavailable policy conditions as blocked or skipped reports", () => {
    const blocked = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        requestId: "peer-request-policy-blocked",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
        unavailableReason: "Peer self-test policy is unavailable.",
        unavailableStatus: "blocked",
      }),
      state: registerTestAgents(),
    });
    const skipped = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        requestId: "peer-request-policy-skipped",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
        unavailableReason: "Peer self-test is not enabled in this model.",
        unavailableStatus: "skipped",
      }),
      state: registerTestAgents(),
    });

    expect(blocked.report.finalStatus).toBe("blocked");
    expect(skipped.report.finalStatus).toBe("skipped");
  });

  it("summarizes peer self-test results by status", () => {
    const results: HobitAgentPeerSelfTestResult[] = [
      result("status", "passed"),
      result("capability", "failed"),
      result("message", "skipped"),
      result("history", "blocked"),
    ];

    expect(summarizeAgentPeerSelfTestReport(results)).toEqual({
      blocked: 1,
      failed: 1,
      passed: 1,
      skipped: 1,
      total: 4,
    });
  });
});

describe("hobitAgentPeerSelfTest runtime safety", () => {
  it("does not represent hidden execution or product mutations", () => {
    const report = runAgentPeerSelfTest({
      request: createAgentPeerSelfTestRequest({
        requestId: "peer-request-safety",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    }).report;

    expect(report.hiddenSideEffectFlags.codexRun).toBe(false);
    expect(report.hiddenSideEffectFlags.shellCommand).toBe(false);
    expect(report.hiddenSideEffectFlags.queueMutation).toBe(false);
    expect(report.hiddenSideEffectFlags.terminalLaunch).toBe(false);
    expect(report.hiddenSideEffectFlags.gitMutation).toBe(false);
    expect(report.hiddenSideEffectFlags.rollbackExecution).toBe(false);
    expect(report.hiddenSideEffectFlags.hiddenWorkerStart).toBe(false);
  });

  it("uses only model-level peer self-test capabilities", () => {
    expect([...HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES]).toEqual([
      "agent.status.read",
      "agent.history.read",
      "agent.message.send",
      "agent.capabilities.read",
      "agent.selfTest.run",
    ]);
    expect([...HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES]).not.toContain(
      "codex.runTask",
    );
    expect([...HOBIT_AGENT_PEER_SELF_TEST_REQUIRED_CAPABILITIES]).not.toContain(
      "workspace.shell.runCommand",
    );
  });
});

describe("hobitAgentPeerSelfTest architecture", () => {
  it("creates instructions without granting shell or Codex execution", () => {
    const instruction = createAgentPeerSelfTestInstruction();

    expect(instruction.body).toContain("typed model APIs");
    expect(instruction.body).toContain("Do not call Codex");
    expect(instruction.body).toContain("shell");
  });

  it("does not introduce pattern-based product action dispatch", () => {
    const sources = collectAgentSelfTestSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sources).not.toContain("new RegExp");
    expect(sources).not.toContain(".match(");
    expect(sources).not.toContain("classifyUserIntent");
    expect(sources).not.toContain(["user text", " -> ", "product action"].join(""));
  });

  it("keeps peer self-test deterministic for identical input state", () => {
    const state = registerTestAgents();
    const request = createAgentPeerSelfTestRequest({
      messageId: "peer-message-deterministic",
      requestId: "peer-request-deterministic",
      targetAgentId: "test.agentB",
      testerAgentId: "test.agentA",
    });

    expect(runAgentPeerSelfTest({ request, state })).toEqual(
      runAgentPeerSelfTest({ request, state }),
    );
  });
});

function registerTestAgents(): HobitAgentRuntimeState {
  return registerAgents([HOBIT_TEST_AGENT_A, HOBIT_TEST_AGENT_B]);
}

function registerAgents(
  agents: readonly HobitAgentInstance[],
): HobitAgentRuntimeState {
  return agents.reduce(
    (state, agent) => {
      const result = registerAgent(state, agent);
      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.state;
    },
    createAgentRuntimeState({
      maxHistoryEvents: 20,
      workspaceId: "workspace-1",
    }),
  );
}

function agentWithoutCapability(
  agent: HobitAgentInstance,
  capabilityId: string,
): HobitAgentInstance {
  const capabilityManifest: HobitAgentCapabilityRegistry = {
    ...agent.capabilityManifest,
    capabilities: agent.capabilityManifest.capabilities.filter(
      (capability) => capability.id !== capabilityId,
    ),
  };

  return {
    ...agent,
    capabilityManifest,
  };
}

function expectTargetHistoryContainsMessage(
  state: HobitAgentRuntimeState,
  agentId: string,
  messageId: string,
) {
  const history = getAgentBoundedHistory(state, {
    agentId,
    direction: "received",
    kind: "self_test",
  });

  expect(history.ok).toBe(true);
  if (!history.ok) {
    return;
  }

  expect(history.history.events.map((event) => event.message.messageId)).toContain(
    messageId,
  );
}

function removeMessageFromHistory(
  state: HobitAgentRuntimeState,
  agentId: string,
  messageId: string,
): HobitAgentRuntimeState {
  return {
    ...state,
    histories: state.histories.map((history) =>
      history.agentId === agentId
        ? removeMessageFromSingleHistory(history, messageId)
        : history,
    ),
  };
}

function removeMessageFromSingleHistory(
  history: HobitAgentHistory,
  messageId: string,
): HobitAgentHistory {
  return {
    ...history,
    events: history.events.filter(
      (event) => event.message.messageId !== messageId,
    ),
  };
}

function result(
  caseId: string,
  status: HobitAgentPeerSelfTestResult["status"],
): HobitAgentPeerSelfTestResult {
  return {
    caseId,
    evidence: [`${caseId} evidence`],
    message: `${caseId} ${status}`,
    status,
  };
}

function collectAgentSelfTestSources() {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();
  const root = `${cwd}/src/workbench/agents/selfTest`;

  return collectFiles(root);
}

function collectFiles(path: string): string[] {
  return (readdirSync(path) as string[]).flatMap((entry: string) => {
    const fullPath = `${path}/${entry}`;
    const stat = statSync(fullPath);

    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
