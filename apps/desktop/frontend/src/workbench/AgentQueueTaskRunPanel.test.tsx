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
  AgentQueueTask,
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
  executionPlan = executionPlanController(null),
  latestRun = latestRunController(null),
  run = runController(),
  runHistory = runHistoryController([]),
  selectedTask = queueTask(),
  tasks = [selectedTask],
}: {
  executionPlan?: AgentQueueExecutionPlanController;
  latestRun?: AgentQueueLatestRunLinkController;
  run?: AgentQueueRunController;
  runHistory?: AgentQueueRunHistoryController;
  selectedTask?: AgentQueueTask;
  tasks?: AgentQueueTask[];
}) {
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
    dependencyStates,
    draft: draftFromTask(selectedTask),
    editTask: editController(),
    editorError: null,
    executionPlan,
    filteredTasks: tasks,
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

function editController() {
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
