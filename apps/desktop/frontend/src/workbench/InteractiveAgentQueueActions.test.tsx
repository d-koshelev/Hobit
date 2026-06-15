import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { GenerateCoordinatorProviderResponse } from "../workspace/types";
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
  it("does not render Queue admin tools in the primary Workspace Agent surface", () => {
    renderWidget({ workspaceAgentQueueBridge: queueBridge() });

    const queueActions = document.querySelector<HTMLDetailsElement>(
      'details[aria-label="Workspace Agent Queue actions"]',
    );

    expect(queueActions).toBeNull();
    expect(document.body.textContent).not.toContain("Queue tools");
    expect(document.body.textContent).not.toContain("Agent Queue API");
    expect(document.body.textContent).not.toContain("Inspect Queue");
  });

  it("keeps non-Queue chat on the provider path", async () => {
    const provider = vi.fn(async () =>
      providerResponse({ assistantText: "Provider handled ordinary chat." }),
    );
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const runAutonomousQueue = vi.fn(async () => ({
      action: "queue.runAutonomousQueue" as const,
      message: "Autonomous Queue started.",
      ok: true,
      status: "running",
    }));

    renderWidget({
      onGenerateCoordinatorProviderResponse: provider,
      workspaceAgentQueueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
      }),
    });

    await sendWorkspaceAgentMessage("Explain the current frontend architecture.");

    expect(provider).toHaveBeenCalledTimes(1);
    expect(createItem).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Provider handled ordinary chat.",
    );
  });

  it("creates a Queue task from a Workspace Agent proposal through the typed bridge only after explicit create", async () => {
    const createItem = vi.fn(
      async (request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0]) =>
        itemResult("queue.createItem", {
          executionPolicy: request.executionPolicy,
          id: "queue-proposal-created",
          priority: request.priority,
          prompt: request.prompt,
          status: request.status,
          title: request.title,
        }),
    );
    const legacyCreate = vi.fn();
    const openQueueItem = vi.fn();
    const runAutonomousQueue = vi.fn();
    const bridge = queueBridge({ createItem, runAutonomousQueue });

    renderWidget({
      onCreateAgentQueueTask: legacyCreate,
      onOpenAgentQueueItem: openQueueItem,
      workspaceAgentQueueBridge: bridge,
    });

    await sendWorkspaceAgentMessage(
      [
        "Break this into Queue tasks from visible text only.",
        "- Visible task using only chat",
      ].join("\n"),
    );

    expect(document.body.textContent).toContain("Draft Queue task");
    expect(buttonWithText("Create Queue task")).toBeUndefined();
    expect(createItem).not.toHaveBeenCalled();

    await clickButton("Approve");

    expect(buttonWithText("Create Queue task")).toBeDefined();
    expect(createItem).not.toHaveBeenCalled();

    await clickButton("Create Queue task");

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Drafted from visible Workspace Agent chat: Visible task using only chat",
        executionPolicy: "manual",
        priority: 0,
        prompt: [
          "Visible task using only chat",
          "",
          "Use only the task prompt and explicit operator-provided context. Do not run hidden tools, mutate Git, or assume hidden Workspace context.",
        ].join("\n"),
        status: "draft",
        title: "Visible task using only chat",
      }),
    );
    expect(legacyCreate).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Created Queue task");
    expect(document.body.textContent).toContain("queue-proposal-created");
    expect(document.body.textContent).toContain("Created, not started");
    expect(document.body.textContent).toContain("lane/status draft");

    await clickButton("Open task");

    expect(openQueueItem).toHaveBeenCalledWith("queue-proposal-created");
  });

  it("rejects an empty Workspace Agent Queue proposal prompt without creating a task", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const bridge = queueBridge({ createItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      [
        "Break this into Queue tasks from visible text only.",
        "- Visible task using only chat",
      ].join("\n"),
    );
    await clickButton("Approve");
    await clickButton("Edit");
    await setProposalInputValue("Prompt", "   ");
    await clickButton("Save changes");
    await clickButton("Approve");
    await clickButton("Create Queue task");

    expect(createItem).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Queue task prompt is required. No Queue task was created.",
    );
  });

  it("renders a create Queue intent draft from visible Workspace Agent text", async () => {
    renderWidget({ workspaceAgentQueueBridge: queueBridge() });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        prompt: "Implement the Queue API prefill card.",
        queueTag: "QUEUE-API",
        status: "draft",
        title: "Draft create intent",
        type: "createItem",
      }),
    );

    expect(document.body.textContent).toContain("Draft Queue item");
    expect(document.body.textContent).toContain("queue.createItem");
    expect(document.body.textContent).toContain("Draft create intent");
    expect(document.body.textContent).toContain("QUEUE-API");
    expect(document.body.textContent).toContain(
      "Implement the Queue API prefill card.",
    );
  });

  it("applies a create Queue intent draft through the Queue bridge", async () => {
    const createItem = vi.fn(async () =>
      itemResult("queue.createItem", {
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        id: "queue-created-from-intent",
        priority: 3,
        prompt: "Create the reviewed Queue task.",
        queueTag: { id: null, name: "prefill" },
        sandbox: "workspace_write",
        status: "queued",
        title: "Create intent task",
      }),
    );
    const bridge = queueBridge({ createItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        priority: 3,
        prompt: "Create the reviewed Queue task.",
        queueTag: "prefill",
        sandbox: "workspace_write",
        status: "queued",
        title: "Create intent task",
        type: "createItem",
      }),
    );
    await clickButton("Apply create");

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        priority: 3,
        prompt: "Create the reviewed Queue task.",
        queueTag: { name: "prefill" },
        sandbox: "workspace_write",
        status: "queued",
        title: "Create intent task",
      }),
    );
    expect(document.body.textContent).toContain("Queue item created");
    expect(document.body.textContent).toContain("queue-created-from-intent");
  });

  it("renders an update Queue intent draft from visible Workspace Agent text", async () => {
    renderWidget({ workspaceAgentQueueBridge: queueBridge() });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        itemId: "queue-target",
        priority: 5,
        prompt: "Update the stored task prompt.",
        status: "queued",
        title: "Updated title draft",
        type: "updateItem",
      }),
    );

    expect(document.body.textContent).toContain("Draft Queue update");
    expect(document.body.textContent).toContain("queue.updateItem");
    expect(document.body.textContent).toContain("queue-target");
    expect(document.body.textContent).toContain("Updated title draft");
    expect(document.body.textContent).toContain("Update the stored task prompt.");
  });

  it("applies an update Queue intent draft through the Queue bridge", async () => {
    const updateItem = vi.fn(async () =>
      itemResult("queue.updateItem", {
        id: "queue-target",
        priority: 5,
        status: "queued",
        title: "Updated title draft",
      }),
    );
    const bridge = queueBridge({ updateItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        itemId: "queue-target",
        priority: 5,
        prompt: "Update the stored task prompt.",
        status: "queued",
        title: "Updated title draft",
        type: "updateItem",
      }),
    );
    await clickButton("Apply update");

    expect(updateItem).toHaveBeenCalledWith({
      itemId: "queue-target",
      patch: {
        priority: 5,
        prompt: "Update the stored task prompt.",
        status: "queued",
        title: "Updated title draft",
      },
    });
    expect(document.body.textContent).toContain("Queue item updated");
  });

  it("blocks create Queue intent apply when title or prompt is missing", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const bridge = queueBridge({ createItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        description: "Missing create title and prompt.",
        type: "createItem",
      }),
    );

    expect(document.body.textContent).toContain(
      "Missing required fields: title, prompt.",
    );
    expect(buttonWithText("Apply create")?.disabled).toBe(true);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("shows missing run settings before applying a queued create Queue intent", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const bridge = queueBridge({ createItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        prompt: "Queued work needs explicit run settings.",
        status: "queued",
        title: "Queued draft without settings",
        type: "createItem",
      }),
    );

    expect(document.body.textContent).toContain(
      "Queued drafts need run settings before apply: execution workspace, Codex executable, sandbox, approval policy.",
    );
    expect(document.body.textContent).toContain("Task workspace");
    expect(document.body.textContent).toContain("Codex executable");
    expect(document.body.textContent).toContain("Sandbox");
    expect(document.body.textContent).toContain("Approval policy");
    expect(buttonWithText("Apply create")?.disabled).toBe(true);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("blocks update Queue intent apply when no fields are changed", async () => {
    const updateItem = vi.fn(async () => itemResult("queue.updateItem"));
    const bridge = queueBridge({ updateItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        itemId: "queue-target",
        type: "updateItem",
      }),
    );

    expect(document.body.textContent).toContain(
      "At least one field must be changed before apply.",
    );
    expect(buttonWithText("Apply update")?.disabled).toBe(true);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("discards a Queue intent draft without applying it", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const bridge = queueBridge({ createItem });

    renderWidget({ workspaceAgentQueueBridge: bridge });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        prompt: "Discard this visible draft.",
        title: "Discarded Queue draft",
        type: "createItem",
      }),
    );

    expect(document.body.textContent).toContain("Discarded Queue draft");

    await clickButton("Discard draft");

    expect(document.querySelector('[aria-label="Draft Queue item"]')).toBeNull();
    expect(createItem).not.toHaveBeenCalled();
  });

  it("does not use shell or legacy Queue callbacks when applying Queue intent drafts", async () => {
    const createItem = vi.fn(async () => itemResult("queue.createItem"));
    const legacyCreate = vi.fn();
    const legacyUpdate = vi.fn();
    const runTerminal = vi.fn();
    const bridge = queueBridge({ createItem });

    renderWidget({
      onCreateAgentQueueTask: legacyCreate,
      onRunTerminalCommand: runTerminal,
      onUpdateAgentQueueTask: legacyUpdate,
      workspaceAgentQueueBridge: bridge,
    });

    await sendWorkspaceAgentMessage(
      queueIntentBlock({
        prompt: "Apply through Queue bridge only.",
        title: "Bridge-only Queue draft",
        type: "createItem",
      }),
    );
    await clickButton("Apply create");

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(legacyCreate).not.toHaveBeenCalled();
    expect(legacyUpdate).not.toHaveBeenCalled();
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

async function sendWorkspaceAgentMessage(message: string, buttonText = "Send") {
  const composer = document.querySelector<HTMLTextAreaElement>(
    ".interactive-agent-input",
  );
  if (!composer) {
    throw new Error("Workspace Agent composer not found.");
  }

  await act(async () => {
    setNativeValue(composer, message);
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });

  await clickButton(buttonText);
}

async function setProposalInputValue(labelText: string, value: string) {
  const label = Array.from(
    document.querySelectorAll<HTMLLabelElement>(
      ".coordinator-proposal-label",
    ),
  ).find(
    (candidate) =>
      candidate.childNodes[0]?.textContent?.trim() === labelText,
  );
  const field = label?.querySelector<HTMLTextAreaElement>("textarea");
  if (!field) {
    throw new Error(`Proposal input not found: ${labelText}`);
  }

  await act(async () => {
    setNativeValue(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

function queueIntentBlock(intent: Record<string, unknown>) {
  return [
    "Please prepare this Queue intent for review.",
    "```hobit-queue-intent",
    JSON.stringify(intent),
    "```",
  ].join("\n");
}

function providerResponse(
  overrides: Partial<GenerateCoordinatorProviderResponse> = {},
): GenerateCoordinatorProviderResponse {
  return {
    allowedTools: [],
    assistantText: "Provider answer.",
    noHiddenContextUsed: true,
    noMutationsPerformed: true,
    noToolsExecuted: true,
    proposalDrafts: [],
    providerError: null,
    providerKind: "mock-local",
    providerStatus: "completed",
    requestId: "provider-test-request",
    visibleContextMessageCount: 1,
    visibleProposalDraftCount: 0,
    ...overrides,
  };
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult("queue.createItem")),
    getRunSettingsDefaults: vi.fn(() => ({
      approvalPolicy: "never" as const,
      codexExecutable: "codex.cmd",
      executionWorkspace: "C:/repo",
      sandbox: "danger_full_access" as const,
    })),
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
