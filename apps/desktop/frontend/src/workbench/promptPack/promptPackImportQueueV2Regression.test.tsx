import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../queue/agentQueueWidgetApiTypes";
import { selectQueueV2ViewModel } from "../queue/queueV2ViewModel";
import type { WorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import { QueueV2Widget } from "../widgetV2/queueV2/QueueV2Widget";
import { buildPromptPackImportPreview } from "./promptPackImportPreview";
import { materializePromptPackPreviewToQueue } from "./promptPackMaterialization";
import type { PromptPackMaterializationResult } from "./promptPackModel";
import { parsePromptPackImportPlan } from "./promptPackParser";
import { selfDevelopmentSmokePromptPackEntries } from "./selfDevelopmentSmokePromptPackFixture.test-fixtures";
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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
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
