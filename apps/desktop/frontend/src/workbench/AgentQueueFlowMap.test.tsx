import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { queueDependencyStatesByTask } from "./agentQueueTaskUiModel";
import { AgentQueueFlowMap } from "./AgentQueueFlowMap";
import { queueTagColorToken } from "./queue/agentQueueFlowMapModel";
import { getAssignedWorkerRoutingStates } from "./queue/agentQueueRoutingModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
} from "./queue/agentQueueSchedulerModel";

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

describe("AgentQueueFlowMap", () => {
  it("renders queue tag groups, dependency barrier, executor lanes, and results", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          coordinatorStatus: "finalized",
          queueItemId: "completed-impl",
          queueTagId: "implementation",
          queueTagName: "Implementation",
          status: "completed",
          title: "Completed implementation",
        }),
        queueTask({
          queueItemId: "queued-review",
          queueTagId: "review",
          queueTagName: "Review",
          status: "queued",
          title: "Review blocker",
          validationStatus: "needs_review",
        }),
        queueTask({
          dependsOn: ["queued-review"],
          queueItemId: "blocked-follow-up",
          queueTagId: "follow-up",
          queueTagName: "Follow-up",
          status: "ready",
          title: "Blocked follow-up",
          validationStatus: "validating",
        }),
        queueTask({
          queueItemId: "validating-ready",
          queueTagId: "validation",
          queueTagName: "Validation",
          status: "ready",
          title: "Validating ready item",
          validationStatus: "validating",
        }),
      ],
    });

    expect(document.body.textContent).toContain("Flow map");
    expect(document.body.textContent).toContain("Review");
    expect(document.body.textContent).toContain("Follow-up");
    expect(document.body.textContent).toContain("Work queue / blocked work");
    expect(document.body.textContent).toContain("Dependency barrier");
    expect(document.body.textContent).toContain("blocks Blocked follow-up");
    expect(document.body.textContent).toContain("Blocked");
    expect(
      Array.from(document.querySelectorAll(".agent-queue-executor-info-box")).some(
        (element) => element.textContent?.includes("Blocked"),
      ),
    ).toBe(true);
    expect(document.body.textContent).toContain("Blocked by: Review blocker");
    expect(document.body.textContent).toContain("Validating");
    expect(
      Array.from(document.querySelectorAll(".agent-queue-executor-info-box")).some(
        (element) => element.textContent?.includes("Validating"),
      ),
    ).toBe(true);
    expect(document.body.textContent).toContain("Agent Executor section");
    expect(document.body.textContent).toContain("Max executors");
    expect(document.body.textContent).toContain("Spare executor");
    expect(document.body.textContent).toContain("Next: Review blocker");
    expect(document.body.textContent).toContain("Results");
    expect(document.body.textContent).toContain("Completed implementation");
  });

  it("applies tag color classes separately from execution status", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          queueItemId: "running-review",
          queueTagId: "review",
          queueTagName: "Review",
          status: "running",
          title: "Running review",
          validationStatus: "passed",
        }),
      ],
    });

    const block = document.querySelector<HTMLButtonElement>(
      ".agent-queue-flow-block[data-tag-color-token]",
    );

    expect(block?.dataset.tagColorToken).toBe(queueTagColorToken("review"));
    expect(block?.classList.contains(queueTagColorToken("review"))).toBe(true);
    expect(document.body.textContent).toContain("Running");
    expect(document.body.textContent).toContain("Passed");
  });

  it("renders compact executor info on work-item blocks", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          queueItemId: "waiting-task",
          status: "queued",
          title: "Waiting task",
        }),
      ],
    });

    const executorInfo = document.querySelector(
      ".agent-queue-flow-block .agent-queue-executor-info-box",
    );

    expect(executorInfo?.textContent).toContain("Executor");
    expect(executorInfo?.textContent).toContain("Waiting");
  });

  it("shows reported work in the results section without final acceptance", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          coordinatorStatus: "awaiting_coordinator_review",
          queueItemId: "reported-task",
          status: "queued",
          title: "Reported task",
          workerExecutionReports: [
            {
              changedFiles: [],
              commandsRun: [],
              createdAt: "2026-05-20T10:02:00.000Z",
              errors: [],
              itemId: "reported-task",
              reportId: "report-1",
              reportStatus: "reported",
              summary: "Worker report summary",
              validationCommandsSuggested: [],
              validationResult: "not_run",
              warnings: [],
              workerId: "executor-1",
            },
          ],
        }),
      ],
    });

    expect(document.body.textContent).toContain("Results / reports");
    expect(document.body.textContent).toContain("Reported task");
    expect(document.body.textContent).toContain("Report received");
    expect(document.body.textContent).toContain("Queued");
    expect(document.body.textContent).not.toContain("Completed");
  });

  it("renders working executor blocks from running worker state", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "worker-working",
          assignedWorkerId: "worker-working",
          queueItemId: "running-task",
          status: "running",
          title: "Running task",
        }),
      ],
    });

    const workingLane = document.querySelector(
      ".agent-queue-flow-executor-working",
    );

    expect(workingLane).not.toBeNull();
    expect(workingLane?.textContent).toContain("Running task");
    expect(workingLane?.textContent).toContain("Working");
    expect(document.querySelector(".agent-queue-flow-executor-spare")).not.toBeNull();
    expect(document.querySelector(".agent-queue-flow-executor-spare")?.textContent).toContain(
      "Spare executor",
    );
    expect(document.querySelector(".agent-queue-flow-executor-spare")?.textContent).toContain(
      "Item is not in a runnable execution state",
    );
  });

  it("shows global STOP as the spare executor dry-run reason", () => {
    renderFlowMap({
      globalExecutionState: "stopped",
      tasks: [
        queueTask({
          queueItemId: "stopped-task",
          title: "Stopped task",
        }),
      ],
    });

    expect(document.querySelector(".agent-queue-flow-executor-spare")?.textContent).toContain(
      "Queue is stopped",
    );
  });

  it("shows STOP + KILL RUNNING as a review request without claiming a kill happened", () => {
    renderFlowMap({
      globalExecutionState: "stop_kill_requested",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "worker-working",
          assignedWorkerId: "worker-working",
          queueItemId: "running-task",
          status: "running",
          title: "Running task",
        }),
        queueTask({
          queueItemId: "queued-task",
          title: "Queued task",
        }),
      ],
    });

    expect(document.body.textContent).toContain("STOP + KILL RUNNING");
    expect(document.body.textContent).toContain(
      "Termination requested / coordinator review needed",
    );
    expect(document.querySelector(".agent-queue-flow-executor-spare")?.textContent).toContain(
      "STOP + KILL RUNNING requested",
    );
  });

  it("selects a work item without starting executor or scheduler callbacks", () => {
    const onSelectTask = vi.fn();
    const onStart = vi.fn();
    renderFlowMap({
      onSelectTask,
      tasks: [
        queueTask({
          queueItemId: "select-me",
          title: "Select me",
        }),
      ],
    });

    clickButton("Select me");

    expect(onSelectTask).toHaveBeenCalledWith("select-me");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("selects the running item from a working executor block only", () => {
    const onSelectTask = vi.fn();
    renderFlowMap({
      onSelectTask,
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "worker-working",
          assignedWorkerId: "worker-working",
          queueItemId: "running-task",
          status: "running",
          title: "Running task",
        }),
      ],
    });

    clickButton("Worker working");

    expect(onSelectTask).toHaveBeenCalledWith("running-task");
  });
});

function renderFlowMap({
  globalExecutionState = "started",
  onSelectTask = vi.fn(),
  tasks,
}: {
  globalExecutionState?: "started" | "stopped" | "stop_kill_requested";
  onSelectTask?: (queueItemId: string) => void;
  tasks: AgentQueueTask[];
}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const dependencyStates = queueDependencyStatesByTask(tasks);
  const testWorkers = workers();
  const schedulerPlan = buildAgentQueueSchedulerPlan({
    dependencyStates,
    globalExecutionState,
    pausedQueueTagIds: new Set(),
    tasks,
    workers: testWorkers,
  });
  const embeddedExecutor = buildAgentQueueEmbeddedExecutorSection({
    dependencyStates,
    maxExecutors: 3,
    schedulerPlan,
    tasks,
    workers: testWorkers,
  });

  act(() => {
    root?.render(
      <AgentQueueFlowMap
        dependencyStates={dependencyStates}
        embeddedExecutor={embeddedExecutor}
        isSelecting={false}
        onSelectTask={onSelectTask}
        pausedQueueTagIds={new Set()}
        routingStates={getAssignedWorkerRoutingStates(tasks, testWorkers, {
          dependencyStates,
          tasks,
        })}
        schedulerPlan={schedulerPlan}
        selectedTask={tasks[0] ?? null}
        tasks={tasks}
        workers={testWorkers}
      />,
    );
  });
}

function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes(text),
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    itemType: "implementation",
    priority: 0,
    prompt: "Prompt",
    queueItemId: "queue-1",
    queueTagId: "default",
    queueTagName: "Default",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    validationStatus: "not_started",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function workers() {
  return [
    {
      currentItemId: "running-task",
      displayOrder: 0,
      enabled: true,
      lastReportSummary: null,
      name: "Worker working",
      scope: { kind: "all" as const },
      status: "running" as const,
      workerId: "worker-working",
    },
    {
      currentItemId: null,
      displayOrder: 1,
      enabled: true,
      lastReportSummary: null,
      name: "Worker spare",
      scope: { kind: "all" as const },
      status: "idle" as const,
      workerId: "worker-spare",
    },
  ];
}
