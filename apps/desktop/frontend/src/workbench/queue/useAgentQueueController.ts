import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentQueueRunnerSnapshot, AgentQueueTask, AgentQueueWorkerConfig, DirectWorkApprovalPolicy, DirectWorkSandbox } from "../../workspace/types";
import { DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE, emptyDraft, getQueueTaskDependencyState, normalizeItemType, normalizeQueueTag, normalizeTaskDependencies, normalizeTaskExecutionPolicy, normalizeTaskStatus, normalizeValidationStatus, queueDependencyReadinessMessage, selectBestAvailableExecutorForTask, sortQueueTasksForDisplay, type QueueFilter, type QueueGlobalStatus, type QueueTagPauseState, type QueueTagRecord, type TaskDraft, type WorkerScope } from "../agentQueueTaskUiModel";
import { useQueueTaskAutoRefreshFromExecutor } from "../useQueueTaskAutoRefreshFromExecutor";
import type { UseAgentQueueControllerOptions } from "./agentQueueControllerTypes";
import { buildAgentQueueControllerViewModel } from "./agentQueueControllerViewModel";
import {
  areStringArraysEqual,
  defaultCodexExecutable,
  queueAutorunPreconditionMessages,
  queueRunReadinessMessage,
  queueTaskDeleteBlockedReason,
  runPreconditionMessages,
  type AgentQueueRunnerStatus,
} from "./agentQueueControllerHelpers";
import {
  loadAgentQueueTasks,
} from "./agentQueueLoadHelpers";
import { createAgentQueueSelectionModel } from "./agentQueueSelectionModel";
import {
  firstRoutingBlockedReasonLabel,
} from "./agentQueueRoutingModel";
import { useAgentQueueSequentialRunner } from "./useAgentQueueSequentialRunner";
import { useAgentQueueAutonomousRunner } from "./useAgentQueueAutonomousRunner";
import { createAgentQueuePlanningActions } from "./useAgentQueuePlanningActions";
import {
  createAgentQueueTagActions,
} from "./useAgentQueueTagActions";
import {
  createAgentQueueTaskActions,
  type AgentQueueLocalTaskFields,
} from "./useAgentQueueTaskActions";
import { createAgentQueueRunActions } from "./useAgentQueueRunActions";
import {
  createAgentQueueWorkerActions,
} from "./useAgentQueueWorkerActions";
import { useAgentQueueRunMetadata } from "./useAgentQueueRunMetadata";
import { useAgentQueueRunSettings } from "./useAgentQueueRunSettings";
import { useAgentQueueWorkerState } from "./useAgentQueueWorkerState";
import { useAgentQueueReportActionCards } from "./useAgentQueueReportActionCards";
import {
  attachContextToQueueTask,
  buildQueueContextAttachment,
  type AgentQueueKnowledgeContextAttachInput,
  type AgentQueueKnowledgeContextAttachResult,
} from "../agentQueueKnowledgeContext";

export type { AgentQueueRunnerStatus } from "./agentQueueControllerHelpers";
export type { QueueTaskInsertPosition } from "./agentQueueOrderingActions";
export type {
  AgentQueueAutorunController,
  AgentQueueAutonomousController,
  AgentQueueCoordinatorFinalizationController,
  AgentQueueDeleteController,
  AgentQueueDiffReviewController,
  AgentQueueEditController,
  AgentQueueExecutionPlanController,
  AgentQueueFoundationController,
  AgentQueueLatestRunLinkController,
  AgentQueueOrderingController,
  AgentQueueReportActionCardController,
  AgentQueueRunActivityController,
  AgentQueueRunController,
  AgentQueueRunEvidenceController,
  AgentQueueRunHistoryController,
  AgentQueueRunnerController,
  AgentQueueWorkerReportController,
} from "./agentQueueControllerTypes";

export function useAgentQueueController({
  agentExecutorSlots = [],
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onCreateAgentQueueWorker,
  onDeleteAgentQueueTask,
  onDeleteAgentQueueWorker,
  onDirectWorkRunHandoffStarted,
  onGetAgentExecutorRunDetail,
  onGetAgentQueueTask,
  onGetAgentQueueTaskLatestRunLink,
  onGetAgentQueueRunnerSnapshot,
  onListenToDirectWorkStreamEvents,
  onListAgentQueueTaskRunLinks,
  onListAgentQueueTasks,
  onListAgentQueueWorkers,
  onStartAssignedAgentQueueTask,
  onStartAgentQueueRunnerSession,
  onStopAgentQueueRunnerSession,
  onUpdateAgentQueueTask,
  onUpdateAgentQueueWorker,
  queueWidgetInstanceId = "agent-queue",
  queueTaskAutoRefreshRequest,
}: UseAgentQueueControllerOptions) {
  const apiAvailable = Boolean(
    onCreateAgentQueueTask &&
      onDeleteAgentQueueTask &&
      onGetAgentQueueTask &&
      onListAgentQueueTasks &&
      onUpdateAgentQueueTask,
  );
  const assignmentApiAvailable = Boolean(
    onAssignAgentQueueTaskToExecutor && onClearAgentQueueTaskAssignment,
  );
  const autorunApiAvailable = Boolean(
    onStartAgentQueueRunnerSession &&
      onStopAgentQueueRunnerSession &&
      onGetAgentQueueRunnerSnapshot,
  );
  const [tasks, setTasks] = useState<AgentQueueTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentQueueTask | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft());
  const [statusFilter, setStatusFilter] = useState<QueueFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(
    null,
  );
  const [selectedExecutorWidgetId, setSelectedExecutorWidgetId] =
    useState("");
  const [manualExecutorOverrideTaskId, setManualExecutorOverrideTaskId] =
    useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [saveStateText, setSaveStateText] = useState("Saved");
  const [repoRootDraft, setRepoRootDraft] = useState("");
  const [codexExecutableDraft, setCodexExecutableDraft] = useState(
    defaultCodexExecutable,
  );
  const [sandbox, setSandbox] =
    useState<DirectWorkSandbox>("danger_full_access");
  const [approvalPolicy, setApprovalPolicy] =
    useState<DirectWorkApprovalPolicy>("never");
  const [isStarting, setIsStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startInFlightRef = useRef(false);
  const tasksRef = useRef<AgentQueueTask[]>([]);
  const [autorunSnapshot, setAutorunSnapshot] =
    useState<AgentQueueRunnerSnapshot | null>(null);
  const [isAutorunLoading, setIsAutorunLoading] = useState(false);
  const [isAutorunStarting, setIsAutorunStarting] = useState(false);
  const [isAutorunStopping, setIsAutorunStopping] = useState(false);
  const [autorunMessage, setAutorunMessage] = useState<string | null>(null);
  const [autorunError, setAutorunError] = useState<string | null>(null);
  const [maxExecutors, setMaxExecutors] = useState(3);
  const [maxExecutorMessage, setMaxExecutorMessage] = useState<string | null>(
    null,
  );
  const [globalExecutionState, setGlobalExecutionState] =
    useState<QueueGlobalStatus>(DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE);
  const [globalMessage, setGlobalMessage] = useState<string | null>(
    "Disabled. Enable arms local scheduling only.",
  );
  const [queueTagPauseStates, setQueueTagPauseStates] = useState<
    Map<string, QueueTagPauseState>
  >(() => new Map());
  const [managedQueueTags, setManagedQueueTags] = useState<QueueTagRecord[]>(
    () => [],
  );
  const [tagManagementError, setTagManagementError] = useState<string | null>(
    null,
  );
  const [tagManagementMessage, setTagManagementMessage] = useState<
    string | null
  >(null);
  const [workerScopes, setWorkerScopes] = useState<Map<string, WorkerScope>>(
    () => new Map(),
  );
  const [workerConfigs, setWorkerConfigs] = useState<AgentQueueWorkerConfig[]>(
    () => [],
  );
  const workerConfigsRef = useRef(workerConfigs);
  const [localTaskFields, setLocalTaskFields] = useState<
    Map<string, AgentQueueLocalTaskFields>
  >(() => new Map());
  const localTaskFieldsRef = useRef(localTaskFields);
  const [orderingMessage, setOrderingMessage] = useState<string | null>(null);
  const [executionPlanMessage, setExecutionPlanMessage] = useState<string | null>(
    null,
  );
  const [workerReportMessage, setWorkerReportMessage] = useState<string | null>(
    null,
  );
  const [coordinatorFinalizationMessage, setCoordinatorFinalizationMessage] =
    useState<string | null>(null);
  const EDIT_PAUSE_MESSAGE =
    "Editing paused this queue tag until coordinator review.";
  const selectionModel = createAgentQueueSelectionModel({
    localTaskFieldsRef,
    selectedTask,
    setDraft,
    setExecutionPlanMessage,
    setIsEditing,
    setSaveStateText,
    setSelectedTask,
    setTasks,
    setWorkerReportMessage,
    tasksRef,
  });
  const {
    applyUpdatedTask,
    clearSelectedTask,
    mergeTaskFoundation,
    setSelectedDraft,
  } = selectionModel;
  const workerActions = useMemo(
    () =>
      createAgentQueueWorkerActions({
        agentExecutorSlots,
        maxExecutors,
        onCreateAgentQueueWorker,
        onDeleteAgentQueueWorker,
        onListAgentQueueWorkers,
        onUpdateAgentQueueWorker,
        setGlobalMessage,
        setMaxExecutorMessage,
        setTagManagementError,
        setWorkerConfigs,
        setWorkerScopes,
        tasksRef,
        workerConfigsRef,
      }),
    [
      agentExecutorSlots,
      maxExecutors,
      onCreateAgentQueueWorker,
      onDeleteAgentQueueWorker,
      onListAgentQueueWorkers,
      onUpdateAgentQueueWorker,
    ],
  );
  const { loadWorkers, persistWorkerScopeUpdates } = workerActions;

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    localTaskFieldsRef.current = localTaskFields;
  }, [localTaskFields]);

  useEffect(() => {
    workerConfigsRef.current = workerConfigs;
  }, [workerConfigs]);

  const isDirty = Boolean(
    selectedTask &&
      (draft.title !== selectedTask.title ||
        draft.approvalPolicy !== (selectedTask.approvalPolicy ?? "") ||
        draft.codexExecutable !== (selectedTask.codexExecutable ?? "") ||
        draft.description !== selectedTask.description ||
        !areStringArraysEqual(
          draft.dependsOn,
          normalizeTaskDependencies(selectedTask.dependsOn),
        ) ||
        draft.executionPolicy !==
          normalizeTaskExecutionPolicy(selectedTask.executionPolicy) ||
        draft.executionWorkspace !== (selectedTask.executionWorkspace ?? "") ||
        draft.itemType !== normalizeItemType(selectedTask.itemType) ||
        draft.prompt !== selectedTask.prompt ||
        draft.queueTagName !== normalizeQueueTag(selectedTask).queueTagName ||
        draft.sandbox !== (selectedTask.sandbox ?? "") ||
        draft.status !== normalizeTaskStatus(selectedTask.status) ||
        draft.priority !== selectedTask.priority ||
        draft.validationStatus !==
          normalizeValidationStatus(selectedTask.validationStatus)),
  );

  const filteredTasks = useMemo(() => {
    const orderedTasks = sortQueueTasksForDisplay(tasks);

    if (statusFilter === "all") {
      return orderedTasks;
    }

    return orderedTasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);
  const {
    assignedWorkerRoutingStates,
    dependencyStates,
    embeddedExecutor,
    pausedQueueTagIds,
    queueTags,
    queueValidationSummary,
    schedulerPlan,
    workers,
  } = useAgentQueueWorkerState({
    agentExecutorSlots,
    globalExecutionState,
    managedQueueTags,
    maxExecutors,
    queueTagPauseStates,
    setMaxExecutors,
    tasks,
    workerConfigs,
    workerScopes,
  });
  const {
    diffReviewReportActionCard,
    linkedReviewsForSelectedTask,
    workerReportActionCard,
  } = useAgentQueueReportActionCards({
    selectedTask,
    tasks,
  });

  const loadTasks = useCallback(
    async (
      preferredTaskId?: string | null,
      options?: { preserveCurrentOnError?: boolean },
    ) => {
      const result = await loadAgentQueueTasks({
        clearSelectedTask,
        mergeTaskFoundation,
        onCreateAgentQueueTask,
        onDeleteAgentQueueTask,
        onGetAgentQueueTask,
        onListAgentQueueTasks,
        onUpdateAgentQueueTask,
        options,
        preferredTaskId,
        setAssignmentError,
        setEditorError,
        setIsLoading,
        setLoadError,
        setSaveStateText,
        setSelectedDraft,
        setTasks,
        setValidationMessage,
        tasksRef,
      });
      return result;
    },
    [
      onCreateAgentQueueTask,
      onDeleteAgentQueueTask,
      onGetAgentQueueTask,
      onListAgentQueueTasks,
      onUpdateAgentQueueTask,
    ],
  );

  useEffect(() => {
    void loadTasks(null);
  }, [loadTasks]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    if (!onGetAgentQueueRunnerSnapshot) {
      setAutorunSnapshot(null);
      return;
    }

    void refreshAutorunSnapshot({ silent: true });
  }, [onGetAgentQueueRunnerSnapshot]);

  useEffect(() => {
    setManualExecutorOverrideTaskId(null);
  }, [selectedTask?.queueItemId]);

  useEffect(() => {
    if (!selectedTask) {
      setSelectedExecutorWidgetId("");
      return;
    }

    setSelectedExecutorWidgetId((currentSelection) => {
      const selection = selectBestAvailableExecutorForTask({
        currentSelection,
        executorSlots: agentExecutorSlots,
        manualOverride:
          manualExecutorOverrideTaskId === selectedTask.queueItemId,
        task: selectedTask,
        workers,
      });

      return selection.executorWidgetId ?? "";
    });
  }, [
    agentExecutorSlots,
    manualExecutorOverrideTaskId,
    selectedTask,
    workers,
  ]);

  useEffect(() => {
    setStartMessage(null);
    setStartedRunId(null);
    setStartError(null);
  }, [selectedTask?.queueItemId]);

  const {
    isLatestRunLinkLoading,
    isRunEvidenceLoading,
    latestRunLink,
    latestRunLinkError,
    refreshLatestRunLink,
    refreshRunEvidence,
    runActivitySnapshot,
    runActivityState,
    runEvidenceDetail,
    runEvidenceError,
    runHistoryLinks,
  } = useAgentQueueRunMetadata({
    loadTasks,
    onGetAgentExecutorRunDetail,
    onGetAgentQueueTaskLatestRunLink,
    onListenToDirectWorkStreamEvents,
    onListAgentQueueTaskRunLinks,
    selectedTask,
  });

  const {
    codexExecutable,
    hasUnsavedTaskSettings,
    repoRoot,
    selectedTaskApprovalPolicy,
    selectedTaskApprovalPolicyForRun,
    selectedTaskCodexExecutable,
    selectedTaskExecutionWorkspace,
    selectedTaskSandbox,
    selectedTaskSandboxForRun,
    updateSelectedTaskApprovalPolicy,
    updateSelectedTaskCodexExecutable,
    updateSelectedTaskExecutionWorkspace,
    updateSelectedTaskSandbox,
  } = useAgentQueueRunSettings({
    applyUpdatedTask,
    approvalPolicy,
    codexExecutableDraft,
    draft,
    isDirty,
    isEditing,
    onUpdateAgentQueueTask,
    repoRootDraft,
    sandbox,
    selectedTask,
    setApprovalPolicy,
    setCodexExecutableDraft,
    setDeleteError,
    setDeleteMessage,
    setRepoRootDraft,
    setSandbox,
    setStartError,
    tasksRef,
  });
  const startApiAvailable = Boolean(onStartAssignedAgentQueueTask);
  const selectedQueueTagId = selectedTask
    ? normalizeQueueTag(selectedTask).queueTagId
    : null;
  const selectedQueueTagPaused = Boolean(
    selectedQueueTagId && pausedQueueTagIds.has(selectedQueueTagId),
  );
  const hasOpenTaskEdit = isEditing || isDirty;
  const selectedTaskAssignedWorkerRouting = selectedTask
    ? assignedWorkerRoutingStates.get(selectedTask.queueItemId)
    : null;
  const selectedExecutorSelection = selectBestAvailableExecutorForTask({
    currentSelection: selectedExecutorWidgetId,
    executorSlots: agentExecutorSlots,
    manualOverride: selectedTask
      ? manualExecutorOverrideTaskId === selectedTask.queueItemId
      : false,
    task: selectedTask,
    workers,
  });
  const selectedTaskRoutingMessage =
    selectedTaskAssignedWorkerRouting &&
    selectedTaskAssignedWorkerRouting.blockedReasons.length > 0
      ? firstRoutingBlockedReasonLabel(
          selectedTaskAssignedWorkerRouting.blockedReasons.filter(
            (reason) => reason.code !== "queue_stopped",
          ),
        )
      : null;
  const globalRunBlockMessage =
    globalExecutionState === "stop_kill_requested"
        ? "STOP + KILL RUNNING is requested. Review running work or click Enable before starting new work."
        : null;
  const canUseDefaultLocalExecutor =
    Boolean(
      selectedTask &&
        selectedExecutorSelection.executorWidgetId &&
        (agentExecutorSlots.find(
          (slot) =>
            slot.widgetInstanceId === selectedExecutorSelection.executorWidgetId,
        )?.ownerKind === "agent_queue" ||
          assignmentApiAvailable) &&
        selectedTask.assignedExecutorWidgetId !==
          selectedExecutorSelection.executorWidgetId &&
        selectedExecutorWidgetId,
    );
  const effectiveSelectedTaskRoutingMessage =
    canUseDefaultLocalExecutor &&
    (selectedTaskAssignedWorkerRouting?.blockedReasons.some(
      (reason) =>
        reason.code === "assigned_worker_unavailable" ||
        reason.code === "worker_disabled" ||
        reason.code === "worker_scope_mismatch",
    ) ??
      false)
      ? null
      : selectedTaskRoutingMessage;
  const executorAvailabilityMessage =
    selectedTask && !selectedExecutorSelection.executorWidgetId
      ? "Local executor unavailable."
      : null;
  const readinessMessage = globalRunBlockMessage
    ? globalRunBlockMessage
    : selectedQueueTagPaused
      ? "Resume this queue tag before running the selected task."
      : selectedTask
        ? executorAvailabilityMessage ??
        queueRunReadinessMessage({
          allowDefaultExecutorAssignment: canUseDefaultLocalExecutor,
          isDirty: hasOpenTaskEdit,
          selectedTask,
          startApiAvailable,
        }) ??
        queueDependencyReadinessMessage(
          dependencyStates.get(selectedTask.queueItemId) ??
            getQueueTaskDependencyState(selectedTask, tasks),
        ) ??
        effectiveSelectedTaskRoutingMessage
      : "Local executor unavailable.";
  const preconditionMessages = useMemo(
    () => {
      if (readinessMessage) {
        return [];
      }

      const messages = runPreconditionMessages({
            codexExecutable,
            isStarting,
            repoRoot,
          }).map((message) =>
            message === "Set workspace." ? "Set task workspace." : message,
          );

      if (selectedTask && !selectedTaskSandbox) {
        messages.push("Set sandbox.");
      }

      if (selectedTask && !selectedTaskApprovalPolicy) {
        messages.push("Set approval policy.");
      }

      return messages;
    },
    [
      codexExecutable,
      isStarting,
      readinessMessage,
      repoRoot,
      selectedTask,
      selectedTaskApprovalPolicy,
      selectedTaskSandbox,
    ],
  );

  const refreshAfterExternalMutation = useCallback(
    async (queueItemId?: string | null) => {
      await loadTasks(queueItemId ?? selectedTask?.queueItemId ?? null, {
        preserveCurrentOnError: true,
      });
    },
    [loadTasks, selectedTask?.queueItemId],
  );
  const canStart = !readinessMessage && preconditionMessages.length === 0;
  const queueRunner = useAgentQueueSequentialRunner({
    approvalPolicy,
    assignmentApiAvailable,
    codexExecutable,
    isDirty: hasOpenTaskEdit,
    isStarting,
    loadTasks,
    onAssignAgentQueueTaskToExecutor,
    onDirectWorkRunHandoffStarted,
    onStartAssignedAgentQueueTask,
    repoRoot,
    sandbox,
    selectedExecutorWidgetId,
    setTasks,
    startApiAvailable,
    taskCount: tasks.length,
    tasksRef,
    pausedQueueTagIds,
    globalExecutionState,
    workers,
  });
  const autonomousRunner = useAgentQueueAutonomousRunner({
    approvalPolicy,
    codexExecutable,
    codexExecutableDraft,
    currentWorkspaceRoot: null,
    hasOpenTaskEdit,
    isStarting,
    loadTasks,
    onDirectWorkRunHandoffStarted,
    onGetAgentExecutorRunDetail,
    onStartAssignedAgentQueueTask,
    onUpdateAgentQueueTask,
    onApprovalPolicyChange: setApprovalPolicy,
    onCodexExecutableDraftChange: setCodexExecutableDraft,
    onRepoRootDraftChange: setRepoRootDraft,
    onSandboxChange: setSandbox,
    queueWidgetInstanceId: queueWidgetInstanceId ?? undefined,
    repoRoot,
    repoRootDraft,
    sandbox,
    selectedTask,
    setLocalTaskFields,
    setSelectedTask,
    setTasks,
    tasksRef,
  });
  useQueueTaskAutoRefreshFromExecutor({
    autoRefreshRequest: queueTaskAutoRefreshRequest,
    isDirty: hasOpenTaskEdit,
    loadTasks,
    onRefreshComplete: (request) => {
      queueRunner.onAutoRefreshComplete(request);
      autonomousRunner.onAutoRefreshComplete(request);
    },
    setValidationMessage,
  });
  const autorunSelectedExecutor = agentExecutorSlots.find(
    (slot) => slot.widgetInstanceId === selectedExecutorWidgetId,
  );
  const autorunPreconditionMessages = queueAutorunPreconditionMessages({
    apiAvailable: autorunApiAvailable,
    codexExecutable,
    globalExecutionState,
    hasExecutorSelection: Boolean(selectedExecutorWidgetId),
    isStarting: isAutorunStarting,
    repoRoot,
  });
  if (pausedQueueTagIds.size > 0) {
    autorunPreconditionMessages.unshift(
      "Resume paused queue tags before arming Queue Autorun.",
    );
  }
  if (
    Array.from(dependencyStates.values()).some(
      (dependencyState) => dependencyState.status !== "ready",
    )
  ) {
    autorunPreconditionMessages.unshift(
      "Resolve blocked or invalid queue dependencies before arming Queue Autorun.",
    );
  }
  if (selectedExecutorWidgetId) {
    const hasEligibleAssignedAutorunTask = tasks.some((task) => {
      const assignedWorkerId = task.assignedWorkerId ?? task.assignedExecutorWidgetId;
      const routingState = assignedWorkerRoutingStates.get(task.queueItemId);

      return (
        assignedWorkerId === selectedExecutorWidgetId &&
        task.executionPolicy === "auto" &&
        Boolean(routingState?.canTake)
      );
    });

    if (!hasEligibleAssignedAutorunTask) {
      autorunPreconditionMessages.unshift(
        "No assigned auto task is currently eligible for the selected worker.",
      );
    }
  }
  const isAutorunActive = Boolean(autorunSnapshot?.isActive);
  const canArmAutorun =
    autorunPreconditionMessages.length === 0 &&
    !isAutorunActive &&
    !isAutorunLoading &&
    !isAutorunStopping;
  const deleteBlockedReason = queueTaskDeleteBlockedReason({
    apiAvailable: Boolean(onDeleteAgentQueueTask),
    autorunSnapshot,
    isDeleting,
    isDirty: hasOpenTaskEdit,
    runnerActiveQueueItemId: queueRunner.activeQueueItemId,
    runnerStatus: queueRunner.controller.status,
    selectedTask,
    tasks: tasksRef.current,
  });
  const tagActions = useMemo(
    () =>
      createAgentQueueTagActions({
        onUpdateAgentQueueTask,
        persistWorkerScopeUpdates,
        queueTags,
        selectedTask,
        setDraft,
        setGlobalMessage,
        setLocalTaskFields,
        setManagedQueueTags,
        setQueueTagPauseStates,
        setSelectedTask,
        setTagManagementError,
        setTagManagementMessage,
        setTasks,
        setWorkerScopes,
        tasksRef,
      }),
    [
      onUpdateAgentQueueTask,
      persistWorkerScopeUpdates,
      queueTags,
      selectedTask,
    ],
  );
  const taskActions = createAgentQueueTaskActions({
    applyUpdatedTask,
    autorunSnapshot,
    draft,
    editPauseMessage: EDIT_PAUSE_MESSAGE,
    hasOpenTaskEdit,
    isCreating,
    isDeleting,
    isDirty,
    isEditing,
    isLoading,
    isSaving,
    isSelecting,
    loadTasks,
    localTaskFieldsRef,
    mergeTaskFoundation,
    onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask,
    onDeleteAgentQueueTask,
    onGetAgentQueueTask,
    onUpdateAgentQueueTask,
    queueRunnerActiveQueueItemId: queueRunner.activeQueueItemId,
    queueRunnerStatus: queueRunner.controller.status,
    selectedTask,
    setAssignmentError,
    setAssignmentMessage,
    setDeleteError,
    setDeleteMessage,
    setDraft,
    setEditorError,
    setExecutionPlanMessage,
    setCoordinatorFinalizationMessage,
    setGlobalMessage,
    setIsConfirmingDelete,
    setIsCreating,
    setIsDeleting,
    setIsEditing,
    setIsSaving,
    setIsSelecting,
    setLoadError,
    setLocalTaskFields,
    setOrderingMessage,
    setQueueTagPauseStates,
    setSaveStateText,
    setSelectedDraft,
    setTasks,
    setValidationMessage,
    setWorkerReportMessage,
    tasksRef,
    workerScopes,
  });
  const planningActions = createAgentQueuePlanningActions({
    applyUpdatedTask,
    hasOpenTaskEdit,
    isSaving,
    selectedExecutorWidgetId,
    selectedTask,
    setAssignmentMessage,
    setExecutionPlanMessage,
    setGlobalExecutionState,
    setGlobalMessage,
    setLocalTaskFields,
    setMaxExecutorMessage,
    setMaxExecutors,
    setOrderingMessage,
    setQueueTagPauseStates,
    setSelectedTask,
    setStartError,
    setTagManagementError,
    setTasks,
    setValidationMessage,
    setWorkerReportMessage,
    tasksRef,
    workerCount: workers.length,
  });
  const runActions = createAgentQueueRunActions({
    applyUpdatedTask,
    agentExecutorSlots,
    approvalPolicy: selectedTaskApprovalPolicyForRun,
    canAutoAssignSelectedTask: canUseDefaultLocalExecutor,
    canArmAutorun,
    canStart,
    codexExecutable,
    hasOpenTaskEdit,
    isAssigning,
    isAutorunStarting,
    isAutorunStopping,
    isStarting,
    loadTasks,
    onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment,
    onDirectWorkRunHandoffStarted,
    onGetAgentQueueRunnerSnapshot,
    onStartAgentQueueRunnerSession,
    onStartAssignedAgentQueueTask,
    onStopAgentQueueRunnerSession,
    queueRunnerClearError: queueRunner.clearError,
    refreshLatestRunLink,
    repoRoot,
    sandbox: selectedTaskSandboxForRun,
    selectedExecutorWidgetId,
    selectedTask,
    setAssignmentError,
    setAssignmentMessage,
    setAutorunError,
    setAutorunMessage,
    setAutorunSnapshot,
    setCodexExecutableDraft,
    setDeleteError,
    setDeleteMessage,
    setIsAssigning,
    setIsAutorunLoading,
    setIsAutorunStarting,
    setIsAutorunStopping,
    setIsStarting,
    setLocalTaskFields,
    setManualExecutorOverrideTaskId,
    setRepoRootDraft,
    setSelectedExecutorWidgetId,
    setStartError,
    setStartedRunId,
    setStartMessage,
    startInFlightRef,
    workerConfigsRef,
    workerScopes,
  });
  const { refreshAutorunSnapshot } = runActions;

  function markReportActionCardShown(cardId: string) {
    if (!selectedTask) {
      return;
    }

    const taskFoundation = {
      ...(localTaskFieldsRef.current.get(selectedTask.queueItemId) ?? {}),
      workspaceChatReportCardId: cardId,
      workspaceChatReportCardStatus: "shown" as const,
    };
    const updatedTask = {
      ...selectedTask,
      workspaceChatReportCardId: cardId,
      workspaceChatReportCardStatus: "shown" as const,
    };

    setLocalTaskFields((current) =>
      new Map(current).set(selectedTask.queueItemId, taskFoundation),
    );
    applyUpdatedTask(updatedTask, { select: true });
    setWorkerReportMessage(
      "Report card shown in Workspace Chat. Coordinator action is still required; no final status was applied.",
    );
  }

  function attachKnowledgeContextToSelectedTask(
    input: AgentQueueKnowledgeContextAttachInput,
  ): AgentQueueKnowledgeContextAttachResult {
    if (!selectedTask) {
      return {
        message: "Select a Queue task before attaching Knowledge / Skills context.",
        status: "unavailable",
      };
    }

    if (hasOpenTaskEdit) {
      return {
        message: "Save or cancel the selected Queue task edits before attaching context.",
        status: "unavailable",
        taskTitle: selectedTask.title,
      };
    }

    const attachment = buildQueueContextAttachment(input);
    const blockedWarnings = attachment.warnings.filter(
      (warning) => warning.severity === "blocked",
    );

    if (blockedWarnings.length > 0) {
      return {
        message: blockedWarnings[0]?.message ?? "This context is blocked.",
        status: "blocked",
        taskTitle: selectedTask.title,
      };
    }

    const updatedTask = attachContextToQueueTask(selectedTask, input);
    const taskFoundation: Partial<AgentQueueTask> = {
      context: updatedTask.context,
    };
    const nextLocalTaskFields = new Map(localTaskFieldsRef.current).set(
      updatedTask.queueItemId,
      {
        ...(localTaskFieldsRef.current.get(updatedTask.queueItemId) ?? {}),
        ...taskFoundation,
      },
    );
    localTaskFieldsRef.current = nextLocalTaskFields;
    setLocalTaskFields(nextLocalTaskFields);
    applyUpdatedTask(updatedTask, { select: true });
    setValidationMessage(
      "Context attached to the selected Queue task as safe refs and summaries. No prompt was materialized and no work was started.",
    );

    return {
      message: `${attachment.ref.title} attached to ${selectedTask.title}.`,
      status: "attached",
      taskTitle: selectedTask.title,
    };
  }

  return buildAgentQueueControllerViewModel({
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
    autorunSelectedExecutorLabel: autorunSelectedExecutor?.label ?? null,
    autorunSnapshot,
    autonomousController: autonomousRunner.controller,
    canArmAutorun,
    canStart,
    canUseDefaultLocalExecutor,
    coordinatorFinalizationMessage,
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
    knowledgeContext: {
      onAttachSelected: attachKnowledgeContextToSelectedTask,
    },
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
    runnerController: queueRunner.controller,
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
  });
}

export type AgentQueueController = ReturnType<typeof useAgentQueueController>;
