import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { queueDependencyStatesByTask } from "./agentQueueTaskUiModel";
import { AgentQueueFlowMap } from "./AgentQueueFlowMap";
import { DEFAULT_AGENT_QUEUE_VIEW_MODE } from "./AgentQueuePlaceholderWidget";
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
  it("is the default Agent Queue view mode", () => {
    expect(DEFAULT_AGENT_QUEUE_VIEW_MODE).toBe("flow");
  });

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
    expect(document.body.textContent).toContain("Work Queue / Backlog");
    expect(document.body.textContent).toContain("Backlog lane");
    expect(document.body.textContent).toContain("Waiting / Not runnable");
    expect(document.body.textContent).toContain("Blocked work");
    expect(document.body.textContent).not.toContain("Ready layer");
    expect(document.body.textContent).toContain("Dependency barrier");
    expect(document.body.textContent).toContain("blocks Blocked follow-up");
    expect(document.body.textContent).toContain("Blocked");
    expect(document.body.textContent).toContain("Blocked by: Review blocker");
    expect(document.body.textContent).toContain("Validating");
    expect(document.body.textContent).toContain(
      "Local executor section / Working executors",
    );
    expect(document.body.textContent).toContain("Max executors");
    expect(document.body.textContent).toContain("Spare executor");
    expect(document.body.textContent).toContain("Next: Review blocker");
    expect(document.body.textContent).toContain(
      "Results / Reports / Completed work",
    );
    expect(document.body.textContent).toContain("Completed implementation");
    expect(document.querySelector(".agent-queue-flow-canvas")).not.toBeNull();
    expect(document.querySelector("[data-testid='queue-flow-topology-canvas']")).not.toBeNull();
    expect(document.querySelector(".agent-queue-flow-intake-region")).not.toBeNull();
    expect(document.querySelectorAll(".agent-queue-flow-top-lane")).toHaveLength(3);
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
      ".agent-queue-flow-executor-working[data-tag-color-token]",
    );

    expect(block?.dataset.tagColorToken).toBe(queueTagColorToken("review"));
    expect(block?.classList.contains(queueTagColorToken("review"))).toBe(true);
    expect(document.body.textContent).toContain("Running commands");
    expect(document.body.textContent).toContain("Passed");
  });

  it("renders compact worker or executor labels on work-item blocks", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          queueItemId: "waiting-task",
          status: "queued",
          title: "Waiting task",
        }),
      ],
    });

    const block = document.querySelector(".agent-queue-flow-block");

    expect(block?.textContent).toContain("Waiting");
    expect(block?.textContent).not.toContain("Priority");
    expect(block?.classList.contains("agent-queue-flow-block")).toBe(true);
  });

  it("keeps empty lane scaffolding compact without inventing work items", () => {
    renderFlowMap({
      tasks: [],
    });

    expect(document.querySelectorAll(".agent-queue-flow-top-lane")).toHaveLength(3);
    expect(document.querySelectorAll(".agent-queue-flow-block")).toHaveLength(0);
    expect(document.body.textContent).toContain("Backlog clear");
    expect(document.body.textContent).toContain("No waiting work");
    expect(document.body.textContent).toContain("No blocked work");
    expect(document.querySelectorAll(".agent-queue-flow-zone-empty")).toHaveLength(3);
  });

  it("shows the dev sample topology control without replacing real queue items by default", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          queueItemId: "real-queue-item",
          title: "Real queue item",
        }),
      ],
    });

    expect(document.body.textContent).toContain("Sample topology");
    expect(document.body.textContent).toContain("1 work item");
    expect(document.body.textContent).toContain("Real queue item");
    expect(document.body.textContent).not.toContain("Prepare API boundary patch");
    expect(
      document.querySelector('[data-queue-item-id="real-queue-item"]'),
    ).not.toBeNull();
  });

  it("does not apply dense sample layout to real Queue groups", () => {
    renderFlowMap({
      tasks: Array.from({ length: 15 }, (_, index) =>
        queueTask({
          orderIndex: index,
          queueItemId: `real-dense-${index + 1}`,
          queueTagId: "real-stack",
          queueTagName: "Real stack",
          title: `Real ${index + 1}`,
        }),
      ),
    });

    expect(document.body.textContent).toContain("15 work items");
    expect(document.body.textContent).toContain("Real stack");
    expect(document.querySelector(".agent-queue-flow-group-dense")).toBeNull();
    expect(document.querySelectorAll("[data-queue-item-id^='real-dense-']")).toHaveLength(
      15,
    );
  });

  it("renders representative sample topology zones for visual QA", () => {
    renderFlowMap({
      tasks: [],
    });

    clickButton("Sample topology");

    expect(document.body.textContent).toContain("43 sample blocks - Flow Map only");
    expect(document.body.textContent).toContain("Sample topology active.");
    expect(document.body.textContent).toContain("Work Queue / Backlog");
    expect(document.body.textContent).toContain("Waiting / Not runnable");
    expect(document.body.textContent).toContain("Blocked work");
    expect(document.body.textContent).toContain(
      "Local executor section / Working executors",
    );
    expect(document.body.textContent).toContain(
      "Results / Reports / Completed work",
    );
    expect(document.body.textContent).toContain("IN-01");
    expect(document.body.textContent).toContain("Dense lane A / 15-task stack");
    expect(document.body.textContent).toContain("Dense lane B / 15-task stack");
    expect(document.body.textContent).toContain("Q-01");
    expect(document.body.textContent).toContain("Q-15");
    expect(document.body.textContent).toContain("API-01");
    expect(document.body.textContent).toContain("API-15");
    expect(document.body.textContent).toContain("PLAN-01");
    expect(document.body.textContent).toContain("DEP-01");
    expect(document.body.textContent).toContain("RUN-01");
    expect(document.body.textContent).toContain("RUN-02");
    expect(document.body.textContent).toContain("Executor C");
    expect(document.body.textContent).toContain("OUT-01");
    expect(document.body.textContent).toContain("OUT-02");
    expect(document.body.textContent).toContain("FIX-01");
    expect(document.body.textContent).toContain("Default");
    expect(document.body.textContent).toContain("Implementation");
    expect(document.body.textContent).toContain("Priority P0");
    expect(document.body.textContent).toContain("Docs/Review");
    expect(document.body.textContent).toContain("Follow-up/Routing");
    expect(document.querySelector(".agent-queue-flow-canvas-sample")).not.toBeNull();
    expect(document.querySelectorAll(".agent-queue-flow-group-dense")).toHaveLength(2);
    expect(
      Array.from(document.querySelectorAll(".agent-queue-flow-block")).every(
        (block) => block.classList.contains("agent-queue-flow-block-compact"),
      ),
    ).toBe(true);
    expect(
      Array.from(document.querySelectorAll(".agent-queue-flow-block")).some((block) =>
        block.textContent?.includes("Sample"),
      ),
    ).toBe(false);
    expect(document.body.textContent).not.toContain("Triage workspace startup regression");
  });

  it("renders deterministic compact labels in both dense sample lanes", () => {
    renderFlowMap({
      tasks: [],
    });

    clickButton("Sample topology");

    const denseBlockLabels = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".agent-queue-flow-group-dense [data-queue-item-id]",
      ),
    ).map((block) => block.textContent?.trim());

    expect(denseBlockLabels).toEqual(
      [
        ...Array.from({ length: 15 }, (_, index) =>
          `Q-${(index + 1).toString().padStart(2, "0")}`,
        ),
        ...Array.from({ length: 15 }, (_, index) =>
          `API-${(index + 1).toString().padStart(2, "0")}`,
        ),
      ],
    );
  });

  it("does not duplicate sample nodes across primary Flow Map zones", () => {
    renderFlowMap({
      tasks: [],
    });

    clickButton("Sample topology");

    const sampleItemIds = Array.from(
      document.querySelectorAll<HTMLElement>("[data-queue-item-id^='sample-']"),
    ).map((item) => item.dataset.queueItemId);

    expect(sampleItemIds).toHaveLength(43);
    expect(new Set(sampleItemIds).size).toBe(43);
  });

  it("keeps sample selection local and restores real selection when sample mode is off", () => {
    const onSelectTask = vi.fn();

    renderFlowMap({
      onSelectTask,
      tasks: [
        queueTask({
          queueItemId: "real-selected",
          title: "Real selected item",
        }),
      ],
    });

    clickButton("Sample topology");
    clickButton("API-00");

    expect(onSelectTask).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Sample selected: API-00");

    clickButton("Sample topology");

    expect(
      document
        .querySelector('[data-queue-item-id="real-selected"]')
        ?.getAttribute("aria-current"),
    ).toBe("true");

    clickButton("Real selected item");

    expect(onSelectTask).toHaveBeenCalledWith("real-selected");
  });

  it("renders each queue item once across primary flow-map zones", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          queueItemId: "ready-item",
          status: "queued",
          title: "Ready item",
        }),
        queueTask({
          queueItemId: "draft-item",
          status: "draft",
          title: "Draft item",
        }),
        queueTask({
          coordinatorStatus: "blocked",
          queueItemId: "blocked-item",
          status: "queued",
          title: "Blocked item",
        }),
        queueTask({
          assignedExecutorWidgetId: "worker-working",
          assignedWorkerId: "worker-working",
          queueItemId: "running-task",
          status: "running",
          title: "Running task",
        }),
        queueTask({
          queueItemId: "completed-item",
          status: "completed",
          title: "Completed item",
        }),
      ],
    });

    for (const queueItemId of [
      "ready-item",
      "draft-item",
      "blocked-item",
      "running-task",
      "completed-item",
    ]) {
      expect(
        document.querySelectorAll(`[data-queue-item-id="${queueItemId}"]`),
      ).toHaveLength(1);
    }

    expect(
      document.querySelector('[aria-label="Waiting work"]')?.textContent,
    ).toContain("Draft item");
    expect(
      document.querySelector('[aria-label="Waiting work"]')?.textContent,
    ).not.toContain("Blocked item");
    expect(
      document.querySelector('[aria-label="Blocked work"]')?.textContent,
    ).toContain("Blocked item");
    expect(
      document.querySelector('[aria-label="Blocked work"]')?.textContent,
    ).not.toContain("Draft item");
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

    expect(document.body.textContent).toContain(
      "Results / Reports / Completed work",
    );
    expect(document.body.textContent).toContain("Reported task");
    expect(document.body.textContent).toContain("Report ready");
    expect(document.body.textContent).toContain("Awaiting review");
    expect(document.querySelector(".agent-queue-flow-result-group")?.textContent).not.toContain(
      "Queued",
    );
    expect(document.querySelector(".agent-queue-flow-result-group")?.textContent).not.toContain(
      "Completed",
    );
    expect(document.querySelector(".agent-queue-flow-results")?.textContent).toContain(
      "Reported task",
    );
  });

  it("shows execution-complete unfinalized results without completed or done labels", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          coordinatorStatus: "awaiting_coordinator_review",
          queueItemId: "execution-complete-task",
          status: "completed",
          title: "Execution evidence task",
        }),
      ],
    });

    const resultsText =
      document.querySelector(".agent-queue-flow-result-group")?.textContent ?? "";

    expect(resultsText).toContain("Execution evidence task");
    expect(resultsText).toContain("Execution complete");
    expect(resultsText).toContain("Awaiting review");
    expect(resultsText).not.toContain("Completed");
    expect(resultsText).not.toContain("Done");
  });

  it("renders finalized, needs changes, and rollback required coordinator markers", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          coordinatorStatus: "finalized",
          queueItemId: "finalized-task",
          status: "completed",
          title: "Accepted task",
        }),
        queueTask({
          coordinatorStatus: "needs_changes",
          queueItemId: "needs-changes-task",
          status: "review_needed",
          title: "Needs changes task",
        }),
        queueTask({
          coordinatorStatus: "rollback_required",
          queueItemId: "rollback-task",
          status: "review_needed",
          title: "Rollback task",
        }),
      ],
    });

    expect(document.body.textContent).toContain("Finalized");
    expect(document.body.textContent).toContain("Needs changes");
    expect(document.body.textContent).toContain("Rollback required");
  });

  it("renders diff review source metadata and source-item requested marker", () => {
    renderFlowMap({
      tasks: [
        queueTask({
          queueItemId: "source-task",
          title: "Source implementation",
        }),
        queueTask({
          diffReview: {
            reviewMode: "diff_vs_report",
            reviewTargetSummary: "Source implementation; commit abc1234",
            sourceCommitHash: "abc1234",
            sourceItemId: "source-task",
            sourceReportId: "report-1",
          },
          itemType: "diff_review",
          queueItemId: "diff-review-task",
          queueTagId: "review",
          queueTagName: "Review",
          title: "Review diff",
        }),
      ],
    });

    expect(document.body.textContent).toContain("Review diff");
    expect(document.body.textContent).toContain("Diff review");
    expect(
      document.querySelector<HTMLButtonElement>('button[title*="Source item"]')
        ?.title,
    ).toContain("Source implementation (source-task)");
    expect(
      document.querySelector<HTMLButtonElement>('button[title*="Review target"]')
        ?.title,
    ).toContain(
      "Source implementation; commit abc1234",
    );
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

  it("shows global disabled state as the spare executor dry-run reason", () => {
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
      "Queue is disabled",
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
