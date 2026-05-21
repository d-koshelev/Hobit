import type {
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
} from "../workspace/types";
import type { AgentExecutorSlot, WidgetInstance } from "./types";
import { AGENT_RUN_WIDGET_DEFINITION_ID } from "./widgetRegistry";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export const DEFAULT_TASK_TITLE = "New task";
export const MIN_PRIORITY = 0;
export const MAX_PRIORITY = 5;

const TASK_STATUSES = [
  "draft",
  "queued",
  "ready",
  "running",
  "completed",
  "failed",
  "cancelled",
  "review_needed",
] as const;

export type QueueTaskStatus = (typeof TASK_STATUSES)[number];
export type QueueFilter = "all" | QueueTaskStatus;

export type TaskDraft = {
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  priority: number;
  prompt: string;
  status: QueueTaskStatus;
  title: string;
};

export const STATUS_OPTIONS: Array<{
  label: string;
  value: QueueTaskStatus;
}> = [
  { label: "Draft", value: "draft" },
  { label: "Queued", value: "queued" },
  { label: "Ready", value: "ready" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Review needed", value: "review_needed" },
];

export const FILTERS: Array<{ label: string; value: QueueFilter }> = [
  { label: "All", value: "all" },
  ...STATUS_OPTIONS,
];

export const EXECUTION_POLICY_OPTIONS: Array<{
  label: string;
  value: AgentQueueTaskExecutionPolicy;
}> = [
  { label: "Manual - requires operator command", value: "manual" },
  { label: "Auto - run automatically", value: "auto" },
  {
    label: "After previous success - run if previous task succeeded",
    value: "after_previous_success",
  },
];

export function emptyDraft(): TaskDraft {
  return {
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "",
    status: "draft",
    title: "",
  };
}

export function validateDraft(draft: TaskDraft): string | null {
  if (!draft.title.trim()) {
    return "Title is required before saving.";
  }

  if (draft.priority < MIN_PRIORITY || draft.priority > MAX_PRIORITY) {
    return "Priority must be between 0 and 5.";
  }

  if (!isQueueTaskStatus(draft.status)) {
    return "Status is not supported.";
  }

  if (draft.status !== "draft" && !draft.prompt.trim()) {
    return "Prompt is required unless the task is a draft.";
  }

  return null;
}

export function isQueueTaskStatus(status: string): status is QueueTaskStatus {
  return TASK_STATUSES.includes(status as QueueTaskStatus);
}

export function isAgentQueueTaskExecutionPolicy(
  executionPolicy: string,
): executionPolicy is AgentQueueTaskExecutionPolicy {
  return EXECUTION_POLICY_OPTIONS.some(
    (option) => option.value === executionPolicy,
  );
}

export function normalizeTaskExecutionPolicy(
  executionPolicy: string | null | undefined,
): AgentQueueTaskExecutionPolicy {
  return executionPolicy && isAgentQueueTaskExecutionPolicy(executionPolicy)
    ? executionPolicy
    : "manual";
}

export function normalizeTaskStatus(status: string): QueueTaskStatus {
  return isQueueTaskStatus(status) ? status : "draft";
}

export function statusLabel(status: string) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    formatStatus(status)
  );
}

export function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "ready":
    case "completed":
      return "success";
    case "running":
    case "queued":
      return "info";
    case "failed":
      return "error";
    case "review_needed":
      return "warning";
    case "cancelled":
    case "draft":
    default:
      return "neutral";
  }
}

export function displayTaskTitle(task: AgentQueueTask) {
  return task.title.trim() || DEFAULT_TASK_TITLE;
}

export function taskPreview(task: AgentQueueTask) {
  const preview = (task.description || task.prompt).replace(/\s+/g, " ").trim();

  return preview || "No description or prompt yet.";
}

export function isFinalQueueTaskStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isAssignmentLockedQueueTaskStatus(status: string) {
  return isFinalQueueTaskStatus(status) || status === "running";
}

export function shortWidgetInstanceId(widgetInstanceId: string) {
  const compactId = widgetInstanceId.replace(/[^a-z0-9]/gi, "");

  return compactId.slice(-6) || widgetInstanceId.slice(-6) || "unknown";
}

export function agentExecutorSlotLabel(widgetInstanceId: string) {
  return `Agent Executor ${shortWidgetInstanceId(widgetInstanceId)}`;
}

export function agentExecutorSlotsFromWidgets(
  widgets: WidgetInstance[],
): AgentExecutorSlot[] {
  return widgets
    .filter(
      (widget) =>
        widget.visible && widget.definitionId === AGENT_RUN_WIDGET_DEFINITION_ID,
    )
    .sort((first, second) => first.layout.order - second.layout.order)
    .map((widget) => ({
      label: agentExecutorSlotLabel(widget.id),
      widgetInstanceId: widget.id,
    }));
}

export function assignmentLabel(assignedExecutorWidgetId: string | null) {
  return assignedExecutorWidgetId
    ? agentExecutorSlotLabel(assignedExecutorWidgetId)
    : "Unassigned";
}

export function formatUpdatedTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

export function queueSingleState({
  isLoading,
  loadError,
}: {
  isLoading: boolean;
  loadError: string | null;
}) {
  if (isLoading) {
    return {
      text: "Loading workspace queue tasks from desktop storage.",
      title: "Loading queue.",
    };
  }

  if (loadError) {
    return {
      text: loadError,
      title: "Queue unavailable.",
    };
  }

  return null;
}

export function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatStatus(status: string) {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
