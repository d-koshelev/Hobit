import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { queueV2DraftReadinessForTask } from "./queue/queueV2DraftReadiness";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import { WorkspaceAgentQueueTaskStatusCard } from "./WorkspaceAgentQueueTaskStatusCard";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("WorkspaceAgentQueueTaskStatusCard queue actions", () => {
  it("shows Queue for run for draft tasks and promotes only after explicit click", async () => {
    const promote = vi.fn();
    const run = vi.fn();
    const task = queueTask({ status: "draft", title: "Imported draft" });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          onPromote: promote,
          onRun: run,
          runCanStart: false,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    expect(document.body.textContent).toContain("Queue for run");
    expect(promote).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();

    await clickButton("Queue for run");

    expect(promote).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("No task was started");
  });

  it("keeps dependency-blocked Workspace Chat tasks from running", async () => {
    const run = vi.fn();
    const task001 = queueTask({
      queueItemId: "queue-task-0001",
      status: "queued",
      title: "Task 001",
    });
    const task002 = queueTask({
      dependsOn: ["queue-task-0001"],
      queueItemId: "queue-task-0002",
      status: "ready",
      title: "Task 002",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          onRun: run,
          readinessMessage: "Dependency is still open.",
          runCanStart: false,
          selectedTask: task002,
          tasks: [task001, task002],
        })}
        task={task002}
      />,
    );

    expect(document.body.textContent).toContain("Dependency is still open");
    expect(buttonByText("Run")?.disabled).toBe(true);

    await clickButton("Run");

    expect(run).not.toHaveBeenCalled();
  });
});

function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonByText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
    await Promise.resolve();
  });
}

function buttonByText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
}

function queueController({
  onPromote = vi.fn(),
  onRun = vi.fn(),
  readinessMessage,
  runCanStart = true,
  selectedTask,
  tasks,
}: {
  onPromote?: () => void;
  onRun?: () => void;
  readinessMessage?: string;
  runCanStart?: boolean;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): AgentQueueController {
  const draftReadiness =
    selectedTask.status === "draft"
      ? queueV2DraftReadinessForTask(selectedTask)
      : null;

  return {
    autorun: { snapshot: null },
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
      canPromote: Boolean(draftReadiness?.readyToQueue),
      disabledReason: draftReadiness?.disabledReason ?? undefined,
      isPromoting: false,
      onPromote,
      readiness: draftReadiness,
    },
    foundation: {
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(),
      workers: [],
    },
    run: {
      canStart: runCanStart,
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: ["Run settings are incomplete."],
      readinessMessage:
        runCanStart ? null : readinessMessage ?? "Run settings are incomplete.",
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: "executor-1",
    assignedWorkerId: "executor-1",
    codexExecutable: "codex.cmd",
    createdAt: "2026-06-10T10:00:00.000Z",
    description: "Review visible task state.",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    priority: 1,
    prompt: "Do this Queue task from visible instructions.",
    queueItemId: "queue-task-0001",
    queueTagId: "implementation",
    queueTagName: "Implementation",
    status: "ready",
    sandbox: "workspace_write",
    title: "Queue task",
    updatedAt: "2026-06-10T10:00:00.000Z",
    validationStatus: "not_started",
    workspaceId: "workspace-1",
    ...overrides,
  } as AgentQueueTask;
}
