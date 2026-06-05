import { describe, expect, it, vi } from "vitest";

import {
  parseWorkspaceAgentQueueCommand,
  runWorkspaceAgentQueueCommand,
} from "./workspaceAgentQueueCommandHandler";
import {
  autonomousResult,
  countsFixture,
  itemResult,
  queueBridge,
  queueItemSnapshot,
  queueSnapshot,
  snapshotResult,
} from "./workspaceAgentQueueCommandHandler.testHelpers";

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

  it("recognizes create a Queue task phrasing", () => {
    expect(
      parseWorkspaceAgentQueueCommand(
        "Create a Queue task read AGENTS.md first line",
      ),
    ).toMatchObject({
      title: "Read AGENTS.md first line",
      type: "createItem",
    });
  });

  it("covers exact prompt-through-Queue smoke prompt with implicit workspace fallback", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-SMOKE-IMPLICIT",
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

    const result = await runWorkspaceAgentQueueCommand(exactSmokePrompt(), {
      bridge: queueBridge({
        createItem,
        getRunSettingsDefaults: () => ({
          approvalPolicy: "on_request",
          codexExecutable: "codex-default.cmd",
          executionWorkspace: "C:/queue-default",
          sandbox: "workspace_write",
        }),
        runAutonomousQueue,
      }),
      currentWorkspaceRoot: "C:/workspace-root",
    });

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "on_request",
        codexExecutable: "codex-default.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/queue-default",
        queueTag: { name: "Default" },
        sandbox: "workspace_write",
        status: "queued",
        title: "Smoke read AGENTS first line",
      }),
    );
    const request = createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Run only:");
    expect(request?.prompt).toContain(
      "Get-Content .\\AGENTS.md -TotalCount 1",
    );
    expect(request?.prompt).toContain("Do not edit files.");
    expect(request?.prompt).toContain("Do not create files.");
    expect(request?.prompt).toContain("Do not delete files.");
    expect(request?.prompt).toContain(
      "Do not reset, clean, stash, checkout, rebase, merge, or force anything.",
    );
    expect(request?.prompt).toContain("git status --short --branch output");
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Created 1 Queue item and started Autonomous Queue.",
    );
  });

  it("covers exact explicit-settings prompt-through-Queue smoke prompt", async () => {
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        approvalPolicy: request.approvalPolicy,
        codexExecutable: request.codexExecutable,
        executionPolicy: request.executionPolicy,
        executionWorkspace: request.executionWorkspace ?? "",
        id: "Q-SMOKE-EXPLICIT",
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
      exactExplicitSettingsSmokePrompt(),
      {
        bridge: queueBridge({
          createItem,
          getRunSettingsDefaults: () => null,
          runAutonomousQueue,
        }),
      },
    );

    expect(result.handled).toBe(true);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:\\Users\\Dmitry\\Documents\\prj\\Hobit_fixed",
        sandbox: "danger_full_access",
        status: "queued",
        title: "Smoke read AGENTS first line",
      }),
    );
    const request = createItem.mock.calls[0]?.[0];
    expect(request?.prompt).toContain("Run only:");
    expect(request?.prompt).toContain(
      "Get-Content .\\AGENTS.md -TotalCount 1",
    );
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Created 1 Queue item and started Autonomous Queue.",
    );
  });

  it("shows a clear local missing-workspace error when no prompt-through fallback exists", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue"),
    );

    const result = await runWorkspaceAgentQueueCommand(exactSmokePrompt(), {
      bridge: queueBridge({
        createItem,
        getRunSettingsDefaults: () => null,
        runAutonomousQueue,
      }),
      currentWorkspaceRoot: "~",
    });

    expect(result.handled).toBe(true);
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(result.body).toContain(
      "Queue action failed: task workspace is missing. No Queue items were created or run.",
    );
    expect(result.body).toContain("Workspace:");
    expect(result.body).toContain("C:\\path\\to\\project");
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

function exactSmokePrompt() {
  return [
    "Use Agent Queue only. Do not execute directly.",
    "",
    "Run this prompt through Queue:",
    "",
    "Title:",
    "Smoke read AGENTS first line",
    "",
    "Prompt:",
    "Run only:",
    "",
    "Get-Content .\\AGENTS.md -TotalCount 1",
    "",
    "Do not edit files.",
    "Do not create files.",
    "Do not delete files.",
    "Do not commit.",
    "Do not push.",
    "Do not reset, clean, stash, checkout, rebase, merge, or force anything.",
    "",
    "Report:",
    "- AGENTS.md first line",
    "- confirmation that no files were changed",
    "- git status --short --branch output",
  ].join("\n");
}

function exactExplicitSettingsSmokePrompt() {
  return [
    "Use Agent Queue only. Do not execute directly.",
    "",
    "Run this prompt through Queue with task-scoped run settings:",
    "",
    "Workspace:",
    "C:\\Users\\Dmitry\\Documents\\prj\\Hobit_fixed",
    "",
    "Codex executable:",
    "codex.cmd",
    "",
    "Sandbox:",
    "danger_full_access",
    "",
    "Approval:",
    "never",
    "",
    "Title:",
    "Smoke read AGENTS first line",
    "",
    "Prompt:",
    "Run only:",
    "",
    "Get-Content .\\AGENTS.md -TotalCount 1",
    "",
    "Do not edit files.",
    "Do not create files.",
    "Do not delete files.",
    "Do not commit.",
    "Do not push.",
    "Do not reset, clean, stash, checkout, rebase, merge, or force anything.",
    "",
    "Report:",
    "- AGENTS.md first line",
    "- confirmation that no files were changed",
    "- git status --short --branch output",
  ].join("\n");
}
