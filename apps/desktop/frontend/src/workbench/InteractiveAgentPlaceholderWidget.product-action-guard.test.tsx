import { describe, expect, it, vi } from "vitest";

import {
  clickButton,
  providerResponse,
  renderWidget,
  setTextareaValue,
} from "./InteractiveAgentPlaceholderWidget.test-utils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

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

  it("does not route example Queue item creation through regex before explicit Codex", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run_explicit_codex",
      status: "started",
      stopListening: vi.fn(),
    }));
    const createItem = vi.fn();
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

    expect(createItem).not.toHaveBeenCalled();
    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(startDirectWork.mock.calls[0][1]).toMatchObject({
      operatorPrompt: expect.stringContaining(
        "User request:\nadd example queue items to queue",
      ),
    });
    expect(provider).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(readPromptPackSource).not.toHaveBeenCalled();
    expect(selectWorkspaceDirectory).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(publishActivityEvents).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "Queue intent detected" }),
      ]),
    );
    expect(document.body.textContent).not.toContain("Queue intent detected");
  });

  it("does not treat Queue creation phrases as an active regex decision layer", async () => {
    const provider = vi.fn(async () => providerResponse());
    const startDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run_explicit_codex",
      status: "started",
      stopListening: vi.fn(),
    }));
    const createItem = vi.fn();
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
    expect(startDirectWork).toHaveBeenCalledTimes(1);
    expect(provider).not.toHaveBeenCalled();
    expect(publishActivityEvents).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Queue intent detected");
    expect(document.body.textContent).not.toContain(
      "I need task content to create Queue items",
    );
  });
});

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(),
    ...overrides,
  } as WorkspaceAgentQueueBridge;
}
