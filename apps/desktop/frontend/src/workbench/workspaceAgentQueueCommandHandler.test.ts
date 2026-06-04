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

  it("explains failed Queue evidence without creating or running work", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          itemCounts: countsFixture({
            failed: 1,
            total: 1,
          }),
          items: [
            queueItemSnapshot({
              coordinatorStatus: "awaiting_coordinator_review",
              evidenceSummary: {
                reviewStatus: "review_needed",
                runRefs: ["run-failed"],
                status: "available",
                validationStatus: "failed",
              },
              executionStatus: "failed",
              id: "Q-FAILED",
              reportSummary: {
                errorMessage: "typecheck exited with code 2",
                failedCommand: "npm.cmd run typecheck --prefix apps/desktop/frontend",
                status: "report_ready",
                summary: "Worker report summary: frontend typecheck failed.",
                validationSummary:
                  "Validation result: failed. Validation commands already reported: npm.cmd run typecheck --prefix apps/desktop/frontend.",
              },
              runLinks: [
                {
                  completedAt: "2026-06-02T12:10:00.000Z",
                  directWorkRunId: "run-failed",
                  executorWidgetId: "executor-1",
                  linkId: "link-1",
                  reviewStatus: "review_needed",
                  source: "manual",
                  startedAt: "2026-06-02T12:00:00.000Z",
                  status: "failed",
                  validationStatus: "failed",
                },
              ],
              status: "failed",
              title: "Fix frontend typecheck",
              validationStatus: "failed",
            }),
          ],
          selectedItem: null,
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("why it failed", {
      bridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
    });

    expect(result.handled).toBe(true);
    expect(getSnapshot).toHaveBeenCalledWith({ includeSelectedItem: true });
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain("Queue item: Q-FAILED - Fix frontend typecheck.");
    expect(result.body).toContain("Execution status: failed.");
    expect(result.body).toContain(
      "Coordinator/review status: awaiting_coordinator_review.",
    );
    expect(result.body).toContain("Result/evidence status: report report_ready, evidence available.");
    expect(result.body).toContain(
      "Failed command: npm.cmd run typecheck --prefix apps/desktop/frontend.",
    );
    expect(result.body).toContain("Error message: typecheck exited with code 2.");
    expect(result.body).toContain(
      "Worker report / final response summary: Worker report summary: frontend typecheck failed.",
    );
    expect(result.body).toContain("Validation summary: Validation result: failed.");
    expect(result.body).toContain("Suggested next action:");
    expect(result.body).not.toContain("validate.ps1");
  });

  it("uses the selected failed Queue item when explaining failure evidence", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const selectedItem = queueItemSnapshot({
      evidenceSummary: {
        reviewStatus: null,
        runRefs: [],
        status: "missing",
        validationStatus: "failed",
      },
      id: "Q-SELECTED",
      reportSummary: {
        status: "evidence_missing",
        summary: "Execution is complete but no safe run evidence is linked.",
      },
      status: "completed",
      title: "Selected failed validation",
      validationStatus: "failed",
    });
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          items: [
            queueItemSnapshot({
              id: "Q-OLDER",
              reportSummary: {
                errorMessage: "older failure",
                status: "report_ready",
              },
              status: "failed",
              title: "Older failed item",
              updatedAt: "2026-06-02T10:00:00.000Z",
            }),
            selectedItem,
          ],
          selectedItem,
          selectedItemId: "Q-SELECTED",
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("why did it fail", {
      bridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
    });

    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(
      "Queue item: Q-SELECTED - Selected failed validation.",
    );
    expect(result.body).toContain("Result/evidence status: report evidence_missing, evidence missing.");
    expect(result.body).toContain("do not rerun validation unless explicitly requested");
    expect(result.body).not.toContain("validate.ps1");
  });

  it("reports missing failure evidence without recreating validation", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const getSnapshot = vi.fn(async () =>
      snapshotResult(
        queueSnapshot({
          items: [
            queueItemSnapshot({
              id: "Q-DRAFT",
              status: "draft",
              title: "Draft item",
            }),
          ],
          selectedItem: queueItemSnapshot({
            id: "Q-DRAFT",
            status: "draft",
            title: "Draft item",
          }),
          selectedItemId: "Q-DRAFT",
        }),
      ),
    );

    const result = await runWorkspaceAgentQueueCommand("what failed", {
      bridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
    });

    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain("Queue item: Q-DRAFT - Draft item.");
    expect(result.body).toContain("No failure evidence is available for this item.");
    expect(result.body).toContain(
      "Open/refresh the Queue report or select the failed item.",
    );
    expect(result.body).not.toContain("validate.ps1");
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
        sandbox: "danger_full_access",
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
    expect(result.body).toContain("Sandbox: danger_full_access");
    expect(result.body).toContain("Approval: never");
    expect(result.body).not.toContain("Missing settings");
  });

  it("runs one prompt-through-Queue command by creating one item and starting Autonomous Queue", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-PROMPT-1",
        prompt: request.prompt,
        sandbox: request.sandbox,
        status: request.status,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue", {
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      ["Run this prompt through Queue:", "Read AGENTS.md first line."].join(
        "\n",
      ),
      {
        bridge: queueBridge({
          createItem,
          getRunSettingsDefaults: () => ({
            approvalPolicy: "on_request",
            codexExecutable: "codex-custom",
            executionWorkspace: "C:/queue-default",
            sandbox: "read_only",
          }),
          runAutonomousQueue,
        }),
        currentWorkspaceRoot: "C:/workspace-root",
      },
    );

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/queue-default",
        prompt: expect.stringContaining(
          "Get-Content .\\AGENTS.md -TotalCount 1",
        ),
        queueTag: { name: "Default" },
        sandbox: "danger_full_access",
        status: "queued",
        title: "Read AGENTS.md first line",
      }),
    );
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Created 1 Queue item and started Autonomous Queue.",
    );
  });

  it("runs multiple prompt-through-Queue commands by creating items and starting Autonomous Queue once", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: `Q-PROMPT-${(createItem.mock.calls.length + 1).toString()}`,
        prompt: request.prompt,
        sandbox: request.sandbox,
        status: request.status,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue", {
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      [
        "Run these prompts through Queue:",
        "",
        "1. read AGENTS.md first line",
        "2. show current location",
        "3. show git status",
      ].join("\n"),
      {
        bridge: queueBridge({
          createItem,
          runAutonomousQueue,
        }),
        currentWorkspaceRoot: "C:/repo",
      },
    );

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledTimes(3);
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Created 3 Queue items and started Autonomous Queue.",
    );
    expect(createItem.mock.calls.map((call) => call[0].title)).toEqual([
      "Read AGENTS.md first line",
      "Show current location",
      "Show git status",
    ]);
    for (const [request] of createItem.mock.calls) {
      expect(request).toMatchObject({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        queueTag: { name: "Default" },
        sandbox: "danger_full_access",
        status: "queued",
      });
    }
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Get-Content .\\AGENTS.md -TotalCount 1",
    );
    expect(createItem.mock.calls[1]?.[0].prompt).toContain("Get-Location");
    expect(createItem.mock.calls[2]?.[0].prompt).toContain(
      "git status --short --branch",
    );
  });

  it("turns unknown prompt-through-Queue text into a structured generic executor prompt", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        prompt: request.prompt,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue", {
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      }),
    );

    await runWorkspaceAgentQueueCommand(
      "Execute this prompt through Queue: summarize visible requirements",
      {
        bridge: queueBridge({
          createItem,
          runAutonomousQueue,
        }),
        currentWorkspaceRoot: "C:/repo",
      },
    );

    const request = createItem.mock.calls[0]?.[0];
    expect(request?.title).toBe("Workspace Agent task");
    expect(request?.prompt).toContain("Mode:");
    expect(request?.prompt).toContain("Queue executor task.");
    expect(request?.prompt).toContain("Objective:");
    expect(request?.prompt).toContain("summarize visible requirements");
    expect(request?.prompt).toContain("Do not edit files.");
    expect(request?.prompt).toContain("Do not create files.");
    expect(request?.prompt).toContain("Do not delete files.");
    expect(request?.prompt).toContain("Report:");
    expect(request?.prompt).toContain("* status");
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
  });

  it("does not create runnable prompt-through-Queue tasks without a workspace", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "Run this prompt through Queue: read AGENTS.md first line",
      {
        bridge: queueBridge({
          createItem,
          getRunSettingsDefaults: () => null,
          runAutonomousQueue,
        }),
        currentWorkspaceRoot: "~",
      },
    );

    expect(result.handled).toBe(true);
    expect(result.body).toBe(
      "Queue action failed: task workspace is missing. No Queue items were created or run.",
    );
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
  });

  it("handles explicit Queue-only multi-task commands before provider routing", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: `Q-CREATED-${(createItem.mock.calls.length + 1).toString()}`,
        prompt: request.prompt,
        sandbox: request.sandbox,
        status: request.status,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue", {
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      multiTaskQueueOnlyCommand(),
      {
        bridge: queueBridge({
          createItem,
          getRunSettingsDefaults: () => null,
          runAutonomousQueue,
        }),
      },
    );

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledTimes(3);
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Created 3 Queue items and started Autonomous Queue.",
    );
    expect(createItem.mock.calls.map((call) => call[0].title)).toEqual([
      "Read AGENTS.md first line",
      "Show current location",
      "Show git status",
    ]);
    for (const [request] of createItem.mock.calls) {
      expect(request).toMatchObject({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:\\Users\\Dmitry\\Documents\\prj\\Hobit_fixed",
        queueTag: { name: "Default" },
        sandbox: "danger_full_access",
        status: "queued",
      });
      expect(request.prompt).toContain("Mode:");
      expect(request.prompt).toContain("Do not edit files.");
      expect(request.prompt).toContain("Report:");
    }
    expect(createItem.mock.calls[0]?.[0].prompt).toContain(
      "Get-Content .\\AGENTS.md -TotalCount 1",
    );
    expect(createItem.mock.calls[1]?.[0].prompt).toContain("Get-Location");
    expect(createItem.mock.calls[2]?.[0].prompt).toContain(
      "git status --short --branch",
    );
  });

  it("shows a local Queue API error for Queue-only commands when the bridge is missing", async () => {
    const result = await runWorkspaceAgentQueueCommand(
      multiTaskQueueOnlyCommand(),
      {},
    );

    expect(result.handled).toBe(true);
    expect(result.body).toBe(
      "Agent Queue API is not available in this workspace view.",
    );
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

  it("creates executable local dogfooding tasks with danger_full_access when Queue defaults are unavailable", async () => {
    const hobitWorkspace = "C:\\Users\\Dmitry\\Documents\\prj\\Hobit_fixed";
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-HOBIT",
        prompt: request.prompt,
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
          getRunSettingsDefaults: () => null,
          runAutonomousQueue,
        }),
        currentWorkspaceRoot: hobitWorkspace,
      },
    );

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executionWorkspace: hobitWorkspace,
        prompt: expect.stringContaining(
          "Get-Content .\\AGENTS.md -TotalCount 1",
        ),
        sandbox: "danger_full_access",
        status: "queued",
        title: "Read AGENTS.md first line",
      }),
    );
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(`Task workspace: ${hobitWorkspace}`);
    expect(result.body).toContain("Sandbox: danger_full_access");
    expect(result.body).toContain("Approval: never");
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
    expect(request?.prompt).toContain(
      "* validation status only if explicitly requested or already present",
    );
    expect(request?.prompt).toContain("* risks or blockers");
    expect(request?.prompt).not.toContain("validate.ps1");
    expect(request?.prompt).not.toContain(
      "validation run, or why validation was not run",
    );
    expect(request?.prompt).not.toContain("Run only:");
  });

  it("parses codebase Knowledge generation as a queued manual Queue task", () => {
    expect(
      parseWorkspaceAgentQueueCommand(
        "Generate codebase knowledge. Area: apps/desktop/frontend/src/workbench",
      ),
    ).toMatchObject({
      description:
        "Generate draft Knowledge from selected codebase area: apps/desktop/frontend/src/workbench. Draft output only; do not activate Knowledge.",
      executionPolicy: "manual",
      queueTagName: "Knowledge generation",
      status: "queued",
      title: "Generate codebase Knowledge: apps/desktop/frontend/src/workbench",
      type: "createItem",
    });
  });

  it("creates a codebase Knowledge generation task without executing analysis or activating Knowledge", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        description: request.description ?? "",
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-KNOWLEDGE",
        prompt: request.prompt,
        queueTag: request.queueTag,
        status: request.status,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "Create Queue task to generate codebase knowledge. Area: apps/desktop/frontend/src/workbench",
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
        description:
          "Generate draft Knowledge from selected codebase area: apps/desktop/frontend/src/workbench. Draft output only; do not activate Knowledge.",
        executionPolicy: "manual",
        executionWorkspace: "C:/repo",
        priority: 0,
        queueTag: { name: "Knowledge generation" },
        status: "queued",
        title: "Generate codebase Knowledge: apps/desktop/frontend/src/workbench",
      }),
    );

    const request = createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Queue knowledge generation task.");
    expect(request?.prompt).toContain(
      "* codebase: apps/desktop/frontend/src/workbench",
    );
    expect(request?.prompt).toContain("* architecture overview");
    expect(request?.prompt).toContain("* important files and why they matter");
    expect(request?.prompt).toContain("* key flows and boundaries");
    expect(request?.prompt).toContain("* safe modification rules");
    expect(request?.prompt).toContain("* relevant validation commands");
    expect(request?.prompt).toContain(
      "* proposed Knowledge item types, tags, and scope",
    );
    expect(request?.prompt).toContain("* Return draft Knowledge only.");
    expect(request?.prompt).toContain(
      "* Do not create, edit, enable, or activate Knowledge records.",
    );
    expect(request?.prompt).toContain(
      "* confirmation that no Knowledge was activated",
    );
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(
      "Created Queue item: Q-KNOWLEDGE",
    );
    expect(result.body).toContain("Status: queued.");
  });

  it("parses coordinator history Knowledge generation as a queued manual Queue task", () => {
    expect(
      parseWorkspaceAgentQueueCommand(
        "Create knowledge from coordinator history. Source refs: visible messages local-1..local-4 and proposal summary P-2",
      ),
    ).toMatchObject({
      description:
        "Generate draft Knowledge from selected coordinator/Workspace Agent history: visible messages local-1..local-4 and proposal summary P-2. Draft output only; do not activate Knowledge.",
      executionPolicy: "manual",
      queueTagName: "Knowledge generation",
      status: "queued",
      title: "Generate Workspace Agent history Knowledge draft",
      type: "createItem",
    });
  });

  it("creates a command history Knowledge generation task without reading hidden history or activating Knowledge", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        description: request.description ?? "",
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-HISTORY",
        prompt: request.prompt,
        queueTag: request.queueTag,
        status: request.status,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "Summarize command history into knowledge. Command summaries: typecheck passed; build failed in Vite spawn limitation",
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
        description:
          "Generate draft Knowledge from selected command/run history: typecheck passed. Draft output only; do not activate Knowledge.",
        executionPolicy: "manual",
        executionWorkspace: "C:/repo",
        priority: 0,
        queueTag: { name: "Knowledge generation" },
        status: "queued",
        title: "Generate command history Knowledge draft",
      }),
    );

    const request = createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Task type:");
    expect(request?.prompt).toContain("knowledge_generation");
    expect(request?.prompt).toContain(
      "* command_history: typecheck passed",
    );
    expect(request?.prompt).toContain("* what was learned");
    expect(request?.prompt).toContain("* what remains uncertain");
    expect(request?.prompt).toContain(
      "* Terminal history only when the operator explicitly selected and pasted or attached the excerpt",
    );
    expect(request?.prompt).toContain(
      "* Do not read hidden Workspace Agent messages, hidden widget state, Notes bodies, raw logs, raw Terminal transcripts, raw Executor stdout/stderr, raw provider responses, Git diffs, repo paths, secrets, or unselected files.",
    );
    expect(request?.prompt).toContain(
      "* confirmation that no Knowledge was activated",
    );
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain("Created Queue item: Q-HISTORY");
    expect(result.body).toContain("Status: queued.");
  });

  it("does not invent full validation in create task prompts", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        prompt: request.prompt,
        title: request.title,
      }),
    );

    await runWorkspaceAgentQueueCommand("create task explain the parser failure", {
      bridge: queueBridge({ createItem }),
      currentWorkspaceRoot: "C:/repo",
    });

    const prompt = createItem.mock.calls[0]?.[0]?.prompt ?? "";
    expect(prompt).toContain("explain the parser failure");
    expect(prompt).not.toContain("scripts\\hobit\\validate.ps1 -Profile full");
    expect(prompt).not.toContain("validate.ps1");
    expect(prompt).not.toContain("full validation");
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
    expect(
      parseWorkspaceAgentQueueCommand("\u043f\u043e\u0447\u0435\u043c\u0443 \u0443\u043f\u0430\u043b\u043e"),
    ).toEqual({
      type: "explainFailure",
    });
  });

  it("keeps explicit validation requests distinct from failure explanation", () => {
    expect(parseWorkspaceAgentQueueCommand("run full validation")).toBeNull();
    expect(
      parseWorkspaceAgentQueueCommand(
        "run validate.ps1 -Profile full",
      ),
    ).toBeNull();
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

function multiTaskQueueOnlyCommand() {
  return [
    "Use Agent Queue only. Do not execute commands directly.",
    "",
    "Create three separate queued Queue tasks with task-scoped run settings:",
    "",
    "* workspace: C:\\Users\\Dmitry\\Documents\\prj\\Hobit_fixed",
    "* codex executable: codex.cmd",
    "* sandbox: danger_full_access",
    "* approval: never",
    "",
    "Task 1: read AGENTS.md first line",
    "Task 2: show current location",
    "Task 3: show git status",
    "",
    "After creating all three Queue tasks, start Autonomous Queue.",
  ].join("\n");
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
