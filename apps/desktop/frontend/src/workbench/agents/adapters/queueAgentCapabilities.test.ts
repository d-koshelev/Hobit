// @ts-expect-error Node types are intentionally absent from the frontend tsconfig; this test reads source in Vitest only.
import { readFileSync } from "fs";

import { describe, expect, it, vi } from "vitest";

import {
  createHobitAgentActionBroker,
  createHobitAgentTestActionHandlers,
  createActionRequest,
} from "../broker";
import {
  createHobitAgentCapabilityRegistry,
  findCapability,
  HOBIT_AGENT_INITIAL_CAPABILITIES,
} from "../capabilities";
import {
  createAgentRuntimeState,
  HOBIT_TEST_AGENT_A,
  HOBIT_TEST_AGENT_B,
  HOBIT_TEST_AGENT_CAPABILITIES,
  registerAgent,
} from "../runtime";
import {
  createDefaultQueueAgentAdapterApi,
} from "./queueAgentCapabilities";
import { createQueueAgentActionHandlers } from "./queueAgentActionHandlers";
import {
  createWorkspaceAgentQueueBridgeAdapterApi,
} from "./workspaceAgentQueueBridgeAdapter";
import {
  QUEUE_AGENT_CAPABILITY_IDS,
  type QueueAgentAdapterApi,
  type QueueAgentCreateItemsRequest,
  type QueueAgentNormalizedCreateItem,
  type QueueAgentPromptPackInput,
  type QueueAgentSelfTestReport,
} from "./queueAgentCapabilityTypes";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";

describe("queueAgentCapabilities discovery and broker separation", () => {
  it("exports Queue handlers and keeps capabilities present in the manifest", () => {
    const adapter = fakeQueueAdapter();
    const handlers = createQueueAgentActionHandlers(adapter);
    const registry = createHobitAgentCapabilityRegistry();

    expect(Object.keys(handlers).sort()).toEqual([...QUEUE_AGENT_CAPABILITY_IDS].sort());
    for (const capabilityId of QUEUE_AGENT_CAPABILITY_IDS) {
      expect(findCapability(registry, capabilityId)).toMatchObject({
        availability: { status: "available" },
        ownerSurface: "Agent Queue",
      });
    }
  });

  it("lets the broker discover and invoke Queue handlers when provided", () => {
    const broker = createQueueBroker(fakeQueueAdapter());
    const result = broker.invoke<{ queueId: string }>(
      request({
        capabilityId: "queue.targetSingletonQueue",
        dryRun: true,
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.message).toBe("Queue target resolved");
    expect(result.result.output).toMatchObject({
      queueId: "workspace-queue",
      wouldCreateDuplicateQueueView: false,
    });
  });

  it("keeps Queue createItems behavior out of generic broker test handlers", () => {
    const genericHandlers = createHobitAgentTestActionHandlers({
      runtimeState: registerTestAgents(),
    });
    const source = frontendSource(
      "workbench/agents/broker/hobitAgentTestActionHandlers.ts",
    );

    expect(genericHandlers["queue.createItems"]).toBeUndefined();
    expect(source).not.toContain('"queue.createItems"');
    expect(source).not.toContain("wouldCreateItems");
  });
});

describe("queueAgentCapabilities dry-run", () => {
  it("returns a createItems preview without Queue mutation, view creation, workers, shell, Codex, Terminal, Git, or rollback", () => {
    const adapter = fakeQueueAdapter();
    const beforeCreated = adapter.createdItems.length;
    const result = createQueueBroker(adapter).invoke<{
      wouldAutoRunWorkers: boolean;
      wouldCreateDuplicateQueueView: boolean;
      wouldCreateItems: number;
      wouldTargetSingletonQueue: boolean;
    }>(
      request({
        capabilityId: "queue.createItems",
        dryRun: true,
        input: {
          items: [
            { id: "a", prompt: "Prompt A", title: "Task A" },
            { dependencies: ["a"], id: "b", prompt: "Prompt B", title: "Task B" },
          ],
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.message).toBe("Queue items preview prepared");
    expect(result.result.output).toMatchObject({
      wouldAutoRunWorkers: false,
      wouldCreateDuplicateQueueView: false,
      wouldCreateItems: 2,
      wouldTargetSingletonQueue: true,
    });
    expect(adapter.createdItems).toHaveLength(beforeCreated);
    expect(adapter.operations).toMatchObject({
      codexRuns: 0,
      duplicateQueueViews: 0,
      gitMutations: 0,
      rollbackExecutions: 0,
      shellCommands: 0,
      terminalLaunches: 0,
      workerStarts: 0,
    });
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

  it("returns invalid_input instead of throwing for invalid createItems input", () => {
    const result = createQueueBroker(fakeQueueAdapter()).invoke(
      request({
        capabilityId: "queue.createItems",
        dryRun: true,
        input: { items: [{ prompt: "Missing title" }] },
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe("Queue item title is required.");
  });

  it("keeps Queue item prompt required for createItem and createItems", () => {
    const createItemResult = createQueueBroker(fakeQueueAdapter()).invoke(
      request({
        capabilityId: "queue.createItem",
        dryRun: true,
        input: { title: "Missing prompt" },
      }),
    );
    const createItemsResult = createQueueBroker(fakeQueueAdapter()).invoke(
      request({
        capabilityId: "queue.createItems",
        dryRun: true,
        input: { items: [{ title: "Missing item prompt" }] },
      }),
    );

    expect(createItemResult.status).toBe("invalid_input");
    expect(createItemResult.result.message).toBe(
      "Queue item prompt is required.",
    );
    expect(createItemsResult.status).toBe("invalid_input");
    expect(createItemsResult.result.message).toBe(
      "Queue item prompt is required.",
    );
  });

  it("does not accept description or prompt aliases as Queue item prompt", () => {
    for (const alias of [
      "description",
      "body",
      "text",
      "content",
      "operatorPrompt",
    ]) {
      const result = createQueueBroker(fakeQueueAdapter()).invoke(
        request({
          capabilityId: "queue.createItem",
          dryRun: true,
          input: {
            [alias]: "Run this task.",
            title: `Alias ${alias}`,
          },
        }),
      );

      expect(result.status).toBe("invalid_input");
      expect(result.result.message).toBe("Queue item prompt is required.");
    }
  });
});

describe("queueAgentCapabilities invoke", () => {
  it("accepts Queue create action-request examples from the capability manifest", () => {
    for (const capabilityId of ["queue.createItem", "queue.createItems"]) {
      const capability = requiredCapability(
        createHobitAgentCapabilityRegistry(),
        capabilityId,
      );
      const example = requiredMutationExample(capability);
      const adapter = fakeQueueAdapter();
      const result = createQueueBroker(adapter, {
        allowWriteInvoke: true,
      }).invoke(
        request({
          capabilityId: example.exampleActionRequest.capabilityId,
          dryRun: example.exampleActionRequest.dryRun,
          input: example.exampleActionRequest.input,
        }),
      );

      expect(result.status).toBe("succeeded");
      expect(adapter.createdItems).toEqual([
        expect.objectContaining({
          prompt:
            "Review the current workspace state and report one safe next step.",
          status: "draft",
          title: "Test Queue item",
        }),
      ]);
      expect(adapter.operations.workerStarts).toBe(0);
      expect(adapter.operations.duplicateQueueViews).toBe(0);
    }
  });

  it("accepts Queue create dry-run examples from the capability manifest without mutation", () => {
    for (const capabilityId of ["queue.createItem", "queue.createItems"]) {
      const capability = requiredCapability(
        createHobitAgentCapabilityRegistry(),
        capabilityId,
      );
      const example = requiredDryRunExample(capability);
      const adapter = fakeQueueAdapter();
      const result = createQueueBroker(adapter).invoke<{
        wouldAutoRunWorkers: boolean;
        wouldCreateDuplicateQueueView: boolean;
        wouldCreateItems: number;
      }>(
        request({
          capabilityId: example.exampleActionRequest.capabilityId,
          dryRun: example.exampleActionRequest.dryRun,
          input: example.exampleActionRequest.input,
        }),
      );

      expect(result.status).toBe("succeeded");
      expect(result.result.output).toMatchObject({
        wouldAutoRunWorkers: false,
        wouldCreateDuplicateQueueView: false,
        wouldCreateItems: 1,
      });
      expect(adapter.createdItems).toEqual([]);
      expect(adapter.operations.workerStarts).toBe(0);
      expect(adapter.operations.duplicateQueueViews).toBe(0);
    }
  });

  it("creates one Queue item through the injected adapter API", () => {
    const adapter = fakeQueueAdapter();
    const result = createQueueBroker(adapter, { allowWriteInvoke: true }).invoke(
      request({
        capabilityId: "queue.createItem",
        input: {
          id: "one",
          prompt: "Implement one task.",
          source: { proposalId: "proposal-1" },
          status: "ready",
          title: "One task",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.message).toBe("Queue items created");
    expect(adapter.createdItems).toEqual([
      expect.objectContaining({
        id: "one",
        prompt: "Implement one task.",
        sourceMetadata: { proposalId: "proposal-1" },
        status: "queued",
        title: "One task",
      }),
    ]);
    expect(adapter.lastCreateRequest?.target).toMatchObject({
      queueId: "workspace-queue",
      singleton: true,
    });
    expect(adapter.operations.duplicateQueueViews).toBe(0);
    expect(adapter.operations.workerStarts).toBe(0);
  });

  it("creates multiple Queue items and preserves source metadata and dependency edges", () => {
    const adapter = fakeQueueAdapter();
    const result = createQueueBroker(adapter, { allowWriteInvoke: true }).invoke<{
      dependencyEdgesPreserved: boolean;
    }>(
      request({
        capabilityId: "queue.createItems",
        input: {
          source: { packId: "pack-1" },
          items: [
            {
              id: "first",
              prompt: "First prompt.",
              sourceMetadata: { promptId: "001" },
              title: "First",
            },
            {
              dependencies: ["first"],
              id: "second",
              prompt: "Second prompt.",
              sourceMetadata: { promptId: "002" },
              title: "Second",
            },
          ],
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      dependencyEdgesPreserved: true,
      wouldAutoRunWorkers: false,
      wouldCreateDuplicateQueueView: false,
    });
    expect(adapter.createdItems.map((item) => item.id)).toEqual([
      "first",
      "second",
    ]);
    expect(adapter.createdItems[1]?.dependencies).toEqual(["first"]);
    expect(adapter.lastCreateRequest?.sourceMetadata).toEqual({ packId: "pack-1" });
  });

  it("uses the injected Workspace Agent Queue bridge for createItems", async () => {
    const createItem = vi.fn(
      async (input: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0]) =>
        queueBridgeItemResult({
          dependencies: input.dependencies ?? [],
          id: `created-${input.title}`,
          prompt: input.prompt,
          status: input.status,
          title: input.title,
        }),
    );
    const runAutonomousQueue = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ createItem, runAutonomousQueue }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });
    const result = await broker.invokeAsync<{
      createdItems: unknown[];
      wouldAutoRunWorkers: boolean;
      wouldCreateDuplicateQueueView: boolean;
      wouldTargetSingletonQueue: boolean;
    }>(
      request({
        capabilityId: "queue.createItems",
        input: {
          items: [
            {
              dependencies: ["first"],
              id: "second",
              prompt: "Second prompt.",
              status: "queued",
              title: "Second",
            },
          ],
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: ["first"],
        prompt: "Second prompt.",
        status: "queued",
        title: "Second",
      }),
    );
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      wouldAutoRunWorkers: false,
      wouldCreateDuplicateQueueView: false,
      wouldTargetSingletonQueue: true,
    });
    expect(result.result.output?.createdItems).toHaveLength(1);
  });

  it("returns failed when dependencies cannot be represented by the injected adapter", () => {
    const result = createQueueBroker(
      fakeQueueAdapter({ supportsDependencyEdges: false }),
      { allowWriteInvoke: true },
    ).invoke(
      request({
        capabilityId: "queue.createItems",
        input: {
          items: [
            { id: "a", prompt: "A", title: "A" },
            { dependencies: ["a"], id: "b", prompt: "B", title: "B" },
          ],
        },
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.result.message).toContain("dependency edges are not supported");
  });
});

describe("queueAgentCapabilities prompt pack", () => {
  it("prepares a prompt-pack preview without mutation", () => {
    const adapter = fakeQueueAdapter();
    const result = createQueueBroker(adapter).invoke<{
      importAvailable: boolean;
      selectedItemCount: number;
      wouldCreateItems: number;
    }>(
      request({
        capabilityId: "queue.preparePromptPackPreview",
        dryRun: true,
        input: { sourceText: promptPackSourceText() },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      importAvailable: true,
      selectedItemCount: 2,
      wouldCreateItems: 2,
      wouldTargetSingletonQueue: true,
    });
    expect(adapter.createdItems).toEqual([]);
  });

  it("returns invalid_input for missing prompt-pack input", () => {
    const result = createQueueBroker(fakeQueueAdapter()).invoke(
      request({
        capabilityId: "queue.preparePromptPackPreview",
        dryRun: true,
        input: {},
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe("Prompt-pack input is required.");
  });

  it("imports a prompt pack through the injected Queue adapter without auto-running workers", () => {
    const adapter = fakeQueueAdapter();
    const result = createQueueBroker(adapter, { allowWriteInvoke: true }).invoke(
      request({
        capabilityId: "queue.importPromptPack",
        confirmationToken: "confirmed",
        input: { sourceText: promptPackSourceText() },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.message).toBe("Queue items created");
    expect(adapter.createdItems).toHaveLength(2);
    expect(adapter.operations.workerStarts).toBe(0);
    expect(adapter.operations.codexRuns).toBe(0);
    expect(adapter.operations.shellCommands).toBe(0);
    expect(adapter.lastImportInput).toMatchObject({
      sourceText: promptPackSourceText(),
    });
  });
});

describe("queueAgentCapabilities self-test and architecture safety", () => {
  it("passes Queue self-test with a safe fake adapter", () => {
    const adapter = fakeQueueAdapter();
    const result = createQueueBroker(adapter).invoke<QueueAgentSelfTestReport>(
      request({
        capabilityId: "queue.selfTest",
        dryRun: true,
        input: {},
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.message).toBe("Queue self-test passed");
    expect(result.result.output?.productSummary).toBe("Queue self-test passed");
    expect(result.result.output?.summary).toEqual({
      blocked: 0,
      failed: 0,
      passed: 8,
      skipped: 0,
      total: 8,
    });
    expect(selfTestCase(result.result.output, "queue:singleton-target")).toMatchObject({
      message: "Singleton Queue target verified.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:create-items-dry-run")).toMatchObject({
      message: "Queue dry-run preview prepared.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:dry-run-target-singleton")).toMatchObject({
      message: "Singleton Queue target verified.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:no-auto-run")).toMatchObject({
      message: "No Queue worker start.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:no-duplicate-view")).toMatchObject({
      message: "No Queue view creation.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:prompt-pack-preview-dry-run")).toMatchObject({
      message: "Queue dry-run preview prepared.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:no-mutation")).toMatchObject({
      message: "No Queue mutation.",
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:no-hidden-side-effects")).toMatchObject({
      message: "No hidden side effects.",
      status: "passed",
    });
    expect(result.result.output?.hiddenSideEffectFlags).toMatchObject({
      didAutoRunWorkers: false,
      didCreateDuplicateQueueView: false,
      didMutateQueue: false,
      didStartWorkers: false,
    });
    expect(adapter.createdItems).toEqual([]);
    expect(adapter.previewCreateItems).toHaveBeenCalledTimes(1);
    expect(adapter.previewPromptPack).toHaveBeenCalledTimes(1);
    expect(adapter.createItems).not.toHaveBeenCalled();
    expect(adapter.importPromptPack).not.toHaveBeenCalled();
  });

  it("skips only unavailable Queue target inspection while dry-run model checks still pass", () => {
    const adapter = fakeQueueAdapter();
    adapter.getSingletonQueueTarget = vi.fn(() => ({
      message: "Queue adapter is not available.",
      reasons: ["Workspace Queue bridge is unavailable."],
      status: "unavailable" as const,
    }));
    const result = createQueueBroker(adapter).invoke<QueueAgentSelfTestReport>(
      request({
        capabilityId: "queue.selfTest",
        dryRun: true,
        input: {},
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(selfTestCase(result.result.output, "queue:singleton-target")).toMatchObject({
      reason: "Adapter not available",
      status: "skipped",
    });
    expect(selfTestCase(result.result.output, "queue:create-items-dry-run")).toMatchObject({
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:no-auto-run")).toMatchObject({
      status: "passed",
    });
    expect(selfTestCase(result.result.output, "queue:no-duplicate-view")).toMatchObject({
      status: "passed",
    });
    expect(result.result.output?.productSummary).toBe("Queue self-test passed");
  });

  it("does not introduce regex routing or direct Workspace Agent broker construction in the adapter", () => {
    const source = frontendSource(
      "workbench/agents/adapters/queueAgentCapabilities.ts",
    );
    const workspaceAgentSource = frontendSource(
      "workbench/InteractiveAgentPlaceholderWidget.tsx",
    );

    expect(source).not.toContain("new RegExp");
    expect(source).not.toContain(".match(");
    expect(source).not.toContain("classify");
    expect(workspaceAgentSource).not.toContain("createQueueAgentActionHandlers");
    expect(workspaceAgentSource).not.toContain("createHobitAgentActionBroker");
  });
});

function createQueueBroker(
  adapter: FakeQueueAdapter,
  { allowWriteInvoke = false }: { allowWriteInvoke?: boolean } = {},
) {
  return createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(adapter),
    policy: {
      requireDryRunBeforeSideEffectingInvoke: !allowWriteInvoke,
    },
    registry: createHobitAgentCapabilityRegistry([
      ...HOBIT_TEST_AGENT_CAPABILITIES,
      ...HOBIT_AGENT_INITIAL_CAPABILITIES,
    ]),
  });
}

type FakeQueueAdapter = QueueAgentAdapterApi & {
  createdItems: QueueAgentNormalizedCreateItem[];
  lastCreateRequest: QueueAgentCreateItemsRequest | null;
  lastImportInput: QueueAgentPromptPackInput | null;
  operations: {
    codexRuns: number;
    duplicateQueueViews: number;
    gitMutations: number;
    rollbackExecutions: number;
    shellCommands: number;
    terminalLaunches: number;
    workerStarts: number;
  };
  createItems: ReturnType<typeof vi.fn>;
  getSingletonQueueTarget: ReturnType<typeof vi.fn>;
  importPromptPack: ReturnType<typeof vi.fn>;
  previewCreateItems: ReturnType<typeof vi.fn>;
  previewPromptPack: ReturnType<typeof vi.fn>;
};

function fakeQueueAdapter({
  supportsDependencyEdges = true,
  supportsSafeMutationSandbox = false,
}: {
  supportsDependencyEdges?: boolean;
  supportsSafeMutationSandbox?: boolean;
} = {}): FakeQueueAdapter {
  const base = createDefaultQueueAgentAdapterApi();
  const adapter = {
    ...base,
    createdItems: [],
    lastCreateRequest: null,
    lastImportInput: null,
    operations: {
      codexRuns: 0,
      duplicateQueueViews: 0,
      gitMutations: 0,
      rollbackExecutions: 0,
      shellCommands: 0,
      terminalLaunches: 0,
      workerStarts: 0,
    },
    supportsDependencyEdges,
    supportsSafeMutationSandbox,
  } as unknown as FakeQueueAdapter;

  adapter.createItems = vi.fn((request: QueueAgentCreateItemsRequest) => {
    adapter.lastCreateRequest = request;
    adapter.createdItems.push(...request.items);
    return base.createItems(request);
  });
  adapter.getSingletonQueueTarget = vi.fn(base.getSingletonQueueTarget);
  adapter.importPromptPack = vi.fn(
    (input: QueueAgentPromptPackInput, request: QueueAgentCreateItemsRequest) => {
      adapter.lastImportInput = input;
      adapter.lastCreateRequest = request;
      adapter.createdItems.push(...request.items);
      return base.importPromptPack(input, request);
    },
  );
  adapter.previewCreateItems = vi.fn(base.previewCreateItems);
  adapter.previewPromptPack = vi.fn(base.previewPromptPack);

  return adapter;
}

function selfTestCase(
  report: QueueAgentSelfTestReport | undefined,
  caseId: string,
) {
  const item = report?.cases.find((candidate) => candidate.caseId === caseId);
  if (!item) {
    throw new Error(`Missing Queue self-test case: ${caseId}`);
  }
  return item;
}

function requiredCapability(
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>,
  capabilityId: string,
) {
  const capability = findCapability(registry, capabilityId);
  if (!capability) {
    throw new Error(`Missing capability ${capabilityId}`);
  }
  return capability;
}

function requiredMutationExample(
  capability: ReturnType<typeof requiredCapability>,
) {
  const example = capability.examples?.find(
    (candidate) => !candidate.exampleActionRequest.dryRun,
  );

  if (!example) {
    throw new Error(`Missing mutation example for ${capability.id}`);
  }

  return example;
}

function requiredDryRunExample(
  capability: ReturnType<typeof requiredCapability>,
) {
  const example = capability.examples?.find(
    (candidate) => candidate.exampleActionRequest.dryRun,
  );

  if (!example) {
    throw new Error(`Missing dry-run example for ${capability.id}`);
  }

  return example;
}

function request({
  capabilityId,
  confirmationToken = null,
  dryRun = false,
  input = {},
}: {
  capabilityId: string;
  confirmationToken?: string | null;
  dryRun?: boolean;
  input?: unknown;
}) {
  return createActionRequest({
    agentId: "test.agentA",
    agentRoleId: "test_harness",
    capabilityId,
    confirmationToken,
    createdAt: "2026-06-15T10:00:00.000Z",
    dryRun,
    input,
    requestId: `request-${capabilityId}`,
  });
}

function registerTestAgents() {
  const empty = createAgentRuntimeState({ workspaceId: "workspace-1" });
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

function promptPackSourceText() {
  return JSON.stringify({
    dependencyPolicy: "explicit_only",
    id: "adapter-pack",
    items: [
      { id: "first", prompt: "First prompt.", title: "First task" },
      {
        dependencies: ["first"],
        id: "second",
        prompt: "Second prompt.",
        title: "Second task",
      },
    ],
  });
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => queueBridgeItemResult()),
    getSnapshot: vi.fn(async () => queueBridgeSnapshotResult()),
    updateItem: vi.fn(async () => queueBridgeItemResult()),
    ...overrides,
  };
}

function queueBridgeItemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action: "queue.createItem",
    events: [],
    item: {
      dependencies: [],
      id: "queue-created",
      prompt: "Prompt",
      status: "queued",
      title: "Queue item",
      ...overrides,
    } as QueueWidgetItemSnapshot,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function queueBridgeSnapshotResult(): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace-1:agent-queue",
      widgetType: "agent-queue",
      workspaceId: "workspace-1",
    } as unknown as QueueWidgetSnapshot,
  };
}

function frontendSource(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/src/${path}`, "utf8");
}
