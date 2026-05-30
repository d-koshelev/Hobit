import type {
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  AgentQueueTaskValidationStatus,
} from "../workspace/types";
import type { AgentExecutorSlot, WidgetInstance } from "./types";
import { AGENT_RUN_WIDGET_DEFINITION_ID } from "./widgetRegistry";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export const DEFAULT_TASK_TITLE = "New task";
export const DEFAULT_QUEUE_TAG_ID = "default";
export const DEFAULT_QUEUE_TAG_NAME = "Default";
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
export type QueueTagStatus = "running" | "paused";
export type QueueTagPauseReason = "manual" | "edit_review";
export type QueueGlobalStatus = "stopped" | "running";
export type WorkerStatus = "idle" | "running" | "paused" | "failed";
export type WorkerScope =
  | { kind: "all" }
  | { kind: "queue_tag"; queueTagId: string; queueTagName: string };

export type QueueTagRecord = {
  queueTagId: string;
  queueTagName: string;
};

export type QueueTagPauseState = {
  paused: boolean;
  reason: QueueTagPauseReason;
};

export type QueueTagSummary = {
  queueTagId: string;
  queueTagName: string;
  status: QueueTagStatus;
  pauseReason: QueueTagPauseReason | null;
  needsCoordinatorReview: boolean;
  taskCount: number;
  runningCount: number;
  validatingCount: number;
  needsReviewCount: number;
  failedValidationCount: number;
  coordinatorReviewCount: number;
};

export type AgentWorkerSummary = {
  workerId: string;
  name: string;
  status: WorkerStatus;
  scope: WorkerScope;
  currentItemId: string | null;
  lastReportSummary: string | null;
};

export type TaskDraft = {
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  itemType: AgentQueueTaskItemType;
  priority: number;
  prompt: string;
  queueTagName: string;
  status: QueueTaskStatus;
  title: string;
  validationStatus: AgentQueueTaskValidationStatus;
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
  { label: "Manual", value: "manual" },
  { label: "Auto", value: "auto" },
  {
    label: "After success",
    value: "after_previous_success",
  },
];

export const VALIDATION_STATUS_OPTIONS: Array<{
  label: string;
  value: AgentQueueTaskValidationStatus;
}> = [
  { label: "Not started", value: "not_started" },
  { label: "Validating", value: "validating" },
  { label: "Passed", value: "passed" },
  { label: "Failed", value: "failed" },
  { label: "Needs review", value: "needs_review" },
];

export const ITEM_TYPE_OPTIONS: Array<{
  label: string;
  value: AgentQueueTaskItemType;
}> = [
  { label: "Implementation", value: "implementation" },
  { label: "Diff review", value: "diff_review" },
  { label: "Follow-up", value: "follow_up" },
  { label: "Validation", value: "validation" },
];

export function emptyDraft(): TaskDraft {
  return {
    description: "",
    executionPolicy: "manual",
    itemType: "implementation",
    priority: 0,
    prompt: "",
    queueTagName: DEFAULT_QUEUE_TAG_NAME,
    status: "draft",
    title: "",
    validationStatus: "not_started",
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

  if (!draft.queueTagName.trim()) {
    return "Queue tag is required before saving.";
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

export function normalizeValidationStatus(
  validationStatus: string | null | undefined,
): AgentQueueTaskValidationStatus {
  return isAgentQueueTaskValidationStatus(validationStatus)
    ? validationStatus
    : "not_started";
}

export function normalizeItemType(
  itemType: string | null | undefined,
): AgentQueueTaskItemType {
  return isAgentQueueTaskItemType(itemType) ? itemType : "implementation";
}

export function normalizeQueueTag(task: Pick<AgentQueueTask, "queueTagId" | "queueTagName">) {
  const queueTagName = task.queueTagName?.trim() || DEFAULT_QUEUE_TAG_NAME;
  const queueTagId =
    task.queueTagId?.trim() || queueTagNameToId(queueTagName) || DEFAULT_QUEUE_TAG_ID;

  return { queueTagId, queueTagName };
}

export function queueTagNameToId(queueTagName: string) {
  return (
    queueTagName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || DEFAULT_QUEUE_TAG_ID
  );
}

export function normalizeQueueTagName(queueTagName: string) {
  return queueTagName.trim().replace(/\s+/g, " ");
}

export function queueTagDisplayNameKey(queueTagName: string) {
  return normalizeQueueTagName(queueTagName).toLowerCase();
}

export function validateQueueTagName(
  queueTagName: string,
  existingTags: QueueTagRecord[],
  options?: { allowQueueTagId?: string },
) {
  const normalizedName = normalizeQueueTagName(queueTagName);

  if (!normalizedName) {
    return "Queue tag name is required.";
  }

  const normalizedId = queueTagNameToId(normalizedName);
  const normalizedDisplayName = queueTagDisplayNameKey(normalizedName);
  const duplicate = existingTags.find(
    (tag) =>
      tag.queueTagId !== options?.allowQueueTagId &&
      (tag.queueTagId === normalizedId ||
        queueTagDisplayNameKey(tag.queueTagName) === normalizedDisplayName),
  );

  if (duplicate) {
    return `Queue tag "${duplicate.queueTagName}" already exists.`;
  }

  return null;
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

export function validationStatusLabel(status: string) {
  return (
    VALIDATION_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    formatStatus(status)
  );
}

export function validationBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "passed":
      return "success";
    case "validating":
      return "info";
    case "failed":
      return "error";
    case "needs_review":
      return "warning";
    case "not_started":
    default:
      return "neutral";
  }
}

export function itemTypeLabel(itemType: string) {
  return (
    ITEM_TYPE_OPTIONS.find((option) => option.value === itemType)?.label ??
    formatStatus(itemType)
  );
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

export function workerLabel(workerId: string | null | undefined) {
  return workerId ? agentExecutorSlotLabel(workerId) : "Unassigned";
}

export function queueTagsFromTasks(
  tasks: AgentQueueTask[],
  pauseStates: ReadonlyMap<string, QueueTagPauseState>,
  managedTags: QueueTagRecord[] = [],
): QueueTagSummary[] {
  const summaries = new Map<string, QueueTagSummary>();

  function createSummary(queueTag: QueueTagRecord): QueueTagSummary {
    const pauseState = pauseStates.get(queueTag.queueTagId);

    return {
      queueTagId: queueTag.queueTagId,
      queueTagName: queueTag.queueTagName,
      runningCount: 0,
      failedValidationCount: 0,
      coordinatorReviewCount: 0,
      needsCoordinatorReview: false,
      needsReviewCount: 0,
      pauseReason: pauseState?.reason ?? null,
      status: pauseState?.paused ? "paused" : "running",
      taskCount: 0,
      validatingCount: 0,
    };
  }

  for (const managedTag of managedTags) {
    summaries.set(managedTag.queueTagId, createSummary(managedTag));
  }

  for (const task of tasks) {
    const { queueTagId, queueTagName } = normalizeQueueTag(task);
    const current =
      summaries.get(queueTagId) ??
      createSummary({
        queueTagId,
        queueTagName,
      });

    current.taskCount += 1;
    if (task.status === "running") {
      current.runningCount += 1;
    }
    const validationStatus = normalizeValidationStatus(task.validationStatus);
    if (validationStatus === "validating") {
      current.validatingCount += 1;
    }
    if (validationStatus === "needs_review") {
      current.needsReviewCount += 1;
    }
    if (validationStatus === "failed") {
      current.failedValidationCount += 1;
    }
    if (task.coordinatorStatus === "awaiting_coordinator_review") {
      current.coordinatorReviewCount += 1;
      current.needsCoordinatorReview = true;
    }
    summaries.set(queueTagId, current);
  }

  if (summaries.size === 0) {
    summaries.set(DEFAULT_QUEUE_TAG_ID, createSummary({
      queueTagId: DEFAULT_QUEUE_TAG_ID,
      queueTagName: DEFAULT_QUEUE_TAG_NAME,
    }));
  }

  return Array.from(summaries.values()).sort((first, second) =>
    first.queueTagName.localeCompare(second.queueTagName),
  );
}

export function validationSummary(tasks: AgentQueueTask[]) {
  return tasks.reduce(
    (summary, task) => {
      const status = normalizeValidationStatus(task.validationStatus);
      summary[status] += 1;
      return summary;
    },
    {
      failed: 0,
      needs_review: 0,
      not_started: 0,
      passed: 0,
      validating: 0,
    } satisfies Record<AgentQueueTaskValidationStatus, number>,
  );
}

export function workersFromExecutorSlots({
  pauseStates,
  slots,
  tasks,
  workerScopes,
}: {
  pauseStates: ReadonlyMap<string, QueueTagPauseState>;
  slots: AgentExecutorSlot[];
  tasks: AgentQueueTask[];
  workerScopes: ReadonlyMap<string, WorkerScope>;
}): AgentWorkerSummary[] {
  return slots.map((slot) => {
    const currentTask =
      tasks.find(
        (task) =>
          task.assignedWorkerId === slot.widgetInstanceId ||
          task.assignedExecutorWidgetId === slot.widgetInstanceId,
      ) ?? null;
    const scope = workerScopes.get(slot.widgetInstanceId) ?? { kind: "all" };
    const scopedQueueTagId =
      scope.kind === "queue_tag" ? scope.queueTagId : null;

    return {
      currentItemId: currentTask?.queueItemId ?? null,
      lastReportSummary: currentTask
        ? `Latest linked item: ${displayTaskTitle(currentTask)}`
        : null,
      name: slot.label,
      scope,
      status: scopedQueueTagId && pauseStates.get(scopedQueueTagId)?.paused
        ? "paused"
        : currentTask?.status === "running"
          ? "running"
          : "idle",
      workerId: slot.widgetInstanceId,
    };
  });
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
      text: "Workspace queue tasks are loading.",
      title: "Loading queue.",
    };
  }

  if (loadError) {
    return {
      text: `${loadError} Use Refresh to try again.`,
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

function isAgentQueueTaskValidationStatus(
  validationStatus: string | null | undefined,
): validationStatus is AgentQueueTaskValidationStatus {
  return VALIDATION_STATUS_OPTIONS.some(
    (option) => option.value === validationStatus,
  );
}

function isAgentQueueTaskItemType(
  itemType: string | null | undefined,
): itemType is AgentQueueTaskItemType {
  return ITEM_TYPE_OPTIONS.some((option) => option.value === itemType);
}
