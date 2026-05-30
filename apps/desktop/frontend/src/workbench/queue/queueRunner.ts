import type {
  AgentQueueGlobalExecutionState,
  AgentQueueTask,
} from "../../workspace/types";
import {
  agentExecutorSlotLabel,
  getQueueTaskDependencyState,
  sortQueueTasksForDisplay,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
} from "../agentQueueTaskUiModel";
import {
  getWorkerItemBlockedReasons,
  type AgentQueueRoutingBlockedReason,
} from "./agentQueueRoutingModel";
import {
  getQueueRunnerPolicyDecision,
  type QueueRunnerPreviousTaskStatus,
} from "./queueExecutionPolicy";

export type QueueRunnerFinalStatus = QueueRunnerPreviousTaskStatus;

export type QueueRunnerTaskDecision =
  | {
      kind: "start";
      requiresAssignment: boolean;
      skippedTaskCount: number;
      task: AgentQueueTask;
    }
  | {
      kind: "stop";
      reason:
        | "assigned_to_different_executor"
        | "dependency_blocked"
        | "manual"
        | "paused_queue_tag"
        | "previous_success_required"
        | "previous_task_not_successful"
        | "routing_blocked";
      blockedReasons?: AgentQueueRoutingBlockedReason[];
      dependencyState?: AgentQueueDependencyState;
      skippedTaskCount: number;
      task: AgentQueueTask;
    }
  | {
      kind: "completed";
      skippedTaskCount: number;
    };

export type QueueRunnerTaskDecisionInput = {
  previousTaskStatus: QueueRunnerPreviousTaskStatus | null;
  pausedQueueTagIds?: ReadonlySet<string>;
  selectedExecutorWidgetId: string;
  startedQueueItemIds?: ReadonlySet<string>;
  tasks: AgentQueueTask[];
  globalExecutionState?: AgentQueueGlobalExecutionState;
  workers?: AgentWorkerSummary[];
};

export function getNextQueueRunnerTaskDecision({
  previousTaskStatus,
  pausedQueueTagIds,
  selectedExecutorWidgetId,
  startedQueueItemIds,
  tasks,
  globalExecutionState = "started",
  workers,
}: QueueRunnerTaskDecisionInput): QueueRunnerTaskDecision {
  let skippedTaskCount = 0;

  for (const task of sortQueueTasksForDisplay(tasks)) {
    if (startedQueueItemIds?.has(task.queueItemId)) {
      skippedTaskCount += 1;
      continue;
    }

    const policyDecision = getQueueRunnerPolicyDecision({
      executionPolicy: task.executionPolicy,
      previousTaskStatus,
      prompt: task.prompt,
      status: task.status,
    });

    if (
      policyDecision === "skip_missing_prompt" ||
      policyDecision === "skip_not_runnable_status"
    ) {
      skippedTaskCount += 1;
      continue;
    }

    if (policyDecision === "stop_for_manual") {
      return {
        kind: "stop",
        reason: "manual",
        skippedTaskCount,
        task,
      };
    }

    if (policyDecision === "stop_waiting_for_previous_success") {
      return {
        kind: "stop",
        reason: "previous_success_required",
        skippedTaskCount,
        task,
      };
    }

    if (policyDecision === "stop_previous_task_not_successful") {
      return {
        kind: "stop",
        reason: "previous_task_not_successful",
        skippedTaskCount,
        task,
      };
    }

    const selectedWorker =
      workers?.find((worker) => worker.workerId === selectedExecutorWidgetId) ??
      defaultWorkerForExecutor(selectedExecutorWidgetId);
    const blockedReasons = getWorkerItemBlockedReasons(selectedWorker, task, {
      globalExecutionState,
      pausedQueueTagIds,
      tasks,
    });

    if (
      blockedReasons.some((reason) => reason.code === "assigned_to_another_worker")
    ) {
      return {
        kind: "stop",
        reason: "assigned_to_different_executor",
        skippedTaskCount,
        task,
      };
    }

    if (
      blockedReasons.some(
        (reason) =>
          reason.code === "item_dependency_graph_invalid" ||
          reason.code === "waiting_for_dependencies",
      )
    ) {
      return {
        blockedReasons,
        dependencyState: getQueueTaskDependencyState(task, tasks),
        kind: "stop",
        reason: "dependency_blocked",
        skippedTaskCount,
        task,
      };
    }

    if (blockedReasons.some((reason) => reason.code === "queue_tag_paused")) {
      return {
        blockedReasons,
        kind: "stop",
        reason: "paused_queue_tag",
        skippedTaskCount,
        task,
      };
    }

    if (blockedReasons.length > 0) {
      return {
        blockedReasons,
        kind: "stop",
        reason: "routing_blocked",
        skippedTaskCount,
        task,
      };
    }

    return {
      kind: "start",
      requiresAssignment: !task.assignedExecutorWidgetId,
      skippedTaskCount,
      task,
    };
  }

  return {
    kind: "completed",
    skippedTaskCount,
  };
}

export function queueRunnerFinalStatus(
  finalStatus: string | null | undefined,
): QueueRunnerFinalStatus {
  if (finalStatus === "completed") {
    return "completed";
  }

  if (finalStatus === "cancelled") {
    return "cancelled";
  }

  if (finalStatus === "timed_out") {
    return "timed_out";
  }

  return "failed";
}

function defaultWorkerForExecutor(workerId: string): AgentWorkerSummary {
  return {
    currentItemId: null,
    displayOrder: 0,
    enabled: true,
    lastReportSummary: null,
    name: agentExecutorSlotLabel(workerId),
    scope: { kind: "all" },
    status: "idle",
    workerId,
  };
}
