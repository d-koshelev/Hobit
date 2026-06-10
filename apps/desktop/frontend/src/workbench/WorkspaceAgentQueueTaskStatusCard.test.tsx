import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import type { AgentQueueController } from "./queue/useAgentQueueController";
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

  it("clicking Open Queue calls only the open callback", () => {
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

    clickButton("Open Queue");

    expect(onOpenQueueItem).toHaveBeenCalledWith("queue-task-0001");
    expect(onViewReport).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("clicking View report calls only the report callback", () => {
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

    clickButton("View report");

    expect(onViewReport).toHaveBeenCalledWith("queue-task-0001");
    expect(onOpenQueueItem).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
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

function clickButton(text: string) {
  act(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.click();
  });
}

function queueController({
  onRun = vi.fn(),
  onStop = vi.fn(),
  runCanStart = true,
  selectedTask,
  tasks,
}: {
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
