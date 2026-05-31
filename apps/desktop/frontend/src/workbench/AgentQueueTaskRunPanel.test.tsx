import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskDetailsPanel } from "./AgentQueueTaskDetailsPanel";
import type {
  AgentQueueAutorunController,
  AgentQueueExecutionPlanController,
  AgentQueueLatestRunLinkController,
  AgentQueueRunController,
  AgentQueueRunHistoryController,
  AgentQueueRunnerController,
  AgentQueueWorkerReportController,
} from "./queue/useAgentQueueController";
import {
  queueDependencyStatesByTask,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import { getAssignedWorkerRoutingStates } from "./queue/agentQueueRoutingModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
} from "./queue/agentQueueSchedulerModel";
import type { AgentExecutorSlot } from "./types";
import type {
  AgentQueueExecutionPlanPreview,
  AgentQueueReportActionCard,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";

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

describe("AgentQueueTaskRunPanel latest run summary", () => {
  it("renders a generated plan preview without starting execution", () => {
    const onGenerate = vi.fn();

    renderPanel({
      executionPlan: executionPlanController(planPreview(), onGenerate),
    });

    expect(document.body.textContent).toContain("Plan preview");
    expect(document.body.textContent).toContain("Plan ready");
    expect(document.body.textContent).toContain("Approx. 1,000-2,000 tokens");
    expect(document.body.textContent).toContain("Inspect the current implementation");
    expect(document.body.textContent).toContain(
      "npm.cmd run test --prefix apps/desktop/frontend",
    );

    clickFirstButton("Refresh plan");

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows a no-run state when the selected task has no run link", () => {
    renderPanel({
      latestRun: latestRunController(null),
      runHistory: runHistoryController([]),
    });

    expect(document.body.textContent).toContain("Latest run");
    expect(document.body.textContent).toContain("Run history");
    expect(document.body.textContent).toContain("No runs yet.");
  });

  it("shows latest run status and source without raw payload fields", () => {
    renderPanel({
      latestRun: latestRunController(runLink({
        completedAt: "2026-05-22T10:01:00.000Z",
        directWorkRunId: "run_safe_123456",
        reviewStatus: "review_needed",
        source: "manual",
        status: "completed",
      })),
    });

    expect(document.body.textContent).toContain("completed");
    expect(document.body.textContent).toContain("manual");
    expect(document.body.textContent).not.toContain("stdout");
    expect(document.body.textContent).not.toContain("stderr");
    expect(document.body.textContent).not.toContain("final response");
    expect(document.body.textContent).not.toContain("diff");
    expect(document.body.textContent).not.toContain("repo_root");
    expect(document.body.textContent).not.toContain("operatorPrompt");
    expect(document.body.textContent).not.toContain("payloadJson");
  });

  it("shows recent safe run history status, source, and compact run ref", () => {
    renderPanel({
      latestRun: latestRunController(runLink({ status: "failed" })),
      runHistory: runHistoryController([
        runLink({
          directWorkRunId: "run_safe_recent_123456",
          linkId: "link_recent",
          source: "autorun",
          status: "failed",
        }),
      ]),
    });

    expect(document.body.textContent).toContain("Run history");
    expect(document.body.textContent).toContain("failed");
    expect(document.body.textContent).toContain("autorun");
    expect(document.body.textContent).toContain("Run 123456");
    expect(document.body.textContent).not.toContain("stdout");
    expect(document.body.textContent).not.toContain("final response");
    expect(document.body.textContent).not.toContain("diff");
  });

  it("limits run history to the latest three rows", () => {
    renderPanel({
      latestRun: latestRunController(runLink({ directWorkRunId: "run_1" })),
      runHistory: runHistoryController([
        runLink({ directWorkRunId: "run_1", linkId: "link_1" }),
        runLink({ directWorkRunId: "run_2", linkId: "link_2" }),
        runLink({ directWorkRunId: "run_3", linkId: "link_3" }),
        runLink({ directWorkRunId: "run_4", linkId: "link_4" }),
      ]),
    });

    expect(document.body.textContent).toContain("Showing latest 3 of 4 total runs.");
    expect(document.body.textContent).toContain("Run run1");
    expect(document.body.textContent).toContain("Run run2");
    expect(document.body.textContent).toContain("Run run3");
    expect(document.body.textContent).not.toContain("Run run4");
  });

  it("opens the owning Executor from the latest run using only safe refs", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      latestRun: latestRunController(runLink({
        completedAt: null,
        directWorkRunId: "run_safe_123456",
        reviewStatus: null,
        source: "autorun",
        status: "running",
      })),
      onOpenAgentExecutorRun,
    });

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open Executor",
    );

    act(() => {
      openButtons[0]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onOpenAgentExecutorRun).toHaveBeenCalledWith({
      executorWidgetInstanceId: "executor_visible",
      runId: "run_safe_123456",
    });
  });

  it("attaches latest run safe metadata to Coordinator without raw output fields", () => {
    const onAttachContextToCoordinator = vi.fn();

    renderPanel({
      latestRun: latestRunController(runLink({
        completedAt: "2026-05-22T10:01:00.000Z",
        directWorkRunId: "run_safe_latest_123456",
        reviewStatus: "review_needed",
        source: "manual",
        status: "completed",
        validationStatus: "passed",
      })),
      onAttachContextToCoordinator,
    });

    clickFirstButton("Attach to Workspace Agent");

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Queue latest run");
    expect(request.contextText).toContain("Queue run metadata");
    expect(request.contextText).toContain("Queue task: Task (task_1)");
    expect(request.contextText).toContain("run_safe_latest_123456");
    expect(request.contextText).toContain("Source: manual");
    expect(request.contextText).toContain("Status: completed");
    expect(request.contextText).toContain("Validation: passed");
    expect(request.contextText).not.toMatch(
      /stdout|stderr|final response|diff|repo_root|operatorPrompt|payloadJson|secret/i,
    );
  });

  it("opens the owning Executor from a history row using only safe refs", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      onOpenAgentExecutorRun,
      runHistory: runHistoryController([
        runLink({
          directWorkRunId: "run_history_safe_123456",
          linkId: "link_history",
        }),
      ]),
    });

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open Executor",
    );

    act(() => {
      openButtons[0]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onOpenAgentExecutorRun).toHaveBeenCalledWith({
      executorWidgetInstanceId: "executor_visible",
      runId: "run_history_safe_123456",
    });
  });

  it("attaches run history row safe metadata to Coordinator", () => {
    const onAttachContextToCoordinator = vi.fn();

    renderPanel({
      onAttachContextToCoordinator,
      runHistory: runHistoryController([
        runLink({
          directWorkRunId: "run_history_safe_123456",
          linkId: "link_history",
          source: "autorun",
          status: "failed",
        }),
      ]),
    });

    clickFirstButton("Attach to Workspace Agent");

    expect(onAttachContextToCoordinator).toHaveBeenCalledTimes(1);
    const request = onAttachContextToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Queue run history row");
    expect(request.contextText).toContain("Queue run metadata");
    expect(request.contextText).toContain("run_history_safe_123456");
    expect(request.contextText).toContain("Source: autorun");
    expect(request.contextText).toContain("Status: failed");
    expect(request.contextText).not.toMatch(
      /stdout|stderr|final response|diff|repo_root|operatorPrompt|payloadJson|secret/i,
    );
  });

  it("shows a compact disabled reason when the owning Executor is not visible", () => {
    const onOpenAgentExecutorRun = vi.fn();

    renderPanel({
      executorSlots: [],
      hasExecutorSlots: false,
      latestRun: latestRunController(runLink({
        executorWidgetId: "executor_missing",
      })),
      runHistory: runHistoryController([
        runLink({
          executorWidgetId: "executor_missing",
          linkId: "link_missing",
        }),
      ]),
      onOpenAgentExecutorRun,
    });

    expect(document.body.textContent).toContain(
      "Owning Agent Executor is not visible on this Workbench.",
    );
    expect(document.body.textContent).toContain("Executor not visible");

    const openButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent === "Open Executor",
    );

    expect(openButtons).toHaveLength(2);
    expect(openButtons.every((button) => button.disabled)).toBe(true);
    act(() => {
      openButtons.forEach((button) =>
        button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
      );
    });
    expect(onOpenAgentExecutorRun).not.toHaveBeenCalled();
  });

  it("warns and prevents assignment when the selected worker scope does not match the task tag", () => {
    const onAssign = vi.fn();

    renderPanel({
      onAssign,
      selectedTask: {
        ...queueTask(),
        assignedExecutorWidgetId: null,
        queueTagId: "default",
        queueTagName: "Default",
      },
      workers: [
        {
          currentItemId: null,
          displayOrder: 0,
          enabled: true,
          lastReportSummary: null,
          name: "Agent Executor visible",
          scope: {
            kind: "queue_tag",
            queueTagId: "review",
            queueTagName: "Review",
          },
          status: "idle",
          workerId: "executor_visible",
        },
      ],
    });

    expect(document.body.textContent).toContain(
      "Selected worker is scoped to Review.",
    );
    clickFirstButton("Assign");

    expect(onAssign).not.toHaveBeenCalled();
  });

  it("shows danger_full_access as an explicit unsafe Queue run sandbox", () => {
    renderPanel({
      run: {
        ...runController(),
        readinessMessage: null,
        sandbox: "danger_full_access",
      },
    });

    expect(document.body.textContent).toContain("danger_full_access");
    expect(document.body.textContent).toContain(
      "danger_full_access is unsafe",
    );
    expect(document.body.textContent).toContain(
      "disables Codex sandbox restrictions",
    );
    expect(document.body.textContent).toContain("will still not auto-commit");
  });
});

describe("AgentQueueTaskDetailsPanel expanded detail", () => {
  it("shows expanded header metadata, prompt, and expected plan without starting execution", () => {
    const onGenerate = vi.fn();
    const onStartAssignedTask = vi.fn();
    const selectedTask = {
      ...queueTask(),
      description: "Implementation details",
      executionPlanPreview: planPreview(),
      queueTagId: "implementation",
      queueTagName: "Implementation",
      title: "Expanded queue detail",
    };

    renderDetailsPanel({
      executionPlan: executionPlanController(
        selectedTask.executionPlanPreview,
        onGenerate,
      ),
      run: {
        ...runController(),
        onStartAssignedTask,
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Selected work item");
    expect(document.body.textContent).toContain("Expanded queue detail");
    expect(document.body.textContent).toContain("Implementation");
    expect(document.body.textContent).toContain("Priority P1");
    expect(document.body.textContent).toContain("Executor");
    expect(document.body.textContent).toContain("Submitted metadata");
    expect(document.body.textContent).toContain("Prompt");
    expect(document.body.textContent).toContain("Expected plan of work");
    expect(document.body.textContent).toContain("Approx. 1,000-2,000 tokens");
    expect(document.body.textContent).toContain(
      "Structured metadata only; never appended to the prompt.",
    );

    clickFirstButton("Refresh plan");

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("explains that a new draft prompt item needs a ready state before execution", () => {
    const onStartEdit = vi.fn();
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: null,
      executionPlanPreview: null,
      status: "draft" as const,
      title: "Prompt implementation draft",
    };

    renderDetailsPanel({
      editTask: editController({ onStart: onStartEdit }),
      run: {
        ...runController(),
        readinessMessage:
          "Draft tasks can stay in planning without an execution workspace. Set status to queued, ready, or review needed before configuring execution.",
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Next action");
    expect(document.body.textContent).toContain("Needs plan / ready state");
    expect(document.body.textContent).toContain(
      "Top blocker: Item is not in a runnable execution state.",
    );
    expect(document.body.textContent).toContain(
      "Set Execution status to Queued or Ready",
    );
    expect(document.body.textContent).toContain("No worker report yet.");

    clickFirstButton("Edit status");

    expect(onStartEdit).toHaveBeenCalledTimes(1);
  });

  it("shows assigned runnable items as ready after execution workspace setup", () => {
    const selectedTask = {
      ...queueTask(),
      assignedExecutorWidgetId: "executor_visible",
      status: "ready" as const,
    };

    renderDetailsPanel({
      run: {
        ...runController(),
        preconditionMessages: [
          "Execution workspace is required for Codex Direct Work execution.",
        ],
        readinessMessage: null,
      },
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Ready to run after setup");
    expect(document.body.textContent).toContain(
      "Enter the execution workspace",
    );
    expect(document.body.textContent).toContain(
      "Execution workspace is required for Codex Direct Work execution.",
    );
  });

  it("keeps coordinator finalization collapsed before worker evidence exists", () => {
    renderDetailsPanel();

    const finalizationDetails = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("details"),
    ).find((details) =>
      details.querySelector("summary")?.textContent?.includes(
        "Coordinator finalization",
      ),
    );

    expect(finalizationDetails).not.toBeUndefined();
    expect(finalizationDetails?.open).toBe(false);
  });

  it("shows stale and no-plan expected plan states", () => {
    const staleTask = {
      ...queueTask(),
      executionPlanPreview: planPreview({ status: "stale" }),
    };

    renderDetailsPanel({
      executionPlan: executionPlanController(staleTask.executionPlanPreview),
      selectedTask: staleTask,
      tasks: [staleTask],
    });

    expect(document.body.textContent).toContain("Plan stale");
    expect(document.body.textContent).toContain("This plan is stale.");

    root?.unmount();
    container?.remove();
    root = null;
    container = null;
    document.body.innerHTML = "";

    const noPlanTask = queueTask();
    renderDetailsPanel({
      executionPlan: executionPlanController(null),
      selectedTask: noPlanTask,
      tasks: [noPlanTask],
    });

    expect(document.body.textContent).toContain("No expected plan has been generated.");
    expect(document.body.textContent).toContain("Generate plan preview");
  });

  it("renders worker report evidence without finalizing the task", () => {
    const report = workerReport({
      changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
      commandsRun: ["npm.cmd run typecheck --prefix apps/desktop/frontend"],
      commitHash: "abc1234",
      errors: ["One focused test still fails."],
      followUpRecommendation: "Create a follow-up/sub-block for the failing test.",
      rollbackRecommendation: "Review before any rollback decision.",
      validationCommandsSuggested: ["npm.cmd run test --prefix apps/desktop/frontend"],
      warnings: ["Diff review is still required."],
    });
    const onAttachDemoReport = vi.fn();
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "queued" as const,
      validationStatus: "not_started" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report, onAttachDemoReport),
    });

    expect(document.body.textContent).toContain("Worker execution report");
    expect(document.body.textContent).toContain("Reported");
    expect(document.body.textContent).toContain("Awaiting review");
    expect(document.body.textContent).toContain("Worker report summary");
    expect(document.body.textContent).toContain("QueueReport.tsx");
    expect(document.body.textContent).toContain(
      "npm.cmd run typecheck --prefix apps/desktop/frontend",
    );
    expect(document.body.textContent).toContain("Diff review is still required.");
    expect(document.body.textContent).toContain("One focused test still fails.");
    expect(document.body.textContent).toContain("abc1234");
    expect(document.body.textContent).toContain(
      "Follow-up/sub-block recommendation",
    );
    expect(document.body.textContent).toContain("Rollback recommendation");
    expect(document.body.textContent).toContain(
      "Worker reports do not finalize Queue item status.",
    );
    expect(document.body.textContent).toContain("Queued");
    expect(document.body.textContent).toContain("Not started");

    clickFirstButton("Attach another report");

    expect(onAttachDemoReport).toHaveBeenCalledTimes(1);
  });

  it("renders explicit coordinator finalization actions", () => {
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "ready_for_finalization" as const,
      status: "review_needed" as const,
      validationStatus: "needs_review" as const,
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [selectedTask],
    });

    expect(document.body.textContent).toContain("Coordinator finalization");
    expect(document.body.textContent).toContain("Ready for finalization");
    expect(document.body.textContent).toContain("Finalize / Accept item");
    expect(document.body.textContent).toContain("Mark needs changes");
    expect(document.body.textContent).toContain("Create follow-up item");
    expect(document.body.textContent).toContain("Mark rollback required");
  });

  it("shows create diff review action and source linkage without starting execution", () => {
    const report = workerReport({
      commitHash: "abc1234",
      changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
    });
    const onCreateDiffReview = vi.fn();
    const selectedTask = {
      ...queueTask(),
      coordinatorStatus: "awaiting_coordinator_review" as const,
      status: "queued" as const,
      workerExecutionReports: [report],
    };

    renderDetailsPanel({
      diffReview: {
        canCreate: true,
        linkedReviewTasks: [
          {
            ...queueTask(),
            diffReview: {
              reviewMode: "diff_vs_report",
              reviewTargetSummary: "Task; commit abc1234",
              sourceCommitHash: "abc1234",
              sourceItemId: "task_1",
              sourceReportId: "report-1",
            },
            itemType: "diff_review",
            queueItemId: "diff-review-1",
            status: "queued",
            title: "Diff review: Task",
          },
        ],
        message: null,
        onCreate: onCreateDiffReview,
      },
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    expect(document.body.textContent).toContain("Create diff review item");
    expect(document.body.textContent).toContain("Diff review requested");
    expect(document.body.textContent).toContain(
      "Source item remains pending coordinator review",
    );

    clickFirstButton("Create diff review item");

    expect(onCreateDiffReview).toHaveBeenCalledTimes(1);
  });

  it("sends worker report action cards to Workspace Chat and records linkage", () => {
    const report = workerReport({
      changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
      warnings: ["Diff review is still required."],
      errors: ["One focused test still fails."],
    });
    const onShown = vi.fn();
    const onShowQueueReportInWorkspaceChat = vi.fn();
    const selectedTask = {
      ...queueTask(),
      workerExecutionReports: [report],
    };
    const card = reportActionCard();

    renderDetailsPanel({
      onShowQueueReportInWorkspaceChat,
      reportActionCard: {
        diffReviewReportCard: null,
        latestShownCardId: null,
        message: null,
        onShown,
        workerReportCard: card,
      },
      selectedTask,
      tasks: [selectedTask],
      workerReport: workerReportController(report),
    });

    expect(document.body.textContent).toContain("Not shown in Chat");

    clickFirstButton("Show in Workspace Chat");

    expect(onShowQueueReportInWorkspaceChat).toHaveBeenCalledWith(card);
    expect(onShown).toHaveBeenCalledWith(card.cardId);
  });

  it("shows diff review source metadata on diff review items", () => {
    const sourceTask = {
      ...queueTask(),
      queueItemId: "source-task",
      title: "Source implementation",
    };
    const selectedTask = {
      ...queueTask(),
      diffReview: {
        reviewMode: "diff_vs_report" as const,
        reviewTargetSummary: "Source implementation; commit abc1234",
        sourceCommitHash: "abc1234",
        sourceItemId: "source-task",
        sourceReportId: "report-1",
      },
      itemType: "diff_review" as const,
      queueItemId: "diff-review-task",
      status: "queued" as const,
      title: "Review source diff",
    };

    renderDetailsPanel({
      selectedTask,
      tasks: [sourceTask, selectedTask],
    });

    expect(document.body.textContent).toContain("Diff review source");
    expect(document.body.textContent).toContain(
      "Source implementation (source-task)",
    );
    expect(document.body.textContent).toContain("report-1");
    expect(document.body.textContent).toContain("abc1234");
    expect(document.body.textContent).toContain("Diff vs report");
    expect(document.body.textContent).toContain("Open source item");
  });
});

function renderPanel(
  overrides: Partial<ComponentProps<typeof AgentQueueTaskRunPanel>>,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const queueTags = overrides.queueTags ?? [
    {
      queueTagId: "default",
      queueTagName: "Default",
      coordinatorReviewCount: 0,
      failedValidationCount: 0,
      needsCoordinatorReview: false,
      needsReviewCount: 0,
      pauseReason: null,
      runningCount: 0,
      status: "running" as const,
      taskCount: 1,
      validatingCount: 0,
    },
  ];

  act(() => {
    root?.render(
      <AgentQueueTaskRunPanel
        apiAvailable={true}
        assignmentError={null}
        assignmentMessage={null}
        autorun={autorunController()}
        currentSelection="executor_visible"
        executorSlots={executorSlots()}
        executionPlan={executionPlanController(null)}
        hasExecutorSlots={true}
        inputId="executor-select"
        isAssigning={false}
        isDirty={false}
        latestRun={latestRunController(null)}
        onAssign={vi.fn()}
        onClear={vi.fn()}
        onOpenAgentExecutorRun={vi.fn()}
        onSelectionChange={vi.fn()}
        run={runController()}
        runHistory={runHistoryController([])}
        runner={runnerController()}
        selectedTask={queueTask()}
        workers={[
          {
          currentItemId: null,
          displayOrder: 0,
          enabled: true,
          lastReportSummary: null,
            name: "Agent Executor visible",
            scope: { kind: "all" },
            status: "idle",
            workerId: "executor_visible",
          },
        ]}
        {...overrides}
        queueTags={queueTags}
      />,
    );
  });
}

function renderDetailsPanel({
  editTask = editController(),
  executionPlan = executionPlanController(null),
  latestRun = latestRunController(null),
  onShowQueueReportInWorkspaceChat,
  reportActionCard,
  run = runController(),
  runHistory = runHistoryController([]),
  selectedTask = queueTask(),
  tasks = [selectedTask],
  workerReport = workerReportController(
    selectedTask.workerExecutionReports?.[
      (selectedTask.workerExecutionReports?.length ?? 0) - 1
    ] ?? null,
  ),
  diffReview,
}: {
  diffReview?: ComponentProps<typeof AgentQueueTaskDetailsPanel>["queue"]["diffReview"];
  editTask?: ReturnType<typeof editController>;
  executionPlan?: AgentQueueExecutionPlanController;
  latestRun?: AgentQueueLatestRunLinkController;
  onShowQueueReportInWorkspaceChat?: ComponentProps<
    typeof AgentQueueTaskDetailsPanel
  >["onShowQueueReportInWorkspaceChat"];
  reportActionCard?: ComponentProps<
    typeof AgentQueueTaskDetailsPanel
  >["queue"]["reportActionCard"];
  run?: AgentQueueRunController;
  runHistory?: AgentQueueRunHistoryController;
  selectedTask?: AgentQueueTask;
  tasks?: AgentQueueTask[];
  workerReport?: AgentQueueWorkerReportController;
} = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const dependencyStates = queueDependencyStatesByTask(tasks);
  const workers = [
    {
      currentItemId: selectedTask.status === "running" ? selectedTask.queueItemId : null,
      displayOrder: 0,
      enabled: true,
      lastReportSummary: null,
      name: "Agent Executor visible",
      scope: { kind: "all" as const },
      status: selectedTask.status === "running" ? "running" as const : "idle" as const,
      workerId: "executor_visible",
    },
  ];
  const schedulerPlan = buildAgentQueueSchedulerPlan({
    dependencyStates,
    globalExecutionState: "started",
    pausedQueueTagIds: new Set(),
    tasks,
    workers,
  });
  const queueTags = [
    {
      coordinatorReviewCount: 0,
      failedValidationCount: 0,
      needsCoordinatorReview: false,
      needsReviewCount: 0,
      pauseReason: null,
      queueTagId: selectedTask.queueTagId ?? "default",
      queueTagName: selectedTask.queueTagName ?? "Default",
      runningCount: selectedTask.status === "running" ? 1 : 0,
      status: "running" as const,
      taskCount: tasks.length,
      validatingCount: selectedTask.validationStatus === "validating" ? 1 : 0,
    },
  ];
  const queue = {
    agentExecutorSlots: executorSlots(),
    apiAvailable: true,
    assignedWorkerRoutingStates: getAssignedWorkerRoutingStates(tasks, workers, {
      dependencyStates,
      globalExecutionState: "started",
      pausedQueueTagIds: new Set(),
      tasks,
    }),
    assignSelectedTask: vi.fn(),
    assignmentApiAvailable: true,
    assignmentError: null,
    assignmentMessage: null,
    autorun: autorunController(),
    clearSelectedTaskAssignment: vi.fn(),
    createTask: vi.fn(),
    deleteTask: deleteController(),
    diffReview: diffReview ?? {
      canCreate: false,
      linkedReviewTasks: tasks.filter(
        (task) => task.diffReview?.sourceItemId === selectedTask.queueItemId,
      ),
      message: null,
      onCreate: vi.fn(),
    },
    dependencyStates,
    draft: draftFromTask(selectedTask),
    editTask,
    editorError: null,
    executionPlan,
    filteredTasks: tasks,
    coordinatorFinalization: {
      canAct: true,
      message: null,
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
    foundation: {
      embeddedExecutor: buildAgentQueueEmbeddedExecutorSection({
        dependencyStates,
        maxExecutors: 1,
        schedulerPlan,
        tasks,
        workers,
      }),
      globalExecutionState: "started" as const,
      globalMessage: null,
      globalStatus: "started" as const,
      maxExecutorMessage: null,
      onCreateQueueTag: vi.fn(),
      onCreateWorker: vi.fn(),
      onDeleteQueueTag: vi.fn(),
      onDeleteWorker: vi.fn(),
      onMaxExecutorsChange: vi.fn(),
      onPauseQueueTag: vi.fn(),
      onRenameQueueTag: vi.fn(),
      onRenameWorker: vi.fn(),
      onResumeQueueTag: vi.fn(),
      onStartWorkers: vi.fn(),
      onStopAndKillRunning: vi.fn(),
      onStopWorkers: vi.fn(),
      onWorkerEnabledChange: vi.fn(),
      onWorkerScopeChange: vi.fn(),
      pausedQueueTagIds: new Set<string>(),
      queueTags,
      schedulerPlan,
      tagManagementError: null,
      tagManagementMessage: null,
      validationSummary: {
        failed: 0,
        needs_review: 0,
        not_started: 0,
        passed: 0,
        validating: 0,
      },
      workers,
    },
    isAssigning: false,
    isCreating: false,
    isDirty: false,
    isEditing: false,
    isLoading: false,
    isSaving: false,
    isSelecting: false,
    latestRun,
    loadError: null,
    ordering: {
      canMoveDown: false,
      canMoveToBottom: false,
      canMoveToTop: false,
      canMoveUp: false,
      message: null,
      onMoveDown: vi.fn(),
      onMoveToBottom: vi.fn(),
      onMoveToTop: vi.fn(),
      onMoveUp: vi.fn(),
      orderLabel: "1 of 1",
    },
    refreshTasks: vi.fn(),
    reportActionCard: {
      diffReviewReportCard: null,
      latestShownCardId: selectedTask.workspaceChatReportCardId ?? null,
      message: null,
      onShown: vi.fn(),
      workerReportCard: null,
      ...reportActionCard,
    },
    run,
    runHistory,
    runner: runnerController(),
    saveStateText: "Saved",
    saveTask: vi.fn(),
    selectExecutorWidget: vi.fn(),
    selectedExecutorWidgetId: "executor_visible",
    selectedTask,
    selectTask: vi.fn(),
    setStatusFilter: vi.fn(),
    statusFilter: "all" as const,
    tasks,
    updateDraft: vi.fn(),
    updatePriority: vi.fn(),
    validationMessage: null,
    workerReport,
  } as unknown as ComponentProps<typeof AgentQueueTaskDetailsPanel>["queue"];

  act(() => {
    root?.render(
      <AgentQueueTaskDetailsPanel
        agentExecutorSlots={executorSlots()}
        assignmentInputId="assignment"
        descriptionInputId="description"
        executionPolicyInputId="execution-policy"
        priorityInputId="priority"
        promptInputId="prompt"
        queue={queue}
        onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
        selectedTaskHint="Task hint"
        statusInputId="status"
        titleInputId="title"
      />,
    );
  });
}

function draftFromTask(task: AgentQueueTask): TaskDraft {
  return {
    dependsOn: task.dependsOn ?? [],
    description: task.description,
    executionPolicy: task.executionPolicy ?? "manual",
    itemType: task.itemType ?? "implementation",
    priority: task.priority,
    prompt: task.prompt,
    queueTagName: task.queueTagName ?? "Default",
    status: task.status,
    title: task.title,
    validationStatus: task.validationStatus ?? "not_started",
  };
}

function editController(overrides: Partial<ReturnType<typeof editControllerBase>> = {}) {
  return {
    ...editControllerBase(),
    ...overrides,
  };
}

function editControllerBase() {
  return {
    isEditing: false,
    onCancel: vi.fn(),
    onStart: vi.fn(),
  };
}

function deleteController() {
  return {
    blockedReason: null,
    canRequest: true,
    error: null,
    isConfirming: false,
    isDeleting: false,
    message: null,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onRequest: vi.fn(),
  };
}

function executionPlanController(
  plan: AgentQueueExecutionPlanPreview | null,
  onGenerate = vi.fn(),
): AgentQueueExecutionPlanController {
  return {
    canGenerate: true,
    message: null,
    onGenerate,
    plan,
  };
}

function workerReportController(
  latestReport: AgentQueueWorkerExecutionReport | null,
  onAttachDemoReport = vi.fn(),
): AgentQueueWorkerReportController {
  return {
    canAttach: true,
    latestReport,
    message: latestReport
      ? "Worker report attached as evidence. Awaiting validation/coordinator review; item status was not finalized."
      : null,
    onAttachDemoReport,
  };
}

function workerReport(
  overrides: Partial<AgentQueueWorkerExecutionReport> = {},
): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: "2026-05-20T10:02:00.000Z",
    errors: [],
    itemId: "queue-1",
    rawReportPreview: "Raw worker report preview",
    reportId: "report-1",
    reportStatus: "reported",
    summary: "Worker report summary",
    validationCommandsSuggested: [],
    validationResult: "not_run",
    warnings: [],
    workerId: "executor_visible",
    ...overrides,
  };
}

function reportActionCard(
  overrides: Partial<AgentQueueReportActionCard> = {},
): AgentQueueReportActionCard {
  return {
    cardId: "queue-report-card-task-1-report-1",
    changedFiles: ["apps/desktop/frontend/src/workbench/QueueReport.tsx"],
    createdAt: "2026-05-22T10:02:00.000Z",
    errors: ["One focused test still fails."],
    linkedFollowUpItemIds: [],
    recommendedActions: [
      {
        actionId: "open_source_item",
        description: "Open source item.",
        enabled: true,
        label: "Open source item",
        type: "open_source_item",
      },
    ],
    reportKind: "worker_execution",
    reportStatus: "reported",
    reportSummary: "Worker report summary",
    sourceItemId: "task_1",
    sourceItemPriority: 1,
    sourceItemPrompt: "Prompt",
    sourceItemStatus: "queued",
    sourceItemTitle: "Task",
    sourceItemType: "implementation",
    sourceQueueTag: "Default",
    sourceQueueTagId: "default",
    sourceReportId: "report-1",
    sourceValidationStatus: "not_started",
    warnings: ["Diff review is still required."],
    ...overrides,
  };
}

function planPreview(
  overrides: Partial<AgentQueueExecutionPlanPreview> = {},
): AgentQueueExecutionPlanPreview {
  return {
    complexity: "low",
    estimatedMinutesMax: 12,
    estimatedMinutesMin: 6,
    estimatedTokenMax: 2000,
    estimatedTokenMin: 1000,
    expectedValidationCommands: [
      "npm.cmd run test --prefix apps/desktop/frontend",
    ],
    generatedAt: "2026-05-22T10:00:00.000Z",
    itemId: "task_1",
    likelyFilesOrAreas: ["frontend UI"],
    notes: "Local deterministic estimate only.",
    planId: "plan-1",
    risk: "low",
    source: "heuristic",
    status: "planned",
    steps: ["Inspect the current implementation"],
    workerId: "executor_visible",
    ...overrides,
  };
}

function clickFirstButton(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function queueTask(): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor_visible",
    createdAt: "2026-05-22T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Prompt",
    queueItemId: "task_1",
    status: "ready",
    title: "Task",
    updatedAt: "2026-05-22T10:00:00.000Z",
    workspaceId: "ws_1",
  };
}

function runLink(
  overrides: Partial<NonNullable<AgentQueueLatestRunLinkController["link"]>> = {},
): NonNullable<AgentQueueLatestRunLinkController["link"]> {
  return {
    completedAt: "2026-05-22T10:01:00.000Z",
    createdAt: "2026-05-22T10:00:00.000Z",
    directWorkRunId: "run_safe_123456",
    executorWidgetId: "executor_visible",
    linkId: "link_1",
    queueTaskId: "task_1",
    reviewStatus: null,
    source: "manual",
    startedAt: "2026-05-22T10:00:00.000Z",
    status: "completed",
    updatedAt: "2026-05-22T10:01:00.000Z",
    validationStatus: null,
    workspaceId: "ws_1",
    ...overrides,
  };
}

function executorSlots(): AgentExecutorSlot[] {
  return [
    { label: "Agent Executor visible", widgetInstanceId: "executor_visible" },
  ];
}

function latestRunController(
  link: AgentQueueLatestRunLinkController["link"],
): AgentQueueLatestRunLinkController {
  return {
    apiAvailable: true,
    error: null,
    isLoading: false,
    link,
    onRefresh: vi.fn(),
  };
}

function runHistoryController(
  links: AgentQueueRunHistoryController["links"],
): AgentQueueRunHistoryController {
  return {
    apiAvailable: true,
    error: null,
    isLoading: false,
    links,
    onRefresh: vi.fn(),
    totalCount: links.length,
  };
}

function runController(): AgentQueueRunController {
  return {
    approvalPolicy: "never",
    canStart: false,
    codexExecutableDraft: "codex",
    isStarting: false,
    onApprovalPolicyChange: vi.fn(),
    onCodexExecutableDraftChange: vi.fn(),
    onRepoRootDraftChange: vi.fn(),
    onSandboxChange: vi.fn(),
    onStartAssignedTask: vi.fn(),
    preconditionMessages: [],
    readinessMessage: "Ready",
    repoRootDraft: "",
    sandbox: "read_only",
    startError: null,
    startedRunId: null,
    startMessage: null,
  };
}

function runnerController(): AgentQueueRunnerController {
  return {
    canStart: false,
    error: null,
    message: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    preconditionMessages: [],
    status: "idle",
  };
}

function autorunController(): AgentQueueAutorunController {
  return {
    apiAvailable: true,
    canArm: false,
    error: null,
    isLoading: false,
    isStarting: false,
    isStopping: false,
    message: null,
    onArm: vi.fn(),
    onRefresh: vi.fn(),
    onStop: vi.fn(),
    preconditionMessages: [],
    selectedExecutorLabel: null,
    snapshot: null,
  };
}
