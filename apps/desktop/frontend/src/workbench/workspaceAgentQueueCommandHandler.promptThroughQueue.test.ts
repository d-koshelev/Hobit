import { describe, expect, it, vi } from "vitest";

import { runWorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandHandler";
import {
  autonomousResult,
  itemResult,
  multiTaskQueueOnlyCommand,
  queueBridge,
} from "./workspaceAgentQueueCommandHandler.testHelpers";

describe("workspaceAgentQueueCommandHandler prompt-through-Queue routing", () => {
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
});
