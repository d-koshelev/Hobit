import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  createValidationRunner,
  type ValidationCommandExecutor,
  type ValidationExecutorResult,
} from "./validation";
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
});

describe("WorkspaceAgentQueueTaskStatusCard workspace action", () => {
  it("sets a missing task workspace through the typed Queue update action only", async () => {
    const updateItem = vi.fn(async (request) =>
      itemResult({
        executionWorkspace: request.patch.executionWorkspace,
        id: request.itemId,
      }),
    );
    const run = vi.fn();
    const finalize = vi.fn();
    const task = queueTask({
      executionWorkspace: null,
      prompt: promptPackPromptWithValidation(),
      status: "ready",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          canAct: true,
          onFinalize: finalize,
          onRun: run,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createValidationRunner({ executor: validationExecutor() })}
        workspaceAgentQueueBridge={queueBridge({ updateItem })}
      />,
    );

    expect(buttonByText("Set task workspace")?.disabled).toBe(false);
    expect(buttonByText("Request validation")?.disabled).toBe(true);
    expect(updateItem).not.toHaveBeenCalled();

    await clickButton("Set task workspace");

    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(updateItem.mock.calls[0]?.[0]).toEqual({
      itemId: "queue-task-0001",
      patch: {
        executionWorkspace: "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
      },
      reason: "Set Queue task execution workspace from current Workspace root.",
    });
    expect(document.body.textContent).toContain(
      "Task workspace set for queue-task-0001. No task was started.",
    );
    expect(run).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });
});

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(node));
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonByText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonByText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
}

function queueController({
  canAct = false,
  onFinalize = vi.fn(),
  onRun = vi.fn(),
  selectedTask,
  tasks,
}: {
  canAct?: boolean;
  onFinalize?: () => void;
  onRun?: () => void;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): AgentQueueController {
  return {
    autorun: { snapshot: null },
    coordinatorFinalization: {
      canAct,
      message: canAct ? null : "Coordinator decision actions are unavailable.",
      onAcceptWithoutCommit: vi.fn(),
      onCommitResult: vi.fn(),
      onCreateFollowUp: vi.fn(),
      onFinalize,
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
    foundation: {
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(),
      workers: [],
    },
    run: {
      canStart: false,
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: ["Validation needs an execution workspace."],
      readinessMessage: "Validation needs an execution workspace.",
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
}

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(),
    getCurrentWorkspaceRoot: () => "C:/Users/Dmitry/Documents/prj/Hobit_fixed",
    getRunSettingsDefaults: () => ({
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      executionWorkspace: "~",
      sandbox: "danger_full_access",
    }),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(async () => itemResult()),
    ...overrides,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    assignedWorkerId: "executor-1",
    createdAt: "2026-06-10T10:00:00.000Z",
    description: "Review visible task state.",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Do this Queue task from visible instructions.",
    queueItemId: "queue-task-0001",
    queueTagId: "implementation",
    queueTagName: "Implementation",
    status: "ready",
    title: "Queue task",
    updatedAt: "2026-06-10T10:00:00.000Z",
    validationStatus: "not_started",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  return {
    action: "queue.updateItem",
    events: [],
    item: {
      blockers: [],
      dependencies: [],
      description: "",
      evidenceSummary: { runRefs: [], status: "none" },
      executionPolicy: "manual",
      executionStatus: "queued",
      id: "queue-task-0001",
      priority: 0,
      prompt: "Prompt",
      queueId: "queue",
      queueTag: { id: null, name: null },
      reportSummary: { status: "none" },
      runLinks: [],
      status: "queued",
      title: "Queue task",
      workspaceId: "workspace-1",
      ...overrides,
    },
    message: "Updated",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function validationExecutor(): ValidationCommandExecutor {
  return {
    capabilities: {
      available: true,
      supportsCancellation: false,
      supportsTimeout: true,
    },
    execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
      durationMs: 32,
      exitCode: 0,
      status: "completed",
      stderr: "",
      stdout: "typecheck ok",
    })),
  };
}

function promptPackPromptWithValidation() {
  return [
    "Implement visible task.",
    "",
    "Prompt pack materialization metadata",
    "Pack: Test pack (test-pack)",
    "Block id: TEST-01",
    "Validation commands",
    "- npm.cmd run typecheck --prefix apps/desktop/frontend",
  ].join("\n");
}
