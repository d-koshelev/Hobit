import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  directWorkEvent,
  lastAssistantMessageText,
  lastOperatorMessageText,
  renderWidget,
  sendMessage,
  setTextareaValue,
  type DirectWorkStreamEvent,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import { QUEUE_START_RUN_CONFIRMATION_TOKEN } from "./agents/capabilities/queueCapabilityContracts";
import type {
  AgentQueueItemAggregate,
  AgentQueueWorkerFinishedCommandResult,
} from "../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

describe("InteractiveAgentPlaceholderWidget Hobit action requests", () => {
  it("invokes queue.createItems through the broker and Queue bridge", async () => {
    const createItem = vi.fn(
      async (request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0]) =>
        itemResult({
          dependencies: request.dependencies ?? [],
          id: "created-task-a",
          prompt: request.prompt,
          status: request.status,
          title: request.title,
        }),
    );
    const publishActivityEvents = vi.fn();
    const runAutonomousQueue = vi.fn();
    const runTerminal = vi.fn();
    const createGitCommit = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.createItems",
        dryRun: false,
        input: {
          items: [
            {
              id: "task-a",
              prompt: "Prompt A",
              status: "queued",
              title: "Task A",
            },
          ],
        },
        requestId: "request-create-items",
      }),
    );

    renderWidget({
      onCreateGitCommit: createGitCommit,
      onPublishAgentActivityEvents: publishActivityEvents,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
      }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Create one Queue item.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: [],
        prompt: "Prompt A",
        status: "queued",
        title: "Task A",
      }),
    );
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
    expect(createGitCommit).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Queue items created. Created 1 Queue item.",
    );
    expect(lastAssistantMessageText()).toContain("Task id: created-task-a.");
    expect(lastAssistantMessageText()).toContain(
      "Next: queue.item.updateRunSettings.",
    );
    expect(lastAssistantMessageText()).not.toContain("hobit.action.request");
    expect(
      publishActivityEvents.mock.calls.flatMap((call) => call[0]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Hobit action requested" }),
        expect.objectContaining({ title: "Queue items created" }),
      ]),
    );
  });

  it("previews dry-run queue.createItems without mutating Queue", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.createItems",
        dryRun: true,
        input: {
          items: [{ prompt: "Preview prompt.", title: "Preview task" }],
        },
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Preview Queue items.");
    await flushAsync();

    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Queue items preview prepared. Would create 1 Queue item.",
    );
  });

  it("invokes queue.lifecycle.agentFinished through the broker and backend worker evidence API", async () => {
    const createItem = vi.fn();
    const recordWorkerFinished = vi.fn(async () => workerFinishedResult());
    const publishActivityEvents = vi.fn();
    const runAutonomousQueue = vi.fn();
    const runTerminal = vi.fn();
    const createGitCommit = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: false,
        input: {
          attemptId: "attempt-1",
          changedFilesSummary: ["apps/desktop/frontend/src/..."],
          finalAgentMessage: "Implemented the requested changes.",
          outcome: "completed",
          runId: "run-1",
          taskId: "task-1",
          validationSummary: "typecheck passed",
        },
      }),
    );

    renderWidget({
      onCreateGitCommit: createGitCommit,
      onPublishAgentActivityEvents: publishActivityEvents,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        recordWorkerFinished,
        runAutonomousQueue,
      }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Record finished Queue work.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(recordWorkerFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        runId: "run-1",
        summary: "Implemented the requested changes.",
        taskId: "task-1",
        validationSummary: "typecheck passed",
      }),
    );
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
    expect(createGitCommit).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Queue lifecycle agent finished.");
    expect(lastAssistantMessageText()).not.toContain("hobit.action.request");
    expect(
      publishActivityEvents.mock.calls.flatMap((call) => call[0]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Hobit action requested" }),
        expect.objectContaining({ title: "Queue lifecycle agent finished" }),
      ]),
    );
  });

  it("returns invalid_input for invalid Queue action input", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.createItems",
        dryRun: false,
        input: { items: [] },
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Create invalid Queue items.");
    await flushAsync();

    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Invalid Hobit action request.",
    );
    expect(lastAssistantMessageText()).toContain(
      "Queue createItems requires at least one item.",
    );
  });

  it("returns compact invalid_input for invalid Queue lifecycle action input", async () => {
    const createItem = vi.fn();
    const getSnapshot = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: false,
        input: {
          outcome: "completed",
          taskId: "task-1",
        },
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem, getSnapshot }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Record invalid finished Queue work.");
    await flushAsync();

    expect(createItem).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Invalid Hobit action request. runId is required.",
    );
  });

  it("continues Queue setup through broker results and stops before confirmed startRun", async () => {
    let task: QueueWidgetItemSnapshot | null = null;
    const getSnapshot = vi.fn(async () =>
      snapshotResult({
        itemCounts: { total: task ? 1 : 0 } as QueueWidgetSnapshot["itemCounts"],
        items: task ? [task] : [],
        selectedItem: task,
        selectedItemId: task?.id ?? null,
      }),
    );
    const listItemAggregates = vi.fn(async () =>
      task ? [aggregateFromSnapshotItem(task)] : [],
    );
    const getItemAggregate = vi.fn(async ({ taskId }: { taskId: string }) =>
      task && task.id === taskId ? aggregateFromSnapshotItem(task) : null,
    );
    const createItem = vi.fn(
      async (request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0]) => {
        const createdTask = snapshotItem({
          approvalPolicy: null,
          blockers: [],
          codexExecutable: null,
          executionWorkspace: null,
          id: "task-smoke",
          prompt: request.prompt,
          runLinks: [],
          sandbox: null,
          status: request.status ?? "draft",
          title: request.title,
        });
        task = createdTask;
        return itemResult(createdTask);
      },
    );
    const updateItem = vi.fn(
      async (request: Parameters<WorkspaceAgentQueueBridge["updateItem"]>[0]) => {
        const updatedTask = snapshotItem({
          ...(task ?? {}),
          ...(request.patch.approvalPolicy !== undefined
            ? { approvalPolicy: request.patch.approvalPolicy }
            : {}),
          ...(request.patch.codexExecutable !== undefined
            ? { codexExecutable: request.patch.codexExecutable }
            : {}),
          ...(request.patch.executionWorkspace !== undefined
            ? { executionWorkspace: request.patch.executionWorkspace }
            : {}),
          ...(request.patch.sandbox !== undefined
            ? { sandbox: request.patch.sandbox }
            : {}),
          id: request.itemId,
          runLinks: [],
          status: request.patch.status === "queued" ? "queued" : "draft",
        });
        task = updatedTask;
        return itemResult(updatedTask);
      },
    );
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
        queueItemId: "task-smoke",
        runId: "run-1",
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: "workspace_1",
      },
      status: "started" as const,
    }));
    const runTerminal = vi.fn();
    const createGitCommit = vi.fn();
    const publishActivityEvents = vi.fn();
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        actionEnvelope({
          capabilityId: "queue.targetSingletonQueue",
          dryRun: false,
          input: {},
          requestId: "request-target",
        }),
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "request-list",
        }),
        actionEnvelope({
          capabilityId: "queue.createItem",
          dryRun: false,
          input: {
            prompt: "Run the Queue dogfooding smoke through Workspace Agent.",
            status: "draft",
            title: "Workspace Agent Queue smoke",
          },
          requestId: "request-create",
        }),
        actionEnvelope({
          capabilityId: "queue.item.updateRunSettings",
          dryRun: false,
          input: {
            approvalPolicy: "on_request",
            codexExecutable: "codex.cmd",
            sandbox: "workspace_write",
            taskId: "task-smoke",
            workspaceRoot: "C:/repo",
          },
          requestId: "request-settings",
        }),
        actionEnvelope({
          capabilityId: "queue.item.promoteDraft",
          dryRun: false,
          input: { taskId: "task-smoke" },
          requestId: "request-promote",
        }),
        actionEnvelope({
          capabilityId: "queue.enable",
          dryRun: false,
          input: {},
          requestId: "request-enable",
        }),
        actionEnvelope({
          capabilityId: "queue.item.startRun",
          confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
          dryRun: false,
          input: { executorWidgetId: "executor-1", taskId: "task-smoke" },
          requestId: "request-start",
        }),
        actionEnvelope({
          capabilityId: "queue.lifecycle.get",
          dryRun: false,
          input: { taskId: "task-smoke" },
          requestId: " ",
        }),
        finalAnswerEnvelope("Queue dogfooding smoke started."),
      ],
      { codexThreadId: "thread-queue-smoke" },
    );

    renderWidget({
      onCreateGitCommit: createGitCommit,
      onPublishAgentActivityEvents: publishActivityEvents,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        enableQueue,
        getAvailableExecutorTargets: () => [
          {
            label: "Local executor ready",
            ownerKind: "agent_queue",
            widgetInstanceId: "executor-1",
          },
        ],
        getItemAggregate,
        getSnapshot,
        listItemAggregates,
        startQueueLinkedRun,
        updateItem,
      }),
      workspaceId: "workspace_1",
    });

    const smokePrompt = `Run the Queue dogfooding smoke. The following JSON object is the only autonomy grant for this run: ${JSON.stringify(
      {
        constraints: {
          noDelete: true,
          noDownstreamAutoStart: true,
          noGit: true,
          noRollback: true,
          noTerminal: true,
          noValidationExecution: true,
        },
        maxActions: 16,
        mode: "queue_acceptance_smoke",
        type: "hobit.queue.autonomyGrant",
      },
    )}`;

    await runDirectWork(smokePrompt);
    await flushAsync(80);

    expect(startDirectWork).toHaveBeenCalledTimes(5);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Run the Queue dogfooding smoke through Workspace Agent.",
        status: "draft",
        title: "Workspace Agent Queue smoke",
      }),
    );
    expect(updateItem).toHaveBeenCalled();
    expect(enableQueue).not.toHaveBeenCalled();
    expect(startQueueLinkedRun).not.toHaveBeenCalled();
    expect(listItemAggregates).toHaveBeenCalled();
    expect(getItemAggregate).toHaveBeenCalledWith({ taskId: "task-smoke" });
    expect(runTerminal).not.toHaveBeenCalled();
    expect(createGitCommit).not.toHaveBeenCalled();
    expect(lastOperatorMessageText()).toBe(smokePrompt);
    expect(allAssistantMessageText()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Action 1/16: queue.targetSingletonQueue"),
        expect.stringContaining("Action 2/16: queue.items.list"),
        expect.stringContaining("Action 3/16: queue.createItem"),
        expect.stringContaining("Action 4/16: queue.item.updateRunSettings"),
        expect.stringContaining("Action 5/16: queue.item.promoteDraft"),
      ]),
    );
    expect(lastAssistantMessageText()).toContain(
      "Stopped: auto-continuation policy blocked.",
    );
    expect(lastAssistantMessageText()).toContain(
      "Policy diagnostic: no_next_action.",
    );
    expect(lastAssistantMessageText()).toContain(
      "capabilityId=queue.item.startRun",
    );
    const continuationRequests = startDirectWork.mock.calls
      .slice(1)
      .map(
        (call) =>
          call[1] as { codexThreadId?: string; operatorPrompt?: string },
      );
    expect(continuationRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codexThreadId: "thread-queue-smoke" }),
      ]),
    );
    expect(continuationRequests[0]?.operatorPrompt).toContain(
      '"type":"hobit.action.result"',
    );
    expect(continuationRequests[2]?.operatorPrompt).toContain(
      '"taskIds":["task-smoke"]',
    );
    expect(continuationRequests[1]?.operatorPrompt).toContain(
      '"executorWidgetIds":["executor-1"]',
    );
    const activityEvents = publishActivityEvents.mock.calls.flatMap(
      (call) => call[0],
    );
    expect(
      new Set(
        activityEvents
          .filter(
            (event) =>
              event.runKind === "workspace-agent-broker-continuation",
          )
          .map((event) => event.runId),
      ).size,
    ).toBe(1);
    expect(activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runKind: "workspace-agent-broker-continuation",
          title: "Queue run settings updated",
        }),
        expect.objectContaining({
          runKind: "workspace-agent-broker-continuation",
          summary: expect.stringContaining(
            "Policy diagnostic: no_next_action.",
          ),
          title: "Queue draft promoted",
        }),
      ]),
    );
  });

  it("stops continuation on queue.item.startRun confirmation_required", async () => {
    const startQueueLinkedRun = vi.fn();
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        actionEnvelope({
          capabilityId: "queue.item.startRun",
          dryRun: false,
          input: { executorWidgetId: "executor-1", taskId: "task-1" },
          requestId: "request-start-needs-confirmation",
        }),
      ],
      { codexThreadId: "thread-confirmation" },
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ startQueueLinkedRun }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Start the Queue task if the model requests it.");
    await flushAsync();

    expect(startQueueLinkedRun).not.toHaveBeenCalled();
    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(lastAssistantMessageText()).toContain(
      "Action 1/16: queue.item.startRun",
    );
    expect(lastAssistantMessageText()).toContain("Action needs confirmation.");
    expect(lastAssistantMessageText()).toContain(
      "Stopped: confirmation required.",
    );
  });

  it("stops before invoking a repeated request id during continuation", async () => {
    const getSnapshot = vi.fn(async () => snapshotResult());
    const listItemAggregates = vi.fn(async () => []);
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "request-repeat",
        }),
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 25 },
          requestId: "request-repeat",
        }),
      ],
      { codexThreadId: "thread-repeat" },
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ getSnapshot, listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("List Queue items repeatedly.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Action 2/16: queue.items.list",
    );
    expect(lastAssistantMessageText()).toContain(
      "Stopped: repeated request id.",
    );
  });

  it("derives missing and blank request ids during continuation without false repeated-id stops", async () => {
    const getSnapshot = vi.fn(async () => snapshotResult());
    const listItemAggregates = vi.fn(async () => []);
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          omitRequestId: true,
        }),
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 25 },
          requestId: " ",
        }),
        finalAnswerEnvelope("Derived request ids completed."),
      ],
      { codexThreadId: "thread-derived-request-id" },
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ getSnapshot, listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("List Queue items with runtime-derived ids.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(3);
    expect(listItemAggregates).toHaveBeenCalledTimes(2);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(allAssistantMessageText()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Action 1/16: queue.items.list"),
        expect.stringContaining("Action 2/16: queue.items.list"),
      ]),
    );
    expect(lastAssistantMessageText()).toBe("Derived request ids completed.");
    expect(allAssistantMessageText().join("\n")).not.toContain(
      "Stopped: repeated request id.",
    );
  });

  it("stops at the broker continuation action budget", async () => {
    const getSnapshot = vi.fn(async () => snapshotResult());
    const listItemAggregates = vi.fn(async () => []);
    const startDirectWork = startDirectWorkWithFinalTexts(
      Array.from({ length: 17 }, (_value, index) =>
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: index + 1 },
          requestId: `request-budget-${index.toString()}`,
        }),
      ),
      { codexThreadId: "thread-budget" },
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ getSnapshot, listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Keep listing Queue items.");
    await flushAsync(160);

    expect(startDirectWork).toHaveBeenCalledTimes(16);
    expect(listItemAggregates).toHaveBeenCalledTimes(16);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Action 16/16: queue.items.list",
    );
    expect(lastAssistantMessageText()).toContain(
      "Stopped: maximum action count reached.",
    );
  });

  it("returns unavailable for an unknown capability without executing side effects", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.missingCapability",
        dryRun: false,
        input: {},
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Request unknown app capability.");
    await flushAsync();

    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Action unavailable.");
    expect(lastAssistantMessageText()).toContain(
      "Capability queue.missingCapability is not registered.",
    );
  });

  it("shows policy_blocked for restricted Codex execution requests", async () => {
    const createItem = vi.fn();
    const runTerminal = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "codex.runTask",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        dryRun: false,
        input: { prompt: "Run code as a product action." },
      }),
    );

    renderWidget({
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Agent emits restricted Codex app action.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(createItem).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Action blocked by policy.");
    expect(lastAssistantMessageText()).toContain(
      "restricted execute capability",
    );
  });

  it("shows needs_confirmation without auto-confirming importPromptPack", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      actionEnvelope({
        capabilityId: "queue.importPromptPack",
        dryRun: false,
        input: {
          sourceText: JSON.stringify({
            items: [{ prompt: "Prompt", title: "Task" }],
          }),
        },
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Process the emitted Hobit action request.");
    await flushAsync();

    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Action needs confirmation.");
    expect(lastAssistantMessageText()).toContain(
      "queue.importPromptPack requires confirmation.",
    );
  });

  it("accepts an explicit final answer marker in typed-capability action mode", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      finalAnswerEnvelope("Normal assistant response without app action."),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Explain the codebase.");
    await flushAsync();

    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toBe(
      "Normal assistant response without app action.",
    );
  });

  it("leaves normal non-action chat outside Direct Work as a normal transcript message", async () => {
    renderWidget({
      workspaceId: "workspace_1",
    });

    await sendMessage("Explain the visible Workspace Agent surface.");
    await flushAsync();

    expect(lastOperatorMessageText()).toBe(
      "Explain the visible Workspace Agent surface.",
    );
    expect(lastAssistantMessageText()).toContain("I can help plan work");
    expect(lastAssistantMessageText()).not.toContain("action protocol error");
  });

  it("does not route user Queue phrases unless the agent emits an envelope", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      finalAnswerEnvelope("I can help plan those Queue items."),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("add example queue items to queue");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toBe(
      "I can help plan those Queue items.",
    );
  });

  it("does not execute queue.items.list when the model only says it is awaiting a result", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const runTerminal = vi.fn();
    const createGitCommit = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      "Awaiting `queue.items.list` result.",
    );

    renderWidget({
      onCreateGitCommit: createGitCommit,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Run the backend-backed Queue smoke with typed capabilities.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
    expect(createGitCommit).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Workspace Agent action protocol error.",
    );
    expect(lastAssistantMessageText()).toContain("No broker action was executed.");
    expect(lastAssistantMessageText()).not.toContain("Queue items listed");
  });

  it("recognizes workflow requests without executing Queue capabilities", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const createItem = vi.fn();
    const runTerminal = vi.fn();
    const createGitCommit = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      workflowEnvelope({
        workflowId: "dependency_acceptance_smoke",
      }),
    );

    renderWidget({
      onCreateGitCommit: createGitCommit,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem, listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Recognize a structured Queue workflow request.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(createItem).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
    expect(createGitCommit).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Workflow request recognized, but workflow is not declared/implemented yet.",
    );
    expect(lastAssistantMessageText()).toContain(
      "queue does not declare workflows yet.",
    );
    expect(lastAssistantMessageText()).not.toContain("Queue items listed");
    expect(lastAssistantMessageText()).not.toContain("Hobit action requested");
  });

  it("reports invalid workflow request field paths without broker execution", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const startDirectWork = startDirectWorkWithFinalText(
      JSON.stringify({
        inputs: {},
        moduleId: "queue",
        type: "hobit.workflow.request",
        workflowId: "dependency_acceptance_smoke",
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Validate a malformed workflow envelope.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Invalid Hobit workflow request.",
    );
    expect(lastAssistantMessageText()).toContain(
      "$.requestId: requestId is required.",
    );
    expect(lastAssistantMessageText()).toContain(
      "Stopped: invalid or unsupported action envelope.",
    );
  });

  it("rejects workflow data inside grant without broker execution", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      JSON.stringify({
        grant: {
          runSettings: {
            approvalPolicy: "on_request",
            sandbox: "workspace_write",
          },
        },
        inputs: {},
        moduleId: "queue",
        requestId: "workflow-grant-input-split",
        type: "hobit.workflow.request",
        workflowId: "dependency_acceptance_smoke",
      }),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem, listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Validate workflow grant and input split.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Invalid Hobit workflow request.",
    );
    expect(lastAssistantMessageText()).toContain("$.grant.runSettings");
    expect(lastAssistantMessageText()).toContain("product_input_in_grant");
    expect(lastAssistantMessageText()).toContain(
      "Stopped: invalid or unsupported action envelope.",
    );
    expect(lastAssistantMessageText()).not.toContain("Hobit action requested");
  });

  it("requests one protocol repair for no-envelope action-mode output", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const publishActivityEvents = vi.fn();
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        "Awaiting `queue.items.list` result.",
        finalAnswerEnvelope("Queue smoke blocked before a broker action."),
      ],
      { codexThreadId: "thread-protocol-repair" },
    );

    renderWidget({
      onPublishAgentActivityEvents: publishActivityEvents,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Run the Queue smoke using typed capabilities.");
    await flushAsync(40);

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toBe(
      "Queue smoke blocked before a broker action.",
    );

    const repairPrompt = startDirectWork.mock.calls[1]?.[1] as {
      operatorPrompt?: string;
    };
    expect(repairPrompt.operatorPrompt).toContain(
      "[Hobit action protocol repair]",
    );
    expect(repairPrompt.operatorPrompt?.length ?? 0).toBeLessThanOrEqual(1600);
    expect(repairPrompt.operatorPrompt).not.toContain("queue.items.list");

    const activityEvents = publishActivityEvents.mock.calls.flatMap(
      (call) => call[0],
    );
    expect(activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runKind: "workspace-agent-broker-continuation",
          title: "Protocol repair requested",
        }),
        expect.objectContaining({
          runKind: "workspace-agent-broker-continuation",
          title: "Broker action chain completed",
        }),
      ]),
    );
  });

  it("executes a valid structured envelope after protocol repair", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        "Awaiting `queue.items.list` result.",
        actionEnvelope({
          capabilityId: "queue.items.list",
          dryRun: false,
          input: { limit: 10 },
          requestId: "request-list-after-repair",
        }),
        finalAnswerEnvelope("Queue items listed after repair."),
      ],
      { codexThreadId: "thread-valid-after-repair" },
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("List Queue items using typed capabilities.");
    await flushAsync(60);

    expect(startDirectWork).toHaveBeenCalledTimes(3);
    expect(listItemAggregates).toHaveBeenCalledTimes(1);
    expect(allAssistantMessageText()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("action protocol repair requested"),
        expect.stringContaining("Action 1/16: queue.items.list"),
      ]),
    );
    expect(lastAssistantMessageText()).toBe("Queue items listed after repair.");
  });

  it("stops with protocol_error after a repeated no-envelope stall", async () => {
    const listItemAggregates = vi.fn(async () => []);
    const publishActivityEvents = vi.fn();
    const startDirectWork = startDirectWorkWithFinalTexts(
      [
        "Awaiting `queue.items.list` result.",
        "Still awaiting the capability result.",
      ],
      { codexThreadId: "thread-repeated-stall" },
    );

    renderWidget({
      onPublishAgentActivityEvents: publishActivityEvents,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ listItemAggregates }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Run Queue smoke using typed capabilities.");
    await flushAsync(50);

    expect(startDirectWork).toHaveBeenCalledTimes(2);
    expect(listItemAggregates).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain(
      "Workspace Agent action protocol error.",
    );
    expect(lastAssistantMessageText()).toContain(
      "Stopped: action protocol error.",
    );

    const activityEvents = publishActivityEvents.mock.calls.flatMap(
      (call) => call[0],
    );
    expect(activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          title: "Broker action chain stopped",
        }),
      ]),
    );
  });

  it("stops malformed structured envelopes as invalid_action_request without repair", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      [
        "```hobit-action-request",
        '{"type":"hobit.action.request","capabilityId":',
        "```",
      ].join("\n"),
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("Create Queue work with a malformed envelope.");
    await flushAsync();

    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(createItem).not.toHaveBeenCalled();
    expect(lastAssistantMessageText()).toContain("Invalid Hobit action request.");
    expect(lastAssistantMessageText()).toContain("Envelope JSON is invalid.");
    expect(lastAssistantMessageText()).toContain(
      "Stopped: invalid or unsupported action envelope.",
    );
  });

  it("sends Queue schemas and examples to Direct Work without exposing them in the transcript", async () => {
    const createItem = vi.fn();
    const runAutonomousQueue = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      "I can create a test Queue item when you confirm the action request.",
    );

    renderWidget({
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
      }),
      workspaceId: "workspace_1",
    });

    await runDirectWork("create test queue item");
    await flushAsync();

    const directWorkRequest = startDirectWork.mock.calls[0]?.[1] as {
      operatorPrompt?: string;
    };
    const operatorPrompt = directWorkRequest.operatorPrompt ?? "";

    expect(operatorPrompt).toContain("Queue item prompt is required");
    expect(operatorPrompt).toContain("runnable task instruction");
    expect(operatorPrompt).toContain("test, dummy, or example Queue item");
    expect(operatorPrompt).toContain("ask a concise clarification");
    expect(operatorPrompt).toContain('"capabilityId":"queue.createItem"');
    expect(operatorPrompt).toContain('"capabilityId":"queue.createItems"');
    expect(operatorPrompt).toContain(
      "Queue lifecycle schemas are exact structured contracts",
    );
    expect(operatorPrompt).toContain("hobit.final.answer");
    expect(operatorPrompt).toContain(
      "Intermediate prose is not a capability call",
    );
    expect(operatorPrompt).toContain("Do not write awaiting capability result");
    expect(operatorPrompt).toContain(
      "agentFinished(evidenceBundle or taskId,runId,outcome,finalAgentMessage)",
    );
    expect(operatorPrompt).toContain("ack(taskId,messageId)");
    expect(operatorPrompt).toContain("addFollowUpPrompt(taskId,coordinatorAgentId,prompt)");
    expect(operatorPrompt).toContain(
      "markDone(taskId) plus top-level confirmationToken=operator-confirmed",
    );
    expect(operatorPrompt).toContain(
      '"capabilityId":"queue.lifecycle.agentFinished"',
    );
    expect(operatorPrompt).toContain(
      '"prompt":"Review the current workspace state and report one safe next step."',
    );
    expect(lastOperatorMessageText()).toBe("create test queue item");
    expect(lastOperatorMessageText()).not.toContain("Queue create action schemas");
    expect(lastAssistantMessageText()).not.toContain("hobit.action.request");
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
  });
});

function actionEnvelope({
  capabilityId,
  confirmationToken,
  dryRun,
  input,
  omitRequestId = false,
  requestId = "request-action",
}: {
  capabilityId: string;
  confirmationToken?: string;
  dryRun: boolean;
  input: unknown;
  omitRequestId?: boolean;
  requestId?: string;
}) {
  const envelope: Record<string, unknown> = {
    capabilityId,
    confirmationToken,
    dryRun,
    input,
    type: "hobit.action.request",
  };

  if (!omitRequestId) {
    envelope.requestId = requestId;
  }

  return JSON.stringify(envelope);
}

function workflowEnvelope({
  workflowId,
}: {
  workflowId: string;
}) {
  return JSON.stringify({
    grant: {},
    inputs: {},
    moduleId: "queue",
    requestId: "workflow-request-1",
    type: "hobit.workflow.request",
    workflowId,
  });
}

function finalAnswerEnvelope(message: string) {
  return JSON.stringify({
    message,
    type: "hobit.final.answer",
  });
}

function allAssistantMessageText() {
  return Array.from(
    document.querySelectorAll(
      '[data-testid="interactive-agent-message-assistant"]',
    ),
  ).map(
    (message) =>
      message.querySelector(".interactive-agent-message-body")?.textContent ??
      "",
  );
}

function startDirectWorkWithFinalText(text: string) {
  return vi.fn(
    async (
      _widgetInstanceId: string,
      _request: unknown,
      onEvent: (event: DirectWorkStreamEvent) => void,
    ) => {
      onEvent(
        directWorkEvent({
          eventKind: "final_message",
          isFinal: false,
          codexThreadId: null,
          runId: "run_action_request",
          text,
        }),
      );
      onEvent(
        directWorkEvent({
          codexThreadId: null,
          elapsedMs: 100,
          eventKind: "completed",
          finalStatus: "completed",
          isFinal: true,
          runId: "run_action_request",
        }),
      );

      return {
        runId: "run_action_request",
        status: "started",
        stopListening: vi.fn(),
      };
    },
  );
}

function startDirectWorkWithFinalTexts(
  texts: string[],
  options: { codexThreadId?: string | null } = {},
) {
  let index = 0;
  return vi.fn(
    async (
      _widgetInstanceId: string,
      _request: unknown,
      onEvent: (event: DirectWorkStreamEvent) => void,
    ) => {
      const text = texts[Math.min(index, texts.length - 1)] ?? "";
      const runId = `run_action_request_${(index + 1).toString()}`;
      index += 1;
      onEvent(
        directWorkEvent({
          codexThreadId: options.codexThreadId ?? null,
          eventKind: "final_message",
          isFinal: false,
          runId,
          text,
        }),
      );
      onEvent(
        directWorkEvent({
          codexThreadId: options.codexThreadId ?? null,
          elapsedMs: 100,
          eventKind: "completed",
          finalStatus: "completed",
          isFinal: true,
          runId,
        }),
      );

      return {
        runId,
        status: "started",
        stopListening: vi.fn(),
      };
    },
  );
}

async function runDirectWork(prompt: string) {
  await setTextareaValue(prompt);
  await clickButton("Run with Codex");
}

async function flushAsync(cycles = 12) {
  await act(async () => {
    for (let index = 0; index < cycles; index += 1) {
      await Promise.resolve();
    }
  });
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(async () => snapshotResult()),
    updateItem: vi.fn(async () => itemResult()),
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item = {
    dependencies: [],
    id: "queue-created",
    prompt: "Prompt",
    status: "queued",
    title: "Queue item",
    ...overrides,
  } as QueueWidgetItemSnapshot;

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function snapshotResult(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return snapshotResultWith(overrides);
}

function snapshotResultWith(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  const snapshot = {
    items: [],
    queueId: "workspace:workspace_1:agent-queue",
    selectedItem: null,
    selectedItemId: null,
    widgetType: "agent-queue",
    workspaceId: "workspace_1",
    ...overrides,
  } as unknown as QueueWidgetSnapshot;

  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot,
  };
}

function snapshotItem(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetItemSnapshot {
  return {
    dependencies: [],
    id: "task-1",
    prompt: "Implement the request.",
    status: "queued",
    title: "Queue item",
    workspaceId: "workspace_1",
    ...overrides,
  } as QueueWidgetItemSnapshot;
}

function workerFinishedResult(
  overrides: Partial<AgentQueueWorkerFinishedCommandResult> = {},
): AgentQueueWorkerFinishedCommandResult {
  const taskId = overrides.taskId ?? "task-1";
  const runId = overrides.runId ?? "run-1";
  const aggregate = overrides.aggregate ?? workerEvidenceAggregate(taskId, runId);
  const evidenceBundle = overrides.evidenceBundle ?? {
    bundleId: overrides.bundleId ?? "bundle-1",
    changedFiles: ["apps/desktop/frontend/src/..."],
    changedFilesCount: 1,
    changedFilesSummary: "1 changed file",
    createdAt: "2026-06-17T10:00:00.000Z",
    errorSummary: null,
    executorWidgetId: "executor-1",
    metadataJson: null,
    outcome: "completed" as const,
    runId,
    runLinkId: "run-link-1",
    source: "workspace_agent",
    summary: "Implemented the requested changes.",
    taskId,
    updatedAt: "2026-06-17T10:00:00.000Z",
    validationSummary: "typecheck passed",
    workerId: "workspace-agent",
    workspaceId: "workspace_1",
  };

  return {
    aggregate,
    bundleId: evidenceBundle.bundleId,
    durable: true,
    evidenceBundle,
    runId,
    taskId,
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function workerEvidenceAggregate(taskId: string, runId: string): AgentQueueItemAggregate {
  return {
    blockers: [],
    commitState: "none",
    dependencyState: "none",
    durableFlags: {
      commitState: false,
      completionState: false,
      dependencyState: true,
      evidenceState: true,
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: true,
      reviewState: false,
      taskRow: true,
      validationState: true,
    },
    evidenceState: "available",
    evidenceSummary: {
      available: true,
      notDurableReason: null,
      source: "durable_worker_evidence_bundle",
      summary: "Implemented the requested changes.",
    },
    latestRun: {
      completedAt: "2026-06-17T10:00:00.000Z",
      executorWidgetId: "executor-1",
      finalDetailAvailable: true,
      reviewStatus: "review_needed",
      runId,
      runLinkId: "run-link-1",
      source: "agent_executor",
      startedAt: "2026-06-17T09:59:00.000Z",
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
    runSettings: {
      approvalPolicy: null,
      assignedExecutorWidgetId: "executor-1",
      codexExecutable: null,
      executionPolicy: "manual",
      executionWorkspace: null,
      sandbox: null,
    },
    taskId,
    ticketState: "awaiting_review",
    title: "Queue item",
    updatedAt: "2026-06-17T10:00:00.000Z",
    validationState: "not_requested",
    workerRunState: "completed",
    workspaceId: "workspace_1",
  };
}

function aggregateFromSnapshotItem(
  item: QueueWidgetItemSnapshot,
): AgentQueueItemAggregate {
  const latestRun = item.runLinks?.[0]
    ? {
        completedAt: item.runLinks[0].completedAt ?? null,
        executorWidgetId: item.runLinks[0].executorWidgetId,
        finalDetailAvailable: true,
        reviewStatus: item.runLinks[0].reviewStatus ?? null,
        runId: item.runLinks[0].directWorkRunId,
        runLinkId: item.runLinks[0].linkId,
        source: item.runLinks[0].source,
        startedAt: item.runLinks[0].startedAt,
        status: item.runLinks[0].status,
        validationStatus: item.runLinks[0].validationStatus ?? null,
      }
    : null;
  const blockers = (item.blockers ?? []).map((blocker) => ({
    code: blocker.code,
    message: blocker.message,
  }));

  return {
    blockers,
    commitState: "none",
    dependencyState: item.dependencies.length > 0 ? "waiting" : "none",
    durableFlags: {
      commitState: false,
      completionState: false,
      dependencyState: true,
      evidenceState: false,
      failureState: false,
      frontendOverlayUsed: false,
      latestRunLink: Boolean(latestRun),
      reviewState: false,
      taskRow: true,
      validationState: true,
    },
    evidenceState: latestRun ? "available" : "none",
    evidenceSummary: latestRun
      ? {
          available: true,
          notDurableReason: null,
          source: "latest_run_link",
          summary: "Latest run evidence available.",
        }
      : null,
    latestRun,
    nextActions: nextActionsForSnapshotItem(item, blockers),
    reviewState: "not_requested",
    runSettings: {
      approvalPolicy: item.approvalPolicy ?? null,
      assignedExecutorWidgetId: item.assignedExecutorWidgetId ?? null,
      codexExecutable: item.codexExecutable ?? null,
      executionPolicy: item.executionPolicy ?? "manual",
      executionWorkspace: item.executionWorkspace ?? null,
      sandbox: item.sandbox ?? null,
    },
    taskId: item.id,
    ticketState: item.status,
    title: item.title,
    updatedAt: item.updatedAt ?? "2026-06-17T10:00:00.000Z",
    validationState: item.validationStatus ?? "not_requested",
    workerRunState: latestRun?.status ?? (item.status === "running" ? "running" : "not_started"),
    workspaceId: item.workspaceId ?? "workspace_1",
  };
}

function nextActionsForSnapshotItem(
  item: QueueWidgetItemSnapshot,
  blockers: readonly { code: string; message: string }[],
): AgentQueueItemAggregate["nextActions"] {
  if (item.status === "draft") {
    const available = blockers.length === 0;
    return [
      {
        available,
        code: "promote_draft",
        label: "Promote draft",
        unavailableReason: available ? null : "Draft readiness is incomplete.",
      },
    ];
  }

  if (item.status === "queued" || item.status === "ready") {
    const available = blockers.length === 0;
    return [
      {
        available,
        code: "start_run",
        label: "Start run",
        unavailableReason: available ? null : "Queue item is blocked.",
      },
    ];
  }

  return [];
}
