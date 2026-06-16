import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  directWorkEvent,
  lastAssistantMessageText,
  lastOperatorMessageText,
  renderWidget,
  setTextareaValue,
  type DirectWorkStreamEvent,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
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
    expect(lastAssistantMessageText()).toBe(
      "Queue items created. Created 1 Queue item.",
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
    expect(lastAssistantMessageText()).toBe(
      "Queue items preview prepared. Would create 1 Queue item.",
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
        confirmationToken: "operator-confirmed",
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

  it("leaves normal assistant text as a normal transcript message", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      "Normal assistant response without app action.",
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

  it("does not route user Queue phrases unless the agent emits an envelope", async () => {
    const createItem = vi.fn();
    const startDirectWork = startDirectWorkWithFinalText(
      "I can help plan those Queue items.",
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
      '"prompt":"Review the current workspace state and report one safe next step."',
    );
    expect(operatorPrompt).not.toContain('"input":{}');
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
  requestId = "request-action",
}: {
  capabilityId: string;
  confirmationToken?: string;
  dryRun: boolean;
  input: unknown;
  requestId?: string;
}) {
  return JSON.stringify({
    capabilityId,
    confirmationToken,
    dryRun,
    input,
    requestId,
    type: "hobit.action.request",
  });
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
          runId: "run_action_request",
          text,
        }),
      );
      onEvent(
        directWorkEvent({
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

async function runDirectWork(prompt: string) {
  await setTextareaValue(prompt);
  await clickButton("Run with Codex");
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
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

function snapshotResult(): QueueWidgetActionResult<QueueWidgetSnapshot> {
  return {
    action: "queue.getSnapshot",
    events: [],
    message: "Queue snapshot returned.",
    ok: true,
    safetyClass: "safe_read",
    snapshot: {
      items: [],
      queueId: "workspace:workspace_1:agent-queue",
      widgetType: "agent-queue",
      workspaceId: "workspace_1",
    } as unknown as QueueWidgetSnapshot,
  };
}
