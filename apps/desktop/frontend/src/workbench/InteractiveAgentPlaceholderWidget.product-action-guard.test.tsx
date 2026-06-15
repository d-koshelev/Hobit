import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  directWorkEvent,
  providerResponse,
  renderWidget,
  setTextareaValue,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import {
  itemResult,
  queueBridge,
} from "./workspaceAgentQueueCommandHandler.testHelpers";

describe("InteractiveAgentPlaceholderWidget product-action guard", () => {
  it("routes path-based prompt-pack import through preview instead of Codex", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();
    renderWidget({
      createQueueItemsFromPromptPackPreview,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue(
      [
        "Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:",
        "",
        "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
      ].join("\n"),
    );
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Prompt-pack import preview started from the requested path.",
    );
    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain(
      "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
    );
  });

  it("fails prompt-pack confirmation without an active preview before Codex starts", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();
    renderWidget({
      createQueueItemsFromPromptPackPreview,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue("confirm import");
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "there is no active prompt-pack import preview to confirm",
    );
    expect(document.body.textContent).toContain("No Codex run");
  });

  it("blocks raw SQLite or shell product-action requests before Codex starts", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn();
    renderWidget({
      createQueueItemsFromPromptPackPreview,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startDirectWork,
    });

    await setTextareaValue(
      "Use rg and node:sqlite to reverse engineer prompt-pack import storage and create Queue item rows.",
    );
    await clickButton("Run with Codex");

    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(createQueueItemsFromPromptPackPreview).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "typed product action unavailable",
    );
    expect(document.body.textContent).toContain(
      "raw SQLite, shell, or ad hoc storage mutation is not a product action connector",
    );
  });

  it("routes example Queue item creation through Agent Queue instead of Codex or shell", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn(
      async (
        _widgetInstanceId: string,
        _request: unknown,
        onEvent: (event: ReturnType<typeof directWorkEvent>) => void,
      ) => {
        onEvent(directWorkEvent({ eventKind: "started" }));
        return {
          runId: "run_unexpected",
          status: "started",
          stopListening: vi.fn(),
        };
      },
    );
    const createItem = vi.fn(async (request) =>
      itemResult("queue.createItem", {
        executionPolicy: request.executionPolicy,
        id: `Q-EXAMPLE-${createItem.mock.calls.length.toString()}`,
        prompt: request.prompt,
        queueTag: request.queueTag,
        status: request.status,
        title: request.title,
      }),
    );
    const runAutonomousQueue = vi.fn();
    const getSnapshot = vi.fn();
    const readPromptPackSource = vi.fn();
    const selectWorkspaceDirectory = vi.fn();
    const publishActivityEvents = vi.fn();

    renderWidget({
      currentWorkspaceRoot: "C:/repo",
      onGenerateCoordinatorProviderResponse: provider,
      onPublishAgentActivityEvents: publishActivityEvents,
      onReadPromptPackSource: readPromptPackSource,
      onSelectWorkspaceDirectory: selectWorkspaceDirectory,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        getSnapshot,
        runAutonomousQueue,
      }),
      workspaceId: "workspace_1",
    });

    await setTextareaValue("add example queue items to queue");
    await clickButton("Run with Codex");

    expect(createItem).toHaveBeenCalledTimes(2);
    expect(createItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        executionPolicy: "manual",
        queueTag: { name: "Examples" },
        status: "draft",
        title: "Example: review Queue intent routing",
      }),
    );
    expect(createItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        executionPolicy: "manual",
        queueTag: { name: "Examples" },
        status: "draft",
        title: "Example: verify Queue draft visibility",
      }),
    );
    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(readPromptPackSource).not.toHaveBeenCalled();
    expect(selectWorkspaceDirectory).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Queue intent detected");
    expect(document.body.textContent).toContain(
      "Queue item creation completed through Agent Queue",
    );
    expect(document.body.textContent).toContain(
      "Created 2 draft Queue items in Agent Queue",
    );
    expect(document.body.textContent).not.toContain("Get-ChildItem");
    expect(document.body.textContent).not.toContain("PowerShell");

    const publishedEvents = publishActivityEvents.mock.calls.flatMap(
      (call) => call[0],
    );
    expect(publishedEvents.map((event) => event.title)).toEqual([
      "Queue intent detected",
      "Queue creation request prepared",
      "Queue item creation completed",
    ]);
    expect(
      publishedEvents.some((event) => event.command || event.outputPreview),
    ).toBe(false);
  });

  it("asks for Queue task content in-app without starting Codex", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn();
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn();
    const publishActivityEvents = vi.fn();

    renderWidget({
      onGenerateCoordinatorProviderResponse: provider,
      onPublishAgentActivityEvents: publishActivityEvents,
      onStartCodexDirectWorkStream: startDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
      }),
      workspaceId: "workspace_1",
    });

    await setTextareaValue("break this into queue tasks");
    await clickButton("Run with Codex");

    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(startDirectWork).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Queue intent detected");
    expect(document.body.textContent).toContain(
      "I need task content to create Queue items",
    );
    expect(
      publishActivityEvents.mock.calls
        .flatMap((call) => call[0])
        .map((event) => event.title),
    ).toEqual([
      "Queue intent detected",
      "Queue creation request prepared",
      "Queue item creation needs input",
    ]);
  });
});
