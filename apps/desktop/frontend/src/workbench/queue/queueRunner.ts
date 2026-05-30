import type { AgentQueueTask } from "../../workspace/types";
import { normalizeQueueTag } from "../agentQueueTaskUiModel";
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
        | "manual"
        | "paused_queue_tag"
        | "previous_success_required"
        | "previous_task_not_successful";
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
};

export function getNextQueueRunnerTaskDecision({
  previousTaskStatus,
  pausedQueueTagIds,
  selectedExecutorWidgetId,
  startedQueueItemIds,
  tasks,
}: QueueRunnerTaskDecisionInput): QueueRunnerTaskDecision {
  let skippedTaskCount = 0;

  for (const task of tasks) {
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

    if (
      task.assignedExecutorWidgetId &&
      task.assignedExecutorWidgetId !== selectedExecutorWidgetId
    ) {
      return {
        kind: "stop",
        reason: "assigned_to_different_executor",
        skippedTaskCount,
        task,
      };
    }

    if (pausedQueueTagIds?.has(normalizeQueueTag(task).queueTagId)) {
      return {
        kind: "stop",
        reason: "paused_queue_tag",
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
