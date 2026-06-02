import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemCounts,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";

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

describe("InteractiveAgentPlaceholderWidget Queue API actions", () => {
  it("renders the app-native Queue action surface when the bridge is present", () => {
    renderWidget({ workspaceAgentQueueBridge: queueBridge() });

    expect(document.body.textContent).toContain("Agent Queue API");
    expect(document.body.textContent).toContain("Inspect Queue");
    expect(document.body.textContent).toContain("Create Queue item");
    expect(document.body.textContent).toContain("Update Queue item");
    expect(document.body.textContent).toContain(
      "App-native Queue actions. No shell, Codex, or storage edits.",
    );
  });

  it("loads a Queue snapshot through the bridge and displays a snapshot result card", async () => {
    const snapshot = queueSnapshot({
      autonomousRunnerState: {
        activeItemId: null,
        available: true,
        isActive: false,
        isSessionOnly: true,
        status: "idle",
        stopReason: null,
        waitingRunId: null,
      },
      blockers: [
        {
          code: "missing_execution_workspace",
          itemId: "queue-blocked",
          message: "Execution workspace is not set.",
        },
      ],
      itemCounts: countsFixture({
        blocked: 1,
        finalized: 1,
        queued: 2,
        reportReady: 1,
        running: 1,
        total: 5,
      }),
      selectedItem: queueItemSnapshot({
        id: "queue-selected",
        status: "review_needed",
        title: "Selected Queue item",
      }),
    });
    snapshot.countsByStatus = snapshot.itemCounts;
    snapshot.blockersCount = snapshot.blockers.length;
    const getSnapshot = vi.fn(async () => snapshotResult(snapshot));
    const bridge = queueBridge({ getSnapshot });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await clickButton("Inspect Queue");

    expect(getSnapshot).toHaveBeenCalledWith({ includeSelectedItem: true });
    expect(document.body.textContent).toContain("Queue snapshot loaded");
    expect(document.body.textContent).toContain("queue.getSnapshot");
    expect(document.body.textContent).toContain(
      "Queue has 5 items: 2 queued, 1 running, 1 blocked, 1 report-ready, 1 finalized.",
    );
    expect(document.body.textContent).toContain("Selected Queue item");
    expect(document.body.textContent).toContain(
      "queue-blocked: Execution workspace is not set.",
    );
    expect(document.body.textContent).toContain("idle session-only");
  });

  it("creates a Queue item through the bridge and displays the created item result", async () => {
    const createItem = vi.fn(async () =>
      itemResult("queue.createItem", {
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        id: "queue-created",
        priority: 4,
        prompt: "Implement the focused slice.",
        queueTag: { id: null, name: "QUEUE-API" },
        sandbox: "workspace_write",
        status: "queued",
        title: "Create from Workspace Agent",
      }),
    );
    const legacyCreate = vi.fn();
    const provider = vi.fn();
    const startCodex = vi.fn();
    const bridge = queueBridge({ createItem });

    renderWidget({
      onCreateAgentQueueTask: legacyCreate,
      onGenerateCoordinatorProviderResponse: provider,
      onStartCodexDirectWorkStream: startCodex,
      workspaceAgentQueueBridge: bridge,
    });

    await setFieldValue("Title", "Create from Workspace Agent", 0);
    await setFieldValue("Prompt", "Implement the focused slice.", 0);
    await setFieldValue("Queue tag", "QUEUE-API", 0);
    await setFieldValue("Priority", "4", 0);
    await setSelectValue("Initial status", "queued");
    await setSelectValue("Execution policy", "auto", 0);
    await setFieldValue("Execution workspace", "C:/repo", 0);
    await setFieldValue("Codex executable", "codex.cmd", 0);
    await setSelectValue("Sandbox", "workspace_write", 0);
    await setSelectValue("Approval policy", "on_request", 0);
    await clickButton("Create Queue item");

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        priority: 4,
        prompt: "Implement the focused slice.",
        queueTag: { name: "QUEUE-API" },
        sandbox: "workspace_write",
        status: "queued",
        title: "Create from Workspace Agent",
      }),
    );
    expect(document.body.textContent).toContain("Queue item created");
    expect(document.body.textContent).toContain("queue.createItem");
    expect(document.body.textContent).toContain("queue-created");
    expect(document.body.textContent).toContain("Create from Workspace Agent");
    expect(legacyCreate).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(startCodex).not.toHaveBeenCalled();
  });

  it("updates a Queue item through the bridge and displays the updated item result", async () => {
    const updateItem = vi.fn(async () =>
      itemResult("queue.updateItem", {
        executionPolicy: "manual",
        id: "queue-updated",
        priority: 7,
        status: "queued",
        title: "Updated Queue item",
      }),
    );
    const legacyUpdate = vi.fn();
    const startCodex = vi.fn();
    const bridge = queueBridge({ updateItem });

    renderWidget({
      onStartCodexDirectWorkStream: startCodex,
      onUpdateAgentQueueTask: legacyUpdate,
      workspaceAgentQueueBridge: bridge,
    });

    await setFieldValue("Item id", "queue-updated");
    await setFieldValue("Title", "Updated Queue item", 1);
    await setFieldValue("Priority", "7", 1);
    await setSelectValue("Status", "queued");
    await clickButton("Update Queue item");

    expect(updateItem).toHaveBeenCalledWith({
      itemId: "queue-updated",
      patch: {
        priority: 7,
        status: "queued",
        title: "Updated Queue item",
      },
    });
    expect(document.body.textContent).toContain("Queue item updated");
    expect(document.body.textContent).toContain("queue.updateItem");
    expect(document.body.textContent).toContain("queue-updated");
    expect(document.body.textContent).toContain("Updated Queue item");
    expect(legacyUpdate).not.toHaveBeenCalled();
    expect(startCodex).not.toHaveBeenCalled();
  });

  it("displays a Queue action failed card when the bridge action fails", async () => {
    const getSnapshot = vi.fn(async () => {
      throw new Error("Queue bridge unavailable");
    });
    const bridge = queueBridge({ getSnapshot });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await clickButton("Inspect Queue");

    expect(document.body.textContent).toContain("Queue action failed");
    expect(document.body.textContent).toContain("queue.getSnapshot");
    expect(document.body.textContent).toContain("Queue bridge unavailable");
    expect(document.body.textContent).toContain("Failed");
  });

  it("does not use shell, Codex, provider, or legacy Queue callbacks for Queue CRUD", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const updateItem = vi.fn(async () => itemResult("queue.updateItem"));
    const legacyCreate = vi.fn();
    const legacyUpdate = vi.fn();
    const provider = vi.fn();
    const startCodex = vi.fn();
    const runTerminal = vi.fn();
    const bridge = queueBridge({ createItem, updateItem });

    renderWidget({
      onCreateAgentQueueTask: legacyCreate,
      onGenerateCoordinatorProviderResponse: provider,
      onRunTerminalCommand: runTerminal,
      onStartCodexDirectWorkStream: startCodex,
      onUpdateAgentQueueTask: legacyUpdate,
      workspaceAgentQueueBridge: bridge,
    });

    await setFieldValue("Title", "CRUD bridge task", 0);
    await clickButton("Create Queue item");
    await setFieldValue("Item id", "queue-1");
    await setFieldValue("Title", "CRUD bridge task update", 1);
    await clickButton("Update Queue item");

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(legacyCreate).not.toHaveBeenCalled();
    expect(legacyUpdate).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(startCodex).not.toHaveBeenCalled();
    expect(runTerminal).not.toHaveBeenCalled();
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

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function setFieldValue(label: string, value: string, index = 0) {
  const field = fieldsByLabel(label)[index];
  if (!field) {
    throw new Error(`Field not found: ${label}`);
  }

  await act(async () => {
    setNativeValue(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function setSelectValue(label: string, value: string, index = 0) {
  const select = selectsByLabel(label)[index];
  if (!select) {
    throw new Error(`Select not found: ${label}`);
  }

  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    );
    descriptor?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
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

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function fieldsByLabel(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      `input[aria-label="${label}"], textarea[aria-label="${label}"]`,
    ),
  );
}

function selectsByLabel(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLSelectElement>(`select[aria-label="${label}"]`),
  );
}

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

function queueSnapshot(
  overrides: Partial<QueueWidgetSnapshot> = {},
): QueueWidgetSnapshot {
  const counts = countsFixture();

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
    id: "queue-1",
    index: null,
    itemType: "implementation",
    order: null,
    priority: 0,
    prompt: "",
    queueId: "workspace:workspace_1:agent-queue",
    queueTag: {
      id: null,
      name: null,
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
