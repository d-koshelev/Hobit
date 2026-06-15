import { describe, expect, it, vi } from "vitest";

import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { createWorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { createAgentQueueWidgetApi } from "../queue/agentQueueWidgetApi";
import type { QueueWidgetItemSnapshot } from "../queue/agentQueueWidgetApiTypes";
import type { AgentWorkerSummary } from "../agentQueueTaskUiModel";
import type {
  AgentQueueTask,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import { buildPromptPackImportPreview } from "./promptPackImportPreview";
import { materializePromptPackPreviewToQueue } from "./promptPackMaterialization";
import { parsePromptPackImportPlan } from "./promptPackParser";
import { selfDevelopmentSmokePromptPackEntries } from "./selfDevelopmentSmokePromptPackFixture.test-fixtures";
import {
  buildSmartQueueMaterializationFromPromptPackPreview,
} from "../queue/smartQueuePromptPackPreviewAdapter";
import {
  materializeSmartQueuePromptPack,
} from "../queue/smartQueuePromptPackMaterialization";
import { selectNextAutonomousTask } from "../queue/agentQueueAutonomousRunnerModel";
import { selectQueueV2ViewModel } from "../queue/queueV2ViewModel";

describe("prompt pack Queue materialization service", () => {
  it("uses Smart Queue materialization output as the Queue creation source", async () => {
    const preview = withSmartQueueMaterialization(
      buildPromptPackImportPreview(
        parsePromptPackImportPlan([
          {
            path: "prompt-batch.json",
            text: JSON.stringify({
              id: "smart-source-pack",
              items: [
                {
                  id: "import-one",
                  prompt: "Legacy selected item prompt.",
                  title: "Legacy title",
                },
              ],
            }),
          },
        ]),
      ),
      (materialization) => ({
        ...materialization,
        tasks: materialization.tasks.map((task) => ({
          ...task,
          prompt: "Smart Queue materialized prompt.",
          settings: {
            ...task.settings,
            executionPolicy: "auto",
            priority: 9,
            tags: ["smart-queue"],
          },
          title: "Smart Queue title",
        })),
      }),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(result.ok).toBe(true);
    expect(request).toMatchObject({
      executionPolicy: "auto",
      priority: 9,
      queueTag: { name: "smart-queue" },
      title: "import-one: Smart Queue title",
    });
    expect(request?.prompt).toContain("Smart Queue materialized prompt.");
    expect(request?.prompt).not.toContain("Legacy selected item prompt.");
  });

  it("creates one materialized prompt as one Queue task", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "single-pack",
            items: [{ id: "one", prompt: "One prompt.", title: "One task" }],
          }),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(true);
    expect(result.createdTasks).toEqual([
      { itemId: "one", queueItemId: "queue-one", title: "one: One task" },
    ]);
    expect(bridge.createItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).not.toHaveBeenCalled();
  });

  it("creates three sequential materialized prompts and preserves dependency edges", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            id: "chain-pack",
            items: [
              { id: "first", prompt: "First.", title: "First" },
              {
                dependencies: ["first"],
                id: "second",
                prompt: "Second.",
                title: "Second",
              },
              {
                dependencies: ["second"],
                id: "third",
                prompt: "Third.",
                title: "Third",
              },
            ],
          }),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(true);
    expect(result.createdTasks.map((task) => task.queueItemId)).toEqual([
      "queue-first",
      "queue-second",
      "queue-third",
    ]);
    expect(result.dependencyLinksCreated).toEqual([
      expect.objectContaining({
        dependencyItemId: "first",
        dependencyQueueItemId: "queue-first",
        dependentItemId: "second",
        dependentQueueItemId: "queue-second",
      }),
      expect.objectContaining({
        dependencyItemId: "second",
        dependencyQueueItemId: "queue-second",
        dependentItemId: "third",
        dependentQueueItemId: "queue-third",
      }),
    ]);
    expect(bridge.updateItem).toHaveBeenNthCalledWith(1, {
      itemId: "queue-second",
      patch: { dependencies: ["queue-first"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(bridge.updateItem).toHaveBeenNthCalledWith(2, {
      itemId: "queue-third",
      patch: { dependencies: ["queue-second"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
  });

  it("uses prompt-pack dependency chains for propagated Queue status after state changes", async () => {
    const first = durableTask({
      prompt: "Run first.",
      queueItemId: "queue-first",
      status: "failed",
      title: "first: First",
    });
    const second = durableTask({
      dependsOn: ["queue-first"],
      prompt: "Run second.",
      queueItemId: "queue-second",
      status: "ready",
      title: "second: Second",
    });
    const third = durableTask({
      dependsOn: ["queue-second"],
      prompt: "Run third.",
      queueItemId: "queue-third",
      status: "ready",
      title: "third: Third",
    });
    const failedView = selectQueueV2ViewModel({
      tasks: [first, second, third],
      workers: [queueWorker()],
    });
    const recoveredView = selectQueueV2ViewModel({
      tasks: [
        {
          ...first,
          closureState: "no_change_accepted",
          coordinatorStatus: "finalized",
          status: "completed",
        },
        second,
        third,
      ],
      workers: [queueWorker()],
    });

    expect(failedView.tasks.find((item) => item.taskId === "queue-second")).toMatchObject({
      boardLane: "blocked",
      humanStatus: { label: "Blocked: dependency failed" },
    });
    expect(failedView.tasks.find((item) => item.taskId === "queue-third")).toMatchObject({
      boardLane: "blocked",
      humanStatus: { label: "Blocked: dependency blocked" },
    });
    expect(recoveredView.tasks.find((item) => item.taskId === "queue-second")).toMatchObject({
      boardLane: "ready",
      dependencySummary: { gate: "satisfied" },
    });
    expect(recoveredView.tasks.find((item) => item.taskId === "queue-third")).toMatchObject({
      boardLane: "waiting_dependency",
      dependencySummary: { gate: "waiting" },
      humanStatus: { label: "Waiting dependency" },
    });
  });

  it("passes Smart Queue pack default settings to created Queue tasks", async () => {
    const basePreview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "settings-pack",
            items: [{ id: "one", prompt: "One prompt.", title: "One task" }],
          }),
        },
      ]),
    );
    const preview = withSmartQueueMaterialization(
      basePreview,
      () =>
        buildSmartQueueMaterializationFromPromptPackPreview(basePreview, {
          defaultSettings: {
            approvalPolicy: "on-request",
            executionWorkspace: "C:/smart-default",
            model: "default-model",
            reasoning: "high",
            sandbox: "workspace-write",
            validationPolicy: {
              commands: ["npm.cmd run test -- --run smartQueue"],
              profile: "smart-default",
            },
          },
        }),
    );
    const bridge = queueBridge();

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      approvalPolicy: "on_request",
      executionWorkspace: "C:/smart-default",
      sandbox: "workspace_write",
    });
    expect(request?.prompt).toContain("Model profile: default-model");
    expect(request?.prompt).toContain("Reasoning effort: high");
    expect(request?.prompt).toContain("Validator profile: smart-default");
    expect(request?.prompt).toContain(
      "- npm.cmd run test -- --run smartQueue",
    );
  });

  it("lets per-prompt Smart Queue settings override defaults in created tasks", async () => {
    const basePreview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "settings-pack",
            items: [
              {
                id: "override",
                modelProfile: "prompt-model",
                prompt: "Prompt override.",
                reasoningEffort: "medium",
                title: "Override",
                validationCommands: ["npm.cmd run typecheck"],
                validatorProfile: "strict",
              },
            ],
          }),
        },
      ]),
    );
    const preview = withSmartQueueMaterialization(
      basePreview,
      () =>
        buildSmartQueueMaterializationFromPromptPackPreview(basePreview, {
          defaultSettings: {
            model: "default-model",
            reasoning: "high",
            validationPolicy: {
              commands: ["npm.cmd run test"],
              profile: "default",
            },
          },
        }),
    );
    const bridge = queueBridge();

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Model profile: prompt-model");
    expect(request?.prompt).toContain("Reasoning effort: medium");
    expect(request?.prompt).toContain("Validator profile: strict");
    expect(request?.prompt).toContain("- npm.cmd run typecheck");
    expect(request?.prompt).not.toContain("Model profile: default-model");
    expect(request?.prompt).not.toContain("Validator profile: default");
  });

  it("preserves source pack and source prompt metadata from Smart Queue materialization", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "source-pack",
            items: [
              {
                id: "source-task",
                path: "001-source-task.md",
                prompt: "Source prompt.",
                title: "Source task",
              },
            ],
            name: "Source Pack",
          }),
        },
      ]),
    );
    const bridge = queueBridge();

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(request?.description).toContain("Prompt pack: Source Pack (source-pack)");
    expect(request?.description).toContain("Prompt item: source-task");
    expect(request?.description).toContain("Prompt number: 1");
    expect(request?.description).toContain("Source path: 001-source-task.md");
    expect(request?.prompt).toContain("Block id: source-task");
    expect(request?.prompt).toContain("Smart Queue task id:");
  });

  it("blocks invalid Smart Queue materializations before creating Queue items", async () => {
    const preview = withSmartQueueMaterialization(
      buildPromptPackImportPreview(
        parsePromptPackImportPlan([
          {
            path: "prompt-batch.json",
            text: JSON.stringify({
              id: "legacy-valid-pack",
              items: [{ id: "one", prompt: "One prompt.", title: "One" }],
            }),
          },
        ]),
      ),
      () =>
        materializeSmartQueuePromptPack({
          prompts: [
            {
              body: "Dependent prompt.",
              dependencies: ["missing"],
              promptId: "dependent",
              title: "Dependent",
            },
          ],
          sourcePackId: "invalid-smart-pack",
          sourceName: "Invalid Smart Pack",
        }),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "import_blocked",
        itemId: "dependent",
        message: "Cannot create Queue items: missing dependency",
      }),
    );
    expect(bridge.createItem).not.toHaveBeenCalled();
    expect(bridge.updateItem).not.toHaveBeenCalled();
  });

  it("does not start workers or create/open Queue views while targeting the singleton Queue", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "singleton-pack",
            items: [{ id: "one", prompt: "One prompt.", title: "One" }],
          }),
        },
      ]),
    );
    const runAutonomousQueue = vi.fn();
    const startQueueItem = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const bridge = {
      ...queueBridge({ runAutonomousQueue, stopAutonomousQueueAfterCurrent }),
      startQueueItem,
    };

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(preview.smartQueueMaterialization.queue).toMatchObject({
      queueId: "workspace-queue",
      singleton: true,
      singletonKey: "workspace-queue",
    });
    expect(bridge.getSnapshot).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(startQueueItem).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("smokes self-development fixture import into Queue dependency items without starting runtime work", async () => {
    const plan = parsePromptPackImportPlan(selfDevelopmentSmokePromptPackEntries);
    const preview = buildPromptPackImportPreview(plan);
    const runAutonomousQueue = vi.fn();
    const startQueueItem = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const bridge = {
      ...queueBridge({
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
      }),
      startQueueItem,
    };

    expect(plan.errors).toEqual([]);
    expect(preview.importAvailable).toBe(true);
    expect(preview.selectedItems).toHaveLength(2);
    expect(preview.selectedItemIds).toEqual([
      "001-safe-docs-noop",
      "002-dependent-follow-up",
    ]);

    const firstTask = preview.selectedItems[0];
    const secondTask = preview.selectedItems[1];
    expect(secondTask.dependencies).toEqual([firstTask.id]);

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      currentWorkspaceRoot: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      preview,
    });

    expect(result.ok).toBe(true);
    expect(result.createdTasks).toEqual([
      {
        itemId: "001-safe-docs-noop",
        queueItemId: "queue-001-safe-docs-noop",
        title: "001-safe-docs-noop: docs: smoke no-op readiness note",
      },
      {
        itemId: "002-dependent-follow-up",
        queueItemId: "queue-002-dependent-follow-up",
        title: "002-dependent-follow-up: docs: verify dependent readiness gate",
      },
    ]);
    expect(bridge.createItem).toHaveBeenCalledTimes(2);

    const firstCreateRequest = bridge.createItem.mock.calls[0]?.[0];
    const secondCreateRequest = bridge.createItem.mock.calls[1]?.[0];
    expect(firstCreateRequest?.prompt).toContain(firstTask.promptBody);
    expect(secondCreateRequest?.prompt).toContain(secondTask.promptBody);
    expect(firstCreateRequest?.prompt).toContain(
      "Expected commit title: docs: smoke no-op readiness note",
    );
    expect(secondCreateRequest?.prompt).toContain(
      "Expected commit title: docs: verify dependent readiness gate",
    );
    for (const request of [firstCreateRequest, secondCreateRequest]) {
      expect(request?.prompt).toContain("Validation commands");
      expect(request?.prompt).toContain("- git status --short --branch");
      expect(request?.prompt).toContain("- git diff --check");
      expect(request?.executionPolicy).toBe("manual");
      expect(request?.executionWorkspace).toBe(
        "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      );
    }
    expect(firstCreateRequest?.status).toBe("queued");
    expect(secondCreateRequest?.status).toBe("draft");

    expect(bridge.updateItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).toHaveBeenCalledWith({
      itemId: "queue-002-dependent-follow-up",
      patch: { dependencies: ["queue-001-safe-docs-noop"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(result.dependencyLinksCreated).toEqual([
      {
        dependencyItemId: "001-safe-docs-noop",
        dependencyQueueItemId: "queue-001-safe-docs-noop",
        dependentItemId: "002-dependent-follow-up",
        dependentQueueItemId: "queue-002-dependent-follow-up",
        status: "created",
      },
    ]);
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(startQueueItem).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("persists imported 002 -> 001 dependencies through the real Queue API model roundtrip", async () => {
    const plan = parsePromptPackImportPlan(selfDevelopmentSmokePromptPackEntries);
    const preview = buildPromptPackImportPreview(plan);
    const harness = createDurableQueueApiHarness();
    const bridge = createWorkspaceAgentQueueBridge({
      queueApi: harness.api,
      queueState: {
        getRunSettingsDefaults: () => ({
          approvalPolicy: "never",
          codexExecutable: "codex.cmd",
          executionWorkspace: "C:/repo",
          sandbox: "read_only",
        }),
        refreshAfterMutation: harness.refreshAfterMutation,
      },
      workspaceId: "workspace-1",
    });

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      currentWorkspaceRoot: "C:/repo",
      preview,
    });
    const reloadedSnapshot = await harness.reloadedApi.getSnapshot({
      workspaceId: "workspace-1",
    });
    const first = harness.task("queue-001-safe-docs-noop");
    const second = harness.task("queue-002-dependent-follow-up");

    expect(result.ok).toBe(true);
    expect(result.dependencyLinksCreated).toEqual([
      expect.objectContaining({
        dependencyQueueItemId: "queue-001-safe-docs-noop",
        dependentQueueItemId: "queue-002-dependent-follow-up",
        status: "created",
      }),
    ]);
    expect(first?.dependsOn).toEqual([]);
    expect(first?.status).toBe("queued");
    expect(first?.executionWorkspace).toBe("C:/repo");
    expect(first?.approvalPolicy).toBe("never");
    expect(first?.codexExecutable).toBe("codex.cmd");
    expect(first?.sandbox).toBe("read_only");
    expect(second?.dependsOn).toEqual(["queue-001-safe-docs-noop"]);
    expect(second?.status).toBe("draft");
    expect(second?.executionWorkspace).toBe("C:/repo");
    expect(harness.createRequests.map((request) => request.dependsOn)).toEqual([
      [],
      [],
    ]);
    expect(harness.createRequests.map((request) => request.status)).toEqual([
      "queued",
      "draft",
    ]);
    expect(harness.updateRequests).toEqual([
      expect.objectContaining({
        dependsOn: ["queue-001-safe-docs-noop"],
        queueItemId: "queue-002-dependent-follow-up",
      }),
    ]);
    expect(reloadedSnapshot.ok).toBe(true);
    expect(
      reloadedSnapshot.snapshot?.items.find(
        (item) => item.id === "queue-002-dependent-follow-up",
      )?.dependencies,
    ).toEqual(["queue-001-safe-docs-noop"]);
    expect(
      reloadedSnapshot.snapshot?.items.find(
        (item) => item.id === "queue-002-dependent-follow-up",
      )?.blockers.map((blocker) => blocker.code),
    ).toContain("dependency_blocked");
    expect(
      reloadedSnapshot.snapshot?.items.find(
        (item) => item.id === "queue-001-safe-docs-noop",
      )?.blockers.map((blocker) => blocker.code),
    ).not.toContain("missing_execution_workspace");
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.runAutonomousQueue).not.toHaveBeenCalled();
    expect(harness.refreshAfterMutation).toHaveBeenCalledWith(
      "queue-002-dependent-follow-up",
    );
  });

  it("creates selected Queue tasks first, then links dependencies by created Queue ids", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            id: "core-pack",
            name: "Core Pack",
            items: [
              {
                id: "setup",
                order: 1,
                priority: 4,
                prompt: "Setup prompt body.",
                tags: ["frontend", "queue"],
                title: "Setup task",
                validationCommands: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
              },
              {
                dependencies: ["setup"],
                executionWorkspace: "C:/work/hobit",
                expectedCommitTitle: "frontend: materialize prompt pack",
                id: "build",
                order: 2,
                prompt: "Build prompt body.",
                title: "Build task",
              },
            ],
          }),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(true);
    expect(result.createdTasks).toEqual([
      { itemId: "setup", queueItemId: "queue-setup", title: "setup: Setup task" },
      { itemId: "build", queueItemId: "queue-build", title: "build: Build task" },
    ]);
    expect(bridge.createItem).toHaveBeenCalledTimes(2);
    expect(bridge.createItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dependencies: [],
        priority: 4,
        queueTag: { name: "frontend" },
        status: "queued",
        title: "setup: Setup task",
      }),
    );
    expect(bridge.createItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        dependencies: [],
        executionWorkspace: "C:/work/hobit",
        prompt: expect.stringContaining("Build prompt body."),
        title: "build: Build task",
      }),
    );
    expect(bridge.updateItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).toHaveBeenCalledWith({
      itemId: "queue-build",
      patch: { dependencies: ["queue-setup"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(result.dependencyLinksCreated).toEqual([
      {
        dependencyItemId: "setup",
        dependencyQueueItemId: "queue-setup",
        dependentItemId: "build",
        dependentQueueItemId: "queue-build",
        status: "created",
      },
    ]);
  });

  it("preserves unsupported prompt-pack metadata in prompt text and reports warnings", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "001-metadata.md",
          text: [
            "Model profile: strong",
            "Reasoning effort: high",
            "Validator profile: standard",
            "Tags: alpha, beta",
            "Expected commit title: frontend: keep metadata",
            "Validation: npm.cmd run build --prefix apps/desktop/frontend",
            "Allowed scope: frontend only",
            "Forbidden scope: backend storage",
            "",
            "# Metadata",
            "",
            "Original body.",
          ].join("\n"),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Original body.");
    expect(request?.prompt).toContain("Prompt pack materialization metadata");
    expect(request?.prompt).toContain("Model profile: strong");
    expect(request?.prompt).toContain("Reasoning effort: high");
    expect(request?.prompt).toContain("Validator profile: standard");
    expect(request?.prompt).toContain("Expected commit title: frontend: keep metadata");
    expect(request?.prompt).toContain("Allowed scope");
    expect(request?.prompt).toContain("- frontend only");
    expect(request?.prompt).toContain("Forbidden scope");
    expect(request?.prompt).toContain("- backend storage");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "queue_metadata_field_unsupported",
        itemId: "001",
      }),
    );
  });

  it("does not call Queue run, start, or autorun controls while materializing", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([{ path: "001-one.md", text: "One body." }]),
    );
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const bridge = queueBridge({
      runAutonomousQueue,
      stopAutonomousQueueAfterCurrent,
    });

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(bridge.createItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("does not let created Queue items bypass the disabled Queue execution gate", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([{ path: "001-one.md", text: "One body." }]),
    );
    const bridge = queueBridge();

    await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    const request = bridge.createItem.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      status: "queued",
    });

    const createdTask = durableTask({
      approvalPolicy: request?.approvalPolicy ?? "never",
      codexExecutable: request?.codexExecutable ?? "codex.cmd",
      description: request?.description ?? "",
      executionWorkspace: request?.executionWorkspace ?? "C:/repo",
      prompt: request?.prompt ?? "",
      queueItemId: "queue-001",
      sandbox: request?.sandbox ?? "read_only",
      status: request?.status ?? "queued",
      title: request?.title ?? "Queue task",
    });

    expect(
      selectNextAutonomousTask([createdTask], new Set(), "stopped"),
    ).toEqual({
      skippedCount: 0,
      task: null,
    });
    expect(
      selectNextAutonomousTask([createdTask], new Set(), "started").task
        ?.queueItemId,
    ).toBe("queue-001");
  });

  it("blocks invalid prompt-pack prompts before creating Queue items", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            id: "invalid-pack",
            items: [{ id: "empty", prompt: "" }],
          }),
        },
      ]),
    );
    const bridge = queueBridge();

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(false);
    expect(result.createdTasks).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "import_blocked",
        message: expect.stringContaining("has no prompt body"),
      }),
    );
    expect(bridge.createItem).not.toHaveBeenCalled();
    expect(bridge.updateItem).not.toHaveBeenCalled();
  });

  it("reports partial failure and skipped dependency links visibly", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            dependencyPolicy: "explicit_only",
            items: [
              { id: "setup", prompt: "setup" },
              { dependencies: ["setup"], id: "build", prompt: "build" },
            ],
          }),
        },
      ]),
    );
    const bridge = queueBridge({
      createItem: vi.fn(async (request) => {
        if (request.title.startsWith("setup:")) {
          return {
            action: "queue.createItem" as const,
            error: { code: "create_failed", message: "setup failed" },
            events: [],
            message: "setup failed",
            ok: false,
            safetyClass: "safe_create_update" as const,
          };
        }

        return createResult(queueItem(request.title));
      }),
    });

    const result = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview,
    });

    expect(result.ok).toBe(false);
    expect(result.createdTasks).toEqual([
      { itemId: "build", queueItemId: "queue-build", title: "build: Build" },
    ]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "item_create_failed",
        itemId: "setup",
        message: "setup failed",
      }),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "dependency_link_skipped",
          dependencyItemId: "setup",
          itemId: "build",
        }),
        expect.objectContaining({
          code: "queue_blocked_status_unsupported",
          dependencyItemId: "setup",
          itemId: "build",
        }),
      ]),
    );
    expect(result.dependencyLinksSkipped).toEqual([
      expect.objectContaining({
        dependencyItemId: "setup",
        dependentItemId: "build",
        dependentQueueItemId: "queue-build",
        status: "skipped",
      }),
    ]);
    expect(bridge.updateItem).not.toHaveBeenCalled();
  });

  it("blocks unconfirmed or invalid previews before creating Queue items", async () => {
    const preview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([{ path: "001-one.md", text: "One body." }]),
    );
    const bridge = queueBridge();

    const unconfirmed = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: false,
      preview,
    });

    expect(unconfirmed.ok).toBe(false);
    expect(unconfirmed.errors[0]?.code).toBe("import_blocked");
    expect(bridge.createItem).not.toHaveBeenCalled();

    const invalidPreview = buildPromptPackImportPreview(
      parsePromptPackImportPlan([
        {
          path: "prompt-batch.json",
          text: JSON.stringify({
            items: [{ dependencies: ["missing"], id: "one", prompt: "one" }],
          }),
        },
      ]),
    );
    const invalid = await materializePromptPackPreviewToQueue({
      bridge,
      confirmed: true,
      preview: invalidPreview,
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.errors[0]?.code).toBe("import_blocked");
    expect(bridge.createItem).not.toHaveBeenCalled();
  });
});

function withSmartQueueMaterialization(
  preview: ReturnType<typeof buildPromptPackImportPreview>,
  build: (
    materialization: ReturnType<
      typeof buildPromptPackImportPreview
    >["smartQueueMaterialization"],
  ) => ReturnType<typeof buildPromptPackImportPreview>["smartQueueMaterialization"],
) {
  return {
    ...preview,
    smartQueueMaterialization: build(preview.smartQueueMaterialization),
  };
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge & {
  createItem: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
} {
  return {
    createItem: vi.fn(async (request) => createResult(queueItem(request.title))),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(async (request) =>
      updateResult(queueItem(request.itemId.replace(/^queue-/, ""))),
    ),
    ...overrides,
  } as WorkspaceAgentQueueBridge & {
    createItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
  };
}

function createResult(item: QueueWidgetItemSnapshot) {
  return {
    action: "queue.createItem" as const,
    events: [],
    item,
    message: "created",
    ok: true,
    safetyClass: "safe_create_update" as const,
  };
}

function updateResult(item: QueueWidgetItemSnapshot) {
  return {
    action: "queue.updateItem" as const,
    events: [],
    item,
    message: "updated",
    ok: true,
    safetyClass: "safe_create_update" as const,
  };
}

function queueItem(title: string): QueueWidgetItemSnapshot {
  const id = title.split(":")[0]?.trim() || title;

  return {
    id: `queue-${id}`,
    title,
  } as QueueWidgetItemSnapshot;
}

function createDurableQueueApiHarness() {
  const tasks = new Map<string, AgentQueueTask>();
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const refreshAfterMutation = vi.fn(async () => undefined);
  const runAutonomousQueue = vi.fn();
  const startAssignedAgentQueueTask = vi.fn();
  const dependencies = {
    createAgentQueueTask: async (
      request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      createRequests.push(request);
      const id = `queue-${request.title.split(":")[0]?.trim() || tasks.size.toString()}`;
      const task = durableTask({
        approvalPolicy: request.approvalPolicy ?? null,
        codexExecutable: request.codexExecutable ?? null,
        dependsOn: request.dependsOn ?? [],
        description: request.description,
        executionPolicy: request.executionPolicy ?? "manual",
        executionWorkspace: request.executionWorkspace ?? null,
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueItemId: id,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
        validationStatus: request.validationStatus,
      });
      tasks.set(task.queueItemId, task);
      return task;
    },
    getAgentQueueTask: async (queueItemId: string) => tasks.get(queueItemId) ?? null,
    listAgentQueueTaskRunLinks: async () => [],
    listAgentQueueTasks: async () =>
      Array.from(tasks.values()).map((task) => ({ ...task })),
    now: () => "2026-06-11T10:00:00.000Z",
    updateAgentQueueTask: async (
      request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      updateRequests.push(request);
      const current = tasks.get(request.queueItemId);
      if (!current) {
        return null;
      }
      const updated = {
        ...current,
        approvalPolicy: request.approvalPolicy ?? null,
        codexExecutable: request.codexExecutable ?? null,
        dependsOn: request.dependsOn ?? current.dependsOn ?? [],
        description: request.description,
        executionPolicy: request.executionPolicy ?? "manual",
        executionWorkspace: request.executionWorkspace ?? current.executionWorkspace ?? null,
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
        updatedAt: "2026-06-11T10:01:00.000Z",
        validationStatus: request.validationStatus,
        workerExecutionReports: request.workerExecutionReports ?? current.workerExecutionReports,
      } satisfies AgentQueueTask;
      tasks.set(updated.queueItemId, updated);
      return updated;
    },
    workspaceId: "workspace-1",
  };

  return {
    api: createAgentQueueWidgetApi(dependencies),
    createRequests,
    refreshAfterMutation,
    reloadedApi: createAgentQueueWidgetApi(dependencies),
    runAutonomousQueue,
    startAssignedAgentQueueTask,
    task: (queueItemId: string) => tasks.get(queueItemId),
    updateRequests,
  };
}

function durableTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    codexExecutable: "codex.cmd",
    createdAt: "2026-06-11T09:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    itemType: "implementation",
    priority: 0,
    prompt: "",
    queueItemId: "queue-task",
    queueTagId: "default",
    queueTagName: "Default",
    sandbox: "read_only",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-06-11T09:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueWorker(overrides: Partial<AgentWorkerSummary> = {}): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Worker",
    scope: { kind: "all" },
    status: "idle",
    workerId: "worker",
    ...overrides,
  };
}
