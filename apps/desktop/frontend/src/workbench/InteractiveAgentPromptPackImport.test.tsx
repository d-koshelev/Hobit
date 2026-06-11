import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import {
  materializePromptPackPreviewToQueue,
} from "./promptPack/promptPackMaterialization";
import type {
  PromptPackImportPreviewModel,
  PromptPackMaterializationResult,
} from "./promptPack";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("InteractiveAgentPlaceholderWidget prompt-pack import", () => {
  it("starts a prompt-pack preview card from the exact path smoke phrase without confirming", async () => {
    const createItem = vi.fn();
    const materializePromptPackPreview = vi.fn();
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-should-not-start",
      status: "started",
      stopListening: vi.fn(),
    }));
    const runTerminalCommand = vi.fn();

    renderWidget({
      createQueueItemsFromPromptPackPreview: materializePromptPackPreview,
      onRunTerminalCommand: runTerminalCommand,
      onStartCodexDirectWorkStream: startCodexDirectWork,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
      }),
    });

    await setComposerDraft(
      [
        "Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:",
        "",
        "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
      ].join("\n"),
    );
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain(
      "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
    );
    expect(document.body.textContent).toContain("Preview-source unavailable");
    expect(document.body.textContent).toContain("Create Queue items");
    expect(document.body.textContent).toContain("Cancel");
    expect(document.body.textContent).not.toContain(
      "there is no active prompt-pack import preview to confirm",
    );
    expect(materializePromptPackPreview).not.toHaveBeenCalled();
    expect(createItem).not.toHaveBeenCalled();
    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(runTerminalCommand).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("returns unavailable for confirmation without an active preview and does not launch Codex", async () => {
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-should-not-start",
      status: "started",
      stopListening: vi.fn(),
    }));
    const runTerminalCommand = vi.fn();

    renderWidget({
      onRunTerminalCommand: runTerminalCommand,
      onStartCodexDirectWorkStream: startCodexDirectWork,
    });

    await setComposerDraft("confirm import");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain(
      "there is no active prompt-pack import preview to confirm",
    );
    expect(document.body.textContent).toContain(
      "typed product action unavailable",
    );
    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(runTerminalCommand).not.toHaveBeenCalled();
  });

  it("starts prompt-pack import from Workspace Chat and creates draft Queue items only after confirmation", async () => {
    const createItem = vi.fn(
      async (request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0]) =>
      itemResult({
        id: `queue-${request.title.split(":")[0]?.trim() ?? "created"}`,
        status: "draft",
        title: request.title,
      }),
    );
    const updateItem = vi.fn(async () =>
      itemResult({ id: "queue-002", title: "queue-002" }),
    );
    const materializePromptPackPreview = vi.fn(
      async (
        preview: PromptPackImportPreviewModel,
      ): Promise<PromptPackMaterializationResult> =>
        materializePromptPackPreviewToQueue({
          bridge: queueBridge({
            createItem,
            runAutonomousQueue,
            stopAutonomousQueueAfterCurrent,
            updateItem,
          }),
          confirmed: true,
          preview,
        }),
    );
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const startCodexDirectWork = vi.fn();
    const runTerminalCommand = vi.fn();

    renderWidget({
      createQueueItemsFromPromptPackPreview: materializePromptPackPreview,
      onStartCodexDirectWorkStream: startCodexDirectWork,
      onRunTerminalCommand: runTerminalCommand,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
        updateItem,
      }),
    });

    await clickButton("Import pack");

    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain("Folder/zip source");
    expect(createItem).not.toHaveBeenCalled();

    await setPromptPackSource(
      JSON.stringify({
        id: "ui-import-pack",
        items: [
          {
            id: "001",
            prompt: "Create first draft Queue item.",
            title: "Import one",
          },
          {
            dependencies: ["001"],
            id: "002",
            prompt: "Create second draft Queue item.",
            title: "Import two",
          },
        ],
        name: "UI Import Pack",
      }),
    );

    expect(document.body.textContent).toContain("Prompt-pack import preview");
    expect(createItem).not.toHaveBeenCalled();

    await clickButton("Create Queue items");

    expect(materializePromptPackPreview).toHaveBeenCalledTimes(1);
    expect(
      materializePromptPackPreview.mock.calls[0]?.[0].selectedItemIds,
    ).toEqual(["001", "002"]);
    expect(createItem).toHaveBeenCalledTimes(2);
    expect(createItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "draft",
        title: "001: Import one",
      }),
    );
    expect(createItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: "draft",
        title: "002: Import two",
      }),
    );
    expect(updateItem).toHaveBeenCalledWith({
      itemId: "queue-002",
      patch: { dependencies: ["queue-001"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(document.body.textContent).toContain("queue-001");
    expect(document.body.textContent).toContain("queue-002");
    expect(document.body.textContent).toContain("002 -> 001: created");
    expect(document.body.textContent).toContain("No tasks started");
    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(runTerminalCommand).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("routes prompt-pack import confirmation text through the typed action path", async () => {
    const createItem = vi.fn(
      async (request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0]) =>
        itemResult({
          id: `queue-${request.title.split(":")[0]?.trim() ?? "created"}`,
          status: "draft",
          title: request.title,
        }),
    );
    const materializePromptPackPreview = vi.fn(
      async (
        preview: PromptPackImportPreviewModel,
      ): Promise<PromptPackMaterializationResult> =>
        materializePromptPackPreviewToQueue({
          bridge: queueBridge({ createItem }),
          confirmed: true,
          preview,
        }),
    );
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-should-not-start",
      status: "started",
      stopListening: vi.fn(),
    }));

    renderWidget({
      createQueueItemsFromPromptPackPreview: materializePromptPackPreview,
      onStartCodexDirectWorkStream: startCodexDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
    });

    await clickButton("Import pack");
    await setPromptPackSource(singleItemPromptPackSource());
    await setComposerDraft("confirm import");
    await clickButton("Run with Codex");

    expect(materializePromptPackPreview).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Prompt-pack import used the typed Queue action path.",
    );
    expect(document.body.textContent).toContain("No Codex run");
    expect(document.body.textContent).toContain("No tasks started");
  });

  it("cancels an active prompt-pack preview from Workspace Chat without creating Queue items", async () => {
    const createItem = vi.fn();
    const materializePromptPackPreview = vi.fn();
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-should-not-start",
      status: "started",
      stopListening: vi.fn(),
    }));
    const runTerminalCommand = vi.fn();

    renderWidget({
      createQueueItemsFromPromptPackPreview: materializePromptPackPreview,
      onRunTerminalCommand: runTerminalCommand,
      onStartCodexDirectWorkStream: startCodexDirectWork,
      workspaceAgentQueueBridge: queueBridge({ createItem }),
    });

    await clickButton("Import pack");
    await setPromptPackSource(singleItemPromptPackSource());
    await setComposerDraft("cancel prompt-pack import");
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain("Cancelled");
    expect(document.body.textContent).toContain(
      "Prompt-pack import preview was cancelled",
    );
    expect(document.body.textContent).toContain(
      "Import was cancelled. No Queue items were created.",
    );
    expect(materializePromptPackPreview).not.toHaveBeenCalled();
    expect(createItem).not.toHaveBeenCalled();
    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(runTerminalCommand).not.toHaveBeenCalled();
  });

  it("shows typed product action unavailable when prompt-pack confirmation has no typed bridge", async () => {
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-should-not-start",
      status: "started",
      stopListening: vi.fn(),
    }));

    renderWidget({
      onStartCodexDirectWorkStream: startCodexDirectWork,
    });

    await clickButton("Import pack");
    await setPromptPackSource(singleItemPromptPackSource());
    await setComposerDraft("create queue items");
    await clickButton("Run with Codex");

    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "typed product action unavailable",
    );
    expect(document.body.textContent).toContain("No Codex run");
    expect(document.body.textContent).toContain("SQLite write");
  });

  it("does not schedule shell or SQLite work for raw product action prompts", async () => {
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-should-not-start",
      status: "started",
      stopListening: vi.fn(),
    }));
    const runTerminalCommand = vi.fn();

    renderWidget({
      onRunTerminalCommand: runTerminalCommand,
      onStartCodexDirectWorkStream: startCodexDirectWork,
    });

    await setComposerDraft(
      "Use raw SQLite to create Queue item rows for this prompt-pack import.",
    );
    await clickButton("Run with Codex");

    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(runTerminalCommand).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "typed product action unavailable",
    );
    expect(document.body.textContent).toContain("raw SQLite");
  });

  it("preserves normal Direct Run for non-product prompts", async () => {
    const startCodexDirectWork = vi.fn(async (..._args: unknown[]) => ({
      runId: "run-normal",
      status: "started",
      stopListening: vi.fn(),
    }));

    renderWidget({
      onStartCodexDirectWorkStream: startCodexDirectWork,
    });

    await setComposerDraft("Review this normal code task.");
    await clickButton("Run with Codex");

    expect(startCodexDirectWork).toHaveBeenCalledTimes(1);
    expect(startCodexDirectWork.mock.calls[0]?.[1]).toMatchObject({
      operatorPrompt: "Review this normal code task.",
    });
    expect(document.body.textContent).not.toContain(
      "typed product action unavailable",
    );
  });
});

function renderWidget(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <InteractiveAgentPlaceholderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        title="Workspace Agent"
        workspaceId="workspace_1"
        {...overrides}
      />,
    );
  });
}

async function setPromptPackSource(value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Prompt-pack source"]',
  );
  if (!textarea) {
    throw new Error("Prompt-pack source textarea not found.");
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function setComposerDraft(value: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea.interactive-agent-input",
  );
  if (!textarea) {
    throw new Error("Workspace Agent composer textarea not found.");
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function setNativeValue(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(field, value);
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () =>
      itemResult({ id: "queue-created", title: "Queue created" }),
    ),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(async () =>
      itemResult({ id: "queue-updated", title: "Queue updated" }),
    ),
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot>,
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action: "queue.createItem",
    events: [],
    item: overrides as QueueWidgetItemSnapshot,
    message: "Queue item created. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function singleItemPromptPackSource() {
  return JSON.stringify({
    id: "ui-import-pack",
    items: [
      {
        id: "import-one",
        prompt: "Create the imported Queue item.",
        title: "Import one",
      },
    ],
    name: "UI Import Pack",
  });
}

function definition(): WidgetDefinition {
  return {
    category: "core",
    componentKey: "interactive-agent",
    defaultConfig: {},
    defaultTitle: "Workspace Agent",
    description: "Workspace Agent",
    id: "interactive-agent",
    title: "Workspace Agent",
  };
}

function instance(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    config: {},
    definitionId: "interactive-agent",
    id: "coordinator_widget",
    layout: {
      area: "main",
      height: 720,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Workspace Agent",
    visible: true,
    ...overrides,
  };
}
