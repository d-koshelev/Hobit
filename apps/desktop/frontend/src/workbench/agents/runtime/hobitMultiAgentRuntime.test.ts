// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readdirSync, readFileSync, statSync } from "fs";

import { describe, expect, it } from "vitest";

import {
  createAgentMessage,
  sendAgentMessage,
} from "../messaging";
import {
  createAgentRuntimeState,
  findAgent,
  getAgentBoundedHistory,
  getAgentCapabilityManifest,
  getAgentRuntimeSnapshot,
  getAgentStatus,
  HOBIT_TEST_AGENT_A,
  HOBIT_TEST_AGENT_B,
  listAgents,
  registerAgent,
  unregisterAgent,
  updateAgentStatus,
} from "./hobitMultiAgentRuntime";

describe("hobitMultiAgentRuntime registration", () => {
  it("registers two stable agents in one workspace runtime", () => {
    const state = registerTestAgents();
    const agents = listAgents(state);

    expect(agents.map((agent) => agent.agentId)).toEqual([
      "test.agentA",
      "test.agentB",
    ]);
    expect(agents[0]?.agentId).toBe(HOBIT_TEST_AGENT_A.agentId);
    expect(agents[1]?.agentId).toBe(HOBIT_TEST_AGENT_B.agentId);
    expect(getAgentRuntimeSnapshot(state)).toMatchObject({
      agentCount: 2,
      workspaceId: "workspace-1",
    });
  });

  it("rejects duplicate agent ids with a structured error", () => {
    const state = registerTestAgents();
    const duplicate = registerAgent(state, HOBIT_TEST_AGENT_A);

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error).toEqual({
        agentId: "test.agentA",
        code: "duplicate_agent_id",
        message: "Agent test.agentA is already registered.",
      });
    }
    expect(listAgents(duplicate.state).map((agent) => agent.agentId)).toEqual([
      "test.agentA",
      "test.agentB",
    ]);
  });

  it("unregisters only the selected agent", () => {
    const state = registerTestAgents();
    const result = unregisterAgent(state, "test.agentA");

    expect(result.ok).toBe(true);
    expect(listAgents(result.state).map((agent) => agent.agentId)).toEqual([
      "test.agentB",
    ]);
    expect(findAgent(result.state, "test.agentA")).toMatchObject({
      ok: false,
      status: "not_found",
    });
    expect(findAgent(result.state, "test.agentB")).toMatchObject({
      ok: true,
      status: "found",
    });
  });

  it("returns structured not-found results for missing agents", () => {
    const state = registerTestAgents();

    expect(findAgent(state, "test.missing")).toMatchObject({
      error: {
        agentId: "test.missing",
        code: "agent_not_found",
      },
      ok: false,
      status: "not_found",
    });
    expect(getAgentStatus(state, "test.missing")).toMatchObject({
      ok: false,
      status: "not_found",
    });
    expect(getAgentCapabilityManifest(state, "test.missing")).toMatchObject({
      ok: false,
      status: "not_found",
    });
  });
});

describe("hobitMultiAgentRuntime status history and API reads", () => {
  it("lets Agent A inspect Agent B status, bounded history, and capabilities", () => {
    const state = withMessage(
      registerTestAgents(3),
      "msg-1",
      "test.agentA",
      "test.agentB",
      "status check",
    );

    expect(getAgentStatus(state, "test.agentB")).toEqual({
      agentId: "test.agentB",
      ok: true,
      status: "idle",
    });

    const history = getAgentBoundedHistory(state, {
      agentId: "test.agentB",
      limit: 1,
    });
    expect(history.ok).toBe(true);
    if (history.ok) {
      expect(history.history.events).toHaveLength(1);
      expect(history.history.events[0]?.message.fromAgentId).toBe("test.agentA");
      expect(history.history.events[0]?.message.toAgentId).toBe("test.agentB");
    }

    const manifest = getAgentCapabilityManifest(state, "test.agentB");
    expect(manifest.ok).toBe(true);
    if (manifest.ok) {
      const capabilityIds = manifest.capabilityManifest.capabilities.map(
        (capability) => capability.id,
      );

      expect(capabilityIds).toEqual([
        "agent.capabilities.read",
        "agent.history.read",
        "agent.message.send",
        "agent.selfTest.run",
        "agent.status.read",
      ]);
    }
  });

  it("keeps agent history bounded", () => {
    const initial = registerTestAgents(3);
    const state = ["msg-1", "msg-2", "msg-3", "msg-4", "msg-5"].reduce(
      (current, messageId) =>
        withMessage(
          current,
          messageId,
          "test.agentA",
          "test.agentB",
          `message ${messageId}`,
        ),
      initial,
    );
    const history = getAgentBoundedHistory(state, {
      agentId: "test.agentB",
      limit: 10,
    });

    expect(history.ok).toBe(true);
    if (history.ok) {
      expect(history.history.events).toHaveLength(3);
      expect(history.history.truncated).toBe(false);
      expect(history.history.events.map((event) => event.message.messageId)).toEqual([
        "msg-3",
        "msg-4",
        "msg-5",
      ]);
    }
  });

  it("reflects status updates in the runtime snapshot", () => {
    const state = registerTestAgents();
    const updated = updateAgentStatus(state, {
      agentId: "test.agentB",
      status: "running",
      updatedAt: "2026-01-01T00:01:00.000Z",
    });

    expect(updated.ok).toBe(true);
    const snapshot = getAgentRuntimeSnapshot(updated.state);
    expect(
      snapshot.agents.find((agent) => agent.agentId === "test.agentB")?.status,
    ).toBe("running");
    expect(snapshot.events.map((event) => event.kind)).toContain(
      "agent_status_updated",
    );
  });

  it("does not mutate the input runtime state", () => {
    const state = registerTestAgents();
    const before = JSON.stringify(state);

    registerAgent(state, {
      ...HOBIT_TEST_AGENT_A,
      agentId: "test.agentC",
      title: "Test Agent C",
    });

    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("hobitMultiAgentRuntime capability manifest", () => {
  it("exposes only safe test agent capabilities", () => {
    const manifest = getAgentCapabilityManifest(
      registerTestAgents(),
      "test.agentA",
    );
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) {
      return;
    }

    const capabilities = manifest.capabilityManifest.capabilities;
    const capabilityIds = capabilities.map((capability) => capability.id);

    expect(capabilityIds).toContain("agent.status.read");
    expect(capabilityIds).toContain("agent.history.read");
    expect(capabilityIds).toContain("agent.message.send");
    expect(capabilityIds).toContain("agent.capabilities.read");
    expect(capabilityIds).toContain("agent.selfTest.run");
    expect(capabilityIds).not.toContain("codex.runTask");
    expect(capabilityIds).not.toContain("workspace.shell.runCommand");
    expect(capabilities.map((capability) => capability.sideEffectLevel)).not.toContain(
      "execute",
    );
    expect(capabilities.map((capability) => capability.sideEffectLevel)).not.toContain(
      "destructive",
    );
  });
});

describe("hobitMultiAgentRuntime architecture", () => {
  it("does not introduce regex routing in runtime or messaging modules", () => {
    const sources = collectAgentRuntimeSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sources).not.toContain("new RegExp");
    expect(sources).not.toContain(".match(");
    expect(sources).not.toContain("classify");
    expect(sources).not.toContain(["user text", " -> regex"].join(""));
  });

  it("does not assert user text to regex to product action behavior", () => {
    const testSources = collectAgentRuntimeSources()
      .filter((path) => path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(testSources).not.toContain(
      ["user text", " - regex - ", "product action"].join(""),
    );
    expect(testSources).not.toContain(["regex", " classifier"].join(""));
  });
});

function registerTestAgents(maxHistoryEvents = 50) {
  const empty = createAgentRuntimeState({
    maxHistoryEvents,
    workspaceId: "workspace-1",
  });
  const withA = registerAgent(empty, HOBIT_TEST_AGENT_A);
  if (!withA.ok) {
    throw new Error(withA.error.message);
  }
  const withB = registerAgent(withA.state, HOBIT_TEST_AGENT_B);
  if (!withB.ok) {
    throw new Error(withB.error.message);
  }

  return withB.state;
}

function withMessage(
  state: ReturnType<typeof registerTestAgents>,
  messageId: string,
  fromAgentId: string,
  toAgentId: string,
  body: string,
) {
  const result = sendAgentMessage({
    histories: state.histories,
    maxHistoryEvents: state.maxHistoryEvents,
    message: createAgentMessage({
      body,
      createdAt: `2026-01-01T00:00:${messageId.slice(-1)}.000Z`,
      fromAgentId,
      kind: "agent",
      messageId,
      threadId: "thread-1",
      toAgentId,
    }),
    registeredAgentIds: listAgents(state).map((agent) => agent.agentId),
  });

  return {
    ...state,
    histories: result.histories,
  };
}

function collectAgentRuntimeSources() {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();
  const roots = [
    `${cwd}/src/workbench/agents/runtime`,
    `${cwd}/src/workbench/agents/messaging`,
  ];

  return roots.flatMap(collectFiles);
}

function collectFiles(path: string): string[] {
  return (readdirSync(path) as string[]).flatMap((entry: string) => {
    const fullPath = `${path}/${entry}`;
    const stat = statSync(fullPath);

    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
