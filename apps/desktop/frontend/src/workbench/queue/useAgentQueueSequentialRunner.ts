import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import { shortWidgetInstanceId } from "../agentQueueTaskUiModel";
import type { AgentQueueTaskStartRequest } from "../agentQueueTaskWidgetActions";
import type { WidgetRenderProps } from "../types";
import {
  isQueueRunnerActive,
  queueRunnerPreconditionMessages,
  queueRunnerStopMessage,
  queueRunStartErrorMessage,
  replaceQueueTask,
  type AgentQueueRunnerStatus,
} from "./agentQueueControllerHelpers";
import {
  getNextQueueRunnerTaskDecision,
  queueRunnerFinalStatus,
  type QueueRunnerFinalStatus,
} from "./queueRunner";

type LoadTasks = (
  preferredTaskId?: string | null,
  options?: { preserveCurrentOnError?: boolean },
) => Promise<string | null>;

type UseAgentQueueSequentialRunnerOptions = {
  approvalPolicy: DirectWorkApprovalPolicy;
  assignmentApiAvailable: boolean;
  codexExecutable: string;
  isDirty: boolean;
  isStarting: boolean;
  loadTasks: LoadTasks;
  onAssignAgentQueueTaskToExecutor: WidgetRenderProps["onAssignAgentQueueTaskToExecutor"];
  onDirectWorkRunHandoffStarted: WidgetRenderProps["onDirectWorkRunHandoffStarted"];
  onStartAssignedAgentQueueTask: WidgetRenderProps["onStartAssignedAgentQueueTask"];
  repoRoot: string;
  sandbox: DirectWorkSandbox;
  selectedExecutorWidgetId: string;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  startApiAvailable: boolean;
  taskCount: number;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
};

export function useAgentQueueSequentialRunner({
  approvalPolicy,
  assignmentApiAvailable,
  codexExecutable,
  isDirty,
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
  taskCount,
  tasksRef,
}: UseAgentQueueSequentialRunnerOptions) {
  const [status, setStatus] = useState<AgentQueueRunnerStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedQueueItemIdsRef = useRef<Set<string>>(new Set());
  const activeQueueItemIdRef = useRef<string | null>(null);
  const waitingRunIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);
  const inFlightRef = useRef(false);
  const preconditionMessages = useMemo(
    () =>
      queueRunnerPreconditionMessages({
        assignmentApiAvailable,
        codexExecutable,
        hasExecutorSelection: Boolean(selectedExecutorWidgetId),
        isDirty,
        isStarting,
        repoRoot,
        runnerInFlight: inFlightRef.current,
        runnerStatus: status,
        startApiAvailable,
        taskCount,
      }),
    [
      assignmentApiAvailable,
      codexExecutable,
      isDirty,
      isStarting,
      repoRoot,
      selectedExecutorWidgetId,
      startApiAvailable,
      status,
      taskCount,
    ],
  );
  const canStart = preconditionMessages.length === 0;

  function start() {
    if (!canStart || inFlightRef.current) {
      return;
    }

    startedQueueItemIdsRef.current = new Set();
    activeQueueItemIdRef.current = null;
    waitingRunIdRef.current = null;
    stopRequestedRef.current = false;
    setError(null);
    setMessage("Sequential Queue Runner started.");
    setStatus("running");
    void advance(null);
  }

  function stop() {
    stopRequestedRef.current = true;
    setError(null);
    setStatus("stopped");
    setMessage(
      "Sequential Queue Runner stopped. The active Agent Executor run was not stopped.",
    );
  }

  async function advance(previousTaskStatus: QueueRunnerFinalStatus | null) {
    if (stopRequestedRef.current) {
      setStatus("stopped");
      setMessage("Sequential Queue Runner stopped.");
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus,
      selectedExecutorWidgetId,
      startedQueueItemIds: startedQueueItemIdsRef.current,
      tasks: tasksRef.current,
    });

    if (decision.kind === "completed") {
      setStatus("completed");
      setMessage(
        decision.skippedTaskCount > 0
          ? `Sequential Queue Runner completed. Skipped ${decision.skippedTaskCount.toString()} non-runnable task(s).`
          : "Sequential Queue Runner completed.",
      );
      return;
    }

    if (decision.kind === "stop") {
      const stopMessage = queueRunnerStopMessage(decision);
      setStatus(
        decision.reason === "assigned_to_different_executor"
          ? "error"
          : "stopped",
      );
      setMessage(stopMessage);
      setError(
        decision.reason === "assigned_to_different_executor"
          ? stopMessage
          : null,
      );
      return;
    }

    await startTask(
      decision.task,
      decision.requiresAssignment,
      decision.skippedTaskCount,
    );
  }

  async function startTask(
    task: AgentQueueTask,
    requiresAssignment: boolean,
    skippedTaskCount: number,
  ) {
    if (!onStartAssignedAgentQueueTask || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    activeQueueItemIdRef.current = task.queueItemId;
    waitingRunIdRef.current = null;
    setError(null);

    try {
      if (requiresAssignment) {
        if (!onAssignAgentQueueTaskToExecutor) {
          throw new Error("Assignment persistence is not available in this runtime.");
        }

        setStatus("assigning");
        setMessage(
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

      if (stopRequestedRef.current) {
        setStatus("stopped");
        setMessage("Sequential Queue Runner stopped before starting the next task.");
        return;
      }

      const request: AgentQueueTaskStartRequest = {
        approvalPolicy,
        codexExecutable,
        queueItemId: task.queueItemId,
        repoRoot,
        sandbox,
      };

      setStatus("starting");
      setMessage(
        skippedTaskCount > 0
          ? `Starting "${task.title}" after skipping ${skippedTaskCount.toString()} non-runnable task(s).`
          : `Starting "${task.title}".`,
      );

      const response = await onStartAssignedAgentQueueTask(request);
      startedQueueItemIdsRef.current.add(response.queueItemId);
      waitingRunIdRef.current = response.runId;
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

      if (stopRequestedRef.current) {
        setStatus("stopped");
        setMessage(
          "Sequential Queue Runner stopped. The active Agent Executor run was not stopped.",
        );
        return;
      }

      setStatus("waiting_for_executor");
      setMessage(
        `Waiting for Agent Executor ${shortWidgetInstanceId(
          response.executorWidgetInstanceId,
        )} to finish "${task.title}".`,
      );
    } catch (caughtError) {
      const messageText = queueRunStartErrorMessage(caughtError);
      setStatus("error");
      setError(messageText);
      setMessage(messageText);
      activeQueueItemIdRef.current = null;
      waitingRunIdRef.current = null;
    } finally {
      inFlightRef.current = false;
    }
  }

  function handleAutoRefreshComplete(
    request: NonNullable<WidgetRenderProps["queueTaskAutoRefreshRequest"]>,
  ) {
    if (
      status !== "waiting_for_executor" ||
      activeQueueItemIdRef.current !== request.queueItemId ||
      waitingRunIdRef.current !== request.runId
    ) {
      return;
    }

    const finalStatus = queueRunnerFinalStatus(request.finalStatus);
    activeQueueItemIdRef.current = null;
    waitingRunIdRef.current = null;

    if (stopRequestedRef.current) {
      setStatus("stopped");
      setMessage(
        "Sequential Queue Runner stopped. The completed task state was refreshed.",
      );
      return;
    }

    setStatus("running");
    setMessage(
      finalStatus === "completed"
        ? "Task completed. Sequential Queue Runner is checking the next task."
        : `Task ended with ${finalStatus}. Sequential Queue Runner is checking the next task.`,
    );
    void advance(finalStatus);
  }

  return {
    activeQueueItemId: activeQueueItemIdRef.current,
    clearError: () => setError(null),
    controller: {
      canStart,
      error,
      message,
      onStart: start,
      onStop: stop,
      preconditionMessages,
      status,
    },
    isActive: isQueueRunnerActive(status),
    onAutoRefreshComplete: handleAutoRefreshComplete,
  };
}
