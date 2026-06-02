import type {
  AgentQueueCoordinatorStatus,
  AgentQueueGlobalExecutionState,
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  AgentQueueTaskValidationStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import { clamp, formatStatus, type BadgeVariant } from "./agentQueueFormatting";

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
export type QueueGlobalStatus = AgentQueueGlobalExecutionState;

export type TaskDraft = {
  dependsOn: string[];
  approvalPolicy: DirectWorkApprovalPolicy | "";
  codexExecutable: string;
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionWorkspace: string;
  itemType: AgentQueueTaskItemType;
  priority: number;
  prompt: string;
  queueTagName: string;
  sandbox: DirectWorkSandbox | "";
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

export const DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE =
  "stopped" satisfies AgentQueueGlobalExecutionState;

export function queueGlobalExecutionStateLabel(
  state: AgentQueueGlobalExecutionState,
): "Enabled" | "Disabled" | "STOP + KILL RUNNING" {
  switch (state) {
    case "started":
      return "Enabled";
    case "stop_kill_requested":
      return "STOP + KILL RUNNING";
    case "stopped":
    default:
      return "Disabled";
  }
}

export function queueGlobalExecutionStateDescription(
  state: AgentQueueGlobalExecutionState,
) {
  switch (state) {
    case "started":
      return "Queue scheduling enabled.";
    case "stop_kill_requested":
      return "New starts blocked; review running work.";
    case "stopped":
    default:
      return "Queue scheduling disabled.";
  }
}

export function queueGlobalExecutionStateAllowsScheduling(
  state: AgentQueueGlobalExecutionState,
) {
  return state === "started";
}

export function queueGlobalExecutionStateBlocksNewWork(
  state: AgentQueueGlobalExecutionState,
) {
  return state !== "started";
}

export function emptyDraft(): TaskDraft {
  return {
    dependsOn: [],
    approvalPolicy: "",
    codexExecutable: "",
    description: "",
    executionPolicy: "manual",
    executionWorkspace: "",
    itemType: "implementation",
    priority: 0,
    prompt: "",
    queueTagName: DEFAULT_QUEUE_TAG_NAME,
    sandbox: "",
    status: "draft",
    title: "",
    validationStatus: "not_started",
  };
}

export function normalizeTaskPriority(priority: number | null | undefined) {
  return typeof priority === "number" && Number.isFinite(priority)
    ? clamp(priority, MIN_PRIORITY, MAX_PRIORITY)
    : MIN_PRIORITY;
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

export function normalizeTaskStatus(status: string): QueueTaskStatus {
  return isQueueTaskStatus(status) ? status : "draft";
}

export function queueTaskPriorityLabel(priority: number | null | undefined) {
  return `P${normalizeTaskPriority(priority).toString()}`;
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

export function normalizeCoordinatorStatus(
  status: string | null | undefined,
): AgentQueueCoordinatorStatus {
  return isAgentQueueCoordinatorStatus(status) ? status : "not_reported";
}

export function coordinatorStatusLabel(
  status: string | null | undefined,
) {
  switch (normalizeCoordinatorStatus(status)) {
    case "worker_reported":
      return "Worker reported";
    case "awaiting_validation":
      return "Awaiting validation";
    case "awaiting_coordinator_review":
      return "Awaiting coordinator review";
    case "ready_for_finalization":
      return "Ready for finalization";
    case "finalized":
      return "Finalized / accepted";
    case "needs_changes":
      return "Needs changes";
    case "follow_up_required":
      return "Follow-up required";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed / rejected";
    case "rollback_required":
      return "Rollback required";
    case "not_reported":
    default:
      return "Not ready";
  }
}

export function coordinatorStatusBadgeVariant(
  status: string | null | undefined,
): BadgeVariant {
  switch (normalizeCoordinatorStatus(status)) {
    case "finalized":
      return "success";
    case "ready_for_finalization":
    case "worker_reported":
      return "info";
    case "needs_changes":
    case "follow_up_required":
    case "blocked":
    case "rollback_required":
    case "awaiting_validation":
    case "awaiting_coordinator_review":
      return "warning";
    case "failed":
      return "error";
    case "not_reported":
    default:
      return "neutral";
  }
}

export function coordinatorStatusBlocksNewWork(
  status: string | null | undefined,
) {
  switch (normalizeCoordinatorStatus(status)) {
    case "awaiting_validation":
    case "awaiting_coordinator_review":
    case "ready_for_finalization":
    case "worker_reported":
    case "needs_changes":
    case "follow_up_required":
    case "blocked":
    case "failed":
    case "rollback_required":
      return true;
    case "finalized":
    case "not_reported":
    default:
      return false;
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

function isAgentQueueCoordinatorStatus(
  status: string | null | undefined,
): status is AgentQueueCoordinatorStatus {
  return (
    status === "not_reported" ||
    status === "worker_reported" ||
    status === "awaiting_validation" ||
    status === "awaiting_coordinator_review" ||
    status === "ready_for_finalization" ||
    status === "finalized" ||
    status === "needs_changes" ||
    status === "follow_up_required" ||
    status === "blocked" ||
    status === "failed" ||
    status === "rollback_required"
  );
}
