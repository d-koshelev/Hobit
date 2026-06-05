import type { Dispatch, SetStateAction } from "react";

import type {
  AgentQueueReportActionCard,
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import type {
  AgentWorkerSummary,
  QueueFilter,
  QueueGlobalStatus,
  QueueTagSummary,
  TaskDraft,
} from "../agentQueueTaskUiModel";
import type { queueDependencyStatesByTask } from "../agentQueueTaskUiModel";
import {
  canCreateDiffReviewItem,
  linkedDiffReviewTasks,
} from "./agentQueueDiffReviewModel";
import {
  queueTaskOrderingControls,
} from "./agentQueueOrderingActions";
import type { AgentQueueEmbeddedExecutorSectionModel, AgentQueueSchedulerPlan } from "./agentQueueSchedulerModel";
import type {
  AgentQueueAutorunController,
  AgentQueueAutonomousController,
  AgentQueueCoordinatorFinalizationController,
  AgentQueueDeleteController,
  AgentQueueDiffReviewController,
  AgentQueueEditController,
  AgentQueueExecutionPlanController,
  AgentQueueFoundationController,
  AgentQueueKnowledgeContextController,
  AgentQueueLatestRunLinkController,
  AgentQueueOrderingController,
  AgentQueueReportActionCardController,
  AgentQueueRunActivityController,
  AgentQueueRunController,
  AgentQueueRunEvidenceController,
  AgentQueueRunHistoryController,
  AgentQueueRunnerController,
  AgentQueueWorkerReportController,
  UseAgentQueueControllerOptions,
} from "./agentQueueControllerTypes";
import type { getAssignedWorkerRoutingStates } from "./agentQueueRoutingModel";
import type { selectBestAvailableExecutorForTask } from "../agentQueueTaskUiModel";
import type { createAgentQueuePlanningActions } from "./useAgentQueuePlanningActions";
import type { createAgentQueueRunActions } from "./useAgentQueueRunActions";
import type { createAgentQueueTagActions } from "./useAgentQueueTagActions";
import type { createAgentQueueTaskActions } from "./useAgentQueueTaskActions";
import type { createAgentQueueWorkerActions } from "./useAgentQueueWorkerActions";
import type { AgentQueueRunActivitySnapshot, AgentQueueRunActivityState } from "./agentQueueRunActivity";

type AgentQueueControllerViewModelInput = Pick<
  UseAgentQueueControllerOptions,
  | "agentExecutorSlots"
  | "onGetAgentExecutorRunDetail"
  | "onGetAgentQueueTaskLatestRunLink"
  | "onListAgentQueueTaskRunLinks"
  | "onUpdateAgentQueueTask"
> & {
  apiAvailable: boolean;
  assignmentApiAvailable: boolean;
  assignmentError: string | null;
  assignmentMessage: string | null;
  assignedWorkerRoutingStates: ReturnType<typeof getAssignedWorkerRoutingStates>;
  autorunApiAvailable: boolean;
  autorunError: string | null;
  autorunMessage: string | null;
  autorunPreconditionMessages: string[];
  autorunSelectedExecutorLabel: string | null;
  autorunSnapshot: AgentQueueAutorunController["snapshot"];
  autonomousController: AgentQueueAutonomousController;
  canArmAutorun: boolean;
  canStart: boolean;
  canUseDefaultLocalExecutor: boolean;
  deleteBlockedReason: string | null;
  deleteError: string | null;
  deleteMessage: string | null;
  dependencyStates: ReturnType<typeof queueDependencyStatesByTask>;
  diffReviewReportActionCard: AgentQueueReportActionCard | null;
  draft: TaskDraft;
  editorError: string | null;
  embeddedExecutor: AgentQueueEmbeddedExecutorSectionModel;
  executionPlanMessage: string | null;
  filteredTasks: AgentQueueTask[];
  globalExecutionState: QueueGlobalStatus;
  globalMessage: string | null;
  hasOpenTaskEdit: boolean;
  hasUnsavedTaskSettings: boolean;
  isAssigning: boolean;
  isAutorunLoading: boolean;
  isAutorunStarting: boolean;
  isAutorunStopping: boolean;
  isConfirmingDelete: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isDirty: boolean;
  isEditing: boolean;
  isLatestRunLinkLoading: boolean;
  isLoading: boolean;
  isRunEvidenceLoading: boolean;
  isSaving: boolean;
  isSelecting: boolean;
  isStarting: boolean;
  latestRunLink: AgentQueueLatestRunLinkController["link"];
  latestRunLinkError: string | null;
  loadError: string | null;
  markReportActionCardShown: (cardId: string) => void;
  maxExecutorMessage: string | null;
  knowledgeContext: AgentQueueKnowledgeContextController;
  coordinatorFinalizationMessage: string | null;
  orderingMessage: string | null;
  pausedQueueTagIds: ReadonlySet<string>;
  planningActions: ReturnType<typeof createAgentQueuePlanningActions>;
  preconditionMessages: string[];
  queueTags: QueueTagSummary[];
  queueValidationSummary: Record<string, number>;
  readinessMessage: string | null;
  refreshAfterExternalMutation: (queueItemId?: string | null) => Promise<void>;
  refreshLatestRunLink: (
    queueItemId: string | null | undefined,
    options?: { silent?: boolean },
  ) => Promise<void>;
  refreshRunEvidence: (
    link: AgentQueueLatestRunLinkController["link"],
    options?: { silent?: boolean },
  ) => Promise<void>;
  runActions: ReturnType<typeof createAgentQueueRunActions>;
  runActivitySnapshot: AgentQueueRunActivitySnapshot;
  runActivityState: AgentQueueRunActivityState;
  runEvidenceDetail: AgentQueueRunEvidenceController["detail"];
  runEvidenceError: string | null;
  runHistoryLinks: AgentQueueRunHistoryController["links"];
  runnerController: AgentQueueRunnerController;
  saveStateText: string;
  schedulerPlan: AgentQueueSchedulerPlan;
  selectedExecutorSelection: ReturnType<typeof selectBestAvailableExecutorForTask>;
  selectedExecutorWidgetId: string;
  selectedTask: AgentQueueTask | null;
  selectedTaskApprovalPolicy: DirectWorkApprovalPolicy | "";
  selectedTaskCodexExecutable: string;
  selectedTaskExecutionWorkspace: string;
  selectedTaskSandbox: DirectWorkSandbox | "";
  setStatusFilter: Dispatch<SetStateAction<QueueFilter>>;
  startError: string | null;
  startMessage: string | null;
  startedRunId: string | null;
  statusFilter: QueueFilter;
  tagActions: ReturnType<typeof createAgentQueueTagActions>;
  tagManagementError: string | null;
  tagManagementMessage: string | null;
  taskActions: ReturnType<typeof createAgentQueueTaskActions>;
  tasks: AgentQueueTask[];
  updateSelectedTaskApprovalPolicy: (value: DirectWorkApprovalPolicy) => void;
  updateSelectedTaskCodexExecutable: (value: string) => void;
  updateSelectedTaskExecutionWorkspace: (value: string) => void;
  updateSelectedTaskSandbox: (value: DirectWorkSandbox) => void;
  validationMessage: string | null;
  workerActions: ReturnType<typeof createAgentQueueWorkerActions>;
  workerReportActionCard: AgentQueueReportActionCard | null;
  workerReportMessage: string | null;
  workers: AgentWorkerSummary[];
};

export function buildAgentQueueControllerViewModel({
  agentExecutorSlots,
  apiAvailable,
  assignmentApiAvailable,
  assignmentError,
  assignmentMessage,
  assignedWorkerRoutingStates,
  autorunApiAvailable,
  autorunError,
  autorunMessage,
  autorunPreconditionMessages,
  autorunSelectedExecutorLabel,
  autorunSnapshot,
  autonomousController,
  canArmAutorun,
  canStart,
  canUseDefaultLocalExecutor,
  deleteBlockedReason,
  deleteError,
  deleteMessage,
  dependencyStates,
  diffReviewReportActionCard,
  draft,
  editorError,
  embeddedExecutor,
  executionPlanMessage,
  filteredTasks,
  globalExecutionState,
  globalMessage,
  hasOpenTaskEdit,
  hasUnsavedTaskSettings,
  isAssigning,
  isAutorunLoading,
  isAutorunStarting,
  isAutorunStopping,
  isConfirmingDelete,
  isCreating,
  isDeleting,
  isDirty,
  isEditing,
  isLatestRunLinkLoading,
  isLoading,
  isRunEvidenceLoading,
  isSaving,
  isSelecting,
  isStarting,
  latestRunLink,
  latestRunLinkError,
  loadError,
  markReportActionCardShown,
  maxExecutorMessage,
  knowledgeContext,
  coordinatorFinalizationMessage,
  onGetAgentExecutorRunDetail,
  onGetAgentQueueTaskLatestRunLink,
  onListAgentQueueTaskRunLinks,
  onUpdateAgentQueueTask,
  orderingMessage,
  pausedQueueTagIds,
  planningActions,
  preconditionMessages,
  queueTags,
  queueValidationSummary,
  readinessMessage,
  refreshAfterExternalMutation,
  refreshLatestRunLink,
  refreshRunEvidence,
  runActions,
  runActivitySnapshot,
  runActivityState,
  runEvidenceDetail,
  runEvidenceError,
  runHistoryLinks,
  runnerController,
  saveStateText,
  schedulerPlan,
  selectedExecutorSelection,
  selectedExecutorWidgetId,
  selectedTask,
  selectedTaskApprovalPolicy,
  selectedTaskCodexExecutable,
  selectedTaskExecutionWorkspace,
  selectedTaskSandbox,
  setStatusFilter,
  startError,
  startMessage,
  startedRunId,
  statusFilter,
  tagActions,
  tagManagementError,
  tagManagementMessage,
  taskActions,
  tasks,
  updateSelectedTaskApprovalPolicy,
  updateSelectedTaskCodexExecutable,
  updateSelectedTaskExecutionWorkspace,
  updateSelectedTaskSandbox,
  validationMessage,
  workerActions,
  workerReportActionCard,
  workerReportMessage,
  workers,
}: AgentQueueControllerViewModelInput) {
  const {
    attachDemoWorkerReport,
    generateExecutionPlanPreview,
    moveSelectedTask,
    startWorkers,
    stopAndKillRunning,
    stopWorkers,
    updateMaxExecutors,
  } = planningActions;
  const {
    armAutorunSession,
    assignSelectedTask,
    clearSelectedTaskAssignment,
    refreshAutorunSnapshot,
    selectExecutorWidget,
    startAssignedTask,
    stopAutorunSession,
  } = runActions;
  const {
    cancelDeleteSelectedTask,
    cancelSelectedTaskEdits,
    commitSelectedResult,
    confirmDeleteSelectedTask,
    createDiffReviewTask,
    createTask,
    refreshTasks,
    requestDeleteSelectedTask,
    saveTask,
    selectTask,
    startEditingSelectedTask,
    updateDraft,
    updatePriority,
    promoteSelectedDraftToQueued,
    applyCoordinatorFinalization,
  } = taskActions;
  const {
    createQueueTag,
    deleteQueueTag,
    pauseQueueTag,
    renameQueueTag,
    resumeQueueTag,
    setQueueTagColor,
  } = tagActions;
  const {
    changeWorkerScope,
    createWorker,
    deleteWorker,
    renameWorker,
    setWorkerEnabled,
  } = workerActions;

  return {
    agentExecutorSlots,
    apiAvailable,
    assignmentApiAvailable,
    assignmentError,
    assignmentMessage,
    createTask,
    draft,
    editorError,
    filteredTasks,
    isAssigning,
    isCreating,
    isDirty,
    isEditing,
    isLoading,
    knowledgeContext,
    isSaving,
    isSelecting,
    loadError,
    deleteTask: {
      blockedReason: deleteBlockedReason,
      canRequest: Boolean(selectedTask && !deleteBlockedReason),
      error: deleteError,
      isConfirming: isConfirmingDelete,
      isDeleting,
      message: deleteMessage,
      onCancel: () => cancelDeleteSelectedTask(),
      onConfirm: () => void confirmDeleteSelectedTask(),
      onRequest: () => requestDeleteSelectedTask(),
    } satisfies AgentQueueDeleteController,
    ordering: {
      ...queueTaskOrderingControls({
        selectedTask,
        tasks,
      }),
      message: orderingMessage,
      onMoveDown: () => moveSelectedTask("down"),
      onMoveToBottom: () => moveSelectedTask("bottom"),
      onMoveToTop: () => moveSelectedTask("top"),
      onMoveUp: () => moveSelectedTask("up"),
    } satisfies AgentQueueOrderingController,
    editTask: {
      isEditing,
      onCancel: cancelSelectedTaskEdits,
      onStart: startEditingSelectedTask,
    } satisfies AgentQueueEditController,
    draftPromotion: {
      canPromote: Boolean(
        selectedTask?.status === "draft" &&
          onUpdateAgentQueueTask &&
          !hasOpenTaskEdit &&
          !isSaving &&
          !isCreating,
      ),
      isPromoting: Boolean(selectedTask?.status === "draft" && isSaving),
      onPromote: () => void promoteSelectedDraftToQueued(),
    },
    executionPlan: {
      canGenerate: Boolean(selectedTask && !hasOpenTaskEdit && !isSaving),
      message: executionPlanMessage,
      onGenerate: generateExecutionPlanPreview,
      plan: selectedTask?.executionPlanPreview ?? null,
    } satisfies AgentQueueExecutionPlanController,
    workerReport: {
      canAttach: Boolean(selectedTask && !hasOpenTaskEdit && !isSaving),
      latestReport:
        selectedTask?.workerExecutionReports?.[
          selectedTask.workerExecutionReports.length - 1
        ] ?? null,
      message: workerReportMessage,
      onAttachDemoReport: attachDemoWorkerReport,
    } satisfies AgentQueueWorkerReportController,
    diffReview: {
      canCreate: Boolean(
        selectedTask &&
          canCreateDiffReviewItem(selectedTask) &&
          !hasOpenTaskEdit &&
          !isSaving &&
          !isCreating,
      ),
      linkedReviewTasks: linkedDiffReviewTasks(selectedTask, tasks),
      message: workerReportMessage,
      onCreate: () => void createDiffReviewTask(),
    } satisfies AgentQueueDiffReviewController,
    reportActionCard: {
      diffReviewReportCard: diffReviewReportActionCard,
      latestShownCardId: selectedTask?.workspaceChatReportCardId ?? null,
      message: workerReportMessage,
      onShown: markReportActionCardShown,
      workerReportCard: workerReportActionCard,
    } satisfies AgentQueueReportActionCardController,
    coordinatorFinalization: {
      canAct: Boolean(selectedTask && !isEditing && !isSaving && !isCreating),
      message: coordinatorFinalizationMessage,
      onAcceptWithoutCommit: () =>
        void applyCoordinatorFinalization("accept_without_commit"),
      onCommitResult: () => void commitSelectedResult(),
      onCreateFollowUp: () => void applyCoordinatorFinalization("create_follow_up"),
      onFinalize: () => void applyCoordinatorFinalization("finalize_accept_item"),
      onMarkBlocked: () => void applyCoordinatorFinalization("mark_blocked"),
      onMarkFailedRejected: () =>
        void applyCoordinatorFinalization("mark_failed_rejected"),
      onMarkFollowUpRequired: () =>
        void applyCoordinatorFinalization("mark_follow_up_required"),
      onMarkNeedsChanges: () =>
        void applyCoordinatorFinalization("mark_needs_changes"),
      onMarkReadyForFinalization: () =>
        void applyCoordinatorFinalization("mark_ready_for_finalization"),
      onMarkRollbackRequired: () =>
        void applyCoordinatorFinalization("mark_rollback_required"),
      status: selectedTask?.coordinatorStatus ?? "not_reported",
    } satisfies AgentQueueCoordinatorFinalizationController,
    run: {
      approvalPolicy: selectedTaskApprovalPolicy,
      canStart,
      codexExecutableDraft: selectedTaskCodexExecutable,
      hasUnsavedTaskSettings,
      isStarting,
      onApprovalPolicyChange: updateSelectedTaskApprovalPolicy,
      onCodexExecutableDraftChange: updateSelectedTaskCodexExecutable,
      onRepoRootDraftChange: updateSelectedTaskExecutionWorkspace,
      onSandboxChange: updateSelectedTaskSandbox,
      onSaveTaskSettings: () => void saveTask(),
      onStartAssignedTask: () => void startAssignedTask(),
      preconditionMessages,
      readinessMessage,
      repoRootDraft: selectedTaskExecutionWorkspace,
      sandbox: selectedTaskSandbox,
      startError,
      startedRunId,
      startMessage,
      usesDefaultExecutorOnStart: canUseDefaultLocalExecutor,
      executorSelectionMessage: executorSelectionMessage({
        assignedExecutorWidgetId: selectedTask?.assignedExecutorWidgetId ?? null,
        label: selectedExecutorSelection.label,
        source: selectedExecutorSelection.source,
      }),
    } satisfies AgentQueueRunController,
    latestRun: {
      apiAvailable: Boolean(
        onListAgentQueueTaskRunLinks || onGetAgentQueueTaskLatestRunLink,
      ),
      error: latestRunLinkError,
      isLoading: isLatestRunLinkLoading,
      link: latestRunLink,
      onRefresh: () =>
        void refreshLatestRunLink(selectedTask?.queueItemId ?? null),
    } satisfies AgentQueueLatestRunLinkController,
    runEvidence: {
      apiAvailable: Boolean(onGetAgentExecutorRunDetail),
      detail: runEvidenceDetail,
      error: runEvidenceError,
      isLoading: isRunEvidenceLoading,
      onRefresh: () => void refreshRunEvidence(latestRunLink),
    } satisfies AgentQueueRunEvidenceController,
    runActivity: {
      ...runActivitySnapshot,
      eventState: runActivityState,
    } satisfies AgentQueueRunActivityController,
    runHistory: {
      apiAvailable: Boolean(
        onListAgentQueueTaskRunLinks || onGetAgentQueueTaskLatestRunLink,
      ),
      error: latestRunLinkError,
      isLoading: isLatestRunLinkLoading,
      links: runHistoryLinks,
      onRefresh: () =>
        void refreshLatestRunLink(selectedTask?.queueItemId ?? null),
      totalCount: runHistoryLinks.length,
    } satisfies AgentQueueRunHistoryController,
    autorun: {
      apiAvailable: autorunApiAvailable,
      canArm: canArmAutorun,
      error: autorunError,
      isLoading: isAutorunLoading,
      isStarting: isAutorunStarting,
      isStopping: isAutorunStopping,
      message: autorunMessage,
      onArm: () => void armAutorunSession(),
      onRefresh: () => void refreshAutorunSnapshot(),
      onStop: () => void stopAutorunSession(),
      preconditionMessages: autorunPreconditionMessages,
      selectedExecutorLabel: autorunSelectedExecutorLabel,
      snapshot: autorunSnapshot,
    } satisfies AgentQueueAutorunController,
    autonomous: {
      ...autonomousController,
    } satisfies AgentQueueAutonomousController,
    foundation: {
      embeddedExecutor,
      globalExecutionState,
      globalMessage,
      globalStatus: globalExecutionState,
      maxExecutorMessage,
      onMaxExecutorsChange: updateMaxExecutors,
      onCreateQueueTag: createQueueTag,
      onCreateWorker: createWorker,
      onDeleteQueueTag: deleteQueueTag,
      onDeleteWorker: deleteWorker,
      onPauseQueueTag: pauseQueueTag,
      onRenameWorker: renameWorker,
      onRenameQueueTag: renameQueueTag,
      onResumeQueueTag: resumeQueueTag,
      onSetQueueTagColor: setQueueTagColor,
      onStartWorkers: startWorkers,
      onStopAndKillRunning: stopAndKillRunning,
      onStopWorkers: stopWorkers,
      onWorkerEnabledChange: setWorkerEnabled,
      onWorkerScopeChange: changeWorkerScope,
      pausedQueueTagIds,
      queueTags,
      schedulerPlan,
      tagManagementError,
      tagManagementMessage,
      validationSummary: queueValidationSummary,
      workers,
    } satisfies AgentQueueFoundationController,
    runner: {
      ...runnerController,
    } satisfies AgentQueueRunnerController,
    refreshAfterExternalMutation,
    refreshTasks,
    saveStateText,
    saveTask,
    selectedExecutorWidgetId,
    selectedTask,
    selectExecutorWidget,
    selectTask,
    setStatusFilter,
    statusFilter,
    tasks,
    dependencyStates,
    assignedWorkerRoutingStates,
    updateDraft,
    updatePriority,
    validationMessage,
    assignSelectedTask,
    clearSelectedTaskAssignment,
  };
}

function executorSelectionMessage({
  assignedExecutorWidgetId,
  label,
  source,
}: {
  assignedExecutorWidgetId: string | null;
  label: string | null;
  source: "assigned" | "automatic" | "manual" | null;
}) {
  if (!label || !source) {
    return null;
  }

  if (source === "assigned") {
    return `Local executor assigned: ${label}.`;
  }

  if (source === "manual") {
    return `Local executor override selected: ${label}.`;
  }

  return assignedExecutorWidgetId
    ? `Local executor selected automatically: ${label}. The previous assignment is unavailable.`
    : `Local executor selected automatically: ${label}.`;
}
