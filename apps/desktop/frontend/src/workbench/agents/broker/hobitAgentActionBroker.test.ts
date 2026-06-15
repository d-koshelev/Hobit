// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readdirSync, readFileSync, statSync } from "fs";

import { describe, expect, it } from "vitest";

import {
  createHobitAgentCapabilityRegistry,
  findCapability,
  HOBIT_AGENT_INITIAL_CAPABILITIES,
  type HobitAgentCapability,
} from "../capabilities";
import {
  createDefaultQueueAgentAdapterApi,
  createQueueAgentActionHandlers,
} from "../adapters";
import {
  createAgentRuntimeState,
  HOBIT_TEST_AGENT_A,
  HOBIT_TEST_AGENT_B,
  HOBIT_TEST_AGENT_CAPABILITIES,
  registerAgent,
} from "../runtime";
import {
  createActionRequest,
  createHobitAgentActionBroker,
  createHobitAgentTestActionHandlers,
  evaluateBrokerPolicy,
  validateActionRequest,
  type HobitAgentActionHandlerMap,
} from "./index";

describe("hobitAgentActionBroker validation and policy", () => {
  it("allows a typed read action and invokes its handler", () => {
    const broker = createTestBroker();
    const result = broker.invoke<{ agentId: string; status: string }>(
      actionRequest({
        capabilityId: "agent.status.read",
        input: { targetAgentId: "test.agentB" },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      capabilityId: "agent.status.read",
      ok: true,
      requestId: "request-agent.status.read",
      status: "succeeded",
    });
    expect(result.result.output).toEqual({
      agentId: "test.agentB",
      status: "idle",
    });
    expect(result.result.auditEvents.map((event) => event.eventName)).toEqual([
      "capability.validation.started",
      "capability.policy.allowed",
      "capability.invoke.completed",
    ]);
  });

  it("returns unavailable when the capability is not registered", () => {
    const result = createTestBroker().invoke(
      actionRequest({ capabilityId: "missing.capability" }),
    );

    expect(result.status).toBe("unavailable");
    expect(result.result).toMatchObject({
      ok: false,
      status: "unavailable",
      unavailableReason: "Capability missing.capability is not registered.",
    });
    expect(result.result.auditEvents.map((event) => event.eventName)).toEqual([
      "capability.validation.started",
      "capability.policy.blocked",
    ]);
  });

  it("returns unavailable when the capability metadata says unavailable", () => {
    const registry = createHobitAgentCapabilityRegistry([
      unavailableCapability(),
    ]);
    const result = createHobitAgentActionBroker({ registry }).invoke(
      actionRequest({
        capabilityId: "test.unavailable",
      }),
    );

    expect(result.status).toBe("unavailable");
    expect(result.result.unavailableReason).toBe(
      "Unavailable in this test registry.",
    );
  });

  it("blocks an agent role that is not allowed by capability policy", () => {
    const result = createTestBroker().invoke(
      actionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "agent.status.read",
        input: { targetAgentId: "test.agentB" },
      }),
    );

    expect(result.status).toBe("policy_blocked");
    expect(result.result).toMatchObject({
      ok: false,
      status: "policy_blocked",
    });
    expect(result.result.policyReasons.join(" ")).toContain(
      "Role workspace_agent cannot use agent.status.read.",
    );
  });

  it("requires confirmation for destructive capabilities", () => {
    const registry = createHobitAgentCapabilityRegistry([
      destructiveCapability(),
    ]);
    const result = createHobitAgentActionBroker({ registry }).invoke(
      actionRequest({
        capabilityId: "test.destroyAll",
        dryRun: true,
      }),
    );

    expect(result.status).toBe("needs_confirmation");
    expect(result.result).toMatchObject({
      ok: false,
      status: "needs_confirmation",
    });
  });

  it("accepts a confirmation token only where the capability policy permits it", () => {
    const registry = createHobitAgentCapabilityRegistry([
      confirmationRequiredReadCapability(),
    ]);
    const handlers: HobitAgentActionHandlerMap = {
      "test.confirmedRead": ({ request }) => ({
        auditEvents: [],
        capabilityId: request.capabilityId,
        dryRun: request.dryRun,
        hiddenSideEffectFlags: {
          noCodexRun: false,
          noGitMutation: false,
          noQueueMutation: false,
          noRollbackExecution: false,
          noShellCommand: false,
          noTerminalLaunch: false,
          noWorkerStart: false,
        },
        message: "Confirmed read completed.",
        ok: true,
        output: { confirmed: true },
        policyReasons: [],
        requestId: request.requestId,
        status: "succeeded",
      }),
    };
    const broker = createHobitAgentActionBroker({ handlers, registry });
    const result = broker.invoke<{ confirmed: boolean }>(
      actionRequest({
        capabilityId: "test.confirmedRead",
        confirmationToken: "confirm-token",
      }),
    );
    const restricted = createTestBroker().invoke(
      actionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "codex.runTask",
        confirmationToken: "confirm-token",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toEqual({ confirmed: true });
    expect(restricted.status).toBe("policy_blocked");
    expect(restricted.result.policyReasons.join(" ")).toContain(
      "restricted execute capability",
    );
  });

  it("restricts execute capabilities at the broker boundary", () => {
    const broker = createTestBroker();
    const codex = broker.invoke(
      actionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "codex.runTask",
        confirmationToken: "confirm-token",
      }),
    );
    const shell = broker.invoke(
      actionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "workspace.shell.runCommand",
        confirmationToken: "confirm-token",
      }),
    );

    expect(codex.status).toBe("policy_blocked");
    expect(shell.status).toBe("unavailable");
    expect(requiredCapability("codex.runTask").defaultForProductActions).toBe(
      false,
    );
    expect(
      requiredCapability("workspace.shell.runCommand").defaultForProductActions,
    ).toBe(false);
  });

  it("validates request shape before handler execution", () => {
    const validation = validateActionRequest({
      capabilityId: "agent.status.read",
      dryRun: false,
      input: {},
    });

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reasons).toContain("requestId is required.");
      expect(validation.reasons).toContain("agentId is required.");
      expect(validation.reasons).toContain("agentRole is required.");
    }
  });
});

describe("hobitAgentActionBroker dry-run behavior", () => {
  it("returns a Queue createItems dry-run preview without mutation", () => {
    const state = registerTestAgents();
    const before = JSON.stringify(state);
    const result = createTestBroker(state).invoke<{
      wouldAutoRunWorkers: boolean;
      wouldCreateDuplicateQueueView: boolean;
      wouldCreateItems: number;
      wouldTargetSingletonQueue: boolean;
    }>(
      actionRequest({
        capabilityId: "queue.createItems",
        dryRun: true,
        input: {
          items: [
            { prompt: "A", title: "Task A" },
            { prompt: "B", title: "Task B" },
          ],
        },
      }),
    );

    expect(JSON.stringify(state)).toBe(before);
    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      wouldAutoRunWorkers: false,
      wouldCreateDuplicateQueueView: false,
      wouldCreateItems: 2,
      wouldTargetSingletonQueue: true,
    });
    expect(result.result.auditEvents.map((event) => event.eventName)).toContain(
      "capability.dryRun.completed",
    );
    expect(Object.values(result.result.hiddenSideEffectFlags)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("requires dry-run before side-effecting invoke when modeled", () => {
    const decision = evaluateBrokerPolicy(
      createTestRegistry(),
      actionRequest({
        capabilityId: "queue.createItems",
        dryRun: false,
      }),
    );
    const result = createTestBroker().invoke(
      actionRequest({
        capabilityId: "queue.createItems",
        dryRun: false,
      }),
    );

    expect(decision).toMatchObject({
      allowed: false,
      requiresDryRun: true,
      status: "requires_dry_run",
    });
    expect(result.status).toBe("dry_run_required");
  });

  it("allows a dry-run supported capability when dryRun is true", () => {
    const result = createTestBroker().invoke(
      actionRequest({
        capabilityId: "agent.message.send",
        dryRun: true,
        input: {
          body: "Preview only.",
          fromAgentId: "test.agentA",
          toAgentId: "test.agentB",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      wouldAppendReceiverHistory: true,
      wouldAppendSenderHistory: true,
      wouldSendMessage: true,
    });
    expect(result.result.auditEvents.map((event) => event.eventName)).toContain(
      "capability.dryRun.completed",
    );
  });
});

describe("hobitAgentActionBroker handler model", () => {
  it("invokes handlers only after policy allows the request", () => {
    let invoked = 0;
    const broker = createHobitAgentActionBroker({
      handlers: {
        "agent.status.read": ({ request }) => {
          invoked += 1;
          return {
            auditEvents: [],
            capabilityId: request.capabilityId,
            dryRun: request.dryRun,
            hiddenSideEffectFlags: {
              noCodexRun: false,
              noGitMutation: false,
              noQueueMutation: false,
              noRollbackExecution: false,
              noShellCommand: false,
              noTerminalLaunch: false,
              noWorkerStart: false,
            },
            message: "Should not run for blocked role.",
            ok: true,
            policyReasons: [],
            requestId: request.requestId,
            status: "succeeded",
          };
        },
      },
      registry: createTestRegistry(),
    });
    const result = broker.invoke(
      actionRequest({
        agentRoleId: "workspace_agent",
        capabilityId: "agent.status.read",
        input: { targetAgentId: "test.agentB" },
      }),
    );

    expect(result.status).toBe("policy_blocked");
    expect(invoked).toBe(0);
  });

  it("returns unavailable/not implemented when no handler is registered", () => {
    const result = createHobitAgentActionBroker({
      registry: createTestRegistry(),
    }).invoke(
      actionRequest({
        capabilityId: "agent.status.read",
        input: { targetAgentId: "test.agentB" },
      }),
    );

    expect(result.status).toBe("unavailable");
    expect(result.result.unavailableReason).toBe(
      "agent.status.read is not implemented by this Action Broker MVP.",
    );
    expect(result.result.auditEvents.map((event) => event.eventName)).toContain(
      "capability.invoke.unavailable",
    );
  });

  it("includes audit events on handler results", () => {
    const result = createTestBroker().invoke(
      actionRequest({
        capabilityId: "agent.capabilities.read",
        input: { targetAgentId: "test.agentA" },
      }),
    );

    expect(result.result.auditEvents.map((event) => event.eventName)).toEqual([
      "capability.validation.started",
      "capability.policy.allowed",
      "capability.invoke.completed",
    ]);
  });

  it("turns handler failures into structured failed results", () => {
    const broker = createHobitAgentActionBroker({
      handlers: {
        "agent.status.read": () => {
          throw new Error("Handler failed in test.");
        },
      },
      registry: createTestRegistry(),
    });
    const result = broker.invoke(
      actionRequest({
        capabilityId: "agent.status.read",
        input: { targetAgentId: "test.agentB" },
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.result).toMatchObject({
      message: "Handler failed in test.",
      ok: false,
      status: "failed",
    });
    expect(result.result.auditEvents.map((event) => event.eventName)).toEqual([
      "capability.validation.started",
      "capability.policy.allowed",
      "capability.invoke.completed",
    ]);
  });
});

describe("hobitAgentActionBroker restricted capabilities and safety", () => {
  it("keeps Codex and shell out of the default app-action path", () => {
    const registry = createTestRegistry();
    const codex = findCapability(registry, "codex.runTask");
    const shell = findCapability(registry, "workspace.shell.runCommand");

    expect(codex).toMatchObject({
      defaultForProductActions: false,
      restricted: true,
      sideEffectLevel: "execute",
    });
    expect(shell).toMatchObject({
      defaultForProductActions: false,
      restricted: true,
      sideEffectLevel: "execute",
    });
  });

  it("does not introduce source-level pattern dispatch in the broker", () => {
    const sources = collectBrokerSources()
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sources).not.toContain("new RegExp");
    expect(sources).not.toContain(".match(");
    expect(sources).not.toContain("classify");
    expect(sources).not.toContain(["user text", " -> ", "product action"].join(""));
  });

  it("does not represent shell, Codex, Queue, Git, Terminal, rollback, or worker side effects in safe handlers", () => {
    const result = createTestBroker().invoke(
      actionRequest({
        capabilityId: "queue.createItems",
        dryRun: true,
        input: { items: [{ title: "Safe preview" }] },
      }),
    );

    expect(result.result.hiddenSideEffectFlags).toEqual({
      noCodexRun: false,
      noGitMutation: false,
      noQueueMutation: false,
      noRollbackExecution: false,
      noShellCommand: false,
      noTerminalLaunch: false,
      noWorkerStart: false,
    });
  });
});

function createTestBroker(state = registerTestAgents()) {
  return createHobitAgentActionBroker({
    handlers: {
      ...createHobitAgentTestActionHandlers({ runtimeState: state }),
      ...createQueueAgentActionHandlers(createDefaultQueueAgentAdapterApi()),
    },
    registry: createTestRegistry(),
  });
}

function createTestRegistry() {
  return createHobitAgentCapabilityRegistry([
    ...HOBIT_TEST_AGENT_CAPABILITIES,
    ...HOBIT_AGENT_INITIAL_CAPABILITIES,
  ]);
}

function actionRequest({
  agentRoleId = "test_harness",
  capabilityId,
  confirmationToken = null,
  dryRun = false,
  input = {},
}: {
  agentRoleId?: "workspace_agent" | "queue_coordinator" | "test_harness";
  capabilityId: string;
  confirmationToken?: string | null;
  dryRun?: boolean;
  input?: unknown;
}) {
  return createActionRequest({
    agentId: "test.agentA",
    agentRoleId,
    capabilityId,
    confirmationToken,
    createdAt: "2026-01-01T00:00:00.000Z",
    dryRun,
    input,
    requestId: `request-${capabilityId}`,
  });
}

function registerTestAgents() {
  const empty = createAgentRuntimeState({
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

function unavailableCapability(): HobitAgentCapability {
  return {
    ...requiredCapability("queue.targetSingletonQueue"),
    allowedAgentRoles: ["test_harness"],
    availability: {
      reason: "Unavailable in this test registry.",
      status: "unavailable",
    },
    id: "test.unavailable",
  };
}

function destructiveCapability(): HobitAgentCapability {
  return {
    ...requiredCapability("queue.createItems"),
    allowedAgentRoles: ["test_harness"],
    confirmationRequirement: "required",
    id: "test.destroyAll",
    sideEffectLevel: "destructive",
  };
}

function confirmationRequiredReadCapability(): HobitAgentCapability {
  return {
    ...requiredCapability("queue.targetSingletonQueue"),
    allowedAgentRoles: ["test_harness"],
    confirmationRequirement: "required",
    id: "test.confirmedRead",
    sideEffectLevel: "read",
  };
}

function requiredCapability(capabilityId: string): HobitAgentCapability {
  const capability = findCapability(
    createHobitAgentCapabilityRegistry(HOBIT_AGENT_INITIAL_CAPABILITIES),
    capabilityId,
  );
  if (!capability) {
    throw new Error(`Missing capability ${capabilityId}`);
  }

  return capability;
}

function collectBrokerSources() {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();
  const root = `${cwd}/src/workbench/agents/broker`;

  return collectFiles(root);
}

function collectFiles(path: string): string[] {
  return (readdirSync(path) as string[]).flatMap((entry: string) => {
    const fullPath = `${path}/${entry}`;
    const stat = statSync(fullPath);

    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
