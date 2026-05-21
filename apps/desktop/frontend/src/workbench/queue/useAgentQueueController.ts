import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import {
  clamp,
  DEFAULT_TASK_TITLE,
  emptyDraft,
  errorToMessage,
  isFinalQueueTaskStatus,
  MAX_PRIORITY,
  MIN_PRIORITY,
  normalizeTaskExecutionPolicy,
  normalizeTaskStatus,
  shortWidgetInstanceId,
  statusLabel,
  type QueueFilter,
  type TaskDraft,
  validateDraft,
} from "../agentQueueTaskUiModel";
import type { AgentQueueTaskStartRequest } from "../agentQueueTaskWidgetActions";
import type { WidgetRenderProps } from "../types";
import { useQueueTaskAutoRefreshFromExecutor } from "../useQueueTaskAutoRefreshFromExecutor";
import {
  getNextQueueRunnerTaskDecision,
  queueRunnerFinalStatus,
  type QueueRunnerFinalStatus,
} from "./queueRunner";

const DEFAULT_CODEX_EXECUTABLE = "codex";
const WINDOWS_CODEX_EXECUTABLE = "codex.cmd";

type UseAgentQueueControllerOptions = Pick<
  WidgetRenderProps,
  | "agentExecutorSlots"
  | "onAssignAgentQueueTaskToExecutor"
  | "onClearAgentQueueTaskAssignment"
  | "onCreateAgentQueueTask"
  | "onDirectWorkRunHandoffStarted"
  | "onGetAgentQueueTask"
  | "onGetAgentQueueRunnerSnapshot"
  | "onListAgentQueueTasks"
  | "onStartAssignedAgentQueueTask"
  | "onStartAgentQueueRunnerSession"
  | "onStopAgentQueueRunnerSession"
  | "onUpdateAgentQueueTask"
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

export type AgentQueueRunnerStatus =
  | "idle"
  | "running"
  | "assigning"
  | "starting"
  | "waiting_for_executor"
  | "stopped"
  | "completed"
  | "error";

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

export function useAgentQueueController({
  agentExecutorSlots = [],
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onDirectWorkRunHandoffStarted,
  onGetAgentQueueTask,
  onGetAgentQueueRunnerSnapshot,
  onListAgentQueueTasks,
  onStartAssignedAgentQueueTask,
  onStartAgentQueueRunnerSession,
  onStopAgentQueueRunnerSession,
  onUpdateAgentQueueTask,
  queueTaskAutoRefreshRequest,
}: UseAgentQueueControllerOptions) {
  const apiAvailable = Boolean(
    onCreateAgentQueueTask &&
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
  const [isAssigning, setIsAssigning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
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
  const startInFlightRef = useRef(false);
  const [runnerStatus, setRunnerStatus] =
    useState<AgentQueueRunnerStatus>("idle");
  const [runnerMessage, setRunnerMessage] = useState<string | null>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const runnerStartedQueueItemIdsRef = useRef<Set<string>>(new Set());
  const runnerActiveQueueItemIdRef = useRef<string | null>(null);
  const runnerWaitingRunIdRef = useRef<string | null>(null);
  const runnerStopRequestedRef = useRef(false);
  const runnerInFlightRef = useRef(false);
  const tasksRef = useRef<AgentQueueTask[]>([]);
  const [autorunSnapshot, setAutorunSnapshot] =
    useState<AgentQueueRunnerSnapshot | null>(null);
  const [isAutorunLoading, setIsAutorunLoading] = useState(false);
  const [isAutorunStarting, setIsAutorunStarting] = useState(false);
  const [isAutorunStopping, setIsAutorunStopping] = useState(false);
  const [autorunMessage, setAutorunMessage] = useState<string | null>(null);
  const [autorunError, setAutorunError] = useState<string | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const isDirty = Boolean(
    selectedTask &&
      (draft.title !== selectedTask.title ||
        draft.description !== selectedTask.description ||
        draft.executionPolicy !==
          normalizeTaskExecutionPolicy(selectedTask.executionPolicy) ||
        draft.prompt !== selectedTask.prompt ||
        draft.status !== normalizeTaskStatus(selectedTask.status) ||
        draft.priority !== selectedTask.priority),
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") {
      return tasks;
    }

    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  const loadTasks = useCallback(
    async (
      preferredTaskId?: string | null,
      options?: { preserveCurrentOnError?: boolean },
    ) => {
      if (
        !onCreateAgentQueueTask ||
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
        const loadedTasks = await onListAgentQueueTasks();
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

        setSelectedDraft(detail);
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
      onGetAgentQueueTask,
      onListAgentQueueTasks,
      onUpdateAgentQueueTask,
    ],
  );

  useEffect(() => {
    void loadTasks(null);
  }, [loadTasks]);

  useEffect(() => {
    if (!onGetAgentQueueRunnerSnapshot) {
      setAutorunSnapshot(null);
      return;
    }

    void refreshAutorunSnapshot({ silent: true });
  }, [onGetAgentQueueRunnerSnapshot]);

  useQueueTaskAutoRefreshFromExecutor({
    autoRefreshRequest: queueTaskAutoRefreshRequest,
    isDirty,
    loadTasks,
    onRefreshComplete: handleQueueTaskAutoRefreshComplete,
    setValidationMessage,
  });

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

  const repoRoot = repoRootDraft.trim();
  const codexExecutable = codexExecutableDraft.trim();
  const startApiAvailable = Boolean(onStartAssignedAgentQueueTask);
  const readinessMessage = selectedTask
    ? queueRunReadinessMessage({
        isDirty,
        selectedTask,
        startApiAvailable,
      })
    : "Assign an Agent Executor when this task is ready to run. Assignment remains planning only and does not start execution.";
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
  const runnerPreconditionMessages = useMemo(
    () =>
      queueRunnerPreconditionMessages({
        assignmentApiAvailable,
        codexExecutable,
        hasExecutorSelection: Boolean(selectedExecutorWidgetId),
        isDirty,
        isStarting,
        repoRoot,
        runnerInFlight: runnerInFlightRef.current,
        runnerStatus,
        startApiAvailable,
        taskCount: tasks.length,
      }),
    [
      assignmentApiAvailable,
      codexExecutable,
      isDirty,
      isStarting,
      repoRoot,
      runnerStatus,
      selectedExecutorWidgetId,
      startApiAvailable,
      tasks.length,
    ],
  );
  const canStartRunner = runnerPreconditionMessages.length === 0;
  const autorunSelectedExecutor = agentExecutorSlots.find(
    (slot) => slot.widgetInstanceId === selectedExecutorWidgetId,
  );
  const autorunPreconditionMessages = queueAutorunPreconditionMessages({
    apiAvailable: autorunApiAvailable,
    codexExecutable,
    hasExecutorSelection: Boolean(selectedExecutorWidgetId),
    isStarting: isAutorunStarting,
    repoRoot,
  });
  const isAutorunActive = Boolean(autorunSnapshot?.isActive);
  const canArmAutorun =
    autorunPreconditionMessages.length === 0 &&
    !isAutorunActive &&
    !isAutorunLoading &&
    !isAutorunStopping;

  async function createTask() {
    if (!onCreateAgentQueueTask || isCreating || isLoading) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current task before creating another task.");
      return;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);

    try {
      const createdTask = await onCreateAgentQueueTask({
        title: DEFAULT_TASK_TITLE,
        description: "",
        prompt: "",
        status: "draft",
        priority: 0,
        executionPolicy: "manual",
      });
      await loadTasks(createdTask.queueItemId);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create queue task."));
    } finally {
      setIsCreating(false);
    }
  }

  async function refreshTasks() {
    if (isDirty) {
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

    if (isDirty) {
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

      setSelectedDraft(detail);
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.queueItemId === detail.queueItemId ? detail : task,
        ),
      );
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open queue task."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function saveTask() {
    if (!selectedTask || !onUpdateAgentQueueTask || !isDirty || isSaving) {
      return;
    }

    const validationError = validateDraft(draft);

    if (validationError) {
      setValidationMessage(validationError);
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
      });

      if (!updatedTask) {
        setEditorError("The selected queue task could not be found.");
        setSaveStateText("Unsaved changes");
        return;
      }

      await loadTasks(updatedTask.queueItemId);
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save queue task."));
      setSaveStateText("Unsaved changes");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraft(nextDraft: Partial<TaskDraft>) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setAssignmentMessage(null);
    setValidationMessage(null);
  }

  function updatePriority(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? clamp(parsedValue, MIN_PRIORITY, MAX_PRIORITY)
      : MIN_PRIORITY;

    updateDraft({ priority });
  }

  async function assignSelectedTask() {
    if (
      !selectedTask ||
      !onAssignAgentQueueTaskToExecutor ||
      !selectedExecutorWidgetId ||
      isAssigning ||
      isDirty
    ) {
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      const updatedTask = await onAssignAgentQueueTaskToExecutor({
        executorWidgetInstanceId: selectedExecutorWidgetId,
        queueItemId: selectedTask.queueItemId,
      });
      await loadTasks(updatedTask.queueItemId);
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
      isDirty
    ) {
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      const updatedTask = await onClearAgentQueueTaskAssignment({
        queueItemId: selectedTask.queueItemId,
      });
      await loadTasks(updatedTask.queueItemId);
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

  function startQueueRunner() {
    if (!canStartRunner || runnerInFlightRef.current) {
      return;
    }

    runnerStartedQueueItemIdsRef.current = new Set();
    runnerActiveQueueItemIdRef.current = null;
    runnerWaitingRunIdRef.current = null;
    runnerStopRequestedRef.current = false;
    setRunnerError(null);
    setRunnerMessage("Sequential Queue Runner started.");
    setRunnerStatus("running");
    void advanceQueueRunner(null);
  }

  function stopQueueRunner() {
    runnerStopRequestedRef.current = true;
    setRunnerError(null);
    setRunnerStatus("stopped");
    setRunnerMessage(
      "Sequential Queue Runner stopped. The active Agent Executor run was not stopped.",
    );
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
      }
      setAutorunMessage(
        snapshot.activeQueueItemId
          ? "Queue Autorun started one eligible task. Sequential continuation is not implemented yet."
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

  async function advanceQueueRunner(
    previousTaskStatus: QueueRunnerFinalStatus | null,
  ) {
    if (runnerStopRequestedRef.current) {
      setRunnerStatus("stopped");
      setRunnerMessage("Sequential Queue Runner stopped.");
      return;
    }

    if (runnerInFlightRef.current) {
      return;
    }

    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus,
      selectedExecutorWidgetId,
      startedQueueItemIds: runnerStartedQueueItemIdsRef.current,
      tasks: tasksRef.current,
    });

    if (decision.kind === "completed") {
      setRunnerStatus("completed");
      setRunnerMessage(
        decision.skippedTaskCount > 0
          ? `Sequential Queue Runner completed. Skipped ${decision.skippedTaskCount.toString()} non-runnable task(s).`
          : "Sequential Queue Runner completed.",
      );
      return;
    }

    if (decision.kind === "stop") {
      const stopMessage = queueRunnerStopMessage(decision);
      setRunnerStatus(
        decision.reason === "assigned_to_different_executor"
          ? "error"
          : "stopped",
      );
      setRunnerMessage(stopMessage);
      setRunnerError(
        decision.reason === "assigned_to_different_executor"
          ? stopMessage
          : null,
      );
      return;
    }

    await startQueueRunnerTask(
      decision.task,
      decision.requiresAssignment,
      decision.skippedTaskCount,
    );
  }

  async function startQueueRunnerTask(
    task: AgentQueueTask,
    requiresAssignment: boolean,
    skippedTaskCount: number,
  ) {
    if (!onStartAssignedAgentQueueTask || runnerInFlightRef.current) {
      return;
    }

    runnerInFlightRef.current = true;
    runnerActiveQueueItemIdRef.current = task.queueItemId;
    runnerWaitingRunIdRef.current = null;
    setRunnerError(null);

    try {
      if (requiresAssignment) {
        if (!onAssignAgentQueueTaskToExecutor) {
          throw new Error("Assignment persistence is not available in this runtime.");
        }

        setRunnerStatus("assigning");
        setRunnerMessage(
          `Assigning "${task.title}" to ${shortWidgetInstanceId(
            selectedExecutorWidgetId,
          )}.`,
        );
        const assignedTask = await onAssignAgentQueueTaskToExecutor({
          executorWidgetInstanceId: selectedExecutorWidgetId,
          queueItemId: task.queueItemId,
        });
        tasksRef.current = replaceQueueTask(tasksRef.current, assignedTask);
        setTasks(tasksRef.current);
      }

      if (runnerStopRequestedRef.current) {
        setRunnerStatus("stopped");
        setRunnerMessage("Sequential Queue Runner stopped before starting the next task.");
        return;
      }

      const request: AgentQueueTaskStartRequest = {
        approvalPolicy,
        codexExecutable,
        queueItemId: task.queueItemId,
        repoRoot,
        sandbox,
      };

      setRunnerStatus("starting");
      setRunnerMessage(
        skippedTaskCount > 0
          ? `Starting "${task.title}" after skipping ${skippedTaskCount.toString()} non-runnable task(s).`
          : `Starting "${task.title}".`,
      );

      const response = await onStartAssignedAgentQueueTask(request);
      runnerStartedQueueItemIdsRef.current.add(response.queueItemId);
      runnerWaitingRunIdRef.current = response.runId;
      onDirectWorkRunHandoffStarted?.({
        executorWidgetInstanceId: response.executorWidgetInstanceId,
        queueItemId: response.queueItemId,
        repoRoot: request.repoRoot,
        runId: response.runId,
        startedAt: new Date().toISOString(),
        taskTitle: task.title,
        workbenchId: response.workbenchId,
        workspaceId: response.workspaceId,
      });
      await loadTasks(response.queueItemId);

      if (runnerStopRequestedRef.current) {
        setRunnerStatus("stopped");
        setRunnerMessage(
          "Sequential Queue Runner stopped. The active Agent Executor run was not stopped.",
        );
        return;
      }

      setRunnerStatus("waiting_for_executor");
      setRunnerMessage(
        `Waiting for Agent Executor ${shortWidgetInstanceId(
          response.executorWidgetInstanceId,
        )} to finish "${task.title}".`,
      );
    } catch (error) {
      const message = queueRunStartErrorMessage(error);
      setRunnerStatus("error");
      setRunnerError(message);
      setRunnerMessage(message);
      runnerActiveQueueItemIdRef.current = null;
      runnerWaitingRunIdRef.current = null;
    } finally {
      runnerInFlightRef.current = false;
    }
  }

  function handleQueueTaskAutoRefreshComplete(
    request: NonNullable<typeof queueTaskAutoRefreshRequest>,
  ) {
    if (
      runnerStatus !== "waiting_for_executor" ||
      runnerActiveQueueItemIdRef.current !== request.queueItemId ||
      runnerWaitingRunIdRef.current !== request.runId
    ) {
      return;
    }

    const finalStatus = queueRunnerFinalStatus(request.finalStatus);
    runnerActiveQueueItemIdRef.current = null;
    runnerWaitingRunIdRef.current = null;

    if (runnerStopRequestedRef.current) {
      setRunnerStatus("stopped");
      setRunnerMessage(
        "Sequential Queue Runner stopped. The completed task state was refreshed.",
      );
      return;
    }

    setRunnerStatus("running");
    setRunnerMessage(
      finalStatus === "completed"
        ? "Task completed. Sequential Queue Runner is checking the next task."
        : `Task ended with ${finalStatus}. Sequential Queue Runner is checking the next task.`,
    );
    void advanceQueueRunner(finalStatus);
  }

  function selectExecutorWidget(executorWidgetInstanceId: string) {
    setSelectedExecutorWidgetId(executorWidgetInstanceId);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setRunnerError(null);
  }

  function updateRepoRootDraft(repoRootValue: string) {
    setRepoRootDraft(repoRootValue);
    setStartError(null);
  }

  function updateCodexExecutableDraft(codexExecutableValue: string) {
    setCodexExecutableDraft(codexExecutableValue);
    setStartError(null);
  }

  function setSelectedDraft(task: AgentQueueTask) {
    setSelectedTask(task);
    setDraft({
      description: task.description,
      executionPolicy: normalizeTaskExecutionPolicy(task.executionPolicy),
      priority: task.priority,
      prompt: task.prompt,
      status: normalizeTaskStatus(task.status),
      title: task.title,
    });
  }

  function clearSelectedTask() {
    setSelectedTask(null);
    setDraft(emptyDraft());
    setSaveStateText("Saved");
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
    isLoading,
    isSaving,
    isSelecting,
    loadError,
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
    runner: {
      canStart: canStartRunner,
      error: runnerError,
      message: runnerMessage,
      onStart: () => startQueueRunner(),
      onStop: () => stopQueueRunner(),
      preconditionMessages: runnerPreconditionMessages,
      status: runnerStatus,
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
    updateDraft,
    updatePriority,
    validationMessage,
    assignSelectedTask,
    clearSelectedTaskAssignment,
  };
}

function runPreconditionMessages({
  codexExecutable,
  isStarting,
  repoRoot,
}: {
  codexExecutable: string;
  isStarting: boolean;
  repoRoot: string;
}) {
  const messages: string[] = [];

  if (!repoRoot) {
    messages.push("Execution workspace is required for Codex Direct Work execution.");
  }

  if (!codexExecutable) {
    messages.push("Codex executable is required before running.");
  }

  if (isStarting) {
    messages.push("Run request is already in flight.");
  }

  return messages;
}

function queueRunnerPreconditionMessages({
  assignmentApiAvailable,
  codexExecutable,
  hasExecutorSelection,
  isDirty,
  isStarting,
  repoRoot,
  runnerInFlight,
  runnerStatus,
  startApiAvailable,
  taskCount,
}: {
  assignmentApiAvailable: boolean;
  codexExecutable: string;
  hasExecutorSelection: boolean;
  isDirty: boolean;
  isStarting: boolean;
  repoRoot: string;
  runnerInFlight: boolean;
  runnerStatus: AgentQueueRunnerStatus;
  startApiAvailable: boolean;
  taskCount: number;
}) {
  const messages = runPreconditionMessages({
    codexExecutable,
    isStarting: isStarting || runnerInFlight || isQueueRunnerActive(runnerStatus),
    repoRoot,
  });

  if (!startApiAvailable) {
    messages.unshift("Assigned-task execution is not available in this runtime.");
  }

  if (!assignmentApiAvailable) {
    messages.unshift("Assignment persistence is not available in this runtime.");
  }

  if (!hasExecutorSelection) {
    messages.unshift("Select one Agent Executor for the Sequential Queue Runner.");
  }

  if (taskCount === 0) {
    messages.unshift("Add queue tasks before starting the Sequential Queue Runner.");
  }

  if (isDirty) {
    messages.unshift("Save task edits before starting the Sequential Queue Runner.");
  }

  return messages;
}

function queueAutorunPreconditionMessages({
  apiAvailable,
  codexExecutable,
  hasExecutorSelection,
  isStarting,
  repoRoot,
}: {
  apiAvailable: boolean;
  codexExecutable: string;
  hasExecutorSelection: boolean;
  isStarting: boolean;
  repoRoot: string;
}) {
  const messages: string[] = [];

  if (!apiAvailable) {
    messages.push(
      "Queue Autorun session control is only available in the Tauri desktop shell.",
    );
  }

  if (!hasExecutorSelection) {
    messages.push("Select one Agent Executor before arming Queue Autorun.");
  }

  if (!repoRoot) {
    messages.push("Execution workspace is required before arming Queue Autorun.");
  }

  if (!codexExecutable) {
    messages.push("Codex executable is required before arming Queue Autorun.");
  }

  if (isStarting) {
    messages.push("Queue Autorun arm request is already in flight.");
  }

  return messages;
}

function isQueueRunnerActive(status: AgentQueueRunnerStatus) {
  return (
    status === "assigning" ||
    status === "running" ||
    status === "starting" ||
    status === "waiting_for_executor"
  );
}

type QueueRunnerStopDecision = Extract<
  ReturnType<typeof getNextQueueRunnerTaskDecision>,
  { kind: "stop" }
>;

function queueRunnerStopMessage(decision: QueueRunnerStopDecision) {
  switch (decision.reason) {
    case "assigned_to_different_executor":
      return `Sequential Queue Runner stopped because "${decision.task.title}" is assigned to another Agent Executor.`;
    case "manual":
      return `Sequential Queue Runner stopped at manual task "${decision.task.title}". Operator action is required.`;
    case "previous_success_required":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because it requires a previous task completed in this runner pass.`;
    case "previous_task_not_successful":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because the previous task did not complete successfully.`;
  }
}

function replaceQueueTask(tasks: AgentQueueTask[], updatedTask: AgentQueueTask) {
  return tasks.map((task) =>
    task.queueItemId === updatedTask.queueItemId ? updatedTask : task,
  );
}

function queueRunReadinessMessage({
  isDirty,
  selectedTask,
  startApiAvailable,
}: {
  isDirty: boolean;
  selectedTask: AgentQueueTask;
  startApiAvailable: boolean;
}) {
  if (!startApiAvailable) {
    return "Assigned-task execution is not available in this runtime.";
  }

  if (!selectedTask.assignedExecutorWidgetId) {
    return "Assign an Agent Executor when this task is ready to run. Assignment remains planning only and does not start execution.";
  }

  if (isDirty) {
    return "Save task edits before configuring execution.";
  }

  if (!selectedTask.prompt.trim()) {
    return "Add a task prompt before configuring execution.";
  }

  if (selectedTask.status === "draft") {
    return "Draft tasks can stay in planning without an execution workspace. Set status to queued, ready, or review needed before configuring execution.";
  }

  if (selectedTask.status === "running") {
    return "This task is already running in its assigned Agent Executor.";
  }

  if (isFinalQueueTaskStatus(selectedTask.status)) {
    return "Final-status tasks cannot be run in this version.";
  }

  if (!isRunnableQueueTaskStatus(selectedTask.status)) {
    return `Task status cannot be run: ${statusLabel(selectedTask.status)}.`;
  }

  return null;
}

function isRunnableQueueTaskStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

function queueRunStartErrorMessage(error: unknown) {
  const message = errorToMessage(error, "Unable to start assigned queue task.");

  if (/already has an active Direct Work run/i.test(message)) {
    return "Assigned Agent Executor is already running another task.";
  }

  if (/repo root must not be empty/i.test(message)) {
    return "Execution workspace is required for Codex Direct Work execution.";
  }

  if (/queue task status cannot be run/i.test(message)) {
    return message;
  }

  return message;
}

function defaultCodexExecutable(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_CODEX_EXECUTABLE;
  }

  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? WINDOWS_CODEX_EXECUTABLE
    : DEFAULT_CODEX_EXECUTABLE;
}
