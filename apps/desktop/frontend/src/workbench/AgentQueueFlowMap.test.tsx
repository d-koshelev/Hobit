import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { queueDependencyStatesByTask } from "./agentQueueTaskUiModel";
import { AgentQueueFlowMap } from "./AgentQueueFlowMap";
import { queueTagColorToken } from "./queue/agentQueueFlowMapModel";
import { getAssignedWorkerRoutingStates } from "./queue/agentQueueRoutingModel";

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
      ],
    });

    expect(document.body.textContent).toContain("Flow map");
    expect(document.body.textContent).toContain("Review");
    expect(document.body.textContent).toContain("Follow-up");
    expect(document.body.textContent).toContain("Work queue / blocked work");
    expect(document.body.textContent).toContain("Dependency barrier");
    expect(document.body.textContent).toContain("Review blocker blocks Blocked follow-up");
    expect(document.body.textContent).toContain("Blocked");
    expect(document.body.textContent).toContain("Blocked by: Review blocker");
    expect(document.body.textContent).toContain("Validating");
    expect(document.body.textContent).toContain("Agent Executor section");
    expect(document.body.textContent).toContain("Spare executor");
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
  onSelectTask = vi.fn(),
  tasks,
}: {
  onSelectTask?: (queueItemId: string) => void;
  tasks: AgentQueueTask[];
}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const dependencyStates = queueDependencyStatesByTask(tasks);
  const testWorkers = workers();

  act(() => {
    root?.render(
      <AgentQueueFlowMap
        dependencyStates={dependencyStates}
        isSelecting={false}
        onSelectTask={onSelectTask}
        pausedQueueTagIds={new Set()}
        routingStates={getAssignedWorkerRoutingStates(tasks, testWorkers, {
          dependencyStates,
          tasks,
        })}
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
