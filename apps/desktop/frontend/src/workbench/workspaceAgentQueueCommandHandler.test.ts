import { describe, expect, it, vi } from "vitest";

import {
  parseWorkspaceAgentQueueCommand,
  runWorkspaceAgentQueueCommand,
} from "./workspaceAgentQueueCommandHandler";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemCounts,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type {
  WorkspaceAgentQueueAutonomousActionResult,
  WorkspaceAgentQueueBridge,
} from "./workspaceAgentQueueBridge";

describe("workspaceAgentQueueCommandHandler", () => {
  it("analyzes Queue snapshots through getSnapshot and renders a compact summary", async () => {
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          blockers: [
            {
              code: "missing_execution_workspace",
              itemId: "Q-BLOCKED",
              message: "Execution workspace is not set.",
            },
          ],
          itemCounts: countsFixture({
            awaitingCoordinatorReview: 1,
            blocked: 1,
            finalized: 1,
            queued: 2,
            reportReady: 1,
            running: 1,
            total: 6,
          }),
          items: [
            queueItemSnapshot({
              id: "Q-NEXT",
              status: "queued",
              title: "Next runnable",
            }),
            queueItemSnapshot({
              id: "Q-READY",
              status: "ready",
              title: "Ready runnable",
            }),
          ],
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("analyze queue", {
      bridge: queueBridge({ getSnapshot }),
    });

    expect(result.handled).toBe(true);
    expect(getSnapshot).toHaveBeenCalledWith({ includeSelectedItem: true });
    expect(result.body).toContain(
      "Queue has 6 items: 2 queued, 1 running, 1 blocked, 1 report-ready, 1 awaiting review, 1 finalized.",
    );
    expect(result.body).toContain("Q-NEXT - Next runnable");
    expect(result.body).toContain(
      "Q-BLOCKED: Execution workspace is not set.",
    );
    expect(result.body).toContain("Recommendation:");
  });

  it("creates Queue items through createItem with current workspace run settings", async () => {
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-CREATED",
        priority: request.priority,
        prompt: request.prompt,
        queueTag: request.queueTag,
        sandbox: request.sandbox,
        status: request.status,
        title: request.title,
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "create task Read AGENTS.md first line.",
      {
        bridge: queueBridge({
          createItem,
          runAutonomousQueue,
        }),
        currentWorkspaceRoot: "C:/repo",
      },
    );

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executionWorkspace: "C:/repo",
        priority: 0,
        prompt: expect.stringContaining(
          "Get-Content .\\AGENTS.md -TotalCount 1",
        ),
        queueTag: { name: "Default" },
        sandbox: "read_only",
        status: "queued",
        title: "Read AGENTS.md first line",
      }),
    );
    const request = createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Mode:");
    expect(request?.prompt).toContain("Objective:");
    expect(request?.prompt).toContain("Run only:");
    expect(request?.prompt).toContain("Do not edit files.");
    expect(request?.prompt).toContain("Do not create files.");
    expect(request?.prompt).toContain("Do not delete files.");
    expect(request?.prompt).toContain(
      "Do not commit, push, reset, clean, stash, or rollback.",
    );
    expect(request?.prompt).toContain("Report:");
    expect(request?.prompt).toContain("* AGENTS.md first line");
    expect(request?.prompt).toContain(
      "* confirmation that no files were changed",
    );
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(
      "Created Queue item: Q-CREATED \u2014 Read AGENTS.md first line. Status: queued.",
    );
    expect(result.body).toContain("Task workspace: C:/repo");
    expect(result.body).not.toContain("Missing settings");
  });

  it("uses Queue run defaults from the bridge before Workspace Agent fallbacks", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionWorkspace: request.executionWorkspace ?? "",
        sandbox: request.sandbox,
        status: request.status,
        title: request.title,
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "create task read AGENTS.md first line",
      {
        bridge: queueBridge({
          createItem,
          getRunSettingsDefaults: () => ({
            approvalPolicy: "never",
            codexExecutable: "codex-custom.cmd",
            executionWorkspace: "D:/queue-default",
            sandbox: "workspace_write",
          }),
        }),
        currentWorkspaceRoot: "C:/repo",
      },
    );

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex-custom.cmd",
        executionWorkspace: "D:/queue-default",
        sandbox: "workspace_write",
        status: "queued",
      }),
    );
    expect(result.body).toContain("Task workspace: D:/queue-default");
  });

  it("creates a read-only location task with an exact Get-Location command", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        prompt: request.prompt,
        title: request.title,
      }),
    );

    await runWorkspaceAgentQueueCommand(
      "create task show current location",
      {
        bridge: queueBridge({ createItem }),
        currentWorkspaceRoot: "C:/repo",
      },
    );

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Get-Location"),
        title: "Show current location",
      }),
    );
  });

  it("creates a read-only Git status task with the short branch command", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        prompt: request.prompt,
        title: request.title,
      }),
    );

    await runWorkspaceAgentQueueCommand("create task git status", {
      bridge: queueBridge({ createItem }),
      currentWorkspaceRoot: "C:/repo",
    });

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("git status --short --branch"),
        title: "Show git status",
      }),
    );
  });

  it("creates unknown task text as a structured prompt instead of raw text only", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        prompt: request.prompt,
        title: request.title,
      }),
    );

    await runWorkspaceAgentQueueCommand(
      "create task build parser from visible requirements",
      {
        bridge: queueBridge({ createItem }),
        currentWorkspaceRoot: "C:/repo",
      },
    );

    const request = createItem.mock.calls[0]?.[0];
    expect(request?.title).toBe("Workspace Agent task");
    expect(request?.prompt).not.toBe("build parser from visible requirements");
    expect(request?.prompt).toContain("Mode:");
    expect(request?.prompt).toContain("Objective:");
    expect(request?.prompt).toContain(
      "build parser from visible requirements",
    );
    expect(request?.prompt).toContain("Do not edit files.");
    expect(request?.prompt).toContain("Do not create files.");
    expect(request?.prompt).toContain("Do not delete files.");
    expect(request?.prompt).toContain("Report:");
    expect(request?.prompt).toContain("* status");
    expect(request?.prompt).toContain("* risks or blockers");
    expect(request?.prompt).not.toContain("Run only:");
  });

  it("creates a draft and reports a blocker when task workspace is unavailable", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        executionWorkspace: request.executionWorkspace ?? "",
        status: request.status,
        title: request.title,
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "create task read AGENTS.md first line",
      {
        bridge: queueBridge({ createItem }),
        currentWorkspaceRoot: "~",
      },
    );

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        executionWorkspace: undefined,
        status: "draft",
      }),
    );
    expect(result.body).toBe(
      "Created Queue item, but task workspace is missing.",
    );
  });

  it("uses a fenced prompt block when creating a Queue item", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        prompt: request.prompt,
        title: request.title,
      }),
    );

    await runWorkspaceAgentQueueCommand(
      ["create task Build parser", "```", "Use this exact prompt.", "```"].join(
        "\n",
      ),
      {
        bridge: queueBridge({ createItem }),
      },
    );

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Use this exact prompt.",
        title: "Build parser",
      }),
    );
  });

  it("updates an exact Queue item id through updateItem", async () => {
    const updateItem = vi.fn(async (request) =>
      itemResult("queue.updateItem", {
        id: request.itemId,
        status: request.patch.status,
        title: "Exact item",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "update task Q-123 status queued",
      {
        bridge: queueBridge({
          getSnapshot: vi.fn(async () =>
            snapshotResult(
              queueSnapshot({
                items: [
                  queueItemSnapshot({
                    id: "Q-123",
                    status: "draft",
                    title: "Exact item",
                  }),
                ],
              }),
            ),
          ),
          updateItem,
        }),
      },
    );

    expect(result.handled).toBe(true);
    expect(updateItem).toHaveBeenCalledWith({
      itemId: "Q-123",
      patch: { status: "queued" },
    });
    expect(result.body).toContain("Updated Queue item: Q-123 - Exact item.");
  });

  it("asks for clarification when update title matching is ambiguous", async () => {
    const updateItem = vi.fn(async () => itemResult("queue.updateItem"));

    const result = await runWorkspaceAgentQueueCommand(
      "update task AGENTS status queued",
      {
        bridge: queueBridge({
          getSnapshot: vi.fn(async () =>
            snapshotResult(
              queueSnapshot({
                items: [
                  queueItemSnapshot({
                    id: "Q-1",
                    title: "Read AGENTS first",
                  }),
                  queueItemSnapshot({
                    id: "Q-2",
                    title: "Review AGENTS instructions",
                  }),
                ],
              }),
            ),
          ),
          updateItem,
        }),
      },
    );

    expect(result.handled).toBe(true);
    expect(result.body).toContain("Queue update needs a specific task.");
    expect(result.body).toContain("Q-1 (Read AGENTS first)");
    expect(result.body).toContain("Q-2 (Review AGENTS instructions)");
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("starts Autonomous Queue through the autonomous bridge action", async () => {
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue", {
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand("run autonomous queue", {
      bridge: queueBridge({ runAutonomousQueue }),
    });

    expect(result.handled).toBe(true);
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe("Autonomous Queue started.");
  });

  it("stops Autonomous Queue after the current task through the autonomous bridge action", async () => {
    const stopAutonomousQueueAfterCurrent = vi.fn(async () =>
      autonomousResult("queue.stopAutonomousQueueAfterCurrent", {
        message: "Autonomous Queue will stop after the current task.",
        ok: true,
        status: "stopping",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "stop after current task",
      {
        bridge: queueBridge({ stopAutonomousQueueAfterCurrent }),
      },
    );

    expect(result.handled).toBe(true);
    expect(stopAutonomousQueueAfterCurrent).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Autonomous Queue will stop after the current task.",
    );
  });

  it("parses Russian Queue command phrases", () => {
    expect(
      parseWorkspaceAgentQueueCommand(
        "\u0447\u0442\u043e \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
      ),
    ).toEqual({
      type: "analyzeQueue",
    });
    expect(
      parseWorkspaceAgentQueueCommand(
        "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
      ),
    ).toEqual({
      type: "runAutonomousQueue",
    });
    expect(
      parseWorkspaceAgentQueueCommand(
        "\u0441\u043e\u0437\u0434\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443 \u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
      ),
    ).toMatchObject({
      title: "Workspace Agent task",
      type: "createItem",
    });
  });
});

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult("queue.createItem")),
    getSnapshot: vi.fn(async () => snapshotResult(queueSnapshot())),
    updateItem: vi.fn(async () => itemResult("queue.updateItem")),
    ...overrides,
  };
}

function snapshotResult(
  snapshot: QueueWidgetSnapshot,
): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    item: snapshot,
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot,
  };
}

function itemResult(
  action: "queue.createItem" | "queue.updateItem",
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item = queueItemSnapshot(overrides);

  return {
    action,
    events: [],
    item,
    message:
      action === "queue.createItem"
        ? "Queue item created. No task execution started."
        : "Queue item updated. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function autonomousResult(
  action:
    | "queue.runAutonomousQueue"
    | "queue.stopAutonomousQueueAfterCurrent",
  overrides: Partial<WorkspaceAgentQueueAutonomousActionResult> = {},
): WorkspaceAgentQueueAutonomousActionResult {
  return {
    action,
    message: "Autonomous Queue started.",
    ok: true,
    status: "running",
    ...overrides,
  };
}

function queueSnapshot(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetSnapshot {
  const counts = overrides.itemCounts ?? countsFixture();

  return {
    autonomousRunnerState: {
      activeItemId: null,
      available: false,
      isActive: false,
      isSessionOnly: true,
      status: "unavailable",
      stopReason: null,
      waitingRunId: null,
    },
    blockers: [],
    blockersCount: 0,
    capsAndRedactions: [],
    coordinatorId: "primary",
    countsByStatus: counts,
    finalizedCount: counts.finalized,
    globalQueueState: {
      errorCount: 0,
      lastRefreshAt: "2026-06-02T12:00:00.000Z",
      status: "idle",
      unsupportedReason: null,
    },
    itemCounts: counts,
    items: [queueItemSnapshot()],
    lastEvents: [],
    localExecutorState: {
      activeRunCount: 0,
      assignedCount: 0,
      available: false,
      executorCount: 0,
      unsupportedReason: null,
      workerCount: 0,
    },
    pendingConfirmations: [],
    queueId: "workspace:workspace_1:agent-queue",
    queueTags: [],
    reportReadyCount: counts.reportReady,
    revision: "rev-1",
    runningCount: counts.running,
    selectedItem: null,
    selectedItemId: null,
    snapshotGeneratedAt: "2026-06-02T12:00:00.000Z",
    unsupportedReason: null,
    waitingCount: counts.waiting,
    widgetType: "agent-queue",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function countsFixture(
  overrides: Partial<QueueWidgetItemCounts> = {},
): QueueWidgetItemCounts {
  return {
    awaitingCoordinatorReview: 0,
    blocked: 0,
    cancelled: 0,
    completed: 0,
    draft: 1,
    failed: 0,
    finalized: 0,
    queued: 0,
    ready: 0,
    reportReady: 0,
    review_needed: 0,
    reviewNeeded: 0,
    running: 0,
    total: 1,
    waiting: 1,
    ...overrides,
  };
}

function queueItemSnapshot(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetItemSnapshot {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    blockers: [],
    codexExecutable: "codex.cmd",
    coordinatorStatus: null,
    createdAt: "2026-06-02T11:00:00.000Z",
    dependencies: [],
    description: "",
    evidenceSummary: {
      reviewStatus: null,
      runRefs: [],
      status: "none",
      validationStatus: "not_started",
    },
    executionPolicy: "manual",
    executionStatus: "draft",
    executionWorkspace: "C:/repo",
    id: "Q-1",
    index: null,
    itemType: "implementation",
    order: null,
    priority: 0,
    prompt: "Prompt",
    queueId: "workspace:workspace_1:agent-queue",
    queueTag: {
      id: null,
      name: "Default",
    },
    reportSummary: {
      status: "none",
    },
    runLinks: [],
    sandbox: "read_only",
    status: "draft",
    title: "Queue item",
    updatedAt: "2026-06-02T11:00:00.000Z",
    validationStatus: "not_started",
    workspaceId: "workspace_1",
    ...overrides,
  };
}
