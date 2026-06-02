import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentExecutorRunDetail, AgentQueueRunnerSnapshot, AgentQueueTask, AgentQueueTaskRunLinkSummary, AgentQueueWorkerConfig, DirectWorkApprovalPolicy, DirectWorkSandbox, DirectWorkStreamEvent } from "../../workspace/types";
import { DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE, emptyDraft, errorToMessage, getQueueTaskDependencyState, normalizeItemType, normalizeQueueTag, normalizeTaskDependencies, normalizeTaskExecutionPolicy, normalizeTaskStatus, normalizeValidationStatus, queueDependencyReadinessMessage, queueDependencyStatesByTask, queueTagsFromTasks, selectBestAvailableExecutorForTask, sortQueueTasksForDisplay, validationSummary, workersFromExecutorSlots, type AgentWorkerSummary, type QueueFilter, type QueueGlobalStatus, type QueueTagPauseState, type QueueTagRecord, type QueueTagSummary, type TaskDraft, type WorkerScope } from "../agentQueueTaskUiModel";
import { useQueueTaskAutoRefreshFromExecutor } from "../useQueueTaskAutoRefreshFromExecutor";
import type { AgentQueueAutorunController, AgentQueueAutonomousController, AgentQueueCoordinatorFinalizationController, AgentQueueDeleteController, AgentQueueDiffReviewController, AgentQueueEditController, AgentQueueExecutionPlanController, AgentQueueFoundationController, AgentQueueLatestRunLinkController, AgentQueueOrderingController, AgentQueueReportActionCardController, AgentQueueRunActivityController, AgentQueueRunController, AgentQueueRunEvidenceController, AgentQueueRunHistoryController, AgentQueueRunnerController, AgentQueueWorkerReportController, UseAgentQueueControllerOptions } from "./agentQueueControllerTypes";
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
  refreshAgentQueueRunLinks,
} from "./agentQueueLoadHelpers";
import { createAgentQueueSelectionModel } from "./agentQueueSelectionModel";
import {
  firstRoutingBlockedReasonLabel,
  getAssignedWorkerRoutingStates,
  getWorkerRoutingSummary,
  type AgentQueueRoutingContext,
} from "./agentQueueRoutingModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
  type AgentQueueEmbeddedExecutorSectionModel,
  type AgentQueueSchedulerPlan,
} from "./agentQueueSchedulerModel";
import {
  queueTaskOrderingControls,
} from "./agentQueueOrderingActions";
import {
  appendAgentQueueRunActivityEvent,
  buildAgentQueueRunActivitySnapshot,
  emptyAgentQueueRunActivityState,
} from "./agentQueueRunActivity";
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
  canCreateDiffReviewItem,
  linkedDiffReviewTasks,
} from "./agentQueueDiffReviewModel";
import {
  buildDiffReviewReportActionCard,
  buildWorkerExecutionReportActionCard,
} from "./agentQueueReportActionCardModel";
import {
  createAgentQueueWorkerActions,
} from "./useAgentQueueWorkerActions";

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
  const [sandbox, setSandbox] = useState<DirectWorkSandbox>("read_only");
  const [approvalPolicy, setApprovalPolicy] =
    useState<DirectWorkApprovalPolicy>("never");
  const [isStarting, setIsStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [latestRunLink, setLatestRunLink] =
    useState<AgentQueueTaskRunLinkSummary | null>(null);
  const [runHistoryLinks, setRunHistoryLinks] = useState<
    AgentQueueTaskRunLinkSummary[]
  >([]);
  const [latestRunLinkError, setLatestRunLinkError] = useState<string | null>(
    null,
  );
  const [isLatestRunLinkLoading, setIsLatestRunLinkLoading] = useState(false);
  const [runEvidenceDetail, setRunEvidenceDetail] =
    useState<AgentExecutorRunDetail | null>(null);
  const [runEvidenceError, setRunEvidenceError] = useState<string | null>(null);
  const [isRunEvidenceLoading, setIsRunEvidenceLoading] = useState(false);
  const startInFlightRef = useRef(false);
  const selectedRunEventRefreshInFlightRef = useRef(false);
  const runEvidenceRequestKeyRef = useRef<string | null>(null);
  const [runActivityState, setRunActivityState] = useState(
    emptyAgentQueueRunActivityState,
  );
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
  const {
    changeWorkerScope,
    createWorker,
    deleteWorker,
    loadWorkers,
    persistWorkerScopeUpdates,
    renameWorker,
    setWorkerEnabled,
  } = workerActions;

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
  const pausedQueueTagIds = useMemo(
    () =>
      new Set(
        Array.from(queueTagPauseStates.entries())
          .filter(([, pauseState]) => pauseState.paused)
          .map(([queueTagId]) => queueTagId),
      ),
    [queueTagPauseStates],
  );
  const queueTags = useMemo(
    () => queueTagsFromTasks(tasks, queueTagPauseStates, managedQueueTags),
    [managedQueueTags, queueTagPauseStates, tasks],
  );
  const dependencyStates = useMemo(
    () => queueDependencyStatesByTask(tasks),
    [tasks],
  );
  const routingContext = useMemo<AgentQueueRoutingContext>(
    () => ({
      dependencyStates,
      globalExecutionState,
      pausedQueueTagIds,
      tasks,
    }),
    [dependencyStates, globalExecutionState, pausedQueueTagIds, tasks],
  );
  const workers = useMemo(
    () => {
      const baseWorkers = workersFromExecutorSlots({
        pauseStates: queueTagPauseStates,
        slots: agentExecutorSlots,
        tasks,
        workerConfigs,
        workerScopes,
      });

      return baseWorkers.map((worker) => ({
        ...worker,
        routingSummary: getWorkerRoutingSummary(worker, tasks, routingContext),
      }));
    },
    [
      agentExecutorSlots,
      dependencyStates,
      pausedQueueTagIds,
      queueTagPauseStates,
      tasks,
      workerConfigs,
      workerScopes,
    ],
  );
  const queueValidationSummary = useMemo(
    () => validationSummary(tasks),
    [tasks],
  );
  const assignedWorkerRoutingStates = useMemo(
    () => getAssignedWorkerRoutingStates(tasks, workers, routingContext),
    [routingContext, tasks, workers],
  );
  const schedulerPlan = useMemo(
    () =>
      buildAgentQueueSchedulerPlan({
        dependencyStates,
        globalExecutionState,
        pausedQueueTagIds,
        tasks,
        workers,
      }),
    [
      dependencyStates,
      globalExecutionState,
      pausedQueueTagIds,
      tasks,
      workers,
    ],
  );
  const embeddedExecutor = useMemo(
    () =>
      buildAgentQueueEmbeddedExecutorSection({
        dependencyStates,
        maxExecutors,
        schedulerPlan,
        tasks,
        workers,
      }),
    [dependencyStates, maxExecutors, schedulerPlan, tasks, workers],
  );

  useEffect(() => {
    if (workers.length > maxExecutors) {
      setMaxExecutors(workers.length);
    }
  }, [maxExecutors, workers.length]);

  const linkedReviewsForSelectedTask = useMemo(
    () => linkedDiffReviewTasks(selectedTask, tasks),
    [selectedTask, tasks],
  );
  const dependentTasksForSelectedTask = useMemo(
    () =>
      selectedTask
        ? tasks.filter((task) =>
            (task.dependsOn ?? []).includes(selectedTask.queueItemId),
          )
        : [],
    [selectedTask, tasks],
  );
  const workerReportActionCard = useMemo(() => {
    const latestReport =
      selectedTask?.workerExecutionReports?.[
        selectedTask.workerExecutionReports.length - 1
      ] ?? null;

    if (!selectedTask || !latestReport) {
      return null;
    }

    return buildWorkerExecutionReportActionCard({
      dependentTasks: dependentTasksForSelectedTask,
      linkedDiffReviewTask: linkedReviewsForSelectedTask[0] ?? null,
      report: latestReport,
      sourceTask: selectedTask,
    });
  }, [dependentTasksForSelectedTask, linkedReviewsForSelectedTask, selectedTask]);
  const diffReviewReportActionCard = useMemo(() => {
    if (!selectedTask || normalizeItemType(selectedTask.itemType) !== "diff_review") {
      return null;
    }

    return buildDiffReviewReportActionCard({
      diffReviewTask: selectedTask,
      sourceTask:
        tasks.find(
          (task) => task.queueItemId === selectedTask.diffReview?.sourceItemId,
        ) ?? null,
    });
  }, [selectedTask, tasks]);

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

  useEffect(() => {
    setRunActivityState(emptyAgentQueueRunActivityState());
  }, [latestRunLink?.directWorkRunId, selectedTask?.queueItemId]);

  const refreshLatestRunLink = useCallback(
    async (
      queueItemId: string | null | undefined,
      options?: { silent?: boolean },
    ) => {
      await refreshAgentQueueRunLinks({
        onGetAgentQueueTaskLatestRunLink,
        onListAgentQueueTaskRunLinks,
        options,
        queueItemId,
        setIsLatestRunLinkLoading,
        setLatestRunLink,
        setLatestRunLinkError,
        setRunHistoryLinks,
      });
    },
    [onGetAgentQueueTaskLatestRunLink, onListAgentQueueTaskRunLinks],
  );

  useEffect(() => {
    void refreshLatestRunLink(selectedTask?.queueItemId ?? null);
  }, [refreshLatestRunLink, selectedTask?.queueItemId]);

  useEffect(() => {
    const selectedTaskId = selectedTask?.queueItemId ?? null;
    const selectedRunId = latestRunLink?.directWorkRunId ?? null;
    const selectedExecutorWidgetId = latestRunLink?.executorWidgetId ?? null;
    const hasActiveSelectedRun =
      Boolean(selectedTaskId && selectedRunId && selectedExecutorWidgetId) &&
      (selectedTask?.status === "running" || latestRunLink?.status === "running");

    if (
      !onListenToDirectWorkStreamEvents ||
      !selectedTaskId ||
      !selectedRunId ||
      !selectedExecutorWidgetId ||
      !hasActiveSelectedRun
    ) {
      return undefined;
    }

    const activeSelectedRunId = selectedRunId;
    const activeSelectedExecutorWidgetId = selectedExecutorWidgetId;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function refreshSelectedRunFromEvent(event: DirectWorkStreamEvent) {
      if (
        cancelled ||
        !isSelectedQueueRunStreamEvent(event, {
          runId: activeSelectedRunId,
          widgetInstanceId: activeSelectedExecutorWidgetId,
        }) ||
        (!event.isFinal && selectedRunEventRefreshInFlightRef.current)
      ) {
        return;
      }

      setRunActivityState((current) =>
        appendAgentQueueRunActivityEvent(current, event),
      );

      if (!event.isFinal) {
        return;
      }

      selectedRunEventRefreshInFlightRef.current = true;

      try {
        await loadTasks(selectedTaskId, { preserveCurrentOnError: true });
        await refreshLatestRunLink(selectedTaskId, { silent: true });
      } finally {
        selectedRunEventRefreshInFlightRef.current = false;
      }
    }

    void onListenToDirectWorkStreamEvents((event) => {
      void refreshSelectedRunFromEvent(event);
    }).then(
      (stopListening) => {
        if (cancelled) {
          stopListening();
          return;
        }
        unsubscribe = stopListening;
      },
      () => undefined,
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    latestRunLink?.directWorkRunId,
    latestRunLink?.executorWidgetId,
    latestRunLink?.status,
    loadTasks,
    onListenToDirectWorkStreamEvents,
    refreshLatestRunLink,
    selectedTask?.queueItemId,
    selectedTask?.status,
  ]);

  const refreshRunEvidence = useCallback(
    async (
      link: AgentQueueTaskRunLinkSummary | null | undefined,
      options?: { silent?: boolean },
    ) => {
      if (!link || link.status === "running") {
        runEvidenceRequestKeyRef.current = null;
        setRunEvidenceDetail(null);
        setRunEvidenceError(null);
        setIsRunEvidenceLoading(false);
        return;
      }

      const requestKey = `${link.executorWidgetId}:${link.directWorkRunId}`;
      runEvidenceRequestKeyRef.current = requestKey;

      if (!onGetAgentExecutorRunDetail) {
        setRunEvidenceDetail(null);
        setRunEvidenceError(
          "Direct Work result detail is only available when Executor run detail APIs are available.",
        );
        setIsRunEvidenceLoading(false);
        return;
      }

      if (!options?.silent) {
        setIsRunEvidenceLoading(true);
        setRunEvidenceError(null);
      }

      try {
        const detail = await onGetAgentExecutorRunDetail(
          link.executorWidgetId,
          link.directWorkRunId,
        );
        if (runEvidenceRequestKeyRef.current !== requestKey) {
          return;
        }
        setRunEvidenceDetail(detail);
        setRunEvidenceError(detail ? null : "Direct Work result was not found.");
      } catch (error) {
        if (runEvidenceRequestKeyRef.current !== requestKey) {
          return;
        }
        setRunEvidenceDetail(null);
        setRunEvidenceError(
          errorToMessage(error, "Unable to load Direct Work result evidence."),
        );
      } finally {
        if (!options?.silent) {
          setIsRunEvidenceLoading(false);
        }
      }
    },
    [onGetAgentExecutorRunDetail],
  );

  useEffect(() => {
    void refreshRunEvidence(latestRunLink);
  }, [
    latestRunLink?.directWorkRunId,
    latestRunLink?.executorWidgetId,
    latestRunLink?.status,
    refreshRunEvidence,
  ]);

  const selectedTaskExecutionWorkspace = selectedTask
    ? (isEditing || isDirty ? draft.executionWorkspace : selectedTask.executionWorkspace ?? "")
    : repoRootDraft;
  const selectedTaskCodexExecutable = selectedTask
    ? (isEditing || isDirty ? draft.codexExecutable : selectedTask.codexExecutable ?? "")
    : codexExecutableDraft;
  const selectedTaskSandbox = selectedTask
    ? (isEditing || isDirty ? draft.sandbox : selectedTask.sandbox ?? "")
    : sandbox;
  const selectedTaskApprovalPolicy = selectedTask
    ? (isEditing || isDirty ? draft.approvalPolicy : selectedTask.approvalPolicy ?? "")
    : approvalPolicy;
  const repoRoot = selectedTaskExecutionWorkspace.trim();
  const codexExecutable = selectedTaskCodexExecutable.trim();
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
  const selectedTaskSandboxForRun =
    selectedTaskSandbox === "read_only" ||
    selectedTaskSandbox === "workspace_write" ||
    selectedTaskSandbox === "danger_full_access"
      ? selectedTaskSandbox
      : sandbox;
  const selectedTaskApprovalPolicyForRun =
    selectedTaskApprovalPolicy === "never" ||
    selectedTaskApprovalPolicy === "on_request" ||
    selectedTaskApprovalPolicy === "untrusted"
      ? selectedTaskApprovalPolicy
      : approvalPolicy;
  const hasUnsavedTaskSettings = Boolean(
    selectedTask &&
      (draft.executionWorkspace !== (selectedTask.executionWorkspace ?? "") ||
        draft.codexExecutable !== (selectedTask.codexExecutable ?? "") ||
        draft.sandbox !== (selectedTask.sandbox ?? "") ||
        draft.approvalPolicy !== (selectedTask.approvalPolicy ?? "")),
  );
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
    queueWidgetInstanceId,
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
  const {
    createQueueTag,
    deleteQueueTag,
    pauseQueueTag,
    renameQueueTag,
    resumeQueueTag,
  } = tagActions;
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
  const {
    cancelDeleteSelectedTask,
    cancelSelectedTaskEdits,
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
  const {
    attachDemoWorkerReport,
    generateExecutionPlanPreview,
    moveSelectedTask,
    startWorkers,
    stopAndKillRunning,
    stopWorkers,
    updateMaxExecutors,
  } = planningActions;
  function updateSelectedTaskExecutionWorkspace(value: string) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ executionWorkspace: value });
    } else {
      setRepoRootDraft(value);
    }
    setStartError(null);
    setDeleteError(null);
    setDeleteMessage(null);
  }

  function updateSelectedTaskCodexExecutable(value: string) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ codexExecutable: value });
    } else {
      setCodexExecutableDraft(value);
    }
    setStartError(null);
  }

  function updateSelectedTaskSandbox(value: DirectWorkSandbox) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ sandbox: value });
    } else {
      setSandbox(value);
    }
    setStartError(null);
  }

  function updateSelectedTaskApprovalPolicy(value: DirectWorkApprovalPolicy) {
    if (selectedTask) {
      updateSelectedTaskRunSettings({ approvalPolicy: value });
    } else {
      setApprovalPolicy(value);
    }
    setStartError(null);
  }

  function updateSelectedTaskRunSettings(
    nextSettings: Partial<Pick<
      AgentQueueTask,
      "executionWorkspace" | "codexExecutable" | "sandbox" | "approvalPolicy"
    >>,
  ) {
    if (!selectedTask) {
      return;
    }

    const currentSelectedTask =
      tasksRef.current.find((task) => task.queueItemId === selectedTask.queueItemId) ??
      selectedTask;
    const updatedTask: AgentQueueTask = {
      ...currentSelectedTask,
      ...nextSettings,
    };
    applyUpdatedTask(updatedTask, { select: true });

    if (!onUpdateAgentQueueTask) {
      return;
    }

    void onUpdateAgentQueueTask({
      approvalPolicy: updatedTask.approvalPolicy ?? null,
      codexExecutable: updatedTask.codexExecutable ?? null,
      description: updatedTask.description,
      executionPolicy: normalizeTaskExecutionPolicy(updatedTask.executionPolicy),
      executionWorkspace: updatedTask.executionWorkspace ?? null,
      itemType: normalizeItemType(updatedTask.itemType),
      priority: updatedTask.priority,
      prompt: updatedTask.prompt,
      queueItemId: updatedTask.queueItemId,
      queueTagId: normalizeQueueTag(updatedTask).queueTagId,
      queueTagName: normalizeQueueTag(updatedTask).queueTagName,
      sandbox: updatedTask.sandbox ?? null,
      status: normalizeTaskStatus(updatedTask.status),
      title: updatedTask.title,
      validationStatus: normalizeValidationStatus(updatedTask.validationStatus),
    }).then((persistedTask) => {
      if (persistedTask) {
        applyUpdatedTask(persistedTask, { select: true });
      }
    }, (error) => {
      setStartError(errorToMessage(error, "Unable to save task run settings."));
    });
  }

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
  const {
    armAutorunSession,
    assignSelectedTask,
    clearSelectedTaskAssignment,
    refreshAutorunSnapshot,
    selectExecutorWidget,
    startAssignedTask,
    stopAutorunSession,
    updateCodexExecutableDraft,
    updateRepoRootDraft,
  } = runActions;

  const runActivitySnapshot = useMemo(
    () =>
      selectedTask
        ? buildAgentQueueRunActivitySnapshot({
            activity: runActivityState,
            latestRun: latestRunLink,
            selectedTask,
          })
        : {
            currentMessage: "No Queue task selected.",
            currentStage: "Starting" as const,
            lastCommand: null,
            lastCommandStatus: null,
            rawEvents: [],
            recentEvents: [],
            statusLine: "No active run selected.",
          },
    [latestRunLink, runActivityState, selectedTask],
  );

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
      selectedExecutorLabel: autorunSelectedExecutor?.label ?? null,
      snapshot: autorunSnapshot,
    } satisfies AgentQueueAutorunController,
    autonomous: {
      ...autonomousRunner.controller,
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
      ...queueRunner.controller,
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

function isSelectedQueueRunStreamEvent(
  event: DirectWorkStreamEvent,
  selectedRun: {
    runId: string;
    widgetInstanceId: string;
  },
) {
  return (
    event.runId === selectedRun.runId &&
    event.widgetInstanceId === selectedRun.widgetInstanceId
  );
}
