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
  createUnavailableValidationRunner,
  createValidationRunner,
  type ValidationCommandExecutor,
  type ValidationExecutorResult,
} from "./validation";
import { WorkspaceAgentQueueTaskStatusCard } from "./WorkspaceAgentQueueTaskStatusCard";

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

describe("WorkspaceAgentQueueTaskStatusCard", () => {
  it("renders compact status for draft, ready, running, review, and closed tasks", () => {
    const tasks = [
      queueTask({ queueItemId: "queue-draft-0001", status: "draft", title: "Draft task" }),
      queueTask({ queueItemId: "queue-ready-0001", status: "ready", title: "Ready task" }),
      queueTask({ queueItemId: "queue-running-0001", status: "running", title: "Running task" }),
      queueTask({
        coordinatorStatus: "awaiting_coordinator_review",
        queueItemId: "queue-review-0001",
        status: "review_needed",
        title: "Review task",
        validationStatus: "needs_review",
        workerExecutionReports: [workerReport()],
      }),
      queueTask({
        closureState: "no_change_accepted",
        coordinatorStatus: "finalized",
        queueItemId: "queue-closed-0001",
        status: "completed",
        title: "Closed task",
        validationStatus: "passed",
      }),
    ];

    render(
      <>
        {tasks.map((task) => (
          <WorkspaceAgentQueueTaskStatusCard
            key={task.queueItemId}
            queue={queueController({ selectedTask: task, tasks })}
            task={task}
          />
        ))}
      </>,
    );

    expect(document.body.textContent).toContain("Draft task");
    expect(document.body.textContent).toContain("Intake");
    expect(document.body.textContent).toContain("Ready task");
    expect(document.body.textContent).toContain("Ready");
    expect(document.body.textContent).toContain("Running task");
    expect(document.body.textContent).toContain("Running");
    expect(document.body.textContent).toContain("Review task");
    expect(document.body.textContent).toContain("Review");
    expect(document.body.textContent).toContain("Closed task");
    expect(document.body.textContent).toContain("Closed");
    expect(document.body.textContent).toContain("Next action");
    expect(document.body.textContent).toContain("Coordinator");
    expect(document.body.textContent).toContain("Validation");
    expect(document.body.textContent).not.toContain("{\"");
    expect(document.body.textContent).not.toContain("workerExecutionReports");
  });

  it("shows unavailable action reasons without running or stopping on render", () => {
    const run = vi.fn();
    const stop = vi.fn();
    const task = queueTask({ status: "ready" });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          onRun: run,
          onStop: stop,
          runCanStart: false,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    expect(document.body.textContent).toContain(
      "Open Queue is unavailable in this Workspace Agent surface.",
    );
    expect(document.body.textContent).toContain("No report is ready for this task.");
    expect(document.body.textContent).toContain("Run settings are incomplete.");
    expect(document.body.textContent).toContain(
      "Stop is only relevant while a task is running.",
    );
    expect(run).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it("clicking Open Queue calls only the open callback", async () => {
    const onOpenQueueItem = vi.fn();
    const onViewReport = vi.fn();
    const run = vi.fn();
    const task = queueTask({ status: "ready" });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        onOpenQueueItem={onOpenQueueItem}
        onViewReport={onViewReport}
        queue={queueController({
          onRun: run,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    await clickButton("Open Queue");

    expect(onOpenQueueItem).toHaveBeenCalledWith("queue-task-0001");
    expect(onViewReport).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("clicking View report calls only the report callback", async () => {
    const onOpenQueueItem = vi.fn();
    const onViewReport = vi.fn();
    const run = vi.fn();
    const task = queueTask({
      status: "review_needed",
      workerExecutionReports: [workerReport()],
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        onOpenQueueItem={onOpenQueueItem}
        onViewReport={onViewReport}
        queue={queueController({
          onRun: run,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    await clickButton("View report");

    expect(onViewReport).toHaveBeenCalledWith("queue-task-0001");
    expect(onOpenQueueItem).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("calls the Queue run callback exactly once only after explicit click", async () => {
    const run = vi.fn();
    const task = queueTask({ status: "ready" });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          onRun: run,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    expect(run).not.toHaveBeenCalled();

    await clickButton("Run");

    expect(run).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(
      "Explicit Queue run request sent for queue-task-0001.",
    );
  });

  it("keeps unsupported validation, diff review, rollback, and stop controls disabled with reasons", () => {
    const task = queueTask({ status: "running" });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    expect(buttonByText("Stop")?.disabled).toBe(true);
    expect(buttonByText("Request validation")?.disabled).toBe(true);
    expect(buttonByText("Create diff review")?.disabled).toBe(true);
    expect(buttonByText("Rollback")?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Selected-task stop/cancel is not exposed to Workspace Chat.",
    );
    expect(document.body.textContent).toContain(
      "Validation runner is unavailable in this Workspace Chat surface.",
    );
    expect(document.body.textContent).toContain(
      "Diff Review task creation is not exposed as a Workspace Chat Queue control action.",
    );
    expect(document.body.textContent).toContain(
      "Rollback is not exposed as a Workspace Chat Queue control action.",
    );
  });

  it("enables Request validation when a runner, Queue bridge, execution workspace, and validation commands are available", () => {
    const task = queueTask({
      executionWorkspace: "C:/repo",
      prompt: promptPackPromptWithValidation(),
      status: "ready",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createValidationRunner({ executor: validationExecutor() })}
        workspaceAgentQueueBridge={queueBridge()}
      />,
    );

    expect(buttonByText("Request validation")?.disabled).toBe(false);
  });

  it("disables Request validation with a reason when no commands are available and manual input is unsupported", () => {
    const task = queueTask({
      executionWorkspace: "C:/repo",
      prompt: "No validation metadata.",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        manualValidationCommandInputSupported={false}
        queue={queueController({
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createValidationRunner({ executor: validationExecutor() })}
        workspaceAgentQueueBridge={queueBridge()}
      />,
    );

    expect(buttonByText("Request validation")?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "No validation commands or suite are available for this Queue task.",
    );
  });

  it("supports explicit manual validation input when no Queue suite is available", async () => {
    const executor = validationExecutor();
    const task = queueTask({
      executionWorkspace: "C:/repo",
      prompt: "No validation metadata.",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createValidationRunner({ executor })}
        workspaceAgentQueueBridge={queueBridge()}
      />,
    );

    expect(buttonByText("Request validation")?.disabled).toBe(false);

    await clickButton("Request validation");
    expect(buttonByText("Run validation")?.disabled).toBe(true);

    await changeInput("Manual validation command", "npm.cmd run test -- --run Validation");
    expect(buttonByText("Run validation")?.disabled).toBe(false);

    await clickButton("Run validation");

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Validation passed");
  });

  it("runs validation only after explicit Run validation and renders capped passed evidence", async () => {
    const hiddenTail = "hidden-tail";
    const stdout = `typecheck ok ${"x".repeat(4_000)} ${hiddenTail}`;
    const executor = validationExecutor({
      execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
        durationMs: 41,
        exitCode: 0,
        status: "completed",
        stderr: "",
        stdout,
      })),
    });
    const finalize = vi.fn();
    const task = queueTask({
      executionWorkspace: "C:/repo",
      prompt: promptPackPromptWithValidation(),
      status: "ready",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        onOpenQueueItem={vi.fn()}
        queue={queueController({
          canAct: true,
          onFinalize: finalize,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createValidationRunner({ executor })}
        workspaceAgentQueueBridge={queueBridge()}
      />,
    );

    expect(executor.execute).not.toHaveBeenCalled();

    await clickButton("Request validation");

    expect(document.body.textContent).toContain("Queue validation");
    expect(document.body.textContent).toContain(
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    );
    expect(executor.execute).not.toHaveBeenCalled();

    await clickButton("Run validation");

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(finalize).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Validation passed");
    expect(document.body.textContent).toContain("Command count");
    expect(document.body.textContent).toContain("Passed");
    expect(document.body.textContent).toContain("Failed");
    expect(document.body.textContent).toContain("41 ms");
    expect(document.body.textContent).toContain("Exit codes");

    await clickButton("View evidence");

    expect(document.body.textContent).toContain("typecheck ok");
    expect(document.body.textContent).not.toContain(hiddenTail);
    expect(document.body.textContent).toContain("Output snippets are capped");
    expect(document.body.textContent).toContain(
      "This card does not finalize Queue tasks",
    );
  });

  it("renders failed validation evidence without finalizing the Queue task", async () => {
    const executor = validationExecutor({
      execute: vi.fn(async (): Promise<ValidationExecutorResult> => ({
        durationMs: 25,
        exitCode: 1,
        status: "completed",
        stderr: "test failed",
        stdout: "",
      })),
    });
    const finalize = vi.fn();
    const task = queueTask({
      executionWorkspace: "C:/repo",
      prompt: promptPackPromptWithValidation("npm.cmd run test -- --run Validation"),
      status: "review_needed",
      workerExecutionReports: [workerReport()],
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          canAct: true,
          onFinalize: finalize,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createValidationRunner({ executor })}
        workspaceAgentQueueBridge={queueBridge({ validationStatus: "failed" })}
      />,
    );

    await clickButton("Request validation");
    await clickButton("Run validation");
    await clickButton("View evidence");

    expect(document.body.textContent).toContain("Validation failed");
    expect(document.body.textContent).toContain("test failed");
    expect(document.body.textContent).toContain("Exit codes");
    expect(finalize).not.toHaveBeenCalled();
  });

  it("shows unsupported runner state when the validation runner reports unavailable", async () => {
    const task = queueTask({
      executionWorkspace: "C:/repo",
      prompt: promptPackPromptWithValidation(),
      status: "ready",
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
        validationRunner={createUnavailableValidationRunner("Desktop validation runner is not configured.")}
        workspaceAgentQueueBridge={queueBridge({ validationStatus: "needs_review" })}
      />,
    );

    await clickButton("Request validation");
    await clickButton("Run validation");

    expect(document.body.textContent).toContain("Unavailable");
    expect(document.body.textContent).toContain(
      "Desktop validation runner is not configured.",
    );
  });

  it("requires explicit confirmation before accepting/finalizing a review task", async () => {
    const finalize = vi.fn();
    const task = queueTask({
      coordinatorStatus: "ready_for_finalization",
      status: "review_needed",
      workerExecutionReports: [workerReport()],
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          canAct: true,
          onFinalize: finalize,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    await clickButton("Accept result");

    expect(finalize).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Confirm Accept result to finalize this Queue item.",
    );

    await clickButton("Confirm accept");

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(
      "Coordinator decision finalize_accept_item requested for queue-task-0001.",
    );
  });

  it("creates a follow-up through the Queue action without running it", async () => {
    const createFollowUp = vi.fn();
    const run = vi.fn();
    const task = queueTask({
      coordinatorStatus: "follow_up_required",
      status: "review_needed",
      workerExecutionReports: [workerReport()],
    });

    render(
      <WorkspaceAgentQueueTaskStatusCard
        queue={queueController({
          canAct: true,
          onCreateFollowUp: createFollowUp,
          onRun: run,
          selectedTask: task,
          tasks: [task],
        })}
        task={task}
      />,
    );

    await clickButton("Create follow-up");

    expect(createFollowUp).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Coordinator decision create_follow_up requested for queue-task-0001.",
    );
  });
});

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function changeInput(label: string, value: string) {
  await act(async () => {
    const input = Array.from(document.querySelectorAll("input")).find(
      (candidate) => candidate.getAttribute("aria-label") === label,
    );
    if (!input) {
      throw new Error(`Input not found: ${label}`);
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
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
  onRun = vi.fn(),
  onStop = vi.fn(),
  onCreateFollowUp = vi.fn(),
  onFinalize = vi.fn(),
  onMarkBlocked = vi.fn(),
  onMarkFailedRejected = vi.fn(),
  onMarkNeedsChanges = vi.fn(),
  runCanStart = true,
  selectedTask,
  tasks,
}: {
  canAct?: boolean;
  onCreateFollowUp?: () => void;
  onFinalize?: () => void;
  onMarkBlocked?: () => void;
  onMarkFailedRejected?: () => void;
  onMarkNeedsChanges?: () => void;
  onRun?: () => void;
  onStop?: () => void;
  runCanStart?: boolean;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}): AgentQueueController {
  return {
    autorun: {
      snapshot: null,
    },
    coordinatorFinalization: {
      canAct,
      message: canAct ? null : "Coordinator decision actions are unavailable.",
      onAcceptWithoutCommit: vi.fn(),
      onCommitResult: vi.fn(),
      onCreateFollowUp,
      onFinalize,
      onMarkBlocked,
      onMarkFailedRejected,
      onMarkFollowUpRequired: vi.fn(),
      onMarkNeedsChanges,
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
      onStopAndKillRunning: onStop,
      pausedQueueTagIds: new Set(),
      workers: [
        {
          currentItemId: null,
          displayOrder: 0,
          enabled: true,
          lastReportSummary: null,
          name: "Local executor",
          scope: { kind: "all" },
          status: "idle",
          workerId: "executor-1",
        },
      ],
    },
    run: {
      canStart: runCanStart,
      isStarting: false,
      onStartAssignedTask: onRun,
      preconditionMessages: ["Run settings are incomplete."],
      readinessMessage: runCanStart ? null : "Run settings are incomplete.",
    },
    selectedTask,
    tasks,
  } as unknown as AgentQueueController;
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

function workerReport(): NonNullable<AgentQueueTask["workerExecutionReports"]>[number] {
  return {
    changedFiles: ["src/example.ts"],
    commandsRun: ["npm test"],
    createdAt: "2026-06-10T10:30:00.000Z",
    errors: ["Validation needs operator review."],
    itemId: "queue-task-0001",
    reportId: "report-1",
    reportStatus: "reported",
    summary: "Report ready for review.",
    validationCommandsSuggested: ["npm test"],
    validationResult: "partial",
    warnings: ["Follow-up may be needed."],
    workerId: "executor-1",
  };
}

function validationExecutor(
  overrides: Partial<ValidationCommandExecutor> = {},
): ValidationCommandExecutor {
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
    ...overrides,
  };
}

function queueBridge({
  validationStatus = "passed",
}: {
  validationStatus?: QueueWidgetItemSnapshot["validationStatus"];
} = {}): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(async (request) =>
      itemResult({
        id: request.itemId,
        reportSummary: request.patch.appendWorkerExecutionReport
          ? {
              status: "report_ready",
              validationSummary: `Validation result: ${validationStatus}.`,
            }
          : { status: "none" },
        validationStatus: request.patch.validationStatus ?? validationStatus,
      }),
    ),
  };
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item: QueueWidgetItemSnapshot = {
    blockers: [],
    dependencies: [],
    description: "",
    evidenceSummary: {
      runRefs: [],
      status: "none",
    },
    executionPolicy: "manual",
    executionStatus: "queued",
    id: "queue-task-0001",
    priority: 0,
    prompt: "Prompt",
    queueId: "queue",
    queueTag: {
      id: null,
      name: null,
    },
    reportSummary: {
      status: "none",
    },
    runLinks: [],
    status: "queued",
    title: "Queue task",
    workspaceId: "workspace-1",
    ...overrides,
  };

  return {
    action: "queue.updateItem",
    events: [],
    item,
    message: "Updated",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function promptPackPromptWithValidation(
  command = "npm.cmd run typecheck --prefix apps/desktop/frontend",
) {
  return [
    "Implement visible task.",
    "",
    "Prompt pack materialization metadata",
    "Pack: Test pack (test-pack)",
    "Block id: TEST-01",
    "Validation commands",
    `- ${command}`,
  ].join("\n");
}
