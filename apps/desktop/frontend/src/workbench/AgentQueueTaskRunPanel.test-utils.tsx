import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, vi } from "vitest";

import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskDetailsPanel } from "./AgentQueueTaskDetailsPanel";
import type {
  AgentQueueAutorunController,
  AgentQueueAutonomousController,
  AgentQueueExecutionPlanController,
  AgentQueueLatestRunLinkController,
  AgentQueueRunActivityController,
  AgentQueueRunController,
  AgentQueueRunEvidenceController,
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
import type {
  AgentQueueExecutionPlanPreview,
  AgentExecutorRunDetail,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";
import {
  executorSlots,
  queueTask,
} from "./AgentQueueTaskRunPanel.test-fixtures";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  resetRenderedPanel();
  vi.restoreAllMocks();
});

export function resetRenderedPanel() {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
}

export function renderPanel(
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
        onPromoteDraftToQueued={vi.fn()}
        onOpenAgentExecutorRun={vi.fn()}
        onSelectionChange={vi.fn()}
        canPromoteDraftToQueued={false}
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
            name: "Local executor visible",
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

export function renderDetailsPanel({
  autonomous = autonomousController(),
  editTask = editController(),
  executionPlan = executionPlanController(null),
  latestRun = latestRunController(null),
  onShowQueueReportInWorkspaceChat,
  reportActionCard,
  run = runController(),
  runActivity = runActivityController(),
  runEvidence = runEvidenceController(null),
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
  autonomous?: AgentQueueAutonomousController;
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
  runActivity?: AgentQueueRunActivityController;
  runEvidence?: AgentQueueRunEvidenceController;
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
      name: "Local executor visible",
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
    autonomous,
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
    draftPromotion: {
      canPromote: selectedTask.status === "draft",
      isPromoting: false,
      onPromote: vi.fn(),
    },
    editorError: null,
    executionPlan,
    filteredTasks: tasks,
    coordinatorFinalization: {
      canAct: true,
      message: null,
      onAcceptWithoutCommit: vi.fn(),
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
    runActivity,
    runEvidence,
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

export function draftFromTask(task: AgentQueueTask): TaskDraft {
  return {
    dependsOn: task.dependsOn ?? [],
    approvalPolicy: task.approvalPolicy ?? "",
    codexExecutable: task.codexExecutable ?? "",
    description: task.description,
    executionPolicy: task.executionPolicy ?? "manual",
    executionWorkspace: task.executionWorkspace ?? "",
    itemType: task.itemType ?? "implementation",
    priority: task.priority,
    prompt: task.prompt,
    queueTagName: task.queueTagName ?? "Default",
    sandbox: task.sandbox ?? "",
    status: task.status,
    title: task.title,
    validationStatus: task.validationStatus ?? "not_started",
  };
}

export function editController(overrides: Partial<ReturnType<typeof editControllerBase>> = {}) {
  return {
    ...editControllerBase(),
    ...overrides,
  };
}

export function editControllerBase() {
  return {
    isEditing: false,
    onCancel: vi.fn(),
    onStart: vi.fn(),
  };
}

export function deleteController() {
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

export function executionPlanController(
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

export function workerReportController(
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

export function runEvidenceController(
  detail: AgentExecutorRunDetail | null,
  overrides: Partial<AgentQueueRunEvidenceController> = {},
): AgentQueueRunEvidenceController {
  return {
    apiAvailable: true,
    detail,
    error: null,
    isLoading: false,
    onRefresh: vi.fn(),
    ...overrides,
  };
}

export function runActivityController(
  overrides: Partial<AgentQueueRunActivityController> = {},
): AgentQueueRunActivityController {
  return {
    currentMessage: "Waiting for final response.",
    currentStage: "Preparing",
    eventState: {
      events: [],
      rawEvents: [],
    },
    lastCommand: null,
    lastCommandStatus: null,
    rawEvents: [],
    recentEvents: [],
    statusLine: "Running - waiting for final response.",
    ...overrides,
  };
}

export function clickFirstButton(text: string) {
  const button = buttonByText(text);

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export function buttonByText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

export function detailsBySummary(text: string) {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>("details")).find(
    (details) => details.querySelector("summary")?.textContent === text,
  );
}

export function executionSectionText() {
  return sectionText("Queue task execution");
}

export function sectionText(label: string) {
  const section = document.querySelector(`[aria-label="${label}"]`);

  if (!section) {
    throw new Error(`Section not found: ${label}`);
  }

  return section.textContent ?? "";
}

export function latestRunController(
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

export function runHistoryController(
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

export function runController(): AgentQueueRunController {
  return {
    approvalPolicy: "never",
    canStart: false,
    codexExecutableDraft: "codex",
    executorSelectionMessage: null,
    hasUnsavedTaskSettings: false,
    isStarting: false,
    onApprovalPolicyChange: vi.fn(),
    onCodexExecutableDraftChange: vi.fn(),
    onRepoRootDraftChange: vi.fn(),
    onSandboxChange: vi.fn(),
    onSaveTaskSettings: vi.fn(),
    onStartAssignedTask: vi.fn(),
    preconditionMessages: [],
    readinessMessage: "Ready",
    repoRootDraft: "",
    sandbox: "read_only",
    startError: null,
    startedRunId: null,
    startMessage: null,
    usesDefaultExecutorOnStart: false,
  };
}

export function runnerController(): AgentQueueRunnerController {
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

export function autorunController(): AgentQueueAutorunController {
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

export function autonomousController(
  overrides: Partial<AgentQueueAutonomousController> = {},
): AgentQueueAutonomousController {
  return {
    activeQueueItemId: null,
    activeTaskTitle: null,
    apiAvailable: true,
    approvalPolicy: "never",
    canStart: true,
    codexExecutableDraft: "codex",
    completedCount: 0,
    currentStage: null,
    currentWorkspaceRoot: null,
    error: null,
    failedCount: 0,
    latestReportState: null,
    message: null,
    onApprovalPolicyChange: vi.fn(),
    onCodexExecutableDraftChange: vi.fn(),
    onRepoRootDraftChange: vi.fn(),
    onSandboxChange: vi.fn(),
    onStart: vi.fn(),
    onStopAfterCurrent: vi.fn(),
    preconditionMessages: [],
    remainingEligibleCount: 0,
    repoRootDraft: "C:\\repo",
    sandbox: "read_only",
    skippedBlockedCount: 0,
    status: "idle",
    timeline: [],
    ...overrides,
  };
}
