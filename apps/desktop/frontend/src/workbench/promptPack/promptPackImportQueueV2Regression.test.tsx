import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import type { AgentQueueController } from "../queue/details/agentQueueTaskDetailsTypes";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../queue/agentQueueWidgetApiTypes";
import { selectQueueV2ViewModel } from "../queue/queueV2ViewModel";
import {
  createValidationRunner,
  type ValidationCommandExecutor,
  type ValidationExecutorResult,
} from "../validation";
import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { WorkspaceAgentQueueTaskStatusCard } from "../WorkspaceAgentQueueTaskStatusCard";
import { QueueV2Widget } from "../widgetV2/queueV2/QueueV2Widget";
import { buildPromptPackImportPreview } from "./promptPackImportPreview";
import { materializePromptPackPreviewToQueue } from "./promptPackMaterialization";
import type {
  PromptPackFileEntry,
  PromptPackMaterializationResult,
} from "./promptPackModel";
import { parsePromptPackImportPlan } from "./promptPackParser";
import {
  realisticDogfoodingSmokePromptPackEntries,
  realisticDogfoodingSmokePromptPackFixturePath,
  selfDevelopmentSmokePromptPackEntries,
} from "./selfDevelopmentSmokePromptPackFixture.test-fixtures";
import { WorkspaceAgentPromptPackImportCard } from "./WorkspaceAgentPromptPackImportCard";

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

describe("prompt-pack import result and QueueV2 regression", () => {
  it("pins realistic folder import through QueueV2 ready/run and Workspace Agent validation availability", async () => {
    const harness = createQueueHarness();
    const onReadPromptPackSource = vi.fn(async ({ path }: { path: string }) => {
      expect(path).toBe(realisticDogfoodingSmokePromptPackFixturePath);
      return realisticDogfoodingSmokePromptPackEntries;
    });
    const codexRun = vi.fn();
    const shellCommand = vi.fn();
    const sqliteDirectAction = vi.fn();
    const autoRun = vi.fn();
    const autoFinalize = vi.fn();
    const commitOrPush = vi.fn();
    const validationExecutor = createMockValidationExecutor();

    await render(
      <PromptPackFolderImportHarness
        bridge={harness.bridge}
        currentWorkspaceRoot="C:/Users/Dmitry/Documents/prj/Hobit_fixed"
        onReadPromptPackSource={onReadPromptPackSource}
      />,
    );

    expect(buttonWithText("Create Queue items")?.disabled).toBe(true);

    await clickButton("Read source preview");

    const previewText = elementByAriaLabel("Prompt-pack import preview card")
      ?.textContent;
    expect(previewText).toContain("Hobit Realistic Dogfooding Smoke");
    expect(previewText).toContain("Items2");
    expect(previewText).toContain("Selected2");
    expect(previewText).toContain("001-add-dogfooding-smoke-result-doc");
    expect(previewText).toContain("002-record-dependent-gate-result");
    expect(previewText).toContain(
      "002-record-dependent-gate-result: Depends on 001-add-dogfooding-smoke-result-doc",
    );
    expect(previewText).toContain("No blocking errors.");
    expect(previewText).not.toContain("has no prompt body");
    expect(buttonWithText("Create Queue items")?.disabled).toBe(false);
    expect(harness.bridge.createItem).not.toHaveBeenCalled();

    await clickButton("Create Queue items");

    expect(harness.bridge.createItem).toHaveBeenCalledTimes(2);
    expect(harness.bridge.updateItem).toHaveBeenCalledWith({
      itemId: "queue-002-record-dependent-gate-result",
      patch: { dependencies: ["queue-001-add-dogfooding-smoke-result-doc"] },
      reason:
        "Materialize prompt-pack dependency links after creating all selected Queue items.",
    });
    expect(document.body.textContent).toContain("Created Queue items");
    expect(document.body.textContent).toContain(
      "001-add-dogfooding-smoke-result-doc",
    );
    expect(document.body.textContent).toContain(
      "002-record-dependent-gate-result",
    );
    expect(document.body.textContent).toContain("No tasks started");

    const importedTasks = harness.tasks();
    expect(importedTasks.map((task) => task.queueItemId).sort()).toEqual([
      "queue-001-add-dogfooding-smoke-result-doc",
      "queue-002-record-dependent-gate-result",
    ]);
    expect(
      importedTasks.find(
        (task) => task.queueItemId === "queue-002-record-dependent-gate-result",
      )?.dependsOn,
    ).toEqual(["queue-001-add-dogfooding-smoke-result-doc"]);
    expect(
      importedTasks.find(
        (task) => task.queueItemId === "queue-001-add-dogfooding-smoke-result-doc",
      )?.executionWorkspace,
    ).toBe("C:/Users/Dmitry/Documents/prj/Hobit_fixed");
    expect(
      importedTasks.find(
        (task) => task.queueItemId === "queue-002-record-dependent-gate-result",
      )?.executionWorkspace,
    ).toBe("C:/Users/Dmitry/Documents/prj/Hobit_fixed");

    const importedViewModel = selectQueueV2ViewModel({
      selectedTaskId: "queue-002-record-dependent-gate-result",
      tasks: importedTasks,
      workers: [worker()],
    });
    const firstImported = importedViewModel.tasks.find(
      (task) => task.taskId === "queue-001-add-dogfooding-smoke-result-doc",
    );
    const dependent = importedViewModel.tasks.find(
      (task) => task.taskId === "queue-002-record-dependent-gate-result",
    );
    expect(firstImported).toMatchObject({
      boardLane: "intake_draft",
      nextAction: "queue_task",
    });
    expect(dependent?.boardLane).toBe("blocked");
    expect(dependent?.eligibility.eligibleNow).toBe(false);
    expect(dependent?.blockedReasons.map((reason) => reason.code)).toContain(
      "dependency_open",
    );

    cleanupRender();

    const promoteTask = vi.fn();
    const runTask = vi.fn();
    await render(
      <QueueV2ReadyRunHarness
        initialTasks={importedTasks}
        onPromoteTask={promoteTask}
        onRunTask={runTask}
      />,
    );

    await openDetailsForTask("queue-002-record-dependent-gate-result");
    expect(
      document.querySelector("#queue-v2-task-details-queue-002-record-dependent-gate-result")
        ?.textContent,
    ).toContain("Waiting on");
    expect(runTask).not.toHaveBeenCalled();

    await clickButton("Close");
    await openDetailsForTask("queue-001-add-dogfooding-smoke-result-doc");
    expect(buttonWithText("Queue for run")?.disabled).toBe(false);
    expect(runTask).not.toHaveBeenCalled();

    await clickButton("Queue for run");

    expect(promoteTask).toHaveBeenCalledTimes(1);
    expect(buttonWithText("Run task")?.disabled).toBe(false);
    expect(runTask).not.toHaveBeenCalled();

    cleanupRender();

    const readyFirstTask = {
      ...importedTasks.find(
        (task) => task.queueItemId === "queue-001-add-dogfooding-smoke-result-doc",
      )!,
      status: "ready" as const,
    };
    const readyTasks = [
      readyFirstTask,
      importedTasks.find(
        (task) => task.queueItemId === "queue-002-record-dependent-gate-result",
      )!,
    ];
    await render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          onRun: runTask,
          selectedTask: readyFirstTask,
          tasks: readyTasks,
        })}
        task={readyFirstTask}
        validationRunner={createValidationRunner({ executor: validationExecutor })}
        workspaceAgentQueueBridge={harness.bridge}
      />,
    );

    expect(buttonWithText("Request validation")?.disabled).toBe(false);

    await clickButton("Request validation");

    expect(document.body.textContent).toContain("Validation request");
    expect(document.body.textContent).toContain(
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    );
    expect(document.body.textContent).toContain("Run validation");
    expect(validationExecutor.execute).not.toHaveBeenCalled();

    expect(codexRun).not.toHaveBeenCalled();
    expect(shellCommand).not.toHaveBeenCalled();
    expect(sqliteDirectAction).not.toHaveBeenCalled();
    expect(autoRun).not.toHaveBeenCalled();
    expect(autoFinalize).not.toHaveBeenCalled();
    expect(commitOrPush).not.toHaveBeenCalled();
    expect(runTask).not.toHaveBeenCalled();
    expect(harness.startQueueItem).not.toHaveBeenCalled();
  });

  it("shows the self-development smoke import result and keeps open callbacks explicit", async () => {
    const { result } = await materializeSelfDevelopmentSmokeFixture();
    const onOpenQueueItem = vi.fn();

    await render(
      <WorkspaceAgentPromptPackImportCard
        importState={{
          id: "import-1",
          result,
          sourceText: "",
        }}
        onCancel={vi.fn()}
        onOpenQueueItem={onOpenQueueItem}
        onPatch={vi.fn()}
      />,
    );

    expect(elementByAriaLabel("Prompt-pack import result")?.textContent).toContain(
      "Created Queue items",
    );
    expect(document.body.textContent).toContain("001-safe-docs-noop");
    expect(document.body.textContent).toContain("002-dependent-follow-up");
    expect(document.body.textContent).toContain(
      "queue-001-safe-docs-noop",
    );
    expect(document.body.textContent).toContain(
      "queue-002-dependent-follow-up",
    );
    expect(document.body.textContent).toContain(
      "002-dependent-follow-up -> 001-safe-docs-noop: created",
    );
    expect(document.body.textContent).toContain("No tasks started");
    expect(document.body.textContent).toContain("Warnings");
    expect(document.body.textContent).toContain("Errors");
    expect(onOpenQueueItem).not.toHaveBeenCalled();

    await clickButton("Open Queue");

    expect(onOpenQueueItem).toHaveBeenCalledTimes(1);
    expect(onOpenQueueItem).toHaveBeenCalledWith("queue-001-safe-docs-noop");
  });

  it("renders imported QueueV2 tasks with dependency blocking and prompt-pack metadata", async () => {
    const { startQueueItem, tasks } = await materializeSelfDevelopmentSmokeFixture();
    const viewModel = selectQueueV2ViewModel({
      selectedTaskId: "queue-002-dependent-follow-up",
      tasks,
      workers: [worker()],
    });
    const dependent = viewModel.tasks.find(
      (item) => item.taskId === "queue-002-dependent-follow-up",
    );

    expect(dependent?.boardLane).toBe("blocked");
    expect(dependent?.eligibility.eligibleNow).toBe(false);
    expect(dependent?.blockedReasons.map((reason) => reason.code)).toContain(
      "dependency_open",
    );

    await render(<QueueV2Widget tasks={tasks} workers={[worker()]} />);

    const firstCard = cardByTaskId("queue-001-safe-docs-noop");
    const secondCard = cardByTaskId("queue-002-dependent-follow-up");

    expect(firstCard?.textContent).toContain(
      "001-safe-docs-noop: docs: smoke no-op readiness note",
    );
    expect(firstCard?.textContent).toContain("Block 001-safe-docs-noop");
    expect(firstCard?.textContent).toContain("Validation required");
    expect(secondCard?.getAttribute("data-queue-v2-lane")).toBe("blocked");
    expect(secondCard?.textContent).toContain(
      "002-dependent-follow-up: docs: verify dependent readiness gate",
    );
    expect(secondCard?.textContent).toContain("Dependency blocked");
    expect(secondCard?.textContent).toContain("Dependency");
    expect(document.body.textContent).not.toContain("Run now");
    expect(document.body.textContent).toContain("No running tasks");
    expect(startQueueItem).not.toHaveBeenCalled();

    await openDetailsForTask("queue-002-dependent-follow-up");

    const details = document.querySelector(
      "#queue-v2-task-details-queue-002-dependent-follow-up",
    );
    expect(details?.textContent).toContain("Prompt-pack import");
    expect(details?.textContent).toContain(
      "Hobit Self-Development Smoke (hobit-self-development-smoke)",
    );
    expect(details?.textContent).toContain("002-dependent-follow-up");
    expect(details?.textContent).toContain("001-safe-docs-noop");
    expect(details?.textContent).toContain("Waiting on");
    expect(details?.textContent).toContain("git status --short --branch");
    expect(details?.textContent).toContain("git diff --check");
    expect(details?.textContent).toContain(
      "docs: verify dependent readiness gate",
    );
    expect(details?.textContent).toContain(
      "apps/desktop/frontend/src/workbench/promptPack/fixtures/self-development-smoke-prompt-pack/**",
    );
    expect(details?.textContent).toContain("crates/**");
    expect(startQueueItem).not.toHaveBeenCalled();
  });
});

async function materializeSelfDevelopmentSmokeFixture() {
  const plan = parsePromptPackImportPlan(selfDevelopmentSmokePromptPackEntries);
  const preview = buildPromptPackImportPreview(plan);
  const harness = createQueueHarness();
  const result = await materializePromptPackPreviewToQueue({
    bridge: harness.bridge,
    confirmed: true,
    currentWorkspaceRoot: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
    preview,
  });

  expect(result.ok).toBe(true);
  expect(result.createdTasks).toHaveLength(2);
  expect(result.dependencyLinksCreated).toEqual([
    expect.objectContaining({
      dependencyQueueItemId: "queue-001-safe-docs-noop",
      dependentQueueItemId: "queue-002-dependent-follow-up",
      status: "created",
    }),
  ]);

  return {
    result,
    startQueueItem: harness.startQueueItem,
    tasks: harness.tasks(),
  };
}

function createQueueHarness() {
  const taskMap = new Map<string, AgentQueueTask>();
  const startQueueItem = vi.fn();
  const bridge: WorkspaceAgentQueueBridge & {
    startQueueItem: typeof startQueueItem;
  } = {
    createItem: vi.fn(async (request) => {
      const task = taskFromCreateRequest(request);
      taskMap.set(task.queueItemId, task);
      return actionResult(task);
    }),
    getSnapshot: vi.fn(),
    startQueueItem,
    updateItem: vi.fn(async (request) => {
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
      return actionResult(updated, "queue.updateItem");
    }),
  };

  return {
    bridge,
    startQueueItem,
    tasks: () => Array.from(taskMap.values()),
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
    executionWorkspace: request.executionWorkspace ?? null,
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

function actionResult(
  task: AgentQueueTask,
  action: "queue.createItem" | "queue.updateItem" = "queue.createItem",
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action,
    events: [],
    item: itemSnapshot(task),
    message: "Queue item saved. No task execution started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function itemSnapshot(task: AgentQueueTask): QueueWidgetItemSnapshot {
  return {
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

async function render(element: ReactNode) {
  cleanupRender();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

function cleanupRender() {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
    await Promise.resolve();
  });
}

async function openDetailsForTask(taskId: string) {
  const card = cardByTaskId(taskId);
  const menuButton = card?.querySelector<HTMLButtonElement>(
    ".queue-v2-card-details",
  );
  if (!menuButton) {
    throw new Error(`Details menu not found for ${taskId}`);
  }

  await act(async () => {
    menuButton.click();
    await Promise.resolve();
  });
  await clickButton("Open details");
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function cardByTaskId(taskId: string) {
  return document.querySelector<HTMLElement>(`[data-queue-item-id="${taskId}"]`);
}

function elementByAriaLabel(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("[aria-label]")).find(
    (element) => element.getAttribute("aria-label") === name,
  );
}

function PromptPackFolderImportHarness({
  bridge,
  currentWorkspaceRoot,
  onReadPromptPackSource,
}: {
  bridge: WorkspaceAgentQueueBridge;
  currentWorkspaceRoot?: string | null;
  onReadPromptPackSource: (request: {
    path: string;
  }) => Promise<readonly PromptPackFileEntry[]>;
}) {
  const [importState, setImportState] = useState({
    id: "realistic-import",
    sourcePath: realisticDogfoodingSmokePromptPackFixturePath,
    sourceText: "",
  });

  return (
    <WorkspaceAgentPromptPackImportCard
      createQueueItemsFromPromptPackPreview={(preview) =>
        materializePromptPackPreviewToQueue({
          bridge,
          confirmed: true,
          currentWorkspaceRoot,
          preview,
        })
      }
      importState={importState}
      onCancel={vi.fn()}
      onPatch={(_importId, patch) =>
        setImportState((current) => ({ ...current, ...patch }))
      }
      onReadPromptPackSource={onReadPromptPackSource}
    />
  );
}

function QueueV2ReadyRunHarness({
  initialTasks,
  onPromoteTask,
  onRunTask,
}: {
  initialTasks: AgentQueueTask[];
  onPromoteTask: () => void;
  onRunTask: () => void;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const selectedTask =
    tasks.find(
      (task) => task.queueItemId === "queue-001-add-dogfooding-smoke-result-doc",
    ) ?? tasks[0]!;
  const queue = queueController({
    onPromote: () => {
      onPromoteTask();
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.queueItemId === selectedTask.queueItemId
            ? { ...task, status: "ready" }
            : task,
        ),
      );
    },
    onRun: onRunTask,
    selectedTask,
    tasks,
  });

  return <QueueV2Widget queue={queue} tasks={tasks} workers={[worker()]} />;
}

function queueController({
  onPromote = vi.fn(),
  onRun = vi.fn(),
  selectedTask,
  tasks,
}: {
  onPromote?: () => void;
  onRun?: () => void;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): AgentQueueController {
  return {
    apiAvailable: true,
    autorun: {
      snapshot: null,
    },
    coordinatorFinalization: {
      canAct: false,
      message: "Coordinator decision actions are unavailable.",
      onAcceptWithoutCommit: vi.fn(),
      onCommitResult: vi.fn(),
      onCreateFollowUp: vi.fn(),
      onFinalize: vi.fn(),
      onMarkBlocked: vi.fn(),
      onMarkFailedRejected: vi.fn(),
      onMarkFollowUpRequired: vi.fn(),
      onMarkNeedsChanges: vi.fn(),
      onMarkReadyForFinalization: vi.fn(),
      onMarkRollbackRequired: vi.fn(),
      status: selectedTask.coordinatorStatus ?? "not_reported",
    },
    diffReview: {
      canCreate: false,
      linkedReviewTasks: [],
      message: "Diff review is unavailable.",
      onCreate: vi.fn(),
    },
    draftPromotion: {
      canPromote: selectedTask.status === "draft",
      isPromoting: false,
      onPromote,
    },
    foundation: {
      globalExecutionState: "started",
      onStopAndKillRunning: vi.fn(),
      pausedQueueTagIds: new Set(),
      workers: [worker()],
    },
    isCreating: false,
    isLoading: false,
    refreshTasks: vi.fn(),
    run: {
      canStart: selectedTask.status === "ready",
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: [],
      readinessMessage:
        selectedTask.status === "ready" ? null : "Task is not ready to run.",
    },
    selectedTask,
    tasks,
    workerReport: {
      canAttach: false,
      latestReport: null,
      message: null,
      onAttachDemoReport: vi.fn(),
    },
  } as unknown as AgentQueueController;
}

function createMockValidationExecutor(): ValidationCommandExecutor {
  return {
    capabilities: {
      available: true,
      supportsCancellation: false,
      supportsTimeout: true,
    },
    execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
      durationMs: 12,
      exitCode: 0,
      status: "completed",
      stderr: "",
      stdout: "validation ok",
    })),
  };
}
