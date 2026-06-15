import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import type {
  AgentQueueGlobalExecutionState,
  AgentExecutorRunDetail,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import {
  errorToMessage,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskExecutionPolicy,
  normalizeTaskStatus,
  normalizeValidationStatus,
  shortWidgetInstanceId,
} from "../agentQueueTaskUiModel";
import type { DirectWorkQueueTaskAutoRefreshRequest, WidgetRenderProps } from "../types";
import {
  queueRunStartErrorMessage,
  replaceQueueTask,
} from "./agentQueueControllerHelpers";
import type {
  AgentQueueAutonomousController,
  AgentQueueAutonomousStatus,
  AgentQueueAutonomousTimelineEvent,
} from "./agentQueueControllerTypes";
import type { AgentQueueLocalTaskFields } from "./useAgentQueueTaskActions";
import {
  AUTONOMOUS_REPORT_READY_NOTE,
  DEPENDENCY_BLOCKER,
  NO_ELIGIBLE_TASK_BLOCKER,
  assessAutonomousSuccess,
  autonomousPreconditionMessages,
  autonomousSetupBlockerMessages,
  autonomousTaskBlockerMessages,
  autonomousTaskSetupMessage,
  buildAutonomousWorkerReport,
  countRemainingAutonomousEligibleTasks,
  selectFirstAutonomousSetupBlockedTask,
  selectNextAutonomousTask,
} from "./agentQueueAutonomousRunnerModel";
import {
  autonomousQueueStateSignature,
  isRunReadinessBlocker,
  taskHasReportReadyState,
  taskReleasesAutonomousRunner,
} from "./agentQueueAutonomousRunnerState";
import {
  buildSmartQueueWorkerFailureIntegration,
  classifySmartQueueFailure,
  type SmartQueueFailureIntegrationInput,
} from "./smartQueueWorkerReportIntegration";

type LoadTasks = (
  preferredTaskId?: string | null,
  options?: { preserveCurrentOnError?: boolean },
) => Promise<string | null>;

type UseAgentQueueAutonomousRunnerOptions = {
  approvalPolicy: DirectWorkApprovalPolicy;
  codexExecutable: string;
  codexExecutableDraft: string;
  currentWorkspaceRoot: string | null;
  globalExecutionState: AgentQueueGlobalExecutionState;
  hasOpenTaskEdit: boolean;
  isStarting: boolean;
  loadTasks: LoadTasks;
  onDirectWorkRunHandoffStarted: WidgetRenderProps["onDirectWorkRunHandoffStarted"];
  onGetAgentExecutorRunDetail: WidgetRenderProps["onGetAgentExecutorRunDetail"];
  onStartAssignedAgentQueueTask: WidgetRenderProps["onStartAssignedAgentQueueTask"];
  onUpdateAgentQueueTask: WidgetRenderProps["onUpdateAgentQueueTask"];
  onApprovalPolicyChange: (approvalPolicy: DirectWorkApprovalPolicy) => void;
  onCodexExecutableDraftChange: (codexExecutable: string) => void;
  onRepoRootDraftChange: (repoRoot: string) => void;
  onSandboxChange: (sandbox: DirectWorkSandbox) => void;
  queueWidgetInstanceId?: string;
  repoRoot: string;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox;
  selectedTask: AgentQueueTask | null;
  setLocalTaskFields: Dispatch<SetStateAction<Map<string, AgentQueueLocalTaskFields>>>;
  setSelectedTask: Dispatch<SetStateAction<AgentQueueTask | null>>;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
};

type ActiveAutonomousRun = {
  executorWidgetInstanceId: string;
  queueItemId: string;
  repoRoot: string;
  runId: string;
  taskTitle: string;
};

type Counters = {
  completed: number;
  failed: number;
  skippedBlocked: number;
};

export function useAgentQueueAutonomousRunner({
  approvalPolicy,
  codexExecutable,
  codexExecutableDraft,
  currentWorkspaceRoot,
  globalExecutionState,
  hasOpenTaskEdit,
  isStarting,
  loadTasks,
  onDirectWorkRunHandoffStarted,
  onGetAgentExecutorRunDetail,
  onStartAssignedAgentQueueTask,
  onUpdateAgentQueueTask,
  onApprovalPolicyChange,
  onCodexExecutableDraftChange,
  onRepoRootDraftChange,
  onSandboxChange,
  queueWidgetInstanceId,
  repoRoot,
  repoRootDraft,
  sandbox,
  selectedTask,
  setLocalTaskFields,
  setSelectedTask,
  setTasks,
  tasksRef,
}: UseAgentQueueAutonomousRunnerOptions) {
  const [status, setStatus] = useState<AgentQueueAutonomousStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [latestReportState, setLatestReportState] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<AgentQueueAutonomousTimelineEvent[]>([]);
  const [counters, setCounters] = useState<Counters>({
    completed: 0,
    failed: 0,
    skippedBlocked: 0,
  });
  const activeRunRef = useRef<ActiveAutonomousRun | null>(null);
  const inFlightRef = useRef(false);
  const lastDependencyWaitQueueSignatureRef = useRef<string | null>(null);
  const stopAfterCurrentRef = useRef(false);
  const waitingForDependencyRef = useRef(false);
  const startedQueueItemIdsRef = useRef<Set<string>>(new Set());
  const countersRef = useRef(counters);

  countersRef.current = counters;

  const apiAvailable = Boolean(
    onGetAgentExecutorRunDetail &&
      onStartAssignedAgentQueueTask &&
      onUpdateAgentQueueTask,
  );
  const autonomousActive =
    status === "running" ||
    status === "stopping" ||
    (status === "blocked" && waitingForDependencyRef.current);
  const preconditionMessages = useMemo(
    () =>
      autonomousPreconditionMessages({
        apiAvailable,
        globalExecutionState,
        isStarting: isStarting || inFlightRef.current || autonomousActive,
      }),
    [
      apiAvailable,
      autonomousActive,
      globalExecutionState,
      isStarting,
    ],
  );
  const canStart = preconditionMessages.length === 0;

  useEffect(() => {
    if (!autonomousActive || inFlightRef.current) {
      return;
    }

    const activeRun = activeRunRef.current;
    if (!activeRun) {
      if (waitingForDependencyRef.current) {
        const queueSignature = autonomousQueueStateSignature(tasksRef.current);
        if (lastDependencyWaitQueueSignatureRef.current === queueSignature) {
          return;
        }

        lastDependencyWaitQueueSignatureRef.current = queueSignature;
        void advance();
      }
      return;
    }

    lastDependencyWaitQueueSignatureRef.current = null;
    void reconcileActiveRunWithQueueState(activeRun);
  });

  function start() {
    if (!canStart || inFlightRef.current) {
      return;
    }

    stopAfterCurrentRef.current = false;
    waitingForDependencyRef.current = false;
    lastDependencyWaitQueueSignatureRef.current = null;
    startedQueueItemIdsRef.current = new Set();
    activeRunRef.current = null;
    setCounters({
      completed: 0,
      failed: 0,
      skippedBlocked: 0,
    });
    setTimeline([]);
    setActiveTaskTitle(null);
    setLatestReportState(null);
    setCurrentStage("checking execution readiness");
    setError(null);
    setMessage("Autonomous Queue starting.");
    setStatus("running");
    void startAutonomousRun();
  }

  function stopAfterCurrent() {
    stopAfterCurrentRef.current = true;
    setStatus((currentStatus) =>
      currentStatus === "running" ? "stopping" : currentStatus,
    );
    setMessage("Stop after current task requested.");
    addTimeline(
      "Stop after current task requested",
      "Stop now unavailable; will stop after current task.",
      "warning",
    );
  }

  async function startAutonomousRun() {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    try {
      const preflightOptions = {
        hasOpenTaskEdit,
        globalExecutionState,
        tasks: tasksRef.current,
      };
      const setupBlockers = autonomousSetupBlockerMessages(preflightOptions);

      if (setupBlockers.length > 0) {
        const setupBlocker = setupBlockers[0] ?? "Set autonomous setup before running.";
        const setupBlockedTask = selectFirstAutonomousSetupBlockedTask(
          tasksRef.current,
          startedQueueItemIdsRef.current,
          globalExecutionState,
        );
        if (setupBlockedTask) {
          await recordSmartQueueFailure(setupBlockedTask, {
            failureKind: "missing_config",
            reason: setupBlocker,
            runId: "setup",
            stage: "environment",
          });
        }
        needsSetup(setupBlocker);
        return;
      }

      setCurrentStage("selecting next task");
      const decision = selectNextAutonomousTask(
        tasksRef.current,
        startedQueueItemIdsRef.current,
        globalExecutionState,
      );

      if (!decision.task) {
        const taskBlockers = autonomousTaskBlockerMessages(preflightOptions);
        const taskBlocker = taskBlockers[0] ?? NO_ELIGIBLE_TASK_BLOCKER;
        if (taskBlocker === DEPENDENCY_BLOCKER) {
          waitForDependencies(taskBlocker);
        } else {
          completeNoEligible(taskBlocker);
        }
        return;
      }

      setCounters((current) => ({
        ...current,
        skippedBlocked: Math.max(current.skippedBlocked, decision.skippedCount),
      }));
      await startTask(decision.task);
    } catch (caughtError) {
      fail(errorToMessage(caughtError, "Unable to start Autonomous Queue."));
    } finally {
      inFlightRef.current = false;
    }
  }

  async function advance() {
    if (stopAfterCurrentRef.current) {
      waitingForDependencyRef.current = false;
      lastDependencyWaitQueueSignatureRef.current = null;
      setStatus("completed");
      setCurrentStage(null);
      setActiveTaskTitle(null);
      setMessage("Autonomous Queue stopped after current task.");
      return;
    }

    const decision = selectNextAutonomousTask(
      tasksRef.current,
      startedQueueItemIdsRef.current,
      globalExecutionState,
    );
    setCounters((current) => ({
      ...current,
      skippedBlocked: Math.max(current.skippedBlocked, decision.skippedCount),
    }));

    if (!decision.task) {
      if (decision.skippedCount > 0) {
        waitForDependencies(DEPENDENCY_BLOCKER);
      } else {
        completeNoEligible("No eligible tasks remain.");
      }
      return;
    }

    waitingForDependencyRef.current = false;
    lastDependencyWaitQueueSignatureRef.current = null;
    setStatus("running");
    setMessage("Starting next task.");
    await startTask(decision.task);
  }

  async function startTask(task: AgentQueueTask) {
    if (!onStartAssignedAgentQueueTask) {
      fail("Queue-owned local executor is unavailable.");
      return;
    }

    const setupMessage = autonomousTaskSetupMessage(task);
    if (setupMessage) {
      needsSetup(setupMessage);
      return;
    }

    const taskRepoRoot = task.executionWorkspace?.trim() ?? "";
    const taskCodexExecutable = task.codexExecutable?.trim() ?? "";
    const taskSandbox = task.sandbox;
    const taskApprovalPolicy = task.approvalPolicy;

    if (!taskRepoRoot || !taskCodexExecutable || !taskSandbox || !taskApprovalPolicy) {
      const reason = setupMessage ?? `Task ${task.title} is missing execution settings.`;
      await recordSmartQueueFailure(task, {
        failureKind: "missing_config",
        reason,
        runId: "setup",
        stage: "environment",
      });
      needsSetup(reason);
      return;
    }

    setCurrentStage("starting Direct Work");
    setActiveTaskTitle(task.title);
    addTimeline("Next task selected", task.title, "info");
    addTimeline("Run started", task.title, "info");

    try {
      const response = await onStartAssignedAgentQueueTask({
        approvalPolicy: taskApprovalPolicy,
        codexExecutable: taskCodexExecutable,
        queueItemId: task.queueItemId,
        queueOwnerWidgetInstanceId: queueWidgetInstanceId,
        repoRoot: taskRepoRoot,
        sandbox: taskSandbox,
      });
      activeRunRef.current = {
        executorWidgetInstanceId: response.executorWidgetInstanceId,
        queueItemId: response.queueItemId,
        repoRoot: taskRepoRoot,
        runId: response.runId,
        taskTitle: task.title,
      };
      waitingForDependencyRef.current = false;
      startedQueueItemIdsRef.current.add(response.queueItemId);
      onDirectWorkRunHandoffStarted?.({
        executorWidgetInstanceId: response.executorWidgetInstanceId,
        queueItemId: response.queueItemId,
        repoRoot: taskRepoRoot,
        runId: response.runId,
        startedAt: new Date().toISOString(),
        taskTitle: task.title,
        workbenchId: response.workbenchId,
        workspaceId: response.workspaceId,
      });
      await loadTasks(response.queueItemId, { preserveCurrentOnError: true });
      setCurrentStage(
        `waiting for local executor ${shortWidgetInstanceId(response.executorWidgetInstanceId)}`,
      );
      setMessage(`Waiting for "${task.title}" to finish.`);
    } catch (caughtError) {
      const startErrorMessage = queueRunStartErrorMessage(caughtError);
      await recordSmartQueueFailure(task, {
        failureKind: classifySmartQueueFailure(startErrorMessage),
        reason: startErrorMessage,
        runId: "start",
      });

      if (isRunReadinessBlocker(startErrorMessage)) {
        block(startErrorMessage);
      } else {
        fail(startErrorMessage);
      }
    }
  }

  function handleAutoRefreshComplete(request: DirectWorkQueueTaskAutoRefreshRequest) {
    const activeRun = activeRunRef.current;

    if (
      !activeRun ||
      activeRun.queueItemId !== request.queueItemId ||
      activeRun.runId !== request.runId
    ) {
      return;
    }

    void completeTask(activeRun, request.finalStatus);
  }

  async function completeTask(activeRun: ActiveAutonomousRun, finalStatus: string) {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setCurrentStage("loading evidence");
    addTimeline("Run completed", `${activeRun.taskTitle}: ${finalStatus}`, "info");

    try {
      const detail = await onGetAgentExecutorRunDetail?.(
        activeRun.executorWidgetInstanceId,
        activeRun.runId,
      );
      addTimeline("Evidence loaded", activeRun.taskTitle, detail ? "success" : "error");

      const success = assessAutonomousSuccess(detail, finalStatus);
      if (!success.ok || !detail) {
        await addFailureEvidence(activeRun.queueItemId, activeRun.runId, success.reason, {
          finalStatus,
        });
        fail(success.reason);
        return;
      }

      setCurrentStage("recording report");
      await recordReportReadyTask({
        activeRun,
        detail,
      });
      activeRunRef.current = null;
      waitingForDependencyRef.current = false;
      lastDependencyWaitQueueSignatureRef.current = null;
      incrementCounter("completed");
      setLatestReportState("Report ready. Awaiting coordinator review.");
      addTimeline("Report ready", AUTONOMOUS_REPORT_READY_NOTE, "success");

      inFlightRef.current = false;
      await advance();
    } catch (caughtError) {
      fail(errorToMessage(caughtError, "Autonomous Queue task completion failed."));
    } finally {
      inFlightRef.current = false;
    }
  }

  async function reconcileActiveRunWithQueueState(activeRun: ActiveAutonomousRun) {
    const currentTask = taskById(activeRun.queueItemId);

    if (!currentTask) {
      activeRunRef.current = null;
      lastDependencyWaitQueueSignatureRef.current = null;
      setActiveTaskTitle(null);
      setCurrentStage("queue changed");
      setMessage("Active task is no longer in the queue. Starting next task.");
      addTimeline(
        "Active task cleared",
        "The active Queue item is no longer visible.",
        "warning",
      );
      await advance();
      return;
    }

    const taskStatus = normalizeTaskStatus(currentTask.status);
    const validationStatus = normalizeValidationStatus(currentTask.validationStatus);
    const coordinatorStatus = currentTask.coordinatorStatus ?? "not_reported";

    if (taskStatus === "running" || taskStatus === "queued" || taskStatus === "ready") {
      return;
    }

    if (
      taskStatus === "failed" ||
      taskStatus === "cancelled" ||
      validationStatus === "failed" ||
      coordinatorStatus === "failed"
    ) {
      activeRunRef.current = null;
      lastDependencyWaitQueueSignatureRef.current = null;
      await recordSmartQueueFailure(currentTask, {
        finalStatus: taskStatus,
        reason: `Active task ${currentTask.title} ended with ${taskStatus}.`,
        runId: activeRun.runId,
      });
      fail(`Active task ${currentTask.title} ended with ${taskStatus}.`);
      return;
    }

    if (taskStatus === "completed" && !taskHasReportReadyState(currentTask)) {
      await completeTask(activeRun, "completed");
      return;
    }

    if (taskReleasesAutonomousRunner(currentTask)) {
      activeRunRef.current = null;
      lastDependencyWaitQueueSignatureRef.current = null;
      incrementCounter("completed");
      setActiveTaskTitle(null);
      setCurrentStage("starting next task");
      setLatestReportState(
        coordinatorStatus === "finalized"
          ? "Coordinator finalized."
          : "Report ready. Awaiting coordinator review.",
      );
      setMessage("Starting next eligible task.");
      addTimeline(
        "Active task released",
        `${currentTask.title} is no longer running.`,
        "success",
      );
      await advance();
    }
  }

  async function recordReportReadyTask({
    activeRun,
    detail,
  }: {
    activeRun: ActiveAutonomousRun;
    detail: AgentExecutorRunDetail;
  }) {
    const currentTask = taskById(activeRun.queueItemId);
    if (!currentTask || !onUpdateAgentQueueTask) {
      throw new Error("Queue task could not be loaded for autonomous report.");
    }

    const updatedTask = await onUpdateAgentQueueTask({
      description: currentTask.description,
      dependsOn: currentTask.dependsOn,
      executionPolicy: normalizeTaskExecutionPolicy(currentTask.executionPolicy),
      itemType: normalizeItemType(currentTask.itemType),
      priority: currentTask.priority,
      prompt: currentTask.prompt,
      queueItemId: currentTask.queueItemId,
      queueTagId: normalizeQueueTag(currentTask).queueTagId,
      queueTagName: normalizeQueueTag(currentTask).queueTagName,
      status: "completed",
      title: currentTask.title,
      validationStatus: "needs_review",
      executionWorkspace: currentTask.executionWorkspace ?? null,
      codexExecutable: currentTask.codexExecutable ?? null,
      sandbox: currentTask.sandbox ?? null,
      approvalPolicy: currentTask.approvalPolicy ?? null,
    });
    const baseTask = updatedTask ?? { ...currentTask, status: "completed" as const };
    const report = buildAutonomousWorkerReport({
      detail,
      runId: activeRun.runId,
      task: currentTask,
    });
    const reportReadyTask: AgentQueueTask = {
      ...baseTask,
      coordinatorStatus: "awaiting_coordinator_review",
      validationStatus: "needs_review",
      workerExecutionReports: [
        ...(currentTask.workerExecutionReports ?? []),
        report,
      ],
    };

    tasksRef.current = replaceQueueTask(tasksRef.current, reportReadyTask);
    setTasks(tasksRef.current);
    if (selectedTask?.queueItemId === reportReadyTask.queueItemId) {
      setSelectedTask(reportReadyTask);
    }
    setLocalTaskFields((current) =>
      new Map(current).set(reportReadyTask.queueItemId, {
        ...(current.get(reportReadyTask.queueItemId) ?? {}),
        coordinatorStatus: "awaiting_coordinator_review",
        validationStatus: "needs_review",
        workerExecutionReports: reportReadyTask.workerExecutionReports,
      }),
    );
  }

  async function addFailureEvidence(
    queueItemId: string,
    runId: string,
    reason: string,
    options?: Pick<SmartQueueFailureIntegrationInput, "finalStatus">,
  ) {
    const currentTask = taskById(queueItemId);
    if (!currentTask) {
      return;
    }

    await recordSmartQueueFailure(currentTask, {
      finalStatus: options?.finalStatus,
      reason,
      runId,
    });
  }

  async function recordSmartQueueFailure(
    task: AgentQueueTask,
    input: Omit<SmartQueueFailureIntegrationInput, "task" | "workerId">,
  ) {
    const integration = buildSmartQueueWorkerFailureIntegration({
      ...input,
      task,
      workerId:
        queueWidgetInstanceId ??
        task.assignedWorkerId ??
        task.assignedExecutorWidgetId ??
        "agent-queue",
    });
    const report: AgentQueueWorkerExecutionReport =
      integration.taskPatch.workerExecutionReport;
    const failedTask: AgentQueueTask = {
      ...task,
      coordinatorStatus: integration.taskPatch.coordinatorStatus,
      status: integration.taskPatch.status,
      validationStatus: integration.taskPatch.validationStatus,
      workerExecutionReports: [...(task.workerExecutionReports ?? []), report],
    };

    if (onUpdateAgentQueueTask) {
      try {
        const updatedTask = await onUpdateAgentQueueTask({
          approvalPolicy: task.approvalPolicy ?? null,
          codexExecutable: task.codexExecutable ?? null,
          dependsOn: task.dependsOn,
          description: task.description,
          executionPolicy: normalizeTaskExecutionPolicy(task.executionPolicy),
          executionWorkspace: task.executionWorkspace ?? null,
          itemType: normalizeItemType(task.itemType),
          priority: task.priority,
          prompt: task.prompt,
          queueItemId: task.queueItemId,
          queueTagId: normalizeQueueTag(task).queueTagId,
          queueTagName: normalizeQueueTag(task).queueTagName,
          sandbox: task.sandbox ?? null,
          status: integration.taskPatch.status,
          title: task.title,
          validationStatus: integration.taskPatch.validationStatus,
          workerExecutionReports: failedTask.workerExecutionReports,
        });

        if (updatedTask) {
          failedTask.assignedExecutorWidgetId =
            updatedTask.assignedExecutorWidgetId;
          failedTask.updatedAt = updatedTask.updatedAt;
        }
      } catch {
        // The local frontend state still carries the visible failure evidence.
      }
    }

    tasksRef.current = replaceQueueTask(tasksRef.current, failedTask);
    setTasks(tasksRef.current);
    if (selectedTask?.queueItemId === failedTask.queueItemId) {
      setSelectedTask(failedTask);
    }
    setLocalTaskFields((current) =>
      new Map(current).set(task.queueItemId, {
        ...(current.get(task.queueItemId) ?? {}),
        coordinatorStatus: failedTask.coordinatorStatus,
        validationStatus: failedTask.validationStatus,
        workerExecutionReports: failedTask.workerExecutionReports,
      }),
    );
  }

  function fail(reason: string) {
    activeRunRef.current = null;
    waitingForDependencyRef.current = false;
    lastDependencyWaitQueueSignatureRef.current = null;
    incrementCounter("failed");
    setLatestReportState("Failed.");
    setStatus("failed");
    setCurrentStage(null);
    setActiveTaskTitle(null);
    setError(reason);
    setMessage(reason);
    addTimeline("Autonomous Queue stopped", reason, "error");
  }

  function needsSetup(reason: string) {
    activeRunRef.current = null;
    waitingForDependencyRef.current = false;
    lastDependencyWaitQueueSignatureRef.current = null;
    setStatus("needs_setup");
    setCurrentStage(null);
    setActiveTaskTitle(null);
    setError(null);
    setMessage(reason);
    addTimeline("Autonomous Queue needs setup", reason, "warning");
  }

  function block(reason: string) {
    activeRunRef.current = null;
    waitingForDependencyRef.current = false;
    lastDependencyWaitQueueSignatureRef.current = null;
    setStatus("blocked");
    setCurrentStage(null);
    setActiveTaskTitle(null);
    setError(null);
    setMessage(reason);
    addTimeline("Autonomous Queue blocked", reason, "warning");
  }

  function waitForDependencies(reason: string) {
    activeRunRef.current = null;
    if (waitingForDependencyRef.current) {
      return;
    }

    waitingForDependencyRef.current = true;
    lastDependencyWaitQueueSignatureRef.current =
      autonomousQueueStateSignature(tasksRef.current);
    setStatus("blocked");
    setCurrentStage("waiting for dependency finalization");
    setActiveTaskTitle(null);
    setError(null);
    setMessage("Waiting on dependency-blocked tasks.");
    addTimeline("Autonomous Queue waiting", reason, "warning");
  }

  function completeNoEligible(reason: string) {
    activeRunRef.current = null;
    waitingForDependencyRef.current = false;
    lastDependencyWaitQueueSignatureRef.current = null;
    setStatus("completed");
    setCurrentStage(null);
    setActiveTaskTitle(null);
    setMessage("Autonomous Queue completed.");
    addTimeline("Autonomous Queue completed", reason, "success");
  }

  function addTimeline(
    title: string,
    detail: string | null,
    eventStatus: AgentQueueAutonomousTimelineEvent["status"],
  ) {
    const event: AgentQueueAutonomousTimelineEvent = {
      detail,
      id: `${Date.now().toString()}-${Math.random().toString(36).slice(2)}`,
      status: eventStatus,
      timestamp: new Date().toISOString(),
      title,
    };
    setTimeline((current) => [...current.slice(-19), event]);
  }

  function incrementCounter(counter: keyof Counters) {
    setCounters((current) => ({
      ...current,
      [counter]: current[counter] + 1,
    }));
  }

  function taskById(queueItemId: string) {
    return tasksRef.current.find((task) => task.queueItemId === queueItemId) ?? null;
  }

  return {
    activeQueueItemId: activeRunRef.current?.queueItemId ?? null,
    controller: {
      activeQueueItemId: activeRunRef.current?.queueItemId ?? null,
      activeTaskTitle,
      apiAvailable,
      approvalPolicy,
      canStart,
      codexExecutableDraft,
      completedCount: counters.completed,
      currentWorkspaceRoot,
      currentStage,
      error,
      failedCount: counters.failed,
      latestReportState,
      message,
      onApprovalPolicyChange,
      onCodexExecutableDraftChange,
      onRepoRootDraftChange,
      onSandboxChange,
      onStart: start,
      onStopAfterCurrent: stopAfterCurrent,
      preconditionMessages,
      repoRootDraft,
      remainingEligibleCount: countRemainingAutonomousEligibleTasks(
        tasksRef.current,
        startedQueueItemIdsRef.current,
        globalExecutionState,
      ),
      sandbox,
      skippedBlockedCount: counters.skippedBlocked,
      status,
      timeline,
    } satisfies AgentQueueAutonomousController,
    onAutoRefreshComplete: handleAutoRefreshComplete,
  };
}
