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
  createAgentApiSmokeCases,
  createAgentApiSmokeInstruction,
  createAgentApiSmokeRequest,
  HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES,
  runAgentApiSmoke,
  summarizeAgentApiSmokeReport,
  type HobitAgentApiSmokeResult,
} from "./hobitAgentApiSmokeRunner";

describe("hobitAgentApiSmokeRunner instruction", () => {
  it("creates a safe smoke instruction for available agent APIs", () => {
    const instruction = createAgentApiSmokeInstruction();

    expect(instruction.id).toBe("hobit.agent.apiSmoke");
    expect(instruction.body).toContain(
      "Check every agent API/capability available to you",
    );
    expect(instruction.body).toContain("Use safe self-test mode only");
    expect(instruction.body).toContain("Do not perform hidden side effects");
    expect(instruction.body).toContain("Queue mutation");
    expect(instruction.body).toContain("widget/view creation");
  });
});

describe("hobitAgentApiSmokeRunner successful smoke", () => {
  it("lets Agent A run API smoke against Agent B", () => {
    const result = runAgentApiSmoke({
      request: createAgentApiSmokeRequest({
        messageId: "api-smoke-a-to-b",
        requestId: "api-smoke-request-a-to-b",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("passed");
    expect(result.report.summary).toEqual({
      blocked: 0,
      failed: 0,
      passed: 5,
      skipped: 0,
      total: 5,
    });
    expect(result.report.checkedCapabilities).toEqual([
      "agent.capabilities.read",
      "agent.history.read",
      "agent.message.send",
      "agent.selfTest.run",
      "agent.status.read",
    ]);
    expect(result.report.results.map((smokeResult) => smokeResult.capabilityId)).toEqual([
      "agent.capabilities.read",
      "agent.history.read",
      "agent.message.send",
      "agent.selfTest.run",
      "agent.status.read",
    ]);
    expect(result.report.productFacingSummary).toContain(
      "checked test.agentB agent APIs in safe smoke mode",
    );
    expect(result.report.productFacingSummary).toContain(
      "No hidden execution or product mutation",
    );
    expect(result.report.hiddenSideEffectFlags).toEqual({
      codexRun: false,
      gitMutation: false,
      queueMutation: false,
      rollbackExecution: false,
      shellCommand: false,
      terminalLaunch: false,
      widgetViewCreation: false,
      workerStart: false,
    });

    expectTargetHistoryContainsMessage(
      result.state,
      "test.agentB",
      "api-smoke-a-to-b",
    );
    expectTargetHistoryContainsMessage(
      result.state,
      "test.agentB",
      "api-smoke-request-a-to-b:peer-self-test",
    );
  });

  it("lets Agent B run API smoke against Agent A", () => {
    const result = runAgentApiSmoke({
      request: createAgentApiSmokeRequest({
        messageId: "api-smoke-b-to-a",
        requestId: "api-smoke-request-b-to-a",
        targetAgentId: "test.agentA",
        testerAgentId: "test.agentB",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("passed");
    expect(result.report.testerAgentId).toBe("test.agentB");
    expect(result.report.targetAgentId).toBe("test.agentA");
    expectTargetHistoryContainsMessage(
      result.state,
      "test.agentA",
      "api-smoke-b-to-a",
    );
  });
});

describe("hobitAgentApiSmokeRunner skipped blocked and failed cases", () => {
  it("returns a blocked report when the target is unavailable", () => {
    const result = runAgentApiSmoke({
      request: createAgentApiSmokeRequest({
        requestId: "api-smoke-target-missing",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerAgents([HOBIT_TEST_AGENT_A]),
    });

    expect(result.report.finalStatus).toBe("blocked");
    expect(result.report.summary).toEqual({
      blocked: 5,
      failed: 0,
      passed: 0,
      skipped: 0,
      total: 5,
    });
    expect(result.report.results.every((smokeResult) => smokeResult.status === "blocked")).toBe(
      true,
    );
    expect(result.report.productFacingSummary).toContain("could not complete");
  });

  it("marks an agent capability with no safe smoke case as skipped", () => {
    const target = agentWithExtraCapability(
      HOBIT_TEST_AGENT_B,
      "agent.future.read",
    );
    const result = runAgentApiSmoke({
      request: createAgentApiSmokeRequest({
        requestId: "api-smoke-extra-capability",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerAgents([HOBIT_TEST_AGENT_A, target]),
    });

    expect(result.report.finalStatus).toBe("skipped");
    expect(result.report.summary).toEqual({
      blocked: 0,
      failed: 0,
      passed: 5,
      skipped: 1,
      total: 6,
    });
    expect(result.report.results).toContainEqual(
      expect.objectContaining({
        capabilityId: "agent.future.read",
        status: "skipped",
      }),
    );
  });

  it("returns failed results when a required capability is missing", () => {
    const target = agentWithoutCapability(
      HOBIT_TEST_AGENT_B,
      "agent.selfTest.run",
    );
    const result = runAgentApiSmoke({
      request: createAgentApiSmokeRequest({
        requestId: "api-smoke-missing-required",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerAgents([HOBIT_TEST_AGENT_A, target]),
    });

    expect(result.report.finalStatus).toBe("failed");
    expect(result.report.results).toContainEqual(
      expect.objectContaining({
        capabilityId: "agent.selfTest.run",
        message:
          "agent.selfTest.run is required for Agent API smoke but is missing.",
        status: "failed",
      }),
    );
    expect(result.report.productFacingSummary).toContain("found Agent API smoke failures");
  });

  it("returns failed when message delivery fails", () => {
    const result = runAgentApiSmoke({
      adapters: {
        sendMessage: ({ histories, message }) => ({
          error: {
            agentId: message.toAgentId,
            code: "blocked",
            message: "Message delivery blocked by smoke test adapter.",
          },
          histories: [...histories],
          message: markMessageFailed(
            message,
            "Message delivery blocked by smoke test adapter.",
          ),
          ok: false,
          status: "failed",
        }),
      },
      request: createAgentApiSmokeRequest({
        requestId: "api-smoke-message-failure",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("failed");
    expect(result.report.results).toContainEqual(
      expect.objectContaining({
        capabilityId: "agent.message.send",
        status: "failed",
      }),
    );
    expect(result.report.results).toContainEqual(
      expect.objectContaining({
        capabilityId: "agent.history.read",
        status: "skipped",
      }),
    );
  });

  it("returns failed when target history misses delivered message evidence", () => {
    const result = runAgentApiSmoke({
      adapters: {
        afterMessageStateCreated: (state) =>
          removeMessageFromHistory(state, "test.agentB", "api-smoke-a-to-b"),
      },
      request: createAgentApiSmokeRequest({
        messageId: "api-smoke-a-to-b",
        requestId: "api-smoke-history-missing",
        targetAgentId: "test.agentB",
        testerAgentId: "test.agentA",
      }),
      state: registerTestAgents(),
    });

    expect(result.report.finalStatus).toBe("failed");
    expect(result.report.results).toContainEqual(
      expect.objectContaining({
        capabilityId: "agent.message.send",
        status: "passed",
      }),
    );
    expect(result.report.results).toContainEqual(
      expect.objectContaining({
        capabilityId: "agent.history.read",
        message:
          "test.agentB history is missing the delivered Agent API smoke message.",
        status: "failed",
      }),
    );
  });
});

describe("hobitAgentApiSmokeRunner safety and architecture", () => {
  it("does not require or represent Codex shell Queue Terminal Git rollback worker or widget side effects", () => {
    const report = runAgentApiSmoke({
      request: createAgentApiSmokeRequest({
        requestId: "api-smoke-safety",
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
    expect(report.hiddenSideEffectFlags.workerStart).toBe(false);
    expect(report.hiddenSideEffectFlags.widgetViewCreation).toBe(false);
    expect([...HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES]).not.toContain(
      "codex.runTask",
    );
    expect([...HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES]).not.toContain(
      "workspace.shell.runCommand",
    );
    expect([...HOBIT_AGENT_API_SMOKE_REQUIRED_CAPABILITIES]).not.toContain(
      "queue.createItems",
    );
  });

  it("creates smoke cases only for agent API capabilities", () => {
    expect(
      createAgentApiSmokeCases({
        capabilityIds: [
          "agent.status.read",
          "queue.createItems",
          "agent.future.read",
        ],
      }).map((smokeCase) => smokeCase.capabilityId),
    ).toEqual(["agent.status.read", "agent.future.read"]);
  });

  it("summarizes smoke results by status", () => {
    const results: HobitAgentApiSmokeResult[] = [
      result("agent.status.read", "passed"),
      result("agent.history.read", "failed"),
      result("agent.future.read", "skipped"),
      result("agent.selfTest.run", "blocked"),
    ];

    expect(summarizeAgentApiSmokeReport(results)).toEqual({
      blocked: 1,
      failed: 1,
      passed: 1,
      skipped: 1,
      total: 4,
    });
  });

  it("does not introduce regex routing or user text product-action dispatch", () => {
    const sources = collectAgentSelfTestSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const testSources = collectAgentSelfTestSources()
      .filter((path) => path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sources).not.toContain("new RegExp");
    expect(sources).not.toContain(".match(");
    expect(sources).not.toContain("classifyUserIntent");
    expect(sources).not.toContain(["user text", " -> regex"].join(""));
    expect(testSources).not.toContain(
      ["user text", " -> regex", " -> product action"].join(""),
    );
  });

  it("does not introduce Queue adapter or handler behavior in this block", () => {
    const sources = collectAgentSelfTestSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sources).not.toContain(["queue.createItems", " invoke"].join(""));
    expect(sources).not.toContain(["Queue", " adapter"].join(""));
    expect(sources).not.toContain(["queueMutation", ": true"].join(""));
    expect(sources).not.toContain(["would", "Create", "Items"].join(""));
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

function agentWithExtraCapability(
  agent: HobitAgentInstance,
  capabilityId: string,
): HobitAgentInstance {
  const capabilityManifest: HobitAgentCapabilityRegistry = {
    ...agent.capabilityManifest,
    capabilities: [
      ...agent.capabilityManifest.capabilities,
      {
        ...agent.capabilityManifest.capabilities[0],
        id: capabilityId,
        title: "Future Agent API",
      },
    ],
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
  capabilityId: string,
  status: HobitAgentApiSmokeResult["status"],
): HobitAgentApiSmokeResult {
  return {
    capabilityId,
    caseId: `${capabilityId}:test`,
    evidence: [`${capabilityId} evidence`],
    message: `${capabilityId} ${status}`,
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
