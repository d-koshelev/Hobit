import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
} from "../../workspace/types";

export type QueueRunnerPreviousTaskStatus =
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export type QueueRunnerPolicyDecision =
  | "run"
  | "stop_for_manual"
  | "stop_waiting_for_previous_success"
  | "stop_previous_task_not_successful"
  | "skip_not_runnable_status"
  | "skip_missing_prompt";

export type QueueTaskRunnableStatus = Extract<
  AgentQueueTaskStatus,
  "queued" | "ready" | "review_needed"
>;

export type QueueRunnerPolicyDecisionInput = {
  executionPolicy?: string | null;
  previousTaskStatus?: QueueRunnerPreviousTaskStatus | null;
  prompt?: string | null;
  status?: string | null;
};

const QUEUE_EXECUTION_POLICIES: readonly AgentQueueTaskExecutionPolicy[] = [
  "manual",
  "auto",
  "after_previous_success",
];

const RUNNABLE_QUEUE_TASK_STATUSES: readonly QueueTaskRunnableStatus[] = [
  "queued",
  "ready",
  "review_needed",
];

export function normalizeQueueExecutionPolicy(
  value: string | null | undefined,
): AgentQueueTaskExecutionPolicy {
  return QUEUE_EXECUTION_POLICIES.includes(
    value as AgentQueueTaskExecutionPolicy,
  )
    ? (value as AgentQueueTaskExecutionPolicy)
    : "manual";
}

export function isQueueTaskRunnableStatus(
  status: string | null | undefined,
): status is QueueTaskRunnableStatus {
  return RUNNABLE_QUEUE_TASK_STATUSES.includes(
    status as QueueTaskRunnableStatus,
  );
}

export function hasQueueTaskRunnablePrompt(task: {
  prompt?: string | null;
}): boolean {
  return Boolean(task.prompt?.trim());
}

export function getQueueRunnerPolicyDecision({
  executionPolicy,
  previousTaskStatus,
  prompt,
  status,
}: QueueRunnerPolicyDecisionInput): QueueRunnerPolicyDecision {
  const policy = normalizeQueueExecutionPolicy(executionPolicy);

  if (policy === "manual") {
    return "stop_for_manual";
  }

  if (!isQueueTaskRunnableStatus(status)) {
    return "skip_not_runnable_status";
  }

  if (!hasQueueTaskRunnablePrompt({ prompt })) {
    return "skip_missing_prompt";
  }

  if (policy === "auto") {
    return "run";
  }

  if (!previousTaskStatus) {
    return "stop_waiting_for_previous_success";
  }

  return previousTaskStatus === "completed"
    ? "run"
    : "stop_previous_task_not_successful";
}
