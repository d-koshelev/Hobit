import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerConfig,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import {
  clamp,
  DEFAULT_QUEUE_TAG_ID,
  DEFAULT_TASK_TITLE,
  emptyDraft,
  errorToMessage,
  getQueueTaskDependencyState,
  MAX_PRIORITY,
  MIN_PRIORITY,
  normalizeItemType,
  normalizeQueueTag,
  normalizeQueueTagName,
  normalizeTaskDependencies,
  normalizeTaskExecutionPolicy,
  normalizeTaskPriority,
  normalizeTaskStatus,
  normalizeValidationStatus,
  DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE,
  queueGlobalExecutionStateDescription,
  queueGlobalExecutionStateLabel,
  queueDependencyReadinessMessage,
  queueDependencyStatesByTask,
  sortQueueTasksForDisplay,
  queueTagsFromTasks,
  queueTagNameToId,
  shortWidgetInstanceId,
  validateQueueTaskDependencies,
  validationSummary,
  workersFromExecutorSlots,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
  type QueueFilter,
  type QueueTagPauseState,
  type QueueTagRecord,
  type QueueTagSummary,
  type TaskDraft,
  type WorkerScope,
  validateDraft,
  validateQueueTagName,
} from "../agentQueueTaskUiModel";
import type { AgentQueueTaskStartRequest } from "../agentQueueTaskWidgetActions";
import type { WidgetRenderProps } from "../types";
import { useQueueTaskAutoRefreshFromExecutor } from "../useQueueTaskAutoRefreshFromExecutor";
import {
  defaultCodexExecutable,
  nextQueueTaskSelection,
  queueAutorunPreconditionMessages,
  queueRunReadinessMessage,
  queueRunStartErrorMessage,
  queueTaskDeleteBlockedReason,
  reconcileQueueTask,
  runPreconditionMessages,
  type AgentQueueRunnerStatus,
} from "./agentQueueControllerHelpers";
import {
  firstRoutingBlockedReasonLabel,
  getAssignedWorkerRoutingStates,
  getWorkerRoutingSummary,
  type AgentQueueRoutingContext,
} from "./agentQueueRoutingModel";
import {
  buildAgentQueueSchedulerPlan,
  type AgentQueueSchedulerPlan,
} from "./agentQueueSchedulerModel";
import { useAgentQueueSequentialRunner } from "./useAgentQueueSequentialRunner";

type UseAgentQueueControllerOptions = Pick<
  WidgetRenderProps,
  | "agentExecutorSlots"
  | "onAssignAgentQueueTaskToExecutor"
  | "onClearAgentQueueTaskAssignment"
  | "onCreateAgentQueueTask"
  | "onDeleteAgentQueueTask"
  | "onCreateAgentQueueWorker"
  | "onDeleteAgentQueueWorker"
  | "onDirectWorkRunHandoffStarted"
  | "onGetAgentQueueTask"
  | "onGetAgentQueueTaskLatestRunLink"
  | "onGetAgentQueueRunnerSnapshot"
  | "onListAgentQueueTaskRunLinks"
  | "onListAgentQueueTasks"
  | "onListAgentQueueWorkers"
  | "onStartAssignedAgentQueueTask"
  | "onStartAgentQueueRunnerSession"
  | "onStopAgentQueueRunnerSession"
  | "onUpdateAgentQueueTask"
  | "onUpdateAgentQueueWorker"
  | "queueTaskAutoRefreshRequest"
>;

export type AgentQueueRunController = {
  approvalPolicy: DirectWorkApprovalPolicy;
  canStart: boolean;
  codexExecutableDraft: string;
  isStarting: boolean;
  onApprovalPolicyChange: (approvalPolicy: DirectWorkApprovalPolicy) => void;
  onCodexExecutableDraftChange: (codexExecutable: string) => void;
  onRepoRootDraftChange: (repoRoot: string) => void;
  onSandboxChange: (sandbox: DirectWorkSandbox) => void;
  onStartAssignedTask: () => void;
  preconditionMessages: string[];
  readinessMessage: string | null;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox;
  startError: string | null;
  startedRunId: string | null;
  startMessage: string | null;
};

export type { AgentQueueRunnerStatus } from "./agentQueueControllerHelpers";

export type AgentQueueRunnerController = {
  canStart: boolean;
  error: string | null;
  message: string | null;
  onStart: () => void;
  onStop: () => void;
  preconditionMessages: string[];
  status: AgentQueueRunnerStatus;
};

export type AgentQueueAutorunController = {
  apiAvailable: boolean;
  canArm: boolean;
  error: string | null;
  isLoading: boolean;
  isStarting: boolean;
  isStopping: boolean;
  message: string | null;
  onArm: () => void;
  onRefresh: () => void;
  onStop: () => void;
  preconditionMessages: string[];
  selectedExecutorLabel: string | null;
  snapshot: AgentQueueRunnerSnapshot | null;
};

export type AgentQueueLatestRunLinkController = {
  apiAvailable: boolean;
  error: string | null;
  isLoading: boolean;
  link: AgentQueueTaskRunLinkSummary | null;
  onRefresh: () => void;
};

export type AgentQueueRunHistoryController = {
  apiAvailable: boolean;
  error: string | null;
  isLoading: boolean;
  links: AgentQueueTaskRunLinkSummary[];
  onRefresh: () => void;
  totalCount: number;
};

export type AgentQueueDeleteController = {
  blockedReason: string | null;
  canRequest: boolean;
  error: string | null;
  isConfirming: boolean;
  isDeleting: boolean;
  message: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRequest: () => void;
};

export type QueueTaskInsertPosition = "top" | "bottom";

export type AgentQueueOrderingController = {
  canMoveDown: boolean;
  canMoveToBottom: boolean;
  canMoveToTop: boolean;
  canMoveUp: boolean;
  message: string | null;
  orderLabel: string | null;
  onMoveDown: () => void;
  onMoveToBottom: () => void;
  onMoveToTop: () => void;
  onMoveUp: () => void;
};

export type AgentQueueEditController = {
  isEditing: boolean;
  onCancel: () => void;
  onStart: () => void;
};

export type AgentQueueFoundationController = {
  globalExecutionState: QueueGlobalStatus;
  globalMessage: string | null;
  globalStatus: QueueGlobalStatus;
  onCreateQueueTag: (queueTagName: string) => boolean;
  onDeleteQueueTag: (queueTagId: string) => boolean;
  onCreateWorker: () => void;
  onDeleteWorker: (workerId: string) => void;
  onPauseQueueTag: (queueTagId: string) => void;
  onRenameWorker: (workerId: string, name: string) => void;
  onRenameQueueTag: (queueTagId: string, queueTagName: string) => Promise<boolean>;
  onResumeQueueTag: (queueTagId: string) => void;
  onStartWorkers: () => void;
  onStopAndKillRunning: () => void;
  onStopWorkers: () => void;
  onWorkerEnabledChange: (workerId: string, enabled: boolean) => void;
  onWorkerScopeChange: (workerId: string, scope: WorkerScope) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  queueTags: QueueTagSummary[];
  schedulerPlan: AgentQueueSchedulerPlan;
  tagManagementError: string | null;
  tagManagementMessage: string | null;
  validationSummary: Record<string, number>;
  workers: AgentWorkerSummary[];
};

export function useAgentQueueController({
  agentExecutorSlots = [],
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onCreateAgentQueueWorker,
  onDeleteAgentQueueTask,
  onDeleteAgentQueueWorker,
  onDirectWorkRunHandoffStarted,
  onGetAgentQueueTask,
  onGetAgentQueueTaskLatestRunLink,
  onGetAgentQueueRunnerSnapshot,
  onListAgentQueueTaskRunLinks,
  onListAgentQueueTasks,
  onListAgentQueueWorkers,
  onStartAssignedAgentQueueTask,
  onStartAgentQueueRunnerSession,
  onStopAgentQueueRunnerSession,
  onUpdateAgentQueueTask,
  onUpdateAgentQueueWorker,
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
  const startInFlightRef = useRef(false);
  const tasksRef = useRef<AgentQueueTask[]>([]);
  const [autorunSnapshot, setAutorunSnapshot] =
    useState<AgentQueueRunnerSnapshot | null>(null);
  const [isAutorunLoading, setIsAutorunLoading] = useState(false);
  const [isAutorunStarting, setIsAutorunStarting] = useState(false);
  const [isAutorunStopping, setIsAutorunStopping] = useState(false);
  const [autorunMessage, setAutorunMessage] = useState<string | null>(null);
  const [autorunError, setAutorunError] = useState<string | null>(null);
  const [globalExecutionState, setGlobalExecutionState] =
    useState<QueueGlobalStatus>(DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE);
  const [globalMessage, setGlobalMessage] = useState<string | null>(
    "Workers are stopped. START only opens local scheduling; it does not run tasks automatically.",
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
    Map<
      string,
      Pick<
        AgentQueueTask,
        | "assignedWorkerId"
        | "coordinatorStatus"
        | "dependsOn"
        | "itemType"
        | "orderIndex"
        | "queueTagId"
        | "queueTagName"
        | "validationStatus"
      >
    >
  >(() => new Map());
  const localTaskFieldsRef = useRef(localTaskFields);
  const [orderingMessage, setOrderingMessage] = useState<string | null>(null);
  const EDIT_PAUSE_MESSAGE =
    "Editing paused this queue tag until coordinator review.";

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
        draft.description !== selectedTask.description ||
        !areStringArraysEqual(
          draft.dependsOn,
          normalizeTaskDependencies(selectedTask.dependsOn),
        ) ||
        draft.executionPolicy !==
          normalizeTaskExecutionPolicy(selectedTask.executionPolicy) ||
        draft.itemType !== normalizeItemType(selectedTask.itemType) ||
        draft.prompt !== selectedTask.prompt ||
        draft.queueTagName !== normalizeQueueTag(selectedTask).queueTagName ||
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

  const loadTasks = useCallback(
    async (
      preferredTaskId?: string | null,
      options?: { preserveCurrentOnError?: boolean },
    ) => {
      if (
        !onCreateAgentQueueTask ||
        !onDeleteAgentQueueTask ||
        !onGetAgentQueueTask ||
        !onListAgentQueueTasks ||
        !onUpdateAgentQueueTask
      ) {
        setTasks([]);
        clearSelectedTask();
        setLoadError(
          "Agent Queue task persistence is not available in this runtime.",
        );
        setIsLoading(false);
        return "Agent Queue task persistence is not available in this runtime.";
      }

      setIsLoading(true);
      setLoadError(null);
      setEditorError(null);
      setAssignmentError(null);
      setValidationMessage(null);

      try {
        const loadedTasks = withQueueOrderIndexes(
          (await onListAgentQueueTasks()).map(mergeTaskFoundation),
        );
        tasksRef.current = loadedTasks;
        setTasks(loadedTasks);

        const preferredExists = loadedTasks.some(
          (task) => task.queueItemId === preferredTaskId,
        );
        const taskIdToSelect = preferredExists
          ? preferredTaskId
          : loadedTasks[0]?.queueItemId;

        if (!taskIdToSelect) {
          clearSelectedTask();
          return null;
        }

        const detail = await onGetAgentQueueTask(taskIdToSelect);

        if (!detail) {
          clearSelectedTask();
          setEditorError("The selected queue task could not be found.");
          return "The selected queue task could not be found.";
        }

        setSelectedDraft(
          loadedTasks.find((task) => task.queueItemId === detail.queueItemId) ??
            detail,
        );
        setSaveStateText("Saved");
        return null;
      } catch (error) {
        if (!options?.preserveCurrentOnError) {
          setTasks([]);
          clearSelectedTask();
          setLoadError(errorToMessage(error, "Unable to load Agent Queue tasks."));
        }
        return errorToMessage(error, "Unable to load Agent Queue tasks.");
      } finally {
        setIsLoading(false);
      }
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

  const loadWorkers = useCallback(async () => {
    if (!onListAgentQueueWorkers) {
      const defaultWorkers = defaultWorkerConfigsFromExecutorSlots(agentExecutorSlots);
      workerConfigsRef.current = defaultWorkers;
      setWorkerConfigs(defaultWorkers);
      return;
    }

    try {
      const loadedWorkers = await onListAgentQueueWorkers();
      if (loadedWorkers.length > 0) {
        workerConfigsRef.current = loadedWorkers;
        setWorkerConfigs(loadedWorkers);
        setWorkerScopes(workerScopesFromConfigs(loadedWorkers));
        return;
      }

      const defaultWorkers = defaultWorkerConfigsFromExecutorSlots(agentExecutorSlots);
      if (!onCreateAgentQueueWorker) {
        workerConfigsRef.current = defaultWorkers;
        setWorkerConfigs(defaultWorkers);
        setWorkerScopes(workerScopesFromConfigs(defaultWorkers));
        return;
      }

      const createdWorkers: AgentQueueWorkerConfig[] = [];
      for (const worker of defaultWorkers) {
        createdWorkers.push(
          await onCreateAgentQueueWorker({
            displayOrder: worker.displayOrder,
            enabled: worker.enabled,
            name: worker.name,
            queueTagId: worker.queueTagId,
            queueTagName: worker.queueTagName,
            scopeKind: worker.scopeKind,
            workerId: worker.workerId,
          }),
        );
      }
      workerConfigsRef.current = createdWorkers;
      setWorkerConfigs(createdWorkers);
      setWorkerScopes(workerScopesFromConfigs(createdWorkers));
    } catch {
      const defaultWorkers = defaultWorkerConfigsFromExecutorSlots(agentExecutorSlots);
      workerConfigsRef.current = defaultWorkers;
      setWorkerConfigs(defaultWorkers);
      setWorkerScopes(workerScopesFromConfigs(defaultWorkers));
    }
  }, [agentExecutorSlots, onCreateAgentQueueWorker, onListAgentQueueWorkers]);

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
    if (!selectedTask) {
      setSelectedExecutorWidgetId("");
      return;
    }

    setSelectedExecutorWidgetId((currentSelection) => {
      if (selectedTask.assignedExecutorWidgetId) {
        return selectedTask.assignedExecutorWidgetId;
      }

      if (
        currentSelection &&
        agentExecutorSlots.some(
          (slot) => slot.widgetInstanceId === currentSelection,
        )
      ) {
        return currentSelection;
      }

      return agentExecutorSlots[0]?.widgetInstanceId ?? "";
    });
  }, [
    agentExecutorSlots,
    selectedTask?.assignedExecutorWidgetId,
    selectedTask?.queueItemId,
  ]);

  useEffect(() => {
    setRepoRootDraft("");
    setStartMessage(null);
    setStartedRunId(null);
    setStartError(null);
  }, [selectedTask?.queueItemId]);

  const refreshLatestRunLink = useCallback(
    async (
      queueItemId: string | null | undefined,
      options?: { silent?: boolean },
    ) => {
      if (
        !queueItemId ||
        (!onListAgentQueueTaskRunLinks && !onGetAgentQueueTaskLatestRunLink)
      ) {
        setLatestRunLink(null);
        setRunHistoryLinks([]);
        setLatestRunLinkError(null);
        setIsLatestRunLinkLoading(false);
        return;
      }

      if (!options?.silent) {
        setIsLatestRunLinkLoading(true);
      }
      setLatestRunLinkError(null);

      try {
        if (onListAgentQueueTaskRunLinks) {
          const links = await onListAgentQueueTaskRunLinks(queueItemId);
          setRunHistoryLinks(links);
          setLatestRunLink(links[0] ?? null);
        } else if (onGetAgentQueueTaskLatestRunLink) {
          const link = await onGetAgentQueueTaskLatestRunLink(queueItemId);
          setLatestRunLink(link);
          setRunHistoryLinks(link ? [link] : []);
        }
      } catch (error) {
        setLatestRunLink(null);
        setRunHistoryLinks([]);
        setLatestRunLinkError(
          errorToMessage(error, "Unable to load Queue run metadata."),
        );
      } finally {
        if (!options?.silent) {
          setIsLatestRunLinkLoading(false);
        }
      }
    },
    [onGetAgentQueueTaskLatestRunLink, onListAgentQueueTaskRunLinks],
  );

  useEffect(() => {
    void refreshLatestRunLink(selectedTask?.queueItemId ?? null);
  }, [refreshLatestRunLink, selectedTask?.queueItemId]);

  const repoRoot = repoRootDraft.trim();
  const codexExecutable = codexExecutableDraft.trim();
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
  const selectedTaskRoutingMessage =
    selectedTaskAssignedWorkerRouting &&
    selectedTaskAssignedWorkerRouting.blockedReasons.length > 0
      ? firstRoutingBlockedReasonLabel(
          selectedTaskAssignedWorkerRouting.blockedReasons,
        )
      : null;
  const globalRunBlockMessage =
    globalExecutionState === "stopped"
      ? "Queue is stopped. Click START before running the selected task."
      : globalExecutionState === "stop_kill_requested"
        ? "STOP + KILL RUNNING is requested. Review running work or click START before starting new work."
        : null;
  const readinessMessage = globalRunBlockMessage
    ? globalRunBlockMessage
    : selectedQueueTagPaused
    ? "Resume this queue tag before running the selected task."
    : selectedTask
        ? queueRunReadinessMessage({
          isDirty: hasOpenTaskEdit,
          selectedTask,
          startApiAvailable,
        }) ??
        queueDependencyReadinessMessage(
          dependencyStates.get(selectedTask.queueItemId) ??
            getQueueTaskDependencyState(selectedTask, tasks),
        ) ??
        selectedTaskRoutingMessage
      : "Assign an Agent Executor before running.";
  const preconditionMessages = useMemo(
    () =>
      readinessMessage
        ? []
        : runPreconditionMessages({
            codexExecutable,
            isStarting,
            repoRoot,
          }),
    [codexExecutable, isStarting, readinessMessage, repoRoot],
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
  useQueueTaskAutoRefreshFromExecutor({
    autoRefreshRequest: queueTaskAutoRefreshRequest,
    isDirty: hasOpenTaskEdit,
    loadTasks,
    onRefreshComplete: queueRunner.onAutoRefreshComplete,
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

  async function createTask(
    nextDraft?: TaskDraft,
    options?: { insertPosition?: QueueTaskInsertPosition },
  ) {
    if (!onCreateAgentQueueTask || isCreating || isLoading) {
      return false;
    }

    if (isEditing || isDirty) {
      setValidationMessage("Save current task before creating another task.");
      return false;
    }

    const taskDraft = nextDraft ?? {
      ...emptyDraft(),
      title: DEFAULT_TASK_TITLE,
    };
    const validationError = validateDraft(taskDraft);

    if (validationError) {
      setValidationMessage(validationError);
      return false;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);
    setDeleteError(null);
    setDeleteMessage(null);
    setIsConfirmingDelete(false);

    try {
      const createdTask = await onCreateAgentQueueTask({
        title: taskDraft.title.trim(),
        description: taskDraft.description,
        prompt: taskDraft.prompt,
        status: taskDraft.status,
        priority: taskDraft.priority,
        executionPolicy: taskDraft.executionPolicy,
        itemType: taskDraft.itemType,
        queueTagId: queueTagNameToId(taskDraft.queueTagName),
        queueTagName: taskDraft.queueTagName.trim(),
        validationStatus: taskDraft.validationStatus,
      });
      const taskFoundation = {
        dependsOn: [],
        itemType: taskDraft.itemType,
        orderIndex: nextOrderIndexForQueueTag({
          insertPosition: options?.insertPosition ?? "bottom",
          queueTagId: queueTagNameToId(taskDraft.queueTagName),
          tasks: tasksRef.current,
        }),
        queueTagId: queueTagNameToId(taskDraft.queueTagName),
        queueTagName: taskDraft.queueTagName.trim(),
        validationStatus: taskDraft.validationStatus,
        coordinatorStatus: "not_reported" as const,
      };
      setLocalTaskFields((current) =>
        new Map(current).set(createdTask.queueItemId, taskFoundation),
      );
      applyUpdatedTask({ ...createdTask, ...taskFoundation }, { select: true });
      setOrderingMessage(
        options?.insertPosition === "top"
          ? "Task inserted at the top of its queue tag."
          : "Task inserted at the bottom of its queue tag.",
      );
      setIsEditing(false);
      return true;
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create queue task."));
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  async function refreshTasks() {
    if (isEditing || isDirty) {
      setValidationMessage("Save current task before refreshing the queue.");
      return;
    }

    await loadTasks(selectedTask?.queueItemId ?? null);
  }

  async function selectTask(queueItemId: string) {
    if (
      !onGetAgentQueueTask ||
      isSelecting ||
      selectedTask?.queueItemId === queueItemId
    ) {
      return;
    }

    if (isEditing || isDirty) {
      setValidationMessage("Save current task before selecting another task.");
      return;
    }

    setIsSelecting(true);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);

    try {
      const detail = await onGetAgentQueueTask(queueItemId);

      if (!detail) {
        setEditorError("The selected queue task could not be found.");
        return;
      }

      const mergedDetail = withQueueOrderIndexes([
        ...tasksRef.current.filter((task) => task.queueItemId !== detail.queueItemId),
        mergeTaskFoundation(detail),
      ]).find((task) => task.queueItemId === detail.queueItemId);
      setSelectedDraft(mergedDetail ?? detail);
      setIsEditing(false);
      setTasks((currentTasks) =>
        sortQueueTasksForDisplay(
          currentTasks.map((task) =>
            task.queueItemId === detail.queueItemId
              ? (mergedDetail ?? mergeTaskFoundation(detail))
              : task,
          ),
        ),
      );
      setSaveStateText("Saved");
      setDeleteError(null);
      setDeleteMessage(null);
      setIsConfirmingDelete(false);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open queue task."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function saveTask() {
    if (
      !selectedTask ||
      !onUpdateAgentQueueTask ||
      !isEditing ||
      !isDirty ||
      isSaving
    ) {
      return;
    }

    const validationError = validateDraft(draft);

    if (validationError) {
      setValidationMessage(validationError);
      return;
    }

    const dependencyValidationError = validateQueueTaskDependencies(
      { ...selectedTask, dependsOn: draft.dependsOn },
      tasksRef.current,
    );

    if (dependencyValidationError) {
      setValidationMessage(dependencyValidationError);
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);
    setSaveStateText("Saving");

    try {
      const updatedTask = await onUpdateAgentQueueTask({
        queueItemId: selectedTask.queueItemId,
        title: draft.title.trim(),
        description: draft.description,
        prompt: draft.prompt,
        status: draft.status,
        priority: draft.priority,
        executionPolicy: draft.executionPolicy,
        itemType: draft.itemType,
        queueTagId: queueTagNameToId(draft.queueTagName),
        queueTagName: draft.queueTagName.trim(),
        validationStatus: draft.validationStatus,
      });

      if (!updatedTask) {
        setEditorError("The selected queue task could not be found.");
        setSaveStateText("Unsaved changes");
        return;
      }

      const previousQueueTagId = normalizeQueueTag(selectedTask).queueTagId;
      const queueTagId = queueTagNameToId(draft.queueTagName);
      const validationStatus =
        draft.validationStatus === "not_started"
          ? "needs_review"
          : draft.validationStatus;
      const taskFoundation: Partial<AgentQueueTask> = {
        dependsOn: normalizeTaskDependencies(draft.dependsOn),
        itemType: draft.itemType,
        orderIndex: selectedTask.orderIndex,
        queueTagId,
        queueTagName: draft.queueTagName.trim(),
        validationStatus,
        coordinatorStatus: "awaiting_coordinator_review" as const,
      };
      let taskForApply = updatedTask;
      const assignedScope = updatedTask.assignedExecutorWidgetId
        ? workerScopes.get(updatedTask.assignedExecutorWidgetId)
        : null;
      if (
        previousQueueTagId !== queueTagId &&
        assignedScope?.kind === "queue_tag" &&
        assignedScope.queueTagId !== queueTagId
      ) {
        taskFoundation.assignedWorkerId = null;
        if (onClearAgentQueueTaskAssignment) {
          try {
            taskForApply = await onClearAgentQueueTaskAssignment({
              queueItemId: selectedTask.queueItemId,
            });
            setAssignmentMessage(
              "Assignment cleared because the worker is scoped to another queue tag.",
            );
          } catch (error) {
            setAssignmentError(
              errorToMessage(
                error,
                "Task moved tags, but its scoped worker assignment could not be cleared.",
              ),
            );
          }
        } else {
          setAssignmentError(
            "Task moved tags. Recheck the scoped worker assignment before running.",
          );
        }
      }
      setQueueTagPauseStates((current) => {
        const next = new Map(current);
        next.set(queueTagId, { paused: true, reason: "edit_review" });
        if (previousQueueTagId !== queueTagId) {
          next.set(previousQueueTagId, {
            paused: true,
            reason: "edit_review",
          });
        }
        return next;
      });
      setLocalTaskFields((current) =>
        new Map(current).set(taskForApply.queueItemId, {
          ...(current.get(taskForApply.queueItemId) ?? {}),
          ...taskFoundation,
        }),
      );
      applyUpdatedTask({ ...taskForApply, ...taskFoundation }, { select: true });
      setValidationMessage(EDIT_PAUSE_MESSAGE);
      setGlobalMessage(EDIT_PAUSE_MESSAGE);
      setSaveStateText("Saved");
      setIsEditing(false);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save queue task."));
      setSaveStateText("Unsaved changes");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteSelectedTask() {
    const blockedReason = queueTaskDeleteBlockedReason({
      apiAvailable: Boolean(onDeleteAgentQueueTask),
      autorunSnapshot,
      isDeleting,
      isDirty,
      runnerActiveQueueItemId: queueRunner.activeQueueItemId,
      runnerStatus: queueRunner.controller.status,
      selectedTask,
      tasks: tasksRef.current,
    });

    setDeleteMessage(null);
    setDeleteError(null);

    if (blockedReason) {
      setDeleteError(blockedReason);
      setIsConfirmingDelete(false);
      return;
    }

    setIsConfirmingDelete(true);
  }

  function cancelDeleteSelectedTask() {
    setIsConfirmingDelete(false);
    setDeleteError(null);
  }

  async function confirmDeleteSelectedTask() {
    if (!selectedTask || !onDeleteAgentQueueTask || isDeleting) {
      return;
    }

    const blockedReason = queueTaskDeleteBlockedReason({
      apiAvailable: true,
      autorunSnapshot,
      isDeleting: false,
      isDirty,
      runnerActiveQueueItemId: queueRunner.activeQueueItemId,
      runnerStatus: queueRunner.controller.status,
      selectedTask,
      tasks: tasksRef.current,
    });

    if (blockedReason) {
      setDeleteError(blockedReason);
      setIsConfirmingDelete(false);
      return;
    }

    const deletedTaskId = selectedTask.queueItemId;
    const nextTaskId = nextQueueTaskSelection(tasksRef.current, deletedTaskId);

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const didDelete = await onDeleteAgentQueueTask({
        queueItemId: deletedTaskId,
      });

      if (!didDelete) {
        setDeleteError("The selected queue task could not be found.");
        setIsConfirmingDelete(false);
        await loadTasks(nextTaskId);
        return;
      }

      setIsConfirmingDelete(false);
      setLocalTaskFields((current) => {
        const next = new Map(current);
        next.delete(deletedTaskId);
        return next;
      });
      setDeleteMessage("Queue task deleted.");
      await loadTasks(nextTaskId);
    } catch (error) {
      setDeleteError(errorToMessage(error, "Unable to delete queue task."));
    } finally {
      setIsDeleting(false);
    }
  }

  function updateDraft(nextDraft: Partial<TaskDraft>) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setAssignmentMessage(null);
    setValidationMessage(null);
    setDeleteMessage(null);
  }

  function updatePriority(value: string) {
    if (!isEditing) {
      return;
    }

    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? clamp(parsedValue, MIN_PRIORITY, MAX_PRIORITY)
      : MIN_PRIORITY;

    updateDraft({ priority });
  }

  function startWorkers() {
    setGlobalExecutionState("started");
    setGlobalMessage(
      `${queueGlobalExecutionStateLabel(
        "started",
      )}: ${queueGlobalExecutionStateDescription(
        "started",
      )} This does not start real workers or run tasks automatically.`,
    );
  }

  function stopWorkers() {
    setGlobalExecutionState("stopped");
    setGlobalMessage(
      `${queueGlobalExecutionStateLabel(
        "stopped",
      )}: ${queueGlobalExecutionStateDescription(
        "stopped",
      )} Running Executor work, if any, remains owned by Agent Executor.`,
    );
  }

  function stopAndKillRunning() {
    setGlobalExecutionState("stop_kill_requested");
    setGlobalMessage(
      `${queueGlobalExecutionStateLabel(
        "stop_kill_requested",
      )}: ${queueGlobalExecutionStateDescription(
        "stop_kill_requested",
      )} Queue does not kill processes in this block.`,
    );
  }

  function moveSelectedTask(position: QueueTaskReorderPosition) {
    if (!selectedTask) {
      setOrderingMessage(null);
      return;
    }

    if (hasOpenTaskEdit) {
      setValidationMessage("Save current task edits before reordering tasks.");
      return;
    }

    const result = reorderQueueTask({
      position,
      queueItemId: selectedTask.queueItemId,
      tasks: tasksRef.current,
    });

    if (!result.changed) {
      setOrderingMessage("Task is already at that position.");
      return;
    }

    const queueTag = normalizeQueueTag(selectedTask);
    setLocalTaskFields((current) => {
      const next = new Map(current);
      for (const task of result.updatedTasks) {
        if (normalizeQueueTag(task).queueTagId !== queueTag.queueTagId) {
          continue;
        }
        next.set(task.queueItemId, {
          ...(next.get(task.queueItemId) ?? {}),
          orderIndex: task.orderIndex,
        });
      }
      return next;
    });
    setQueueTagPauseStates((current) =>
      new Map(current).set(queueTag.queueTagId, {
        paused: true,
        reason: "edit_review",
      }),
    );
    setTasks(result.updatedTasks);
    tasksRef.current = result.updatedTasks;
    setSelectedTask(
      result.updatedTasks.find(
        (task) => task.queueItemId === selectedTask.queueItemId,
      ) ?? selectedTask,
    );
    setOrderingMessage("Task order updated. No Queue work was started.");
    setGlobalMessage(
      "Queue order changed. The affected queue tag is paused for coordinator review.",
    );
  }

  function createQueueTag(queueTagName: string) {
    const existingTags = queueTags.map(queueTagSummaryToRecord);
    const validationError = validateQueueTagName(queueTagName, existingTags);

    setTagManagementError(null);
    setTagManagementMessage(null);

    if (validationError) {
      setTagManagementError(validationError);
      return false;
    }

    const normalizedName = normalizeQueueTagName(queueTagName);
    const queueTagId = queueTagNameToId(normalizedName);

    setManagedQueueTags((current) =>
      upsertQueueTagRecord(current, {
        queueTagId,
        queueTagName: normalizedName,
      }),
    );
    setTagManagementMessage(`Queue tag "${normalizedName}" created.`);
    setGlobalMessage(
      "Queue tag created. It has no items and does not start workers.",
    );
    return true;
  }

  async function renameQueueTag(queueTagId: string, queueTagName: string) {
    const existingTags = queueTags.map(queueTagSummaryToRecord);
    const tag = existingTags.find((candidate) => candidate.queueTagId === queueTagId);
    const validationError = tag
      ? validateQueueTagName(queueTagName, existingTags, {
          allowQueueTagId: queueTagId,
        })
      : "Queue tag could not be found.";

    setTagManagementError(null);
    setTagManagementMessage(null);

    if (validationError) {
      setTagManagementError(validationError);
      return false;
    }

    if (!tag) {
      setTagManagementError("Queue tag could not be found.");
      return false;
    }

    const normalizedName = normalizeQueueTagName(queueTagName);
    const affectedTasks = tasksRef.current.filter(
      (task) => normalizeQueueTag(task).queueTagId === queueTagId,
    );

    try {
      for (const task of affectedTasks) {
        if (!onUpdateAgentQueueTask) {
          throw new Error("Queue task update is not available in this runtime.");
        }

        const updatedTask = await onUpdateAgentQueueTask({
          queueItemId: task.queueItemId,
          title: task.title,
          description: task.description,
          prompt: task.prompt,
          status: task.status,
          priority: task.priority,
          executionPolicy: normalizeTaskExecutionPolicy(task.executionPolicy),
          itemType: normalizeItemType(task.itemType),
          queueTagId,
          queueTagName: normalizedName,
          validationStatus: normalizeValidationStatus(task.validationStatus),
        });

        if (!updatedTask) {
          throw new Error("A queue task using this tag could not be found.");
        }
      }
    } catch (error) {
      setTagManagementError(errorToMessage(error, "Unable to rename queue tag."));
      return false;
    }

    setManagedQueueTags((current) =>
      upsertQueueTagRecord(current, {
        queueTagId,
        queueTagName: normalizedName,
      }),
    );
    setLocalTaskFields((current) => {
      const next = new Map(current);
      for (const task of affectedTasks) {
        next.set(task.queueItemId, {
          ...(next.get(task.queueItemId) ?? {}),
          queueTagId,
          queueTagName: normalizedName,
        });
      }
      return next;
    });
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) =>
        normalizeQueueTag(task).queueTagId === queueTagId
          ? { ...task, queueTagId, queueTagName: normalizedName }
          : task,
      );
      tasksRef.current = nextTasks;
      return nextTasks;
    });
    setSelectedTask((currentTask) =>
      currentTask && normalizeQueueTag(currentTask).queueTagId === queueTagId
        ? { ...currentTask, queueTagId, queueTagName: normalizedName }
        : currentTask,
    );
    setDraft((currentDraft) =>
      selectedTask && normalizeQueueTag(selectedTask).queueTagId === queueTagId
        ? { ...currentDraft, queueTagName: normalizedName }
        : currentDraft,
    );
    setWorkerScopes((current) => {
      const next = new Map(current);
      for (const [workerId, scope] of next.entries()) {
        if (scope.kind === "queue_tag" && scope.queueTagId === queueTagId) {
          next.set(workerId, {
            kind: "queue_tag",
            queueTagId,
            queueTagName: normalizedName,
          });
        }
      }
      return next;
    });
    void persistWorkerScopeUpdates((worker) =>
      worker.scopeKind === "queue_tag" && worker.queueTagId === queueTagId
        ? {
            ...worker,
            queueTagName: normalizedName,
          }
        : worker,
    );
    setTagManagementMessage(`Queue tag renamed to "${normalizedName}".`);
    setGlobalMessage(
      "Queue tag renamed. Existing items and scoped workers were updated without running work.",
    );
    return true;
  }

  function deleteQueueTag(queueTagId: string) {
    const tag = queueTags.find((candidate) => candidate.queueTagId === queueTagId);

    setTagManagementError(null);
    setTagManagementMessage(null);

    if (!tag) {
      setTagManagementError("Queue tag could not be found.");
      return false;
    }

    if (tag.runningCount > 0) {
      setTagManagementError(
        "Queue tags with running items cannot be deleted. Stop or finish the Agent Executor work first.",
      );
      return false;
    }

    if (tag.taskCount > 0) {
      setTagManagementError("Reassign items before deleting this queue tag.");
      return false;
    }

    if (queueTagId === DEFAULT_QUEUE_TAG_ID) {
      setTagManagementError(
        "Default queue tag is kept for legacy and basic queue items.",
      );
      return false;
    }

    setManagedQueueTags((current) =>
      current.filter((managedTag) => managedTag.queueTagId !== queueTagId),
    );
    setQueueTagPauseStates((current) => {
      const next = new Map(current);
      next.delete(queueTagId);
      return next;
    });
    setWorkerScopes((current) => {
      const next = new Map(current);
      for (const [workerId, scope] of next.entries()) {
        if (scope.kind === "queue_tag" && scope.queueTagId === queueTagId) {
          next.set(workerId, { kind: "all" });
        }
      }
      return next;
    });
    void persistWorkerScopeUpdates((worker) =>
      worker.scopeKind === "queue_tag" && worker.queueTagId === queueTagId
        ? {
            ...worker,
            queueTagId: null,
            queueTagName: null,
            scopeKind: "all",
          }
        : worker,
    );
    setTagManagementMessage(`Queue tag "${tag.queueTagName}" deleted.`);
    setGlobalMessage(
      "Empty queue tag deleted. Scoped workers were moved back to All queues.",
    );
    return true;
  }

  function pauseQueueTag(queueTagId: string) {
    setQueueTagPauseStates((current) =>
      new Map(current).set(queueTagId, { paused: true, reason: "manual" }),
    );
    setTagManagementError(null);
    setTagManagementMessage("Queue tag paused.");
    setGlobalMessage(
      "Queue tag paused. Workers must not take new items from that tag until coordinator resume.",
    );
  }

  function resumeQueueTag(queueTagId: string) {
    setQueueTagPauseStates((current) => {
      const next = new Map(current);
      next.delete(queueTagId);
      return next;
    });
    setLocalTaskFields((current) => {
      const next = new Map(current);
      for (const task of tasksRef.current) {
        if (normalizeQueueTag(task).queueTagId === queueTagId) {
          next.set(task.queueItemId, {
            ...(next.get(task.queueItemId) ?? {}),
            coordinatorStatus: "not_reported",
          });
        }
      }
      return next;
    });
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) =>
        normalizeQueueTag(task).queueTagId === queueTagId
          ? { ...task, coordinatorStatus: "not_reported" as const }
          : task,
      );
      tasksRef.current = nextTasks;
      return nextTasks;
    });
    setSelectedTask((currentTask) =>
      currentTask && normalizeQueueTag(currentTask).queueTagId === queueTagId
        ? { ...currentTask, coordinatorStatus: "not_reported" }
        : currentTask,
    );
    setTagManagementError(null);
    setTagManagementMessage("Queue tag resumed.");
    setGlobalMessage("Queue tag resumed by coordinator review.");
  }

  function changeWorkerScope(workerId: string, scope: WorkerScope) {
    setWorkerScopes((current) => new Map(current).set(workerId, scope));
    updateWorkerConfig(workerId, {
      queueTagId: scope.kind === "queue_tag" ? scope.queueTagId : null,
      queueTagName: scope.kind === "queue_tag" ? scope.queueTagName : null,
      scopeKind: scope.kind,
    });
    setGlobalMessage("Worker scope updated. No Queue work was started.");
  }

  function createWorker() {
    const displayOrder = nextWorkerDisplayOrder(workerConfigsRef.current);
    const workerConfig = localWorkerConfig({
      displayOrder,
      name: `Agent Worker ${(displayOrder + 1).toString()}`,
    });

    workerConfigsRef.current = [...workerConfigsRef.current, workerConfig];
    setWorkerConfigs((current) => [...current, workerConfig]);
    setWorkerScopes((current) => new Map(current).set(workerConfig.workerId, { kind: "all" }));
    setGlobalMessage("Agent Worker added. No runtime was started.");

    if (onCreateAgentQueueWorker) {
      void onCreateAgentQueueWorker({
        displayOrder: workerConfig.displayOrder,
        enabled: workerConfig.enabled,
        name: workerConfig.name,
        queueTagId: null,
        queueTagName: null,
        scopeKind: "all",
        workerId: workerConfig.workerId,
      })
        .then((createdWorker) => {
          workerConfigsRef.current = workerConfigsRef.current.map((worker) =>
            worker.workerId === workerConfig.workerId ? createdWorker : worker,
          );
          setWorkerConfigs((current) =>
            current.map((worker) =>
              worker.workerId === workerConfig.workerId ? createdWorker : worker,
            ),
          );
        })
        .catch((error) => {
          setTagManagementError(
            errorToMessage(error, "Unable to persist Agent Worker."),
          );
        });
    }
  }

  function renameWorker(workerId: string, name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setTagManagementError("Worker name is required.");
      return;
    }

    updateWorkerConfig(workerId, { name: trimmedName });
    setGlobalMessage("Agent Worker renamed. No runtime was started.");
  }

  function setWorkerEnabled(workerId: string, enabled: boolean) {
    updateWorkerConfig(workerId, { enabled });
    setGlobalMessage(
      enabled
        ? "Agent Worker enabled. No Queue work was started."
        : "Agent Worker disabled. Existing Executor work is unchanged.",
    );
  }

  function deleteWorker(workerId: string) {
    const assignedTask = tasksRef.current.find(
      (task) =>
        task.assignedWorkerId === workerId ||
        task.assignedExecutorWidgetId === workerId,
    );

    if (assignedTask) {
      setTagManagementError(
        "Clear this worker's task assignment before removing it.",
      );
      return;
    }

    workerConfigsRef.current = workerConfigsRef.current.filter(
      (worker) => worker.workerId !== workerId,
    );
    setWorkerConfigs((current) =>
      current.filter((worker) => worker.workerId !== workerId),
    );
    setWorkerScopes((current) => {
      const next = new Map(current);
      next.delete(workerId);
      return next;
    });
    setGlobalMessage("Agent Worker removed. No runtime was stopped or started.");

    if (onDeleteAgentQueueWorker) {
      void onDeleteAgentQueueWorker({ workerId }).catch((error) => {
        setTagManagementError(
          errorToMessage(error, "Unable to delete Agent Worker."),
        );
      });
    }
  }

  function updateWorkerConfig(
    workerId: string,
    patch: Partial<
      Pick<
        AgentQueueWorkerConfig,
        "enabled" | "name" | "queueTagId" | "queueTagName" | "scopeKind"
      >
    >,
  ) {
    const existingWorker = workerConfigsRef.current.find(
      (worker) => worker.workerId === workerId,
    );

    if (!existingWorker) {
      return;
    }

    const updatedWorker: AgentQueueWorkerConfig = {
      ...existingWorker,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    workerConfigsRef.current = workerConfigsRef.current.map((worker) =>
      worker.workerId === workerId ? updatedWorker : worker,
    );

    setWorkerConfigs((current) =>
      current.map((worker) =>
        worker.workerId === workerId ? updatedWorker : worker,
      ),
    );
    setTagManagementError(null);

    if (onUpdateAgentQueueWorker) {
      void onUpdateAgentQueueWorker({
        displayOrder: updatedWorker.displayOrder,
        enabled: updatedWorker.enabled,
        name: updatedWorker.name,
        queueTagId: updatedWorker.queueTagId,
        queueTagName: updatedWorker.queueTagName,
        scopeKind: updatedWorker.scopeKind,
        workerId: updatedWorker.workerId,
      }).catch((error) => {
        setTagManagementError(
          errorToMessage(error, "Unable to persist Agent Worker."),
        );
      });
    }
  }

  async function persistWorkerScopeUpdates(
    update: (worker: AgentQueueWorkerConfig) => AgentQueueWorkerConfig,
  ) {
    const updatedWorkers = workerConfigsRef.current.map(update);
    workerConfigsRef.current = updatedWorkers;
    setWorkerConfigs(updatedWorkers);
    setWorkerScopes(workerScopesFromConfigs(updatedWorkers));

    if (!onUpdateAgentQueueWorker) {
      return;
    }

    for (const worker of updatedWorkers) {
      const previousWorker = workerConfigsRef.current.find(
        (candidate) => candidate.workerId === worker.workerId,
      );
      if (
        previousWorker?.scopeKind === worker.scopeKind &&
        previousWorker?.queueTagId === worker.queueTagId &&
        previousWorker?.queueTagName === worker.queueTagName
      ) {
        continue;
      }

      await onUpdateAgentQueueWorker({
        displayOrder: worker.displayOrder,
        enabled: worker.enabled,
        name: worker.name,
        queueTagId: worker.queueTagId,
        queueTagName: worker.queueTagName,
        scopeKind: worker.scopeKind,
        workerId: worker.workerId,
      });
    }
  }

  async function assignSelectedTask() {
    if (
      !selectedTask ||
      !onAssignAgentQueueTaskToExecutor ||
      !selectedExecutorWidgetId ||
      isAssigning ||
      hasOpenTaskEdit
    ) {
      return;
    }

    const selectedWorkerScope = workerScopes.get(selectedExecutorWidgetId);
    const selectedWorkerConfig = workerConfigsRef.current.find(
      (worker) => worker.workerId === selectedExecutorWidgetId,
    );
    const selectedTaskQueueTag = normalizeQueueTag(selectedTask);

    if (selectedWorkerConfig && !selectedWorkerConfig.enabled) {
      setAssignmentError(
        "Selected worker is disabled. Enable it before assigning new work.",
      );
      setAssignmentMessage(null);
      return;
    }

    if (
      selectedWorkerScope?.kind === "queue_tag" &&
      selectedWorkerScope.queueTagId !== selectedTaskQueueTag.queueTagId
    ) {
      setAssignmentError(
        "Selected worker is scoped to another queue tag. Choose a matching worker or change the worker scope.",
      );
      setAssignmentMessage(null);
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const updatedTask = await onAssignAgentQueueTaskToExecutor({
        executorWidgetInstanceId: selectedExecutorWidgetId,
        queueItemId: selectedTask.queueItemId,
      });
      setLocalTaskFields((current) =>
        new Map(current).set(updatedTask.queueItemId, {
          ...(current.get(updatedTask.queueItemId) ?? {}),
          assignedWorkerId: selectedExecutorWidgetId,
        }),
      );
      applyUpdatedTask(
        { ...updatedTask, assignedWorkerId: selectedExecutorWidgetId },
        { select: true },
      );
      setAssignmentMessage("Assignment saved.");
    } catch (error) {
      setAssignmentError(errorToMessage(error, "Unable to assign queue task."));
    } finally {
      setIsAssigning(false);
    }
  }

  async function clearSelectedTaskAssignment() {
    if (
      !selectedTask ||
      !onClearAgentQueueTaskAssignment ||
      isAssigning ||
      hasOpenTaskEdit
    ) {
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const updatedTask = await onClearAgentQueueTaskAssignment({
        queueItemId: selectedTask.queueItemId,
      });
      setLocalTaskFields((current) =>
        new Map(current).set(updatedTask.queueItemId, {
          ...(current.get(updatedTask.queueItemId) ?? {}),
          assignedWorkerId: null,
        }),
      );
      applyUpdatedTask({ ...updatedTask, assignedWorkerId: null }, { select: true });
      setAssignmentMessage("Assignment cleared.");
    } catch (error) {
      setAssignmentError(
        errorToMessage(error, "Unable to clear queue task assignment."),
      );
    } finally {
      setIsAssigning(false);
    }
  }

  async function startAssignedTask() {
    if (
      !selectedTask ||
      !canStart ||
      !onStartAssignedAgentQueueTask ||
      startInFlightRef.current
    ) {
      return;
    }

    startInFlightRef.current = true;
    setIsStarting(true);
    setStartMessage(null);
    setStartedRunId(null);
    setStartError(null);

    const request: AgentQueueTaskStartRequest = {
      approvalPolicy,
      codexExecutable,
      queueItemId: selectedTask.queueItemId,
      repoRoot,
      sandbox,
    };

    try {
      const response = await onStartAssignedAgentQueueTask(request);
      onDirectWorkRunHandoffStarted?.({
        executorWidgetInstanceId: response.executorWidgetInstanceId,
        queueItemId: response.queueItemId,
        repoRoot: request.repoRoot,
        runId: response.runId,
        startedAt: new Date().toISOString(),
        taskTitle: selectedTask.title,
        workbenchId: response.workbenchId,
        workspaceId: response.workspaceId,
      });
      await loadTasks(response.queueItemId);
      await refreshLatestRunLink(response.queueItemId, { silent: true });
      setStartMessage(
        `Task started in Agent Executor ${shortWidgetInstanceId(
          response.executorWidgetInstanceId,
        )}.`,
      );
      setStartedRunId(response.runId);
    } catch (error) {
      setStartError(queueRunStartErrorMessage(error));
    } finally {
      startInFlightRef.current = false;
      setIsStarting(false);
    }
  }

  async function refreshAutorunSnapshot(options?: { silent?: boolean }) {
    if (!onGetAgentQueueRunnerSnapshot) {
      setAutorunSnapshot(null);
      setAutorunError(
        "Queue Autorun is only available in the Tauri desktop shell.",
      );
      return;
    }

    if (!options?.silent) {
      setIsAutorunLoading(true);
      setAutorunError(null);
    }

    try {
      const snapshot = await onGetAgentQueueRunnerSnapshot();
      setAutorunSnapshot(snapshot);
      await refreshLatestRunLink(
        snapshot.activeQueueItemId ?? selectedTask?.queueItemId ?? null,
        { silent: true },
      );
      if (!options?.silent) {
        setAutorunMessage("Queue Autorun status refreshed.");
      }
    } catch (error) {
      setAutorunError(
        errorToMessage(error, "Unable to refresh Queue Autorun status."),
      );
    } finally {
      if (!options?.silent) {
        setIsAutorunLoading(false);
      }
    }
  }

  async function armAutorunSession() {
    if (
      !onStartAgentQueueRunnerSession ||
      !selectedExecutorWidgetId ||
      !canArmAutorun ||
      isAutorunStarting
    ) {
      return;
    }

    setIsAutorunStarting(true);
    setAutorunError(null);
    setAutorunMessage(null);

    try {
      const snapshot = await onStartAgentQueueRunnerSession({
        approvalPolicy,
        codexExecutable,
        executorWidgetInstanceId: selectedExecutorWidgetId,
        policy: {
          stopOnCancel: true,
          stopOnFailure: true,
          stopOnReviewNeeded: true,
        },
        repoRoot,
        sandbox,
      });
      setAutorunSnapshot(snapshot);
      if (snapshot.activeQueueItemId && snapshot.waitingRunId) {
        await loadTasks(snapshot.activeQueueItemId, {
          preserveCurrentOnError: true,
        });
        await refreshLatestRunLink(snapshot.activeQueueItemId, {
          silent: true,
        });
      }
      setAutorunMessage(
        snapshot.activeQueueItemId
          ? "Queue Autorun started. It will continue automatically while Hobit is open."
          : "Queue Autorun found no eligible task to start.",
      );
    } catch (error) {
      setAutorunError(errorToMessage(error, "Unable to arm Queue Autorun."));
    } finally {
      setIsAutorunStarting(false);
    }
  }

  async function stopAutorunSession() {
    if (!onStopAgentQueueRunnerSession || isAutorunStopping) {
      return;
    }

    setIsAutorunStopping(true);
    setAutorunError(null);
    setAutorunMessage(null);

    try {
      const snapshot = await onStopAgentQueueRunnerSession();
      setAutorunSnapshot(snapshot);
      setAutorunMessage("Queue Autorun session stopped.");
    } catch (error) {
      setAutorunError(errorToMessage(error, "Unable to stop Queue Autorun."));
    } finally {
      setIsAutorunStopping(false);
    }
  }

  function selectExecutorWidget(executorWidgetInstanceId: string) {
    setSelectedExecutorWidgetId(executorWidgetInstanceId);
    setAssignmentError(null);
    setAssignmentMessage(null);
    queueRunner.clearError();
  }

  function updateRepoRootDraft(repoRootValue: string) {
    setRepoRootDraft(repoRootValue);
    setStartError(null);
    setDeleteError(null);
    setDeleteMessage(null);
  }

  function updateCodexExecutableDraft(codexExecutableValue: string) {
    setCodexExecutableDraft(codexExecutableValue);
    setStartError(null);
  }

  function setSelectedDraft(task: AgentQueueTask) {
    const mergedTask = mergeTaskFoundation(task);
    const queueTag = normalizeQueueTag(mergedTask);
    setSelectedTask(mergedTask);
    setDraft({
      dependsOn: normalizeTaskDependencies(mergedTask.dependsOn),
      description: mergedTask.description,
      executionPolicy: normalizeTaskExecutionPolicy(mergedTask.executionPolicy),
      itemType: normalizeItemType(mergedTask.itemType),
      priority: mergedTask.priority,
      prompt: mergedTask.prompt,
      queueTagName: queueTag.queueTagName,
      status: normalizeTaskStatus(mergedTask.status),
      title: mergedTask.title,
      validationStatus: normalizeValidationStatus(mergedTask.validationStatus),
    });
  }

  function applyUpdatedTask(
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) {
    const existingTask = tasksRef.current.find(
      (candidate) => candidate.queueItemId === task.queueItemId,
    );
    const mergedTask = mergeTaskFoundation({
      ...task,
      orderIndex: task.orderIndex ?? existingTask?.orderIndex,
    });
    const nextTasks = reconcileQueueTask(tasksRef.current, mergedTask);
    tasksRef.current = nextTasks;
    setTasks(nextTasks);

    if (options?.select || selectedTask?.queueItemId === mergedTask.queueItemId) {
      setSelectedDraft(mergedTask);
    }
  }

  function clearSelectedTask() {
    setSelectedTask(null);
    setDraft(emptyDraft());
    setSaveStateText("Saved");
    setIsEditing(false);
  }

  function startEditingSelectedTask() {
    if (!selectedTask || isSaving) {
      return;
    }

    setIsEditing(true);
    setValidationMessage(null);
    setDeleteMessage(null);
    setDeleteError(null);
  }

  function cancelSelectedTaskEdits() {
    if (!selectedTask || isSaving) {
      return;
    }

    setSelectedDraft(selectedTask);
    setIsEditing(false);
    setSaveStateText("Saved");
    setValidationMessage(null);
    setEditorError(null);
  }

  function mergeTaskFoundation(task: AgentQueueTask): AgentQueueTask {
    const localFields = localTaskFieldsRef.current.get(task.queueItemId);
    const queueTag = normalizeQueueTag({
      queueTagId: localFields?.queueTagId ?? task.queueTagId,
      queueTagName: localFields?.queueTagName ?? task.queueTagName,
    });

    return {
      ...task,
      assignedWorkerId:
        localFields?.assignedWorkerId ??
        task.assignedWorkerId ??
        task.assignedExecutorWidgetId,
      coordinatorStatus:
        localFields?.coordinatorStatus ??
        task.coordinatorStatus ??
        "not_reported",
      dependsOn: normalizeTaskDependencies(
        localFields?.dependsOn ?? task.dependsOn,
      ),
      itemType: localFields?.itemType ?? normalizeItemType(task.itemType),
      orderIndex: localFields?.orderIndex ?? task.orderIndex,
      priority: normalizeTaskPriority(task.priority),
      queueTagId: queueTag.queueTagId,
      queueTagName: queueTag.queueTagName,
      validationStatus:
        localFields?.validationStatus ??
        normalizeValidationStatus(task.validationStatus),
    };
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
    run: {
      approvalPolicy,
      canStart,
      codexExecutableDraft,
      isStarting,
      onApprovalPolicyChange: setApprovalPolicy,
      onCodexExecutableDraftChange: updateCodexExecutableDraft,
      onRepoRootDraftChange: updateRepoRootDraft,
      onSandboxChange: setSandbox,
      onStartAssignedTask: () => void startAssignedTask(),
      preconditionMessages,
      readinessMessage,
      repoRootDraft,
      sandbox,
      startError,
      startedRunId,
      startMessage,
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
    foundation: {
      globalExecutionState,
      globalMessage,
      globalStatus: globalExecutionState,
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

type QueueTaskReorderPosition = "up" | "down" | "top" | "bottom";

function queueTaskOrderingControls({
  selectedTask,
  tasks,
}: {
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
}) {
  if (!selectedTask) {
    return {
      canMoveDown: false,
      canMoveToBottom: false,
      canMoveToTop: false,
      canMoveUp: false,
      orderLabel: null,
    };
  }

  const orderedPeers = orderedManualReorderPeers(tasks, selectedTask);
  const selectedIndex = orderedPeers.findIndex(
    (task) => task.queueItemId === selectedTask.queueItemId,
  );
  const position = selectedIndex >= 0 ? selectedIndex + 1 : null;
  const total = orderedPeers.length;

  return {
    canMoveDown: selectedIndex >= 0 && selectedIndex < total - 1,
    canMoveToBottom: selectedIndex >= 0 && selectedIndex < total - 1,
    canMoveToTop: selectedIndex > 0,
    canMoveUp: selectedIndex > 0,
    orderLabel: position ? `${position.toString()} of ${total.toString()}` : null,
  };
}

function reorderQueueTask({
  position,
  queueItemId,
  tasks,
}: {
  position: QueueTaskReorderPosition;
  queueItemId: string;
  tasks: AgentQueueTask[];
}) {
  const selectedTask = tasks.find((task) => task.queueItemId === queueItemId);

  if (!selectedTask) {
    return { changed: false, updatedTasks: tasks };
  }

  const peers = orderedManualReorderPeers(tasks, selectedTask);
  const currentIndex = peers.findIndex((task) => task.queueItemId === queueItemId);

  if (currentIndex < 0) {
    return { changed: false, updatedTasks: tasks };
  }

  const nextIndex =
    position === "top"
      ? 0
      : position === "bottom"
        ? peers.length - 1
        : position === "up"
          ? currentIndex - 1
          : currentIndex + 1;

  if (nextIndex < 0 || nextIndex >= peers.length || nextIndex === currentIndex) {
    return { changed: false, updatedTasks: tasks };
  }

  const reorderedPeers = [...peers];
  const [movedTask] = reorderedPeers.splice(currentIndex, 1);
  reorderedPeers.splice(nextIndex, 0, movedTask);
  const orderById = new Map(
    reorderedPeers.map((task, index) => [task.queueItemId, index]),
  );
  const updatedTasks = sortQueueTasksForDisplay(
    tasks.map((task) =>
      orderById.has(task.queueItemId)
        ? { ...task, orderIndex: orderById.get(task.queueItemId) }
        : task,
    ),
  );

  return { changed: true, updatedTasks };
}

function orderedManualReorderPeers(
  tasks: AgentQueueTask[],
  selectedTask: AgentQueueTask,
) {
  const selectedQueueTag = normalizeQueueTag(selectedTask);
  const selectedPriority = normalizeTaskPriority(selectedTask.priority);

  return sortQueueTasksForDisplay(
    tasks.filter((task) => {
      const queueTag = normalizeQueueTag(task);
      return (
        queueTag.queueTagId === selectedQueueTag.queueTagId &&
        normalizeTaskPriority(task.priority) === selectedPriority
      );
    }),
  );
}

function nextOrderIndexForQueueTag({
  insertPosition,
  queueTagId,
  tasks,
}: {
  insertPosition: QueueTaskInsertPosition;
  queueTagId: string;
  tasks: AgentQueueTask[];
}) {
  const orderIndexes = tasks
    .filter((task) => normalizeQueueTag(task).queueTagId === queueTagId)
    .map((task) => task.orderIndex)
    .filter((orderIndex): orderIndex is number =>
      typeof orderIndex === "number" && Number.isFinite(orderIndex),
    );

  if (orderIndexes.length === 0) {
    return 0;
  }

  return insertPosition === "top"
    ? Math.min(...orderIndexes) - 1
    : Math.max(...orderIndexes) + 1;
}

function withQueueOrderIndexes(tasks: AgentQueueTask[]) {
  const sortedTasks = sortQueueTasksForDisplay(tasks);
  const nextOrderByGroup = new Map<string, number>();

  return sortQueueTasksForDisplay(
    sortedTasks.map((task) => {
      if (typeof task.orderIndex === "number" && Number.isFinite(task.orderIndex)) {
        return task;
      }

      const groupKey = manualOrderGroupKey(task);
      const nextOrderIndex = nextOrderByGroup.get(groupKey) ?? 0;
      nextOrderByGroup.set(groupKey, nextOrderIndex + 1);
      return { ...task, orderIndex: nextOrderIndex };
    }),
  );
}

function manualOrderGroupKey(task: AgentQueueTask) {
  const queueTag = normalizeQueueTag(task);
  return `${queueTag.queueTagId}:${normalizeTaskPriority(task.priority).toString()}`;
}

function queueTagSummaryToRecord(tag: QueueTagSummary): QueueTagRecord {
  return {
    queueTagId: tag.queueTagId,
    queueTagName: tag.queueTagName,
  };
}

function upsertQueueTagRecord(
  queueTags: QueueTagRecord[],
  queueTag: QueueTagRecord,
) {
  const found = queueTags.some(
    (candidate) => candidate.queueTagId === queueTag.queueTagId,
  );

  if (found) {
    return queueTags.map((candidate) =>
      candidate.queueTagId === queueTag.queueTagId ? queueTag : candidate,
    );
  }

  return [...queueTags, queueTag];
}

function defaultWorkerConfigsFromExecutorSlots(
  agentExecutorSlots: Array<{ label: string; widgetInstanceId: string }>,
): AgentQueueWorkerConfig[] {
  const now = new Date().toISOString();

  if (agentExecutorSlots.length === 0) {
    return [
      {
        createdAt: now,
        displayOrder: 0,
        enabled: true,
        name: "Agent Worker 1",
        queueTagId: null,
        queueTagName: null,
        scopeKind: "all",
        updatedAt: now,
        workerId: `agent-worker-${Date.now().toString(36)}`,
        workspaceId: "",
      },
    ];
  }

  return agentExecutorSlots.map((slot, index) => ({
    createdAt: now,
    displayOrder: index,
    enabled: true,
    name: slot.label,
    queueTagId: null,
    queueTagName: null,
    scopeKind: "all",
    updatedAt: now,
    workerId: slot.widgetInstanceId,
    workspaceId: "",
  }));
}

function workerScopesFromConfigs(workerConfigs: AgentQueueWorkerConfig[]) {
  return new Map(
    workerConfigs.map((worker): [string, WorkerScope] => [
      worker.workerId,
      worker.scopeKind === "queue_tag" && worker.queueTagId && worker.queueTagName
        ? {
            kind: "queue_tag",
            queueTagId: worker.queueTagId,
            queueTagName: worker.queueTagName,
          }
        : { kind: "all" },
    ]),
  );
}

function nextWorkerDisplayOrder(workerConfigs: AgentQueueWorkerConfig[]) {
  if (workerConfigs.length === 0) {
    return 0;
  }

  return (
    Math.max(
      ...workerConfigs.map((worker) =>
        Number.isFinite(worker.displayOrder) ? worker.displayOrder : 0,
      ),
    ) + 1
  );
}

function localWorkerConfig({
  displayOrder,
  name,
}: {
  displayOrder: number;
  name: string;
}): AgentQueueWorkerConfig {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    displayOrder,
    enabled: true,
    name,
    queueTagId: null,
    queueTagName: null,
    scopeKind: "all",
    updatedAt: now,
    workerId: `agent-worker-${Date.now().toString(36)}-${displayOrder.toString()}`,
    workspaceId: "",
  };
}

function areStringArraysEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
}
