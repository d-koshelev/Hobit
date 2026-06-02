import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import { queueDependencyStatesByTask } from "./agentQueueTaskUiModel";
import { getAssignedWorkerRoutingStates } from "./queue/agentQueueRoutingModel";
import { AgentQueueTaskList } from "./AgentQueueTaskList";

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
});

describe("AgentQueueTaskList Queue + Workers fields", () => {
  it("renders the default queue tag for old task rows", () => {
    renderList([queueTask()]);

    expect(document.body.textContent).toContain("Tag Default");
    expect(document.body.textContent).toContain("Priority P0");
    expect(document.body.textContent).toContain("Order 1");
    expect(document.body.textContent).toContain("Not started");
    expect(document.body.textContent).toContain("Implementation");
  });

  it("renders execution and validation statuses separately", () => {
    renderList([
      queueTask({
        queueItemId: "queue-1",
        status: "running",
        validationStatus: "validating",
      }),
    ]);

    expect(document.body.textContent).toContain("Running");
    expect(document.body.textContent).toContain("Validating");
    expect(
      document.querySelector(".agent-queue-executor-info-box")?.textContent,
    ).toContain("Validating");
    expect(
      document.querySelector(".agent-queue-validation-animating"),
    ).not.toBeNull();
  });

  it("renders diff review as an independent item type", () => {
    renderList([
      queueTask({
        queueItemId: "source-1",
        title: "Implementation source",
      }),
      queueTask({
        diffReview: {
          reviewMode: "diff_vs_report",
          reviewTargetSummary: "Implementation source; commit abc1234",
          sourceCommitHash: "abc1234",
          sourceItemId: "source-1",
          sourceReportId: "report-1",
        },
        itemType: "diff_review",
        queueItemId: "review-1",
        queueTagName: "Review",
        title: "Review diff",
      }),
    ]);

    expect(document.body.textContent).toContain("Review diff");
    expect(document.body.textContent).toContain("Diff review");
    expect(document.body.textContent).toContain("Tag Review");
    expect(document.body.textContent).toContain(
      "Source Implementation source (source-1)",
    );
    expect(document.body.textContent).toContain(
      "Implementation source; commit abc1234",
    );
    expect(document.body.textContent).toContain("Diff review requested");
  });

  it("renders paused tag and assigned worker state on task rows", () => {
    renderList(
      [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          assignedWorkerId: "executor-1",
          queueTagId: "review",
          queueTagName: "Review",
        }),
      ],
      new Set(["review"]),
    );

    expect(document.body.textContent).toContain("Tag paused");
    expect(document.body.textContent).toContain("Worker Local executor");
    expect(document.querySelector(".agent-queue-task-row-paused")).not.toBeNull();
  });

  it("renders compact dependency state and blocked reason on task rows", () => {
    renderList([
      queueTask({
        queueItemId: "queue-1",
        status: "queued",
        title: "Prerequisite",
      }),
      queueTask({
        dependsOn: ["queue-1"],
        queueItemId: "queue-2",
        status: "ready",
        title: "Dependent",
      }),
    ]);

    expect(document.body.textContent).toContain("Dependent");
    expect(document.body.textContent).toContain("Deps blocked");
    expect(document.body.textContent).toContain("Blocked by: Prerequisite");
  });

  it("renders assigned worker eligibility and compact blocked reason", () => {
    renderList(
      [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          assignedWorkerId: "executor-1",
          prompt: "Run this",
          queueItemId: "queue-1",
          status: "ready",
        }),
      ],
      new Set(),
      true,
    );

    expect(document.body.textContent).toContain("Worker blocked");
    expect(document.body.textContent).toContain("Worker is disabled");
    expect(
      document.querySelector(".agent-queue-executor-info-box")?.textContent,
    ).toContain("Blocked");
  });

  it("renders plan ready or needed state on task rows", () => {
    renderList([
      queueTask({
        executionPlanPreview: {
          complexity: "low",
          estimatedMinutesMax: 10,
          estimatedMinutesMin: 5,
          estimatedTokenMax: 2000,
          estimatedTokenMin: 1000,
          expectedValidationCommands: [],
          generatedAt: "2026-05-20T10:00:00.000Z",
          itemId: "queue-1",
          likelyFilesOrAreas: [],
          planId: "plan-1",
          risk: "low",
          source: "heuristic",
          status: "planned",
          steps: ["Inspect"],
          workerId: "executor-1",
        },
      }),
      queueTask({
        queueItemId: "queue-2",
        title: "Needs plan",
      }),
    ]);

    expect(document.body.textContent).toContain("Plan ready");
    expect(document.body.textContent).toContain("Plan needed");
  });

  it("renders a worker report marker on task rows", () => {
    renderList([
      queueTask({
        coordinatorStatus: "awaiting_coordinator_review",
        workerExecutionReports: [
          {
            changedFiles: [],
            commandsRun: [],
            createdAt: "2026-05-20T10:02:00.000Z",
            errors: [],
            itemId: "queue-1",
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
    ]);

    expect(document.body.textContent).toContain("Report received");
    expect(document.body.textContent).toContain(
      "Awaiting coordinator review",
    );
    expect(
      document.querySelector(".agent-queue-executor-info-box")?.textContent,
    ).toContain("Reported");
  });

  it("renders coordinator finalization decision states on task rows", () => {
    renderList([
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "accepted",
        status: "completed",
        title: "Accepted task",
      }),
      queueTask({
        coordinatorStatus: "follow_up_required",
        queueItemId: "follow-up-required",
        status: "review_needed",
        title: "Follow-up required task",
      }),
      queueTask({
        coordinatorStatus: "rollback_required",
        queueItemId: "rollback-required",
        status: "review_needed",
        title: "Rollback required task",
      }),
    ]);

    expect(document.body.textContent).toContain("Finalized / accepted");
    expect(document.body.textContent).toContain("Follow-up required");
    expect(document.body.textContent).toContain("Rollback required");
  });
});

function renderList(
  tasks: AgentQueueTask[],
  pausedQueueTagIds: ReadonlySet<string> = new Set(),
  disabledWorker = false,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueTaskList
        dependencyStates={queueDependencyStatesByTask(tasks)}
        filteredTasks={tasks}
        isLoading={false}
        isSelecting={false}
        loadError={null}
        onSelectTask={vi.fn()}
        onStatusFilterChange={vi.fn()}
        pausedQueueTagIds={pausedQueueTagIds}
        routingStates={getAssignedWorkerRoutingStates(
          tasks,
          [
            {
              currentItemId: null,
              displayOrder: 0,
              enabled: !disabledWorker,
              lastReportSummary: null,
              name: "Agent Executor 1",
              scope: { kind: "all" },
              status: disabledWorker ? "paused" : "idle",
              workerId: "executor-1",
            },
          ],
          { pausedQueueTagIds, tasks },
        )}
        selectedTask={tasks[0] ?? null}
        statusFilter="all"
        tasks={tasks}
      />,
    );
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "Prompt",
    queueItemId: "queue-1",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
