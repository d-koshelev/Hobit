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
  QUEUE_CAPABILITY_CONTRACT_INVENTORY,
  QUEUE_RUN_APPROVAL_POLICY_VALUES,
  QUEUE_RUN_SANDBOX_VALUES,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../capabilities/queueCapabilityContracts";
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
import type { QueueBackendCapabilityPort } from "./queueBackendCapabilityPort";
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
  AgentQueueCompletionCommandResult,
  AgentQueueItemAggregate,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
} from "../../../workspace/types";
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

  it("keeps Queue broker adapters independent from Queue UI modules", () => {
    const adapterSources = [
      "workbench/agents/adapters/queueAgentCapabilities.ts",
      "workbench/agents/adapters/queueAgentDogfoodLifecycleCapabilities.ts",
      "workbench/agents/adapters/queueBackendCapabilityPort.ts",
      "workbench/agents/adapters/workspaceAgentQueueBridgeAdapter.ts",
    ]
      .map(frontendSource)
      .join("\n");

    expect(adapterSources).not.toContain("AgentQueueV2Board");
    expect(adapterSources).not.toContain("AgentQueuePlaceholderWidget");
    expect(adapterSources).not.toContain("WorkspaceAgentQueueTaskStatusCard");
    expect(adapterSources).not.toContain("widgetV2/queueV2");
    expect(adapterSources).not.toContain("queue/details");
    expect(adapterSources).not.toContain("queueReviewEvidenceViewModel");
    expect(adapterSources).not.toContain(".css");
    expect(adapterSources).not.toContain("ModuleShell");
    expect(adapterSources).not.toContain("ModuleHeader");
  });

  it("keeps Queue adapter capability references registered", () => {
    const registeredCapabilityIds = new Set(
      createHobitAgentCapabilityRegistry().capabilities.map(
        (capability) => capability.id,
      ),
    );
    const adapterSources = [
      "workbench/agents/adapters/queueAgentCapabilities.ts",
      "workbench/agents/adapters/queueAgentDogfoodLifecycleCapabilities.ts",
      "workbench/agents/adapters/queueAgentCapabilityTypes.ts",
      "workbench/agents/adapters/workspaceAgentQueueBridgeAdapter.ts",
    ]
      .map(frontendSource)
      .join("\n");
    const queueCapabilityReferences = [
      ...Array.from(
        adapterSources.matchAll(/nextSuggestedCapability:\s*["'](queue\.[A-Za-z0-9.]+)["']/g),
      ).map((match) => match[1]),
      ...Array.from(
        adapterSources.matchAll(/return\s+["'](queue\.[A-Za-z0-9.]+)["']/g),
      ).map((match) => match[1]),
    ];

    expect(queueCapabilityReferences).not.toContain(
      "queue.lifecycle.getEvidenceBundle",
    );
    for (const capabilityId of queueCapabilityReferences) {
      expect(registeredCapabilityIds.has(capabilityId), capabilityId).toBe(true);
    }
  });

  it("keeps every Queue capability contract inventory entry registered and implemented", () => {
    const registry = createHobitAgentCapabilityRegistry();
    const registeredQueueIds = registry.capabilities
      .filter((capability) => capability.id.startsWith("queue."))
      .map((capability) => capability.id)
      .sort();
    const inventoryIds = QUEUE_CAPABILITY_CONTRACT_INVENTORY.map(
      (contract) => contract.capabilityId,
    ).sort();

    expect(inventoryIds).toEqual(registeredQueueIds);

    for (const contract of QUEUE_CAPABILITY_CONTRACT_INVENTORY) {
      const capability = findCapability(registry, contract.capabilityId);

      expect(contract.registered).toBe(true);
      expect(contract.implemented).toBe(true);
      expect(capability).not.toBeNull();
      expect(capability?.sideEffectLevel).toBe(contract.sideEffectLevel);
      expect(capability?.confirmationRequirement).toBe(
        contract.confirmationRequirement,
      );
      for (const nextCapabilityId of contract.nextSuggestedCapabilities) {
        expect(findCapability(registry, nextCapabilityId)).not.toBeNull();
      }
    }
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
      createdItemCount: 1,
      createdTaskIds: ["created-Second"],
      wouldAutoRunWorkers: false,
      wouldCreateDuplicateQueueView: false,
      wouldTargetSingletonQueue: true,
    });
    expect(result.result.output?.createdItems).toHaveLength(1);
  });

  it("reads queue.items.list from backend aggregate API instead of Queue snapshots", async () => {
    const getSnapshot = vi.fn(async () => queueBridgeSnapshotResult());
    const listItemAggregates = vi.fn(async () => [
      queueAggregate({
        blockers: [{ code: "missing_codex_executable", message: "Missing Codex executable." }],
        codexExecutable: null,
        evidenceState: "not_durable",
        latestRun: {
          completedAt: "2026-06-15T10:05:00.000Z",
          executorWidgetId: "executor-1",
          finalDetailAvailable: true,
          reviewStatus: "review_needed",
          runId: "run-1",
          runLinkId: "link-1",
          source: "manual",
          startedAt: "2026-06-15T10:00:00.000Z",
          status: "completed",
          validationStatus: "passed",
        },
        nextActions: [
          {
            available: false,
            code: "update_run_settings",
            label: "Update run settings",
            unavailableReason: "Codex executable is missing.",
          },
        ],
        taskId: "task-aggregate",
        validationState: "unknown",
      }),
    ]);
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getSnapshot, listItemAggregates }),
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
      aggregateSource: string;
      authoritativeBackendAggregate: boolean;
      items: Array<{
        authoritativeBackendAggregate: boolean;
        blockerReasons: string[];
        blockers: unknown[];
        durableFlags: { evidenceState: boolean; frontendOverlayUsed: boolean };
        evidenceState: string;
        latestRun: { runId: string; status: string };
        nextActions: Array<{
          code: string;
          suggestedCapability?: string | null;
        }>;
        taskId: string;
        validationState: string;
      }>;
    }>(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      aggregateSource: "tauri_queue_item_aggregate",
      authoritativeBackendAggregate: true,
      items: [
        {
          authoritativeBackendAggregate: true,
          blockerReasons: ["Missing Codex executable."],
          evidenceState: "not_durable",
          latestRun: { runId: "run-1", status: "completed" },
          nextActions: [
            {
              code: "update_run_settings",
              suggestedCapability: "queue.item.updateRunSettings",
            },
          ],
          taskId: "task-aggregate",
          validationState: "unknown",
        },
      ],
    });
    expect(result.result.output?.items[0]?.durableFlags).toMatchObject({
      evidenceState: false,
      frontendOverlayUsed: false,
    });
  });

  it("reads queue.lifecycle.get from backend aggregate API with explicit taskId", async () => {
    const getSnapshot = vi.fn(async () => queueBridgeSnapshotResult());
    const getItemAggregate = vi.fn(async ({ taskId }: { taskId: string }) =>
      queueAggregate({
        blockers: [
          { code: "review_not_durable", message: "Review state is not durable yet." },
        ],
        commitState: "not_durable",
        dependencyState: "unknown",
        evidenceState: "not_durable",
        evidenceSummary: {
          available: false,
          notDurableReason: "Worker evidence was not recorded durably.",
          source: "aggregate",
          summary: null,
        },
        latestRun: {
          completedAt: "2026-06-15T10:05:00.000Z",
          executorWidgetId: "executor-1",
          finalDetailAvailable: true,
          reviewStatus: "review_needed",
          runId: "run-1",
          runLinkId: "link-1",
          source: "manual",
          startedAt: "2026-06-15T10:00:00.000Z",
          status: "completed",
          validationStatus: null,
        },
        nextActions: [
          {
            available: false,
            code: "create_review_message",
            label: "Create review message",
            unavailableReason: "Review command is not durable yet.",
          },
        ],
        reviewState: "in_review",
        taskId,
        ticketState: "awaiting_review",
        validationState: "unknown",
        workerRunState: "completed",
      }),
    );
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getItemAggregate, getSnapshot }),
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
      aggregateSource: string;
      authoritativeBackendAggregate: boolean;
      blockerReasons: string[];
      blockers: Array<{ code: string; message: string }>;
      commitState: string;
      dependencyState: string;
      durableFlags: {
        commitState: boolean;
        evidenceState: boolean;
        frontendOverlayUsed: boolean;
      };
      evidenceState: string;
      evidenceSummary: {
        available: boolean;
        notDurableReason: string | null;
        source: string;
        summary: string | null;
      } | null;
      latestRun: { runId: string; status: string };
      lifecycle: null;
      nextActions: Array<{ code: string; suggestedCapability?: string | null }>;
      nextSuggestedCapability: string | null;
      reviewState: string;
      taskId: string;
      ticketState: string;
      validationState: string;
      workerRunState: string;
    }>(
      request({
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-aggregate" },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(getItemAggregate).toHaveBeenCalledWith({ taskId: "task-aggregate" });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      aggregateSource: "tauri_queue_item_aggregate",
      authoritativeBackendAggregate: true,
      blockerReasons: ["Review state is not durable yet."],
      blockers: [
        {
          code: "review_not_durable",
          message: "Review state is not durable yet.",
        },
      ],
      commitState: "not_durable",
      dependencyState: "unknown",
      evidenceState: "not_durable",
      evidenceSummary: {
        available: false,
        notDurableReason: "Worker evidence was not recorded durably.",
        source: "aggregate",
        summary: null,
      },
      latestRun: {
        runId: "run-1",
        status: "completed",
      },
      lifecycle: null,
      nextActions: [
        {
          code: "create_review_message",
          suggestedCapability: "queue.review.createMessage",
        },
      ],
      nextSuggestedCapability: "queue.review.createMessage",
      reviewState: "in_review",
      taskId: "task-aggregate",
      ticketState: "awaiting_review",
      validationState: "unknown",
      workerRunState: "completed",
    });
    expect(result.result.output?.durableFlags).toMatchObject({
      commitState: false,
      evidenceState: false,
      frontendOverlayUsed: false,
    });
  });

  it("rejects missing queue.lifecycle.get taskId before aggregate or snapshot reads", async () => {
    const getItemAggregate = vi.fn();
    const getSnapshot = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getItemAggregate, getSnapshot }),
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

    const result = await broker.invokeAsync(
      request({
        capabilityId: "queue.lifecycle.get",
        input: {},
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe("taskId is required.");
    expect(getItemAggregate).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("runs backend-backed Queue capabilities through the backend port without Queue UI state", async () => {
    const listItemAggregates = vi.fn(async () => [
      queueAggregate({
        nextActions: [
          {
            available: true,
            code: "create_review_message",
            label: "Create review message",
            unavailableReason: null,
          },
        ],
        taskId: "task-backend",
        ticketState: "awaiting_review",
        workerRunState: "completed",
      }),
    ]);
    const getItemAggregate = vi.fn(async ({ taskId }: { taskId: string }) =>
      queueAggregate({
        nextActions: [
          {
            available: true,
            code: "create_review_message",
            label: "Create review message",
            unavailableReason: null,
          },
        ],
        taskId,
        ticketState: "awaiting_review",
        workerRunState: "completed",
      }),
    );
    const recordWorkerFinished = vi.fn(async () =>
      workerFinishedCommandResult({
        aggregate: queueAggregate({
          evidenceState: "available",
          nextActions: [
            {
              available: true,
              code: "create_review_message",
              label: "Create review message",
              unavailableReason: null,
            },
          ],
          taskId: "task-backend",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
        runId: "run-backend",
      }),
    );
    const getWorkerEvidenceBundle = vi.fn(async () =>
      workerEvidenceQueryResult({
        aggregate: queueAggregate({
          evidenceState: "available",
          taskId: "task-backend",
          ticketState: "awaiting_review",
        }),
        runId: "run-backend",
      }),
    );
    const createReviewMessage = vi.fn(async () =>
      reviewCreateMessageResult({
        aggregate: queueAggregate({
          nextActions: [
            {
              available: true,
              code: "ack_review",
              label: "Acknowledge review",
              unavailableReason: null,
            },
          ],
          reviewState: "review_message_created",
          taskId: "task-backend",
          ticketState: "awaiting_review",
        }),
        evidenceBundleId: "bundle-1",
        messageId: "review-message-backend",
        runId: "run-backend",
      }),
    );
    const ackReviewMessage = vi.fn(async () =>
      reviewCommandResult({
        aggregate: queueAggregate({
          nextActions: [
            {
              available: true,
              code: "mark_done",
              label: "Mark done",
              unavailableReason: null,
            },
          ],
          reviewState: "in_review",
          taskId: "task-backend",
          ticketState: "in_review",
        }),
        messageId: "review-message-backend",
        status: "acknowledged",
      }),
    );
    const markItemDone = vi.fn(async () =>
      completionCommandResult({
        aggregate: queueAggregate({
          durableFlags: {
            commitState: true,
            completionState: true,
            dependencyState: true,
            evidenceState: true,
            frontendOverlayUsed: false,
            latestRunLink: true,
            reviewState: true,
            taskRow: true,
            validationState: true,
          },
          evidenceState: "available",
          reviewState: "done",
          taskId: "task-backend",
          ticketState: "done",
          workerRunState: "completed",
        }),
      }),
    );
    const backendApi = queueBackendPort({
      ackReviewMessage,
      createReviewMessage,
      getItemAggregate,
      getWorkerEvidenceBundle,
      listItemAggregates,
      markItemDone,
      recordWorkerFinished,
    });
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(null, { backendApi }),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });

    const list = await broker.invokeAsync(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );
    const lifecycle = await broker.invokeAsync(
      request({
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-backend" },
      }),
    );
    const finished = await broker.invokeAsync(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: {
          finalAgentMessage: "Worker completed.",
          outcome: "completed",
          runId: "run-backend",
          taskId: "task-backend",
        },
      }),
    );
    const evidence = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.getEvidenceBundle",
        input: { runId: "run-backend", taskId: "task-backend" },
      }),
    );
    const review = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.createMessage",
        input: { taskId: "task-backend" },
      }),
    );
    const ack = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.ack",
        input: {
          messageId: "review-message-backend",
          taskId: "task-backend",
        },
      }),
    );
    const markDone = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          reason: "Operator accepted completion.",
          taskId: "task-backend",
        },
      }),
    );

    expect(list.status).toBe("succeeded");
    expect(lifecycle.status).toBe("succeeded");
    expect(finished.status).toBe("succeeded");
    expect(evidence.status).toBe("succeeded");
    expect(review.status).toBe("succeeded");
    expect(ack.status).toBe("succeeded");
    expect(markDone.status).toBe("succeeded");
    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(getItemAggregate).toHaveBeenCalledWith({ taskId: "task-backend" });
    expect(recordWorkerFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-backend",
        taskId: "task-backend",
      }),
    );
    expect(getWorkerEvidenceBundle).toHaveBeenCalledWith({
      runId: "run-backend",
      taskId: "task-backend",
    });
    expect(createReviewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceBundleId: null,
        runId: null,
        taskId: "task-backend",
      }),
    );
    expect(ackReviewMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "review-message-backend",
        taskId: "task-backend",
      }),
    );
    expect(markItemDone).toHaveBeenCalledWith({
      actorId: "test.agentA",
      confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      reason: "Operator accepted completion.",
      reviewMessageId: null,
      runId: null,
      taskId: "task-backend",
    });
  });

  it("routes queue.item.markDone through backend command only with exact structured confirmation", async () => {
    const getSnapshot = vi.fn(async () => queueBridgeSnapshotResult());
    const markItemDone = vi.fn(async () =>
      completionCommandResult({
        aggregate: queueAggregate({
          durableFlags: {
            commitState: true,
            completionState: true,
            dependencyState: true,
            evidenceState: true,
            frontendOverlayUsed: false,
            latestRunLink: true,
            reviewState: true,
            taskRow: true,
            validationState: true,
          },
          evidenceState: "available",
          reviewState: "done",
          taskId: "task-done",
          ticketState: "done",
          workerRunState: "completed",
        }),
        decisionId: "decision-done-1",
        reviewMessageId: "review-message-1",
        runId: "run-1",
      }),
    );
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getSnapshot, markItemDone }),
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

    const missingTask = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: { reason: "Missing task id." },
      }),
    );
    const proseOnly = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.markDone",
        input: { taskId: "task-done" },
      }),
    );
    const success = await broker.invokeAsync<{
      backendCompletionStatus: string;
      nextSuggestedCapability: string | null;
      queueMutation: string;
      ticketState: string;
      wouldCallGit: boolean;
      wouldExecuteRollback: boolean;
      wouldLaunchTerminal: boolean;
      wouldRunValidation: boolean;
    }>(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          reason: "Operator accepted completion.",
          reviewMessageId: "review-message-1",
          runId: "run-1",
          taskId: "task-done",
        },
      }),
    );

    expect(missingTask.status).toBe("invalid_input");
    expect(proseOnly.status).toBe("needs_confirmation");
    expect(markItemDone).toHaveBeenCalledTimes(1);
    expect(markItemDone).toHaveBeenCalledWith({
      actorId: "test.agentA",
      confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      reason: "Operator accepted completion.",
      reviewMessageId: "review-message-1",
      runId: "run-1",
      taskId: "task-done",
    });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(success.status).toBe("succeeded");
    expect(success.result.output).toMatchObject({
      backendCompletionStatus: "succeeded",
      nextSuggestedCapability: null,
      queueMutation: "backend_domain",
      ticketState: "done",
      wouldCallGit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldRunValidation: false,
    });
  });

  it("surfaces queue.item.markDone backend blockers with state dimensions", async () => {
    const markItemDone = vi.fn(async () =>
      completionCommandResult({
        aggregate: queueAggregate({
          dependencyState: "none",
          evidenceState: "available",
          reviewState: "review_message_created",
          taskId: "task-blocked",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
        blocker: {
          blockerCode: "review_not_acked",
          blockerMessage:
            "The backend review message must be ACKed before queue.item.markDone.",
          commitState: "none",
          dependencyState: "none",
          evidenceBundleId: "bundle-1",
          evidenceState: "available",
          missingRequiredField: null,
          nextSuggestedCapability: "queue.review.ack",
          reviewMessageId: "review-message-1",
          reviewState: "review_message_created",
          runId: "run-1",
          taskId: "task-blocked",
          ticketState: "awaiting_review",
          validationState: "not_requested",
          workerRunState: "completed",
        },
        completionDecision: null,
        decisionId: null,
        durable: false,
        evidenceBundleId: "bundle-1",
        reviewMessageId: "review-message-1",
        runId: "run-1",
        status: "blocked",
      }),
    );
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ markItemDone }),
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
      backendCompletionStatus: string;
      blockerCode: string;
      nextSuggestedCapability: string | null;
      queueMutation: string;
      reviewState: string;
      ticketState: string;
    }>(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: { taskId: "task-blocked" },
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.result.output).toMatchObject({
      backendCompletionStatus: "blocked",
      blockerCode: "review_not_acked",
      nextSuggestedCapability: "queue.review.ack",
      queueMutation: "none",
      reviewState: "review_message_created",
      ticketState: "awaiting_review",
    });
  });

  it("creates review messages through backend bridge command with trusted actor default", async () => {
    const getSnapshot = vi.fn(async () => queueBridgeSnapshotResult());
    const createReviewMessage = vi.fn(async () =>
      reviewCreateMessageResult({
        aggregate: queueAggregate({
          nextActions: [
            {
              available: true,
              code: "ack_review",
              label: "Acknowledge review message",
              unavailableReason: null,
            },
          ],
          reviewState: "review_message_created",
          taskId: "task-review",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
        evidenceBundleId: "bundle-1",
        messageId: "review-message-1",
        runId: "run-1",
      }),
    );
    const getItemAggregate = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ createReviewMessage, getItemAggregate, getSnapshot }),
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
      lifecycle: null;
      messageId: string;
      nextSuggestedCapability: string | null;
      queueMutation: string;
      reviewState: string;
      taskId: string;
      wouldPersistBackend: boolean;
    }>(
      request({
        capabilityId: "queue.review.createMessage",
        input: {
          finalAgentMessage: "Worker final report.",
          taskId: "task-review",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(createReviewMessage).toHaveBeenCalledWith({
      actorId: "test.agentA",
      evidenceBundleId: null,
      messageBody: "Worker final report.",
      runId: null,
      taskId: "task-review",
    });
    expect(getItemAggregate).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      lifecycle: null,
      messageId: "review-message-1",
      nextSuggestedCapability: "queue.review.ack",
      queueMutation: "backend_domain",
      reviewState: "review_message_created",
      taskId: "task-review",
      wouldPersistBackend: true,
    });
  });

  it("acknowledges review messages through backend bridge command with trusted actor default", async () => {
    const ackReviewMessage = vi.fn(async () =>
      reviewCommandResult({
        aggregate: queueAggregate({
          reviewState: "in_review",
          taskId: "task-review",
          ticketState: "in_review",
        }),
        messageId: "review-message-1",
        status: "acknowledged",
      }),
    );
    const getSnapshot = vi.fn();
    const result = await createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ ackReviewMessage, getSnapshot }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    }).invokeAsync(
      request({
        capabilityId: "queue.review.ack",
        input: {
          messageId: "review-message-1",
          taskId: "task-review",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(ackReviewMessage).toHaveBeenCalledWith({
      actorId: "test.agentA",
      messageId: "review-message-1",
      taskId: "task-review",
    });
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("records agentFinished through backend worker evidence command", async () => {
    const recordWorkerFinished = vi.fn(async () =>
      workerFinishedCommandResult({
        aggregate: queueAggregate({
          evidenceState: "available",
          latestRun: {
            completedAt: "2026-06-15T10:01:00.000Z",
            executorWidgetId: "executor-1",
            finalDetailAvailable: true,
            reviewStatus: "review_needed",
            runId: "run-1",
            runLinkId: "link-1",
            source: "manual",
            startedAt: "2026-06-15T10:00:00.000Z",
            status: "completed",
            validationStatus: null,
          },
          nextActions: [
            {
              available: true,
              code: "create_review_message",
              label: "Create review message",
              unavailableReason: null,
            },
          ],
          reviewState: "awaiting_review",
          taskId: "task-review",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
        bundleId: "bundle-1",
        runId: "run-1",
      }),
    );
    const getSnapshot = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getSnapshot, recordWorkerFinished }),
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
      evidenceBundleId: string;
      evidenceState: string;
      nextSuggestedCapability: string | null;
      queueMutation: string;
      runId: string;
      taskId: string;
      wouldPersistBackend: boolean;
    }>(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: {
          changedFilesSummary: ["src/lib.rs"],
          finalAgentMessage: "Worker final report.",
          outcome: "completed",
          runId: "run-1",
          taskId: "task-review",
          validationSummary: "not run",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(recordWorkerFinished).toHaveBeenCalledWith({
      changedFiles: ["src/lib.rs"],
      changedFilesSummary: "src/lib.rs",
      errorSummary: null,
      finishedAt: null,
      outcome: "completed",
      runId: "run-1",
      source: "workspace_agent",
      summary: "Worker final report.",
      taskId: "task-review",
      validationSummary: "not run",
      workerId: "test.agentA",
    });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      evidenceBundleId: "bundle-1",
      evidenceState: "available",
      nextSuggestedCapability: "queue.review.createMessage",
      queueMutation: "backend_domain",
      runId: "run-1",
      taskId: "task-review",
      wouldPersistBackend: true,
    });
  });

  it("rejects agentFinished without runId before backend worker evidence command", async () => {
    const recordWorkerFinished = vi.fn();
    const result = await createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ recordWorkerFinished }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    }).invokeAsync(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: {
          finalAgentMessage: "Worker final report.",
          outcome: "completed",
          taskId: "task-review",
        },
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe("runId is required.");
    expect(recordWorkerFinished).not.toHaveBeenCalled();
  });

  it("reads review evidence bundles through backend worker evidence query", async () => {
    const getWorkerEvidenceBundle = vi.fn(async () =>
      workerEvidenceQueryResult({
        aggregate: queueAggregate({
          evidenceState: "available",
          nextActions: [
            {
              available: true,
              code: "create_review_message",
              label: "Create review message",
              unavailableReason: null,
            },
          ],
          reviewState: "awaiting_review",
          taskId: "task-review",
          ticketState: "awaiting_review",
          workerRunState: "completed",
        }),
        bundleId: "bundle-1",
        runId: "run-1",
      }),
    );
    const getSnapshot = vi.fn();
    const result = await createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getSnapshot, getWorkerEvidenceBundle }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    }).invokeAsync<{
      backendEvidenceBundle: { bundleId: string; runId: string };
      evidenceBundleId: string;
      evidenceBundlePersistence: string;
      evidenceState: string;
      nextSuggestedCapability: string | null;
      runId: string;
    }>(
      request({
        capabilityId: "queue.review.getEvidenceBundle",
        input: {
          runId: "run-1",
          taskId: "task-review",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(getWorkerEvidenceBundle).toHaveBeenCalledWith({
      runId: "run-1",
      taskId: "task-review",
    });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.result.output).toMatchObject({
      backendEvidenceBundle: {
        bundleId: "bundle-1",
        runId: "run-1",
      },
      evidenceBundleId: "bundle-1",
      evidenceBundlePersistence: "backend_durable",
      evidenceState: "available",
      nextSuggestedCapability: "queue.review.createMessage",
      runId: "run-1",
    });
  });

  it("rejects missing review create taskId before backend bridge reads or commands", async () => {
    const createReviewMessage = vi.fn();
    const getSnapshot = vi.fn();
    const result = await createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ createReviewMessage, getSnapshot }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    }).invokeAsync(
      request({
        capabilityId: "queue.review.createMessage",
        input: {},
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe("taskId is required.");
    expect(createReviewMessage).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("rejects missing review and evidence ids before backend reads or commands", async () => {
    const ackReviewMessage = vi.fn();
    const getItemAggregate = vi.fn();
    const getWorkerEvidenceBundle = vi.fn();
    const recordWorkerFinished = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            ackReviewMessage,
            getItemAggregate,
            getWorkerEvidenceBundle,
            recordWorkerFinished,
          }),
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

    const missingAckTaskId = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.ack",
        input: { messageId: "review-message-1" },
      }),
    );
    const missingAckMessageId = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.ack",
        input: { taskId: "task-review" },
      }),
    );
    const missingEvidenceTaskId = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.getEvidenceBundle",
        input: { runId: "run-1" },
      }),
    );
    const missingLifecycleTaskId = await broker.invokeAsync(
      request({
        capabilityId: "queue.lifecycle.get",
        input: {},
      }),
    );
    const missingAgentFinishedTaskId = await broker.invokeAsync(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: {
          finalAgentMessage: "Done.",
          outcome: "completed",
          runId: "run-1",
        },
      }),
    );

    expect(missingAckTaskId.status).toBe("invalid_input");
    expect(missingAckTaskId.result.message).toBe("taskId is required.");
    expect(missingAckMessageId.status).toBe("invalid_input");
    expect(missingAckMessageId.result.message).toBe("messageId is required.");
    expect(missingEvidenceTaskId.status).toBe("invalid_input");
    expect(missingEvidenceTaskId.result.message).toBe("taskId is required.");
    expect(missingLifecycleTaskId.status).toBe("invalid_input");
    expect(missingLifecycleTaskId.result.message).toBe("taskId is required.");
    expect(missingAgentFinishedTaskId.status).toBe("invalid_input");
    expect(missingAgentFinishedTaskId.result.message).toBe(
      "taskId is required.",
    );
    expect(ackReviewMessage).not.toHaveBeenCalled();
    expect(getItemAggregate).not.toHaveBeenCalled();
    expect(getWorkerEvidenceBundle).not.toHaveBeenCalled();
    expect(recordWorkerFinished).not.toHaveBeenCalled();
  });

  it("does not infer review or evidence ids from prose fields", async () => {
    const createReviewMessage = vi.fn();
    const getWorkerEvidenceBundle = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ createReviewMessage, getWorkerEvidenceBundle }),
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

    const proseReview = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.createMessage",
        input: {
          reason:
            "Create a review for taskId task-review and messageId message-1.",
        },
      }),
    );
    const proseEvidence = await broker.invokeAsync(
      request({
        capabilityId: "queue.review.getEvidenceBundle",
        input: {
          reason:
            "Read evidence for taskId task-review and runId run-1.",
        },
      }),
    );

    expect(proseReview.status).toBe("invalid_input");
    expect(proseReview.result.message).toBe(
      "reason is not supported by queue.review.createMessage.",
    );
    expect(proseEvidence.status).toBe("invalid_input");
    expect(proseEvidence.result.message).toBe(
      "reason is not supported by queue.review.getEvidenceBundle.",
    );
    expect(createReviewMessage).not.toHaveBeenCalled();
    expect(getWorkerEvidenceBundle).not.toHaveBeenCalled();
  });

  it("surfaces backend aggregate blockers for draft review create", async () => {
    const createReviewMessage = vi.fn(async () =>
      reviewCreateMessageBlockedResult({
        aggregate: queueAggregate({
          evidenceState: "none",
          reviewState: "not_requested",
          taskId: "task-draft",
          ticketState: "draft",
          workerRunState: "not_started",
        }),
      }),
    );
    const result = await createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ createReviewMessage }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    }).invokeAsync(
      request({
        capabilityId: "queue.review.createMessage",
        input: { taskId: "task-draft" },
      }),
    );

    expect(result.status).toBe("failed");
    expect(createReviewMessage).toHaveBeenCalledWith({
      actorId: "test.agentA",
      evidenceBundleId: null,
      messageBody: null,
      runId: null,
      taskId: "task-draft",
    });
    expect(result.result.message).toContain("task_is_draft");
    expect(result.result.output).toMatchObject({
      backendCreateMessageStatus: "precondition_failed",
      blockerCode: "task_is_draft",
      evidenceState: "none",
      reviewState: "not_requested",
      ticketState: "draft",
      workerRunState: "not_started",
    });
  });

  it("acknowledges review messages through backend bridge command", async () => {
    const ackReviewMessage = vi.fn(async () =>
      reviewCommandResult({
        aggregate: queueAggregate({
          nextActions: [
            {
              available: false,
              code: "none",
              label: "No action",
              unavailableReason: "in_review",
            },
          ],
          reviewState: "in_review",
          taskId: "task-review",
          ticketState: "in_review",
        }),
        messageId: "review-message-1",
        status: "acknowledged",
      }),
    );
    const result = await createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ ackReviewMessage }),
        ),
      ),
      policy: {
        requireDryRunBeforeSideEffectingInvoke: false,
      },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    }).invokeAsync<{
      messageId: string;
      queueMutation: string;
      reviewState: string;
      ticketState: string;
    }>(
      request({
        capabilityId: "queue.review.ack",
        input: {
          messageId: "review-message-1",
          taskId: "task-review",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(ackReviewMessage).toHaveBeenCalledWith({
      actorId: "test.agentA",
      messageId: "review-message-1",
      taskId: "task-review",
    });
    expect(result.result.output).toMatchObject({
      messageId: "review-message-1",
      queueMutation: "backend_domain",
      reviewState: "in_review",
      ticketState: "in_review",
    });
  });

  it("handles aggregate read not found and unavailable states cleanly", async () => {
    const notFoundBroker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ getItemAggregate: vi.fn(async () => null) }),
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
    const unavailableBroker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            listItemAggregates: vi.fn(async () => {
              throw new Error("Aggregate command unavailable.");
            }),
          }),
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

    const notFound = await notFoundBroker.invokeAsync(
      request({
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "missing-task" },
      }),
    );
    const unavailable = await unavailableBroker.invokeAsync(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );

    expect(notFound.status).toBe("failed");
    expect(notFound.result.message).toBe('Queue item "missing-task" was not found.');
    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.result.message).toBe("Aggregate command unavailable.");
  });

  it("invokes typed Queue run-control capabilities through the injected bridge", async () => {
    const getSnapshot = vi.fn(async () =>
      queueBridgeSnapshotResult({
        itemCounts: { total: 1 } as QueueWidgetSnapshot["itemCounts"],
        items: [
          queueBridgeSnapshotItem({
            approvalPolicy: "on_request",
            codexExecutable: "codex.cmd",
            executionWorkspace: "C:/repo",
            id: "task-1",
            sandbox: "workspace_write",
            status: "draft",
          }),
        ],
        selectedItem: queueBridgeSnapshotItem({
          approvalPolicy: "on_request",
          codexExecutable: "codex.cmd",
          executionWorkspace: "C:/repo",
          id: "task-1",
          sandbox: "workspace_write",
          status: "draft",
        }),
        selectedItemId: "task-1",
      }),
    );
    const updateItem = vi.fn(
      async (input: Parameters<WorkspaceAgentQueueBridge["updateItem"]>[0]) =>
        queueBridgeItemResult({
          approvalPolicy: "on_request",
          codexExecutable: "codex.cmd",
          executionWorkspace: "C:/repo",
          id: input.itemId,
          sandbox: "workspace_write",
          status: input.patch.status === "queued" ? "queued" : "draft",
        }),
    );
    const listItemAggregates = vi.fn(async () => [
      queueAggregate({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        nextActions: [
          {
            available: true,
            code: "promote_draft",
            label: "Promote draft",
            unavailableReason: null,
          },
        ],
        sandbox: "workspace_write",
        taskId: "task-1",
      }),
    ]);
    const enableQueue = vi.fn(async () => ({
      didAutoRunWorkers: false as const,
      didStartWorkers: false as const,
      globalExecutionState: "started",
      message: "Queue enabled.",
      ok: true,
      queueEnabled: true,
      status: "enabled" as const,
    }));
    const startQueueLinkedRun = vi.fn(async () => ({
      executorWidgetId: "executor-1",
      message: "Queue-linked Direct Work run started.",
      ok: true,
      response: {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "task-1",
        runId: "run-1",
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      },
      status: "started" as const,
    }));
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            enableQueue,
            getAvailableExecutorTargets: () => [
              {
                label: "Local executor ready",
                ownerKind: "agent_queue",
                widgetInstanceId: "executor-1",
              },
            ],
            getSnapshot,
            listItemAggregates,
            startQueueLinkedRun,
            updateItem,
          }),
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

    const listResult = await broker.invokeAsync<{
      availableExecutors: unknown[];
      items: unknown[];
    }>(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );
    const updateResult = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.updateRunSettings",
        input: {
          codexExecutable: "codex.cmd",
          taskId: "task-1",
        },
      }),
    );
    const promoteResult = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.promoteDraft",
        input: { taskId: "task-1" },
      }),
    );
    const enableResult = await broker.invokeAsync(
      request({
        capabilityId: "queue.enable",
        input: {},
      }),
    );
    const startResult = await broker.invokeAsync<{
      executorWidgetId: string;
      queueItemId: string;
      runId: string;
    }>(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );

    expect(listResult.status).toBe("succeeded");
    expect(listResult.result.output?.items).toHaveLength(1);
    expect(listResult.result.output?.availableExecutors).toEqual([
      expect.objectContaining({ executorWidgetId: "executor-1" }),
    ]);
    expect(updateResult.status).toBe("succeeded");
    expect(updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "task-1",
        patch: { codexExecutable: "codex.cmd" },
      }),
    );
    expect(promoteResult.status).toBe("succeeded");
    expect(updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "task-1",
        patch: { status: "queued" },
      }),
    );
    expect(enableResult.status).toBe("succeeded");
    expect(enableQueue).toHaveBeenCalledWith({ dryRun: false });
    expect(startResult.status).toBe("succeeded");
    expect(startResult.result.output).toMatchObject({
      executorWidgetId: "executor-1",
      queueItemId: "task-1",
      runId: "run-1",
    });
    expect(startQueueLinkedRun).toHaveBeenCalledWith({
      dryRun: false,
      executorWidgetId: "executor-1",
      taskId: "task-1",
    });
  });

  it("routes runnable backend aggregate next action to queue.enable while Queue is disabled", async () => {
    const listItemAggregates = vi.fn(async () => [
      queueAggregate({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        nextActions: [
          {
            available: true,
            code: "start_run",
            label: "Start run",
            unavailableReason: null,
          },
        ],
        sandbox: "workspace_write",
        taskId: "task-disabled",
        ticketState: "queued",
      }),
    ]);
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getAvailableExecutorTargets: () => [
              {
                label: "Local executor ready",
                ownerKind: "agent_queue",
                widgetInstanceId: "executor-1",
              },
            ],
            getQueueControlState: () => ({
              globalExecutionState: "stopped",
              queueEnabled: false,
            }),
            listItemAggregates,
          }),
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
      items: Array<{
        blockers: Array<{ code: string; message: string }>;
        blockerReasons: string[];
        canStart: boolean;
        nextActions: Array<{ code: string; suggestedCapability?: string | null }>;
        nextSuggestedCapability?: string | null;
        taskId: string;
      }>;
      nextSuggestedCapability?: string | null;
    }>(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output?.nextSuggestedCapability).toBe("queue.enable");
    expect(result.result.output?.items[0]).toMatchObject({
      blockerReasons: ["Queue disabled."],
      blockers: [{ code: "queue_disabled", message: "Queue disabled." }],
      canStart: false,
      nextSuggestedCapability: "queue.enable",
      taskId: "task-disabled",
    });
    expect(result.result.output?.items[0]?.nextActions).toContainEqual(
      expect.objectContaining({
        code: "start_run",
        suggestedCapability: "queue.enable",
      }),
    );
  });

  it("returns queue.enable after run settings make a queued task runnable while Queue is disabled", async () => {
    const getSnapshot = vi.fn(async () =>
      queueBridgeSnapshotResult({
        items: [
          queueBridgeSnapshotItem({
            approvalPolicy: "on_request",
            codexExecutable: "codex.cmd",
            executionWorkspace: "C:/repo",
            id: "task-disabled",
            sandbox: "workspace_write",
            status: "queued",
          }),
        ],
        selectedItem: queueBridgeSnapshotItem({
          approvalPolicy: "on_request",
          codexExecutable: "codex.cmd",
          executionWorkspace: "C:/repo",
          id: "task-disabled",
          sandbox: "workspace_write",
          status: "queued",
        }),
        selectedItemId: "task-disabled",
      }),
    );
    const updateItem = vi.fn(
      async (input: Parameters<WorkspaceAgentQueueBridge["updateItem"]>[0]) =>
        queueBridgeItemResult({
          approvalPolicy: "on_request",
          codexExecutable: input.patch.codexExecutable ?? "codex.cmd",
          executionWorkspace: "C:/repo",
          id: input.itemId,
          sandbox: "workspace_write",
          status: "queued",
        }),
    );
    const enableQueue = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            enableQueue,
            getAvailableExecutorTargets: () => [
              {
                label: "Local executor ready",
                ownerKind: "agent_queue",
                widgetInstanceId: "executor-1",
              },
            ],
            getQueueControlState: () => ({
              globalExecutionState: "stopped",
              queueEnabled: false,
            }),
            getSnapshot,
            updateItem,
          }),
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
      item: {
        blockers?: Array<{ code: string; message: string }>;
        blockerReasons: string[];
        canStart: boolean;
        nextSuggestedCapability?: string | null;
      };
      nextSuggestedCapability?: string | null;
    }>(
      request({
        capabilityId: "queue.item.updateRunSettings",
        input: {
          codexExecutable: "codex.cmd",
          taskId: "task-disabled",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output?.nextSuggestedCapability).toBe("queue.enable");
    expect(result.result.output?.item).toMatchObject({
      blockerReasons: ["Queue disabled."],
      blockers: [{ code: "queue_disabled", message: "Queue disabled." }],
      canStart: false,
      nextSuggestedCapability: "queue.enable",
    });
    expect(enableQueue).not.toHaveBeenCalled();
  });

  it("keeps startRun blocked while Queue is disabled and does not auto-enable", async () => {
    const enableQueue = vi.fn();
    const startQueueLinkedRun = vi.fn(async () => ({
      blockerReasons: ["Queue disabled."],
      message: "Queue disabled.",
      ok: false,
      status: "blocked" as const,
    }));
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            enableQueue,
            getQueueControlState: () => ({
              globalExecutionState: "stopped",
              queueEnabled: false,
            }),
            startQueueLinkedRun,
          }),
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
      blockers: Array<{ code: string; message: string }>;
      blockerReasons: string[];
      nextSuggestedCapability?: string | null;
      queueEnabled: boolean;
      startedDirectWork: boolean;
    }>(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-disabled",
        },
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.result.message).toBe("Queue disabled.");
    expect(result.result.output).toMatchObject({
      blockers: [{ code: "queue_disabled", message: "Queue disabled." }],
      blockerReasons: ["Queue disabled."],
      nextSuggestedCapability: "queue.enable",
      queueEnabled: false,
      startedDirectWork: false,
    });
    expect(startQueueLinkedRun).toHaveBeenCalledTimes(1);
    expect(enableQueue).not.toHaveBeenCalled();
  });

  it("suggests startRun after explicit queue.enable succeeds", async () => {
    const enableQueue = vi.fn(async () => ({
      didAutoRunWorkers: false as const,
      didStartWorkers: false as const,
      globalExecutionState: "started",
      message: "Queue enabled.",
      ok: true,
      queueEnabled: true,
      status: "enabled" as const,
    }));
    const startQueueLinkedRun = vi.fn(async () => ({
      executorWidgetId: "executor-1",
      message: "Queue-linked Direct Work run started.",
      ok: true,
      response: {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "task-1",
        runId: "run-1",
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      },
      status: "started" as const,
    }));
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            enableQueue,
            getQueueControlState: () => ({
              globalExecutionState: "started",
              queueEnabled: true,
            }),
            startQueueLinkedRun,
          }),
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

    const enableResult = await broker.invokeAsync<{
      nextSuggestedCapability?: string | null;
      queueEnabled: boolean;
    }>(
      request({
        capabilityId: "queue.enable",
        input: {},
      }),
    );
    const startResult = await broker.invokeAsync<{ runId: string }>(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );

    expect(enableResult.status).toBe("succeeded");
    expect(enableResult.result.output).toMatchObject({
      nextSuggestedCapability: "queue.item.startRun",
      queueEnabled: true,
    });
    expect(startResult.status).toBe("succeeded");
    expect(startResult.result.output).toMatchObject({ runId: "run-1" });
    expect(enableQueue).toHaveBeenCalledTimes(1);
    expect(startQueueLinkedRun).toHaveBeenCalledTimes(1);
  });

  it("accepts only exact Queue run-settings enum values", () => {
    const adapter = fakeQueueAdapter();
    adapter.updateRunSettings = vi.fn(
      (
        input: Parameters<
          NonNullable<QueueAgentAdapterApi["updateRunSettings"]>
        >[0],
      ) => ({
      message: "Queue run settings updated",
      output: {
        appliedFields: Object.keys(input).filter((field) => field !== "taskId"),
        item: {
          blockerReasons: [],
          canPromote: false,
          canStart: true,
          draftState: "not_draft" as const,
          hasApprovalPolicy: true,
          hasCodexExecutable: true,
          hasPrompt: true,
          hasSandbox: true,
          hasWorkspace: true,
          readinessState: "runnable" as const,
          status: "queued",
          taskId: input.taskId,
          title: "Queue task",
        },
        taskId: input.taskId,
      },
      status: "succeeded" as const,
    }),
    );
    const broker = createQueueBroker(adapter, { allowWriteInvoke: true });

    for (const sandbox of QUEUE_RUN_SANDBOX_VALUES) {
      const result = broker.invoke(
        request({
          capabilityId: "queue.item.updateRunSettings",
          input: { sandbox, taskId: `task-${sandbox}` },
        }),
      );

      expect(result.status).toBe("succeeded");
    }

    for (const approvalPolicy of QUEUE_RUN_APPROVAL_POLICY_VALUES) {
      const result = broker.invoke(
        request({
          capabilityId: "queue.item.updateRunSettings",
          input: { approvalPolicy, taskId: `task-${approvalPolicy}` },
        }),
      );

      expect(result.status).toBe("succeeded");
    }

    for (const sandbox of [
      "workspace-write",
      "workspaceWrite",
      "default",
      "",
    ]) {
      const result = broker.invoke(
        request({
          capabilityId: "queue.item.updateRunSettings",
          input: { sandbox, taskId: "task-invalid-sandbox" },
        }),
      );

      expect(result.status).toBe("invalid_input");
      expect(result.result.message).toContain("sandbox must be one of");
    }

    for (const approvalPolicy of [
      "on-request",
      "onRequest",
      "default",
      "",
    ]) {
      const result = broker.invoke(
        request({
          capabilityId: "queue.item.updateRunSettings",
          input: { approvalPolicy, taskId: "task-invalid-approval" },
        }),
      );

      expect(result.status).toBe("invalid_input");
      expect(result.result.message).toContain(
        "approvalPolicy must be one of",
      );
    }

    expect(adapter.updateRunSettings).toHaveBeenCalledTimes(
      QUEUE_RUN_SANDBOX_VALUES.length + QUEUE_RUN_APPROVAL_POLICY_VALUES.length,
    );
  });

  it("reports missing approvalPolicy as a readiness blocker when absent", async () => {
    const listItemAggregates = vi.fn(async () => [
      queueAggregate({
        approvalPolicy: null,
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        sandbox: "workspace_write",
        taskId: "task-missing-approval",
      }),
    ]);
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ listItemAggregates }),
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
      items: Array<{ blockerReasons: string[]; taskId: string }>;
    }>(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output?.items[0]).toMatchObject({
      blockerReasons: expect.arrayContaining(["Missing approval policy."]),
      taskId: "task-missing-approval",
    });
  });

  it("keeps queued runnable items out of the final-status blocker path", async () => {
    const getSnapshot = vi.fn(async () => queueBridgeSnapshotResult());
    const listItemAggregates = vi.fn(async () => [
      queueAggregate({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        nextActions: [
          {
            available: true,
            code: "start_run",
            label: "Start run",
            unavailableReason: null,
          },
        ],
        sandbox: "workspace_write",
        taskId: "queued-task",
        ticketState: "queued",
      }),
      queueAggregate({
        approvalPolicy: "never",
        blockers: [
          {
            code: "final_status",
            message: "Final-status Queue items cannot be started.",
          },
        ],
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        nextActions: [],
        sandbox: "workspace_write",
        taskId: "completed-task",
        ticketState: "completed",
      }),
    ]);
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({
            getAvailableExecutorTargets: () => [
              {
                label: "Local executor ready",
                ownerKind: "agent_queue",
                widgetInstanceId: "executor-1",
              },
            ],
            getSnapshot,
            listItemAggregates,
          }),
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

    const listResult = await broker.invokeAsync<{
      items: Array<{
        blockerReasons: string[];
        canStart: boolean;
        nextSuggestedCapability?: string | null;
        readinessState: string;
        taskId: string;
      }>;
    }>(
      request({
        capabilityId: "queue.items.list",
        input: { limit: 10 },
      }),
    );

    const queuedItem = listResult.result.output?.items.find(
      (item) => item.taskId === "queued-task",
    );
    const completedItem = listResult.result.output?.items.find(
      (item) => item.taskId === "completed-task",
    );

    expect(listResult.status).toBe("succeeded");
    expect(queuedItem).toMatchObject({
      canStart: true,
      nextSuggestedCapability: "queue.item.startRun",
      readinessState: "runnable",
    });
    expect(queuedItem?.blockerReasons).not.toContain(
      "Final-status Queue items cannot be started.",
    );
    expect(completedItem).toMatchObject({
      canStart: false,
      readinessState: "final",
    });
    expect(completedItem?.blockerReasons).toContain(
      "Final-status Queue items cannot be started.",
    );
    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("returns a blocked start result without claiming success when the bridge cannot start", async () => {
    const startQueueLinkedRun = vi.fn(async () => ({
      blockerReasons: ["Local executor unavailable."],
      message: "Local executor unavailable.",
      ok: false,
      status: "blocked" as const,
    }));
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ startQueueLinkedRun }),
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

    const result = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.result.message).toBe("Local executor unavailable.");
    expect(result.result.output).not.toMatchObject({
      startedDirectWork: true,
    });
    expect(result.result.policyReasons).toEqual([
      "Local executor unavailable.",
    ]);
  });

  it("rejects invalid Queue run-control inputs before bridge mutation or start", async () => {
    const updateItem = vi.fn();
    const startQueueLinkedRun = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ startQueueLinkedRun, updateItem }),
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

    const whitespaceExecutable = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.updateRunSettings",
        input: {
          codexExecutable: "   ",
          taskId: "task-1",
        },
      }),
    );
    const missingTaskId = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: { executorWidgetId: "executor-1" },
      }),
    );

    expect(whitespaceExecutable.status).toBe("invalid_input");
    expect(whitespaceExecutable.result.message).toContain(
      "codexExecutable must be a non-empty string",
    );
    expect(missingTaskId.status).toBe("invalid_input");
    expect(missingTaskId.result.message).toBe(
      "queue.item.startRun requires taskId.",
    );
    expect(updateItem).not.toHaveBeenCalled();
    expect(startQueueLinkedRun).not.toHaveBeenCalled();
  });

  it("requires exact structured startRun confirmation and never infers it from prose", async () => {
    const startQueueLinkedRun = vi.fn(async () => ({
      executorWidgetId: "executor-1",
      message: "Queue-linked Direct Work run started.",
      ok: true,
      response: {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "task-1",
        runId: "run-1",
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      },
      status: "started" as const,
    }));
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ startQueueLinkedRun }),
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

    const missingConfirmation = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );
    const proseOnlyConfirmation = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
        reason: "I confirm. Start task-1 with executor-1.",
      }),
    );
    const malformedConfirmation = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: "confirmed",
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );
    const exactConfirmation = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );

    expect(missingConfirmation.status).toBe("needs_confirmation");
    expect(proseOnlyConfirmation.status).toBe("needs_confirmation");
    expect(malformedConfirmation.status).toBe("invalid_input");
    expect(malformedConfirmation.result.message).toContain(
      `confirmationToken "${QUEUE_START_RUN_CONFIRMATION_TOKEN}"`,
    );
    expect(exactConfirmation.status).toBe("succeeded");
    expect(startQueueLinkedRun).toHaveBeenCalledTimes(1);
  });

  it("does not infer startRun taskId or executorWidgetId from prose or UI aliases", async () => {
    const startQueueLinkedRun = vi.fn();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(
        createWorkspaceAgentQueueBridgeAdapterApi(
          queueBridge({ startQueueLinkedRun }),
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

    const inferredTask = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorWidgetId: "executor-1",
          reason: "I confirm task task-1.",
          selectedTaskId: "task-1",
          taskTitle: "Task 1",
        },
      }),
    );
    const inferredExecutor = await broker.invokeAsync(
      request({
        capabilityId: "queue.item.startRun",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          executorLabel: "Local executor ready",
          reason: "I confirm executor executor-1.",
          selectedExecutorWidgetId: "executor-1",
          taskId: "task-1",
        },
      }),
    );

    expect(inferredTask.status).toBe("invalid_input");
    expect(inferredTask.result.message).toBe(
      "queue.item.startRun requires taskId.",
    );
    expect(inferredExecutor.status).toBe("invalid_input");
    expect(inferredExecutor.result.message).toBe(
      "queue.item.startRun requires executorWidgetId.",
    );
    expect(startQueueLinkedRun).not.toHaveBeenCalled();
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
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
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

  it("rejects malformed structured confirmation for prompt-pack import", () => {
    const adapter = fakeQueueAdapter();
    const result = createQueueBroker(adapter, { allowWriteInvoke: true }).invoke(
      request({
        capabilityId: "queue.importPromptPack",
        confirmationToken: "confirmed",
        input: { sourceText: promptPackSourceText() },
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toContain(
      `confirmationToken "${QUEUE_START_RUN_CONFIRMATION_TOKEN}"`,
    );
    expect(adapter.importPromptPack).not.toHaveBeenCalled();
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
  reason = null,
}: {
  capabilityId: string;
  confirmationToken?: string | null;
  dryRun?: boolean;
  input?: unknown;
  reason?: string | null;
}) {
  return createActionRequest({
    agentId: "test.agentA",
    agentRoleId: "test_harness",
    capabilityId,
    confirmationToken,
    createdAt: "2026-06-15T10:00:00.000Z",
    dryRun,
    input,
    reason,
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

function queueBackendPort(
  overrides: QueueBackendCapabilityPort,
): QueueBackendCapabilityPort {
  return overrides;
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

function queueBridgeSnapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
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
      ...overrides,
    } as unknown as QueueWidgetSnapshot,
  };
}

function queueBridgeSnapshotItem(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetItemSnapshot {
  return {
    approvalPolicy: null,
    assignedExecutorWidgetId: null,
    blockers: [],
    codexExecutable: null,
    dependencies: [],
    description: "",
    evidenceSummary: {
      runRefs: [],
      status: "none",
    },
    executionPolicy: "manual",
    executionWorkspace: null,
    id: "task-1",
    priority: 0,
    prompt: "Implement the task.",
    queueId: "workspace:workspace-1:agent-queue",
    queueTag: { id: null, name: null },
    reportSummary: { status: "none" },
    runLinks: [],
    sandbox: null,
    status: "draft",
    title: "Queue task",
    validationStatus: "not_started",
    workspaceId: "workspace-1",
    ...overrides,
  } as QueueWidgetItemSnapshot;
}

function queueAggregate({
  approvalPolicy = "on_request",
  assignedExecutorWidgetId = null,
  blockers = [],
  codexExecutable = "codex.cmd",
  commitState = "none",
  dependencyState = "none",
  durableFlags,
  evidenceState = "none",
  evidenceSummary = null,
  executionPolicy = "manual",
  executionWorkspace = "C:/repo",
  latestRun = null,
  nextActions = [
    {
      available: true,
      code: "start_run",
      label: "Start run",
      unavailableReason: null,
    },
  ],
  reviewState = "not_requested",
  sandbox = "workspace_write",
  taskId = "task-1",
  ticketState = "queued",
  title = "Queue task",
  updatedAt = "2026-06-15T10:00:00.000Z",
  validationState = "not_requested",
  workerRunState = "not_started",
  workspaceId = "workspace-1",
}: Partial<
  AgentQueueItemAggregate & {
    approvalPolicy: string | null;
    assignedExecutorWidgetId: string | null;
    codexExecutable: string | null;
    executionPolicy: string;
    executionWorkspace: string | null;
    sandbox: string | null;
  }
> = {}): AgentQueueItemAggregate {
  return {
    blockers,
    commitState,
    dependencyState,
    durableFlags: durableFlags ?? {
      commitState: commitState !== "not_durable",
      completionState: ticketState === "done",
      dependencyState: dependencyState !== "unknown",
      evidenceState: evidenceState !== "not_durable",
      frontendOverlayUsed: false,
      latestRunLink: Boolean(latestRun),
      reviewState: reviewState !== "not_durable",
      taskRow: true,
      validationState: validationState !== "unknown",
    },
    evidenceState,
    evidenceSummary,
    latestRun,
    nextActions,
    reviewState,
    runSettings: {
      approvalPolicy,
      assignedExecutorWidgetId,
      codexExecutable,
      executionPolicy,
      executionWorkspace,
      sandbox,
    },
    taskId,
    ticketState,
    title,
    updatedAt,
    validationState,
    workerRunState,
    workspaceId,
  };
}

function reviewCommandResult({
  aggregate = queueAggregate(),
  messageId = "review-message-1",
  status = "created",
}: Partial<AgentQueueReviewCommandResult> & {
  aggregate?: AgentQueueItemAggregate;
  status?: string;
} = {}): AgentQueueReviewCommandResult {
  return {
    aggregate,
    durable: true,
    messageId,
    reviewMessage: {
      ackActorId: status === "acknowledged" ? "test.agentA" : null,
      ackedAt: status === "acknowledged" ? "2026-06-15T10:01:00.000Z" : null,
      actorId: "test.agentA",
      createdAt: "2026-06-15T10:00:00.000Z",
      messageBody: "Ready for review.",
      messageId,
      metadataJson: null,
      runId: null,
      runLinkId: null,
      status,
      taskId: aggregate.taskId,
      updatedAt: "2026-06-15T10:00:00.000Z",
      workspaceId: aggregate.workspaceId,
    },
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function reviewCreateMessageResult({
  aggregate = queueAggregate(),
  evidenceBundleId = "bundle-1",
  messageId = "review-message-1",
  runId = "run-1",
  status = "succeeded",
}: Partial<AgentQueueReviewCreateMessageResult> & {
  aggregate?: AgentQueueItemAggregate;
  status?: AgentQueueReviewCreateMessageResult["status"];
} = {}): AgentQueueReviewCreateMessageResult {
  const resolvedMessageId = messageId ?? "review-message-1";
  const command = reviewCommandResult({
    aggregate,
    messageId: resolvedMessageId,
    status: "created",
  });

  return {
    aggregate,
    blocker: null,
    durable: true,
    evidenceBundleId,
    messageId: resolvedMessageId,
    reviewMessage: command.reviewMessage,
    runId,
    status,
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function completionCommandResult({
  aggregate = queueAggregate({
    reviewState: "done",
    ticketState: "done",
    workerRunState: "completed",
  }),
  blocker = null,
  completionDecision,
  decisionId = "completion-decision-1",
  durable = true,
  evidenceBundleId = "bundle-1",
  reviewMessageId = "review-message-1",
  runId = "run-1",
  status = "succeeded",
}: Partial<AgentQueueCompletionCommandResult> & {
  aggregate?: AgentQueueItemAggregate;
  status?: AgentQueueCompletionCommandResult["status"];
} = {}): AgentQueueCompletionCommandResult {
  const resolvedDecision =
    completionDecision === undefined
      ? {
          actorId: "test.agentA",
          createdAt: "2026-06-15T10:02:00.000Z",
          decision: "accepted",
          decisionId: decisionId ?? "completion-decision-1",
          metadataJson: null,
          reason: "Operator accepted completion.",
          reviewMessageId,
          runId,
          runLinkId: "link-1",
          taskId: aggregate.taskId,
          workspaceId: aggregate.workspaceId,
        }
      : completionDecision;

  return {
    aggregate,
    blocker,
    completionDecision: resolvedDecision,
    decisionId,
    durable,
    evidenceBundleId,
    reviewMessageId,
    runId,
    status,
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function reviewCreateMessageBlockedResult({
  aggregate = queueAggregate({
    evidenceState: "none",
    reviewState: "not_requested",
    ticketState: "draft",
    workerRunState: "not_started",
  }),
  blockerCode = "task_is_draft",
  blockerMessage = "Draft Queue tasks cannot create review messages.",
  evidenceBundleId = null,
  nextSuggestedCapability = "queue.item.updateRunSettings",
  runId = null,
  status = "precondition_failed",
}: {
  aggregate?: AgentQueueItemAggregate;
  blockerCode?: string;
  blockerMessage?: string;
  evidenceBundleId?: string | null;
  nextSuggestedCapability?: string | null;
  runId?: string | null;
  status?: AgentQueueReviewCreateMessageResult["status"];
} = {}): AgentQueueReviewCreateMessageResult {
  return {
    aggregate,
    blocker: {
      blockerCode,
      blockerMessage,
      durableEvidenceRequired: false,
      evidenceBundleId,
      evidenceBundleIdRequired: false,
      evidenceState: aggregate.evidenceState,
      existingMessageId: null,
      missingRequiredField: null,
      nextSuggestedCapability,
      reviewMessageAlreadyExists: false,
      reviewState: aggregate.reviewState,
      runId,
      runIdRequired: false,
      taskId: aggregate.taskId,
      ticketState: aggregate.ticketState,
      workerRunState: aggregate.workerRunState,
    },
    durable: false,
    evidenceBundleId,
    messageId: null,
    reviewMessage: null,
    runId,
    status,
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function workerFinishedCommandResult({
  aggregate = queueAggregate(),
  bundleId = "bundle-1",
  runId = "run-1",
}: Partial<AgentQueueWorkerFinishedCommandResult> & {
  aggregate?: AgentQueueItemAggregate;
} = {}): AgentQueueWorkerFinishedCommandResult {
  return {
    aggregate,
    bundleId,
    durable: true,
    evidenceBundle: workerEvidenceBundle({ aggregate, bundleId, runId }),
    runId,
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function workerEvidenceQueryResult({
  aggregate = queueAggregate(),
  bundleId = "bundle-1",
  runId = "run-1",
}: {
  aggregate?: AgentQueueItemAggregate;
  bundleId?: string;
  runId?: string;
} = {}): AgentQueueWorkerEvidenceQueryResult {
  return {
    aggregate,
    durable: true,
    evidenceBundle: workerEvidenceBundle({ aggregate, bundleId, runId }),
    runId,
    state: "available",
    taskId: aggregate.taskId,
    workspaceId: aggregate.workspaceId,
  };
}

function workerEvidenceBundle({
  aggregate,
  bundleId,
  runId,
}: {
  aggregate: AgentQueueItemAggregate;
  bundleId: string;
  runId: string;
}) {
  return {
    bundleId,
    changedFiles: ["src/lib.rs"],
    changedFilesCount: 1,
    changedFilesSummary: "src/lib.rs",
    createdAt: "2026-06-15T10:01:00.000Z",
    errorSummary: null,
    executorWidgetId: "executor-1",
    metadataJson: null,
    outcome: "completed" as const,
    runId,
    runLinkId: "link-1",
    source: "workspace_agent",
    summary: "Worker final report.",
    taskId: aggregate.taskId,
    updatedAt: "2026-06-15T10:01:00.000Z",
    validationSummary: "not run",
    workerId: "test.agentA",
    workspaceId: aggregate.workspaceId,
  };
}

function frontendSource(path: string) {
  const cwd = (
    globalThis as unknown as { process: { cwd: () => string } }
  ).process.cwd();

  return readFileSync(`${cwd}/src/${path}`, "utf8");
}
