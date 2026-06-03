import { useEffect, useMemo } from "react";

import type { AgentQueueTask, AgentQueueWorkerConfig } from "../../workspace/types";
import {
  queueDependencyStatesByTask,
  queueTagsFromTasks,
  validationSummary,
  workersFromExecutorSlots,
  type QueueGlobalStatus,
  type QueueTagPauseState,
  type QueueTagRecord,
  type WorkerScope,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import {
  getAssignedWorkerRoutingStates,
  getWorkerRoutingSummary,
  type AgentQueueRoutingContext,
} from "./agentQueueRoutingModel";
import {
  buildAgentQueueEmbeddedExecutorSection,
  buildAgentQueueSchedulerPlan,
} from "./agentQueueSchedulerModel";

type UseAgentQueueWorkerStateInput = {
  agentExecutorSlots: NonNullable<WidgetRenderProps["agentExecutorSlots"]>;
  globalExecutionState: QueueGlobalStatus;
  managedQueueTags: QueueTagRecord[];
  maxExecutors: number;
  queueTagPauseStates: Map<string, QueueTagPauseState>;
  setMaxExecutors: (maxExecutors: number) => void;
  tasks: AgentQueueTask[];
  workerConfigs: AgentQueueWorkerConfig[];
  workerScopes: Map<string, WorkerScope>;
};

export function useAgentQueueWorkerState({
  agentExecutorSlots,
  globalExecutionState,
  managedQueueTags,
  maxExecutors,
  queueTagPauseStates,
  setMaxExecutors,
  tasks,
  workerConfigs,
  workerScopes,
}: UseAgentQueueWorkerStateInput) {
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
  }, [maxExecutors, setMaxExecutors, workers.length]);

  return {
    assignedWorkerRoutingStates,
    dependencyStates,
    embeddedExecutor,
    pausedQueueTagIds,
    queueTags,
    queueValidationSummary,
    schedulerPlan,
    workers,
  };
}
