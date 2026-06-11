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
  type WorkspaceAgentPromptPackImportState,
} from "./WorkspaceAgentPromptPackImportCard";

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
  it("renders the import action card with unavailable folder and zip source state", () => {
    const bridge = queueBridge();

    render(<PromptPackImportHarness bridge={bridge} />);

    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain("Folder/zip source");
    expect(document.body.textContent).toContain(
      "No safe prompt-pack folder or zip reader is wired.",
    );
    expect(document.body.textContent).toContain("Prompt-pack preview unavailable");
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
      "Workspace Agent Queue bridge is unavailable",
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

    render(
      <PromptPackImportHarness
        bridge={bridge}
        onOpenQueueItem={onOpenQueueItem}
      />,
    );

    await setPromptPackSource(twoItemPack());
    await clickButton("Create Queue items");

    expect(document.body.textContent).toContain("first: First task");
    expect(document.body.textContent).toContain("second: Second task");
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
});

function PromptPackImportHarness({
  bridge,
  onOpenQueueItem,
}: {
  bridge?: WorkspaceAgentQueueBridge;
  onOpenQueueItem?: (queueItemId: string) => void;
}) {
  const [importState, setImportState] =
    useState<WorkspaceAgentPromptPackImportState>({
      id: "import-1",
      sourceText: "",
    });

  return (
    <WorkspaceAgentPromptPackImportCard
      bridge={bridge}
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
