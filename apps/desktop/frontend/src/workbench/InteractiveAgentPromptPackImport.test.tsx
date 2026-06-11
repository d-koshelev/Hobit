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
