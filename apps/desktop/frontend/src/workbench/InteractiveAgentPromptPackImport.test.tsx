import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { AgentQueueTask } from "../workspace/types";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import { selectQueueV2ViewModel } from "./queue/queueV2ViewModel";
import {
  materializePromptPackPreviewToQueue,
} from "./promptPack/promptPackMaterialization";
import type {
  PromptPackImportPreviewModel,
  PromptPackMaterializationResult,
} from "./promptPack";
import { selfDevelopmentSmokePromptPackEntries } from "./promptPack/selfDevelopmentSmokePromptPackFixture.test-fixtures";

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
  it("pins the real manual-smoke import route from exact phrase through typed Queue creation", async () => {
    const harness = createSelfDevelopmentQueueHarness();
    const materializePromptPackPreview = vi.fn(
      async (
        preview: PromptPackImportPreviewModel,
      ): Promise<PromptPackMaterializationResult> =>
        materializePromptPackPreviewToQueue({
          bridge: harness.bridge,
          confirmed: true,
          preview,
        }),
    );
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
      workspaceAgentQueueBridge: {
        ...harness.bridge,
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
      },
    });

    await setComposerDraft(exactManualSmokeImportPrompt());
    await clickButton("Run with Codex");

    expect(document.body.textContent).toContain("Import prompt pack");
    expect(document.body.textContent).toContain("Preview-source unavailable");
    expect(document.body.textContent).toContain("Create Queue items");
    expect(document.body.textContent).toContain("Cancel");
    expect(document.body.textContent).not.toContain(
      "there is no active prompt-pack import preview to confirm",
    );
    expect(materializePromptPackPreview).not.toHaveBeenCalled();
    expect(harness.createItem).not.toHaveBeenCalled();

    await setPromptPackSource(selfDevelopmentPromptPackInlineSource());

    expect(document.body.textContent).toContain("Prompt-pack import preview");
    expect(document.body.textContent).toContain("001-safe-docs-noop");
    expect(document.body.textContent).toContain("002-dependent-follow-up");
    expect(document.body.textContent).toContain("Create Queue items");
    expect(document.body.textContent).toContain("Cancel");

    await clickButton("Create Queue items");

    expect(materializePromptPackPreview).toHaveBeenCalledTimes(1);
    expect(harness.createItem).toHaveBeenCalledTimes(2);
    expect(harness.updateItem).toHaveBeenCalledWith({
      itemId: "queue-002-dependent-follow-up",
      patch: { dependencies: ["queue-001-safe-docs-noop"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(document.body.textContent).toContain("Created Queue items");
    expect(document.body.textContent).toContain("queue-001-safe-docs-noop");
    expect(document.body.textContent).toContain("queue-002-dependent-follow-up");
    expect(document.body.textContent).toContain(
      "002-dependent-follow-up -> 001-safe-docs-noop: created",
    );

    const viewModel = selectQueueV2ViewModel({
      selectedTaskId: "queue-002-dependent-follow-up",
      tasks: harness.tasks(),
      workers: [worker()],
    });
    const dependent = viewModel.tasks.find(
      (task) => task.taskId === "queue-002-dependent-follow-up",
    );

    expect(dependent?.boardLane).toBe("blocked");
    expect(dependent?.eligibility.eligibleNow).toBe(false);
    expect(dependent?.blockedReasons.map((reason) => reason.code)).toContain(
      "dependency_open",
    );
    expect(document.body.textContent).not.toContain("node:sqlite");
    expect(startCodexDirectWork).not.toHaveBeenCalled();
    expect(runTerminalCommand).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

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

function exactManualSmokeImportPrompt() {
  return [
    "Import this prompt pack into Queue, show preview first, do not create Queue items until I confirm:",
    "",
    "C:\\Users\\Dmitry\\Documents\\prj\\hobit-realistic-dogfooding-smoke-pack",
  ].join("\n");
}

function selfDevelopmentPromptPackInlineSource() {
  return JSON.stringify({
    dependency_policy: "explicit",
    items: [
      {
        allowed_scope: [
          "docs/SELF_DEVELOPMENT_READINESS_SMOKE_AUDIT.md",
          "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/**",
        ],
        dependencies: [],
        expected_commit_title: "docs: smoke no-op readiness note",
        forbidden_scope: [
          "apps/desktop/frontend/src/workbench/**/*.tsx",
          "apps/desktop/frontend/src/workbench/**/*.ts",
          "crates/**",
          "scripts/**",
          "Cargo.toml",
          "package.json",
          "package-lock.json",
        ],
        id: "001-safe-docs-noop",
        model_profile: "standard",
        path: "001-safe-docs-noop.md",
        prompt: fixtureText("001-safe-docs-noop.md"),
        reasoning_effort: "medium",
        tags: ["self-development", "smoke", "docs-only"],
        title: "docs: smoke no-op readiness note",
        validation_commands: [
          "git status --short --branch",
          "git diff --check",
        ],
        validator_profile: "standard",
      },
      {
        allowed_scope: [
          "docs/SELF_DEVELOPMENT_READINESS_SMOKE_AUDIT.md",
          "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/**",
        ],
        dependencies: ["001-safe-docs-noop"],
        expected_commit_title: "docs: verify dependent readiness gate",
        forbidden_scope: [
          "apps/desktop/frontend/src/workbench/**/*.tsx",
          "apps/desktop/frontend/src/workbench/**/*.ts",
          "crates/**",
          "scripts/**",
          "Cargo.toml",
          "package.json",
          "package-lock.json",
        ],
        id: "002-dependent-follow-up",
        model_profile: "standard",
        path: "002-dependent-follow-up.md",
        prompt: fixtureText("002-dependent-follow-up.md"),
        reasoning_effort: "medium",
        tags: ["self-development", "smoke", "dependency"],
        title: "docs: verify dependent readiness gate",
        validation_commands: [
          "git status --short --branch",
          "git diff --check",
        ],
        validator_profile: "standard",
      },
    ],
    name: "Hobit Self-Development Smoke",
    pack_id: "hobit-self-development-smoke",
  });
}

function fixtureText(path: string) {
  const entry = selfDevelopmentSmokePromptPackEntries.find((candidate) =>
    (candidate.path ?? "").endsWith(path),
  );
  if (!entry) {
    throw new Error(`Missing self-development prompt-pack fixture: ${path}`);
  }
  return entry.text;
}

function createSelfDevelopmentQueueHarness() {
  const taskMap = new Map<string, AgentQueueTask>();
  const createItem = vi.fn(async (
    request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0],
  ) => {
    const task = taskFromCreateRequest(request);
    taskMap.set(task.queueItemId, task);
    return itemResultFromTask(task);
  });
  const updateItem = vi.fn(async (
    request: Parameters<WorkspaceAgentQueueBridge["updateItem"]>[0],
  ) => {
    const current = taskMap.get(request.itemId);
    if (!current) {
      return missingQueueItemResult(request.itemId);
    }

    const updated = {
      ...current,
      dependsOn: request.patch.dependencies ?? current.dependsOn ?? [],
      updatedAt: "2026-06-11T10:01:00.000Z",
    };
    taskMap.set(updated.queueItemId, updated);
    return itemResultFromTask(updated, "queue.updateItem");
  });
  const bridge = queueBridge({ createItem, updateItem });

  return {
    bridge,
    createItem,
    tasks: () => Array.from(taskMap.values()),
    updateItem,
  };
}

function taskFromCreateRequest(
  request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0],
): AgentQueueTask {
  const id = request.title.split(":")[0]?.trim() || "created";
  return {
    approvalPolicy: request.approvalPolicy ?? "never",
    assignedExecutorWidgetId: null,
    assignedWorkerId: null,
    closureState: undefined,
    codexExecutable: request.codexExecutable ?? "codex",
    context: undefined,
    coordinatorStatus: "not_reported",
    createdAt: "2026-06-11T10:00:00.000Z",
    dependsOn: request.dependencies ?? [],
    description: request.description ?? "",
    executionPolicy: request.executionPolicy ?? "manual",
    executionWorkspace: request.executionWorkspace ?? ".",
    itemType: request.itemType ?? "implementation",
    orderIndex: 0,
    priority: request.priority ?? 0,
    prompt: request.prompt ?? "",
    queueItemId: `queue-${id}`,
    queueTagId: request.queueTag?.id ?? request.queueTag?.name ?? "default",
    queueTagName: request.queueTag?.name ?? "Default",
    sandbox: request.sandbox ?? "danger_full_access",
    status: request.status ?? "draft",
    title: request.title,
    updatedAt: "2026-06-11T10:00:00.000Z",
    validationStatus: "not_started",
    workerExecutionReports: [],
    workspaceId: "workspace-1",
  };
}

function itemResultFromTask(
  task: AgentQueueTask,
  action: "queue.createItem" | "queue.updateItem" = "queue.createItem",
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action,
    events: [],
    item: {
      assignedExecutorWidgetId: task.assignedExecutorWidgetId,
      blockers: [],
      coordinatorStatus: task.coordinatorStatus,
      createdAt: task.createdAt,
      dependencies: task.dependsOn ?? [],
      description: task.description,
      evidenceSummary: { runRefs: [], status: "none" },
      executionPolicy: task.executionPolicy ?? "manual",
      executionStatus: task.status,
      executionWorkspace: task.executionWorkspace,
      id: task.queueItemId,
      itemType: task.itemType,
      priority: task.priority,
      prompt: task.prompt,
      queueId: "agent-queue",
      queueTag: {
        id: task.queueTagId ?? null,
        name: task.queueTagName ?? null,
      },
      reportSummary: { status: "none" },
      runLinks: [],
      status: task.status,
      title: task.title,
      updatedAt: task.updatedAt,
      validationStatus: task.validationStatus,
      workspaceId: task.workspaceId,
    },
    message: "Queue item saved. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function missingQueueItemResult(
  itemId: string,
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action: "queue.updateItem",
    error: {
      code: "missing_item",
      message: `Queue item ${itemId} was not found.`,
    },
    events: [],
    message: "Queue item not found.",
    ok: false,
    safetyClass: "safe_create_update",
  };
}

function worker() {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: "Smoke worker",
    scope: { kind: "all" as const },
    status: "idle" as const,
    workerId: "smoke-worker",
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
