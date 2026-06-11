import { act, type ReactElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../queue/agentQueueWidgetApiTypes";
import {
  WorkspaceAgentPromptPackImportCard,
  type CreateQueueItemsFromPromptPackPreview,
  type WorkspaceAgentPromptPackImportState,
} from "./WorkspaceAgentPromptPackImportCard";
import { materializePromptPackPreviewToQueue } from "./promptPackMaterialization";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  container = null;
  root = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("WorkspaceAgentPromptPackImportCard", () => {
  it("renders the import action card with explicit folder/file preview controls", () => {
    const bridge = queueBridge();

    render(<PromptPackImportHarness bridge={bridge} />);

    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain("Folder/file source");
    expect(document.body.textContent).toContain("Zip source");
    expect(document.body.textContent).toContain("Read source preview");
    expect(document.body.textContent).toContain("Prompt-pack preview unavailable");
    expect(bridge.createItem).not.toHaveBeenCalled();
  });

  it("reads an exact path source into preview entries and keeps Queue creation explicit", async () => {
    const bridge = queueBridge();
    const readPromptPackSource = vi.fn(async () => [
      {
        path: "README.md",
        source: "desktop-prompt-pack",
        text: "# UI Import Pack",
      },
      {
        path: "prompt-batch.json",
        source: "desktop-prompt-pack",
        text: JSON.stringify({
          dependency_policy: "explicit",
          id: "ui-import-pack",
          items: [
            { id: "001", path: "001.md", title: "One" },
            {
              dependencies: ["001"],
              id: "002",
              path: "002.md",
              title: "Two",
            },
          ],
          name: "UI Import Pack",
        }),
      },
      {
        path: "001.md",
        source: "desktop-prompt-pack",
        text: "# One\n\nFirst source body.",
      },
      {
        path: "002.md",
        source: "desktop-prompt-pack",
        text: "# Two\n\nSecond source body.",
      },
    ]);

    render(
      <PromptPackImportHarness
        bridge={bridge}
        initialState={{
          id: "import-1",
          sourcePath:
            "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
          sourceText: "",
        }}
        onReadPromptPackSource={readPromptPackSource}
      />,
    );

    await clickButton("Read source preview");

    expect(readPromptPackSource).toHaveBeenCalledWith({
      path: "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
    });
    expect(document.body.textContent).toContain("Prompt-pack import preview");
    expect(document.body.textContent).toContain("001: One");
    expect(document.body.textContent).toContain("002: Two");
    expect(document.body.textContent).toContain("002: Depends on 001");
    expect(buttonWithText("Create Queue items")?.hasAttribute("disabled")).toBe(
      false,
    );
    expect(bridge.createItem).not.toHaveBeenCalled();
  });

  it("shows a visible path-source read error and keeps create disabled", async () => {
    const bridge = queueBridge();
    const readPromptPackSource = vi.fn(async () => {
      throw new Error("Prompt-pack source path could not be read.");
    });

    render(
      <PromptPackImportHarness
        bridge={bridge}
        initialState={{
          id: "import-1",
          sourcePath:
            "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
          sourceText: "",
        }}
        onReadPromptPackSource={readPromptPackSource}
      />,
    );

    await clickButton("Read source preview");

    expect(document.body.textContent).toContain("Preview-source unavailable");
    expect(document.body.textContent).toContain(
      "Prompt-pack source path could not be read.",
    );
    expect(document.body.textContent).toContain(
      "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
    );
    expect(buttonWithText("Create Queue items")?.hasAttribute("disabled")).toBe(
      true,
    );

    await clickButtonIfPresent("Create Queue items");

    expect(bridge.createItem).not.toHaveBeenCalled();
  });


  it("shows preview before creation and confirms Queue materialization once", async () => {
    const bridge = queueBridge();

    render(<PromptPackImportHarness bridge={bridge} />);

    await setPromptPackSource(singleItemPack());

    expect(document.body.textContent).toContain("Prompt-pack import preview");
    expect(document.body.textContent).toContain("UI Import Pack");
    expect(bridge.createItem).not.toHaveBeenCalled();

    await clickButton("Create Queue items");
    await clickButtonIfPresent("Create Queue items");

    expect(bridge.createItem).toHaveBeenCalledTimes(1);
    expect(bridge.updateItem).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Created Queue items");
    expect(document.body.textContent).toContain("queue-import-one");
  });

  it("does not create Queue tasks when the import is cancelled", async () => {
    const bridge = queueBridge();

    render(<PromptPackImportHarness bridge={bridge} />);
    await setPromptPackSource(singleItemPack());
    await clickButton("Cancel");

    expect(document.body.textContent).toContain("Cancelled");
    expect(document.body.textContent).toContain(
      "Import was cancelled. No Queue items were created.",
    );
    expect(buttonWithText("Create Queue items")).toBeUndefined();
    expect(bridge.createItem).not.toHaveBeenCalled();
  });

  it("renders disabled create when the Queue bridge is missing", async () => {
    render(<PromptPackImportHarness />);
    await setPromptPackSource(singleItemPack());

    expect(buttonWithText("Create Queue items")?.hasAttribute("disabled")).toBe(
      true,
    );
    expect(buttonWithText("Cancel")).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Workspace Agent prompt-pack Queue create action is unavailable",
    );
  });

  it("blocks create when preview errors are visible", async () => {
    const bridge = queueBridge();

    render(<PromptPackImportHarness bridge={bridge} />);
    await setPromptPackSource("{not json");

    expect(document.body.textContent).toContain("prompt-batch.json could not be parsed");
    expect(buttonWithText("Create Queue items")?.hasAttribute("disabled")).toBe(
      true,
    );
    expect(bridge.createItem).not.toHaveBeenCalled();
  });

  it("lists created tasks and exposes open and copy result actions", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
    const bridge = queueBridge();
    const onOpenQueueItem = vi.fn();
    const createQueueItemsFromPromptPackPreview = vi.fn(
      async (...args: Parameters<CreateQueueItemsFromPromptPackPreview>) =>
        materializePromptPackPreviewToQueue({
          bridge,
          confirmed: true,
          preview: args[0],
        }),
    );

    render(
      <PromptPackImportHarness
        createQueueItemsFromPromptPackPreview={
          createQueueItemsFromPromptPackPreview
        }
        onOpenQueueItem={onOpenQueueItem}
      />,
    );

    await setPromptPackSource(twoItemPack());
    await clickButton("Create Queue items");

    expect(createQueueItemsFromPromptPackPreview).toHaveBeenCalledTimes(1);
    expect(
      createQueueItemsFromPromptPackPreview.mock.calls[0]?.[0].selectedItemIds,
    ).toEqual(["first", "second"]);
    expect(document.body.textContent).toContain("first: First task");
    expect(document.body.textContent).toContain("second: Second task");
    expect(document.body.textContent).toContain("Created count");
    expect(document.body.textContent).toContain("No tasks started");
    expect(document.body.textContent).toContain("second -> first: created");
    expect(bridge.createItem).toHaveBeenCalledTimes(2);
    expect(bridge.updateItem).toHaveBeenCalledWith({
      itemId: "queue-second",
      patch: { dependencies: ["queue-first"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });

    await clickButton("Open Queue");
    await clickButton("Open created task");
    await clickButton("Copy import summary");

    expect(onOpenQueueItem).toHaveBeenCalledWith("queue-first");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("Created Queue items: 2"),
    );
    expect(document.body.textContent).toContain("Import summary copied.");
  });

  it("does not call Queue run or start controls during import", async () => {
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const bridge = queueBridge({
      runAutonomousQueue,
      stopAutonomousQueueAfterCurrent,
    });

    render(<PromptPackImportHarness bridge={bridge} />);
    await setPromptPackSource(singleItemPack());
    await clickButton("Create Queue items");

    expect(bridge.createItem).toHaveBeenCalledTimes(1);
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("shows a visible error when the typed create action fails", async () => {
    const createQueueItemsFromPromptPackPreview = vi.fn(async () => {
      throw new Error("typed bridge failed");
    });

    render(
      <PromptPackImportHarness
        createQueueItemsFromPromptPackPreview={
          createQueueItemsFromPromptPackPreview
        }
      />,
    );
    await setPromptPackSource(singleItemPack());
    await clickButton("Create Queue items");

    expect(createQueueItemsFromPromptPackPreview).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Failed");
    expect(document.body.textContent).toContain("typed bridge failed");
    expect(document.body.textContent).toContain("No Queue items were created.");
  });
});

function PromptPackImportHarness({
  bridge,
  createQueueItemsFromPromptPackPreview,
  initialState,
  onOpenQueueItem,
  onReadPromptPackSource,
}: {
  bridge?: WorkspaceAgentQueueBridge;
  createQueueItemsFromPromptPackPreview?: CreateQueueItemsFromPromptPackPreview;
  initialState?: WorkspaceAgentPromptPackImportState;
  onOpenQueueItem?: (queueItemId: string) => void;
  onReadPromptPackSource?: Parameters<
    typeof WorkspaceAgentPromptPackImportCard
  >[0]["onReadPromptPackSource"];
}) {
  const [importState, setImportState] =
    useState<WorkspaceAgentPromptPackImportState>(initialState ?? {
      id: "import-1",
      sourceText: "",
    });

  return (
    <WorkspaceAgentPromptPackImportCard
      createQueueItemsFromPromptPackPreview={
        createQueueItemsFromPromptPackPreview ??
        (bridge
          ? (preview) =>
              materializePromptPackPreviewToQueue({
                bridge,
                confirmed: true,
                preview,
              })
          : undefined)
      }
      importState={importState}
      onCancel={(importId) =>
        setImportState((current) =>
          current.id === importId ? { ...current, isCancelled: true } : current,
        )
      }
      onOpenQueueItem={onOpenQueueItem}
      onPatch={(importId, patch) =>
        setImportState((current) =>
          current.id === importId ? { ...current, ...patch } : current,
        )
      }
      onReadPromptPackSource={onReadPromptPackSource}
    />
  );
}

function render(element: ReactElement) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
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

async function clickButtonIfPresent(text: string) {
  const button = buttonWithText(text);
  if (!button) {
    return;
  }
  await act(async () => {
    button.click();
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
): WorkspaceAgentQueueBridge & {
  createItem: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
} {
  return {
    createItem: vi.fn(async (request) =>
      itemResult("queue.createItem", {
        id: `queue-${request.title.split(":")[0]?.trim() || "created"}`,
        title: request.title,
      }),
    ),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(async (request) =>
      itemResult("queue.updateItem", {
        id: request.itemId,
        title: request.itemId,
      }),
    ),
    ...overrides,
  } as WorkspaceAgentQueueBridge & {
    createItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
  };
}

function itemResult(
  action: "queue.createItem" | "queue.updateItem",
  item: Partial<QueueWidgetItemSnapshot>,
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action,
    events: [],
    item: item as QueueWidgetItemSnapshot,
    message: "Queue action completed. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function singleItemPack() {
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

function twoItemPack() {
  return JSON.stringify({
    dependencyPolicy: "explicit_only",
    id: "ui-import-pack",
    items: [
      {
        id: "first",
        prompt: "First prompt.",
        title: "First task",
      },
      {
        dependencies: ["first"],
        id: "second",
        prompt: "Second prompt.",
        title: "Second task",
      },
    ],
    name: "UI Import Pack",
  });
}
