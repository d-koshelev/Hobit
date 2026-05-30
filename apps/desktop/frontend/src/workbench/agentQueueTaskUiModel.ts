import type {
  AgentQueueGlobalExecutionState,
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  AgentQueueTaskValidationStatus,
  AgentQueueWorkerConfig,
} from "../workspace/types";
import type { AgentQueueWorkerRoutingSummary } from "./queue/agentQueueRoutingModel";
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
export type QueueGlobalStatus = AgentQueueGlobalExecutionState;
export type WorkerStatus = "idle" | "running" | "paused" | "failed";
export type WorkerScope =
  | { kind: "all" }
  | { kind: "queue_tag"; queueTagId: string; queueTagName: string };
export type AgentQueueDependencyStatus = "ready" | "blocked" | "invalid";
export type AgentQueueDependencyBlockReason =
  | "cycle"
  | "missing"
  | "not_completed"
  | "not_finalized"
  | "self";

export type AgentQueueDependencyBlocker = {
  queueItemId: string;
  reason: AgentQueueDependencyBlockReason;
  title: string;
};

export type AgentQueueDependencyState = {
  blockedBy: AgentQueueDependencyBlocker[];
  dependsOn: string[];
  status: AgentQueueDependencyStatus;
};

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
  enabled: boolean;
  status: WorkerStatus;
  scope: WorkerScope;
  currentItemId: string | null;
  lastReportSummary: string | null;
  displayOrder: number;
  routingSummary?: AgentQueueWorkerRoutingSummary;
};

export type TaskDraft = {
  dependsOn: string[];
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

export const DEFAULT_QUEUE_GLOBAL_EXECUTION_STATE =
  "stopped" satisfies AgentQueueGlobalExecutionState;

export function queueGlobalExecutionStateLabel(
  state: AgentQueueGlobalExecutionState,
): "START" | "STOP" | "STOP + KILL RUNNING" {
  switch (state) {
    case "started":
      return "START";
    case "stop_kill_requested":
      return "STOP + KILL RUNNING";
    case "stopped":
    default:
      return "STOP";
  }
}

export function queueGlobalExecutionStateDescription(
  state: AgentQueueGlobalExecutionState,
) {
  switch (state) {
    case "started":
      return "Workers may take eligible queue items.";
    case "stop_kill_requested":
      return "Scheduling is stopped; running work requires termination/coordinator review where runtime supports it.";
    case "stopped":
    default:
      return "No new work is scheduled; running work may finish.";
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

export function normalizeTaskDependencies(
  dependsOn: string[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const dependencyId of dependsOn ?? []) {
    const trimmedDependencyId = dependencyId.trim();

    if (!trimmedDependencyId || seen.has(trimmedDependencyId)) {
      continue;
    }

    seen.add(trimmedDependencyId);
    normalized.push(trimmedDependencyId);
  }

  return normalized;
}

export function queueTaskOrderIndex(task: AgentQueueTask) {
  return typeof task.orderIndex === "number" && Number.isFinite(task.orderIndex)
    ? task.orderIndex
    : null;
}

export function compareQueueTasksForOrder(
  first: AgentQueueTask,
  second: AgentQueueTask,
) {
  const firstTag = normalizeQueueTag(first);
  const secondTag = normalizeQueueTag(second);
  const firstOrderIndex = queueTaskOrderIndex(first);
  const secondOrderIndex = queueTaskOrderIndex(second);

  return (
    firstTag.queueTagName.localeCompare(secondTag.queueTagName) ||
    firstTag.queueTagId.localeCompare(secondTag.queueTagId) ||
    normalizeTaskPriority(second.priority) - normalizeTaskPriority(first.priority) ||
    (firstOrderIndex ?? Number.POSITIVE_INFINITY) -
      (secondOrderIndex ?? Number.POSITIVE_INFINITY) ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.queueItemId.localeCompare(second.queueItemId)
  );
}

export function sortQueueTasksForDisplay(tasks: AgentQueueTask[]) {
  return [...tasks].sort(compareQueueTasksForOrder);
}

export function queueTaskPriorityLabel(priority: number | null | undefined) {
  return `P${normalizeTaskPriority(priority).toString()}`;
}

export function buildQueueDependencyGraph(tasks: AgentQueueTask[]) {
  return new Map(
    tasks.map((task) => [
      task.queueItemId,
      normalizeTaskDependencies(task.dependsOn),
    ]),
  );
}

export function queueDependencyStatusLabel(
  status: AgentQueueDependencyStatus,
) {
  switch (status) {
    case "blocked":
      return "Deps blocked";
    case "invalid":
      return "Deps invalid";
    case "ready":
    default:
      return "Deps ready";
  }
}

export function queueDependencyBadgeVariant(
  status: AgentQueueDependencyStatus,
): BadgeVariant {
  switch (status) {
    case "blocked":
      return "warning";
    case "invalid":
      return "error";
    case "ready":
    default:
      return "success";
  }
}

export function queueDependencyBlockedSummary(
  dependencyState: AgentQueueDependencyState,
) {
  if (dependencyState.status === "ready") {
    return "Dependencies ready.";
  }

  const blockedBy = dependencyState.blockedBy
    .map((blocker) => blocker.title)
    .join(", ");

  return blockedBy ? `Blocked by: ${blockedBy}` : "Dependencies are blocked.";
}

export function queueDependencyReadinessMessage(
  dependencyState: AgentQueueDependencyState,
) {
  if (dependencyState.status === "ready") {
    return null;
  }

  return dependencyState.status === "invalid"
    ? `Fix dependency errors before running. ${queueDependencyBlockedSummary(
        dependencyState,
      )}`
    : `Resolve dependencies before running. ${queueDependencyBlockedSummary(
        dependencyState,
      )}`;
}

export function queueDependencyBlockerLabel(
  blocker: AgentQueueDependencyBlocker,
) {
  switch (blocker.reason) {
    case "cycle":
      return `${blocker.title} creates a dependency cycle.`;
    case "missing":
      return `${blocker.title} is missing.`;
    case "not_completed":
      return `${blocker.title} is not completed.`;
    case "not_finalized":
      return `${blocker.title} is not coordinator accepted.`;
    case "self":
      return "A task cannot depend on itself.";
  }
}

export function getQueueTaskDependencyState(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
): AgentQueueDependencyState {
  const dependsOn = normalizeTaskDependencies(task.dependsOn);
  const tasksById = new Map(tasks.map((candidate) => [candidate.queueItemId, candidate]));
  const blockers: AgentQueueDependencyBlocker[] = [];

  for (const dependencyId of dependsOn) {
    if (dependencyId === task.queueItemId) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "self",
        title: displayTaskTitle(task),
      });
      continue;
    }

    const dependency = tasksById.get(dependencyId);

    if (!dependency) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "missing",
        title: dependencyId,
      });
      continue;
    }

    if (hasQueueDependencyCycle({
      dependencyGraph: buildQueueDependencyGraph([
        ...tasks.filter((candidate) => candidate.queueItemId !== task.queueItemId),
        { ...task, dependsOn },
      ]),
      queueItemId: task.queueItemId,
    })) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "cycle",
        title: displayTaskTitle(dependency),
      });
      continue;
    }

    if (dependency.status !== "completed") {
      blockers.push({
        queueItemId: dependencyId,
        reason: "not_completed",
        title: displayTaskTitle(dependency),
      });
      continue;
    }

    if (dependency.coordinatorStatus !== "finalized") {
      blockers.push({
        queueItemId: dependencyId,
        reason: "not_finalized",
        title: displayTaskTitle(dependency),
      });
    }
  }

  const hasInvalidBlocker = blockers.some(
    (blocker) =>
      blocker.reason === "cycle" ||
      blocker.reason === "missing" ||
      blocker.reason === "self",
  );

  return {
    blockedBy: blockers,
    dependsOn,
    status:
      blockers.length === 0 ? "ready" : hasInvalidBlocker ? "invalid" : "blocked",
  };
}

export function queueDependencyStatesByTask(tasks: AgentQueueTask[]) {
  return new Map(
    tasks.map((task) => [
      task.queueItemId,
      getQueueTaskDependencyState(task, tasks),
    ]),
  );
}

export function validateQueueTaskDependencies(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
) {
  const dependencyState = getQueueTaskDependencyState(task, tasks);
  const invalidBlocker = dependencyState.blockedBy.find(
    (blocker) =>
      blocker.reason === "cycle" ||
      blocker.reason === "missing" ||
      blocker.reason === "self",
  );

  return invalidBlocker ? queueDependencyBlockerLabel(invalidBlocker) : null;
}

export function dependentTasksForQueueItem(
  tasks: AgentQueueTask[],
  queueItemId: string,
) {
  return tasks.filter((task) =>
    normalizeTaskDependencies(task.dependsOn).includes(queueItemId),
  );
}

function hasQueueDependencyCycle({
  dependencyGraph,
  queueItemId,
}: {
  dependencyGraph: ReadonlyMap<string, string[]>;
  queueItemId: string;
}) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(currentQueueItemId: string): boolean {
    if (visiting.has(currentQueueItemId)) {
      return true;
    }

    if (visited.has(currentQueueItemId)) {
      return false;
    }

    visiting.add(currentQueueItemId);

    for (const dependencyId of dependencyGraph.get(currentQueueItemId) ?? []) {
      if (visit(dependencyId)) {
        return true;
      }
    }

    visiting.delete(currentQueueItemId);
    visited.add(currentQueueItemId);
    return false;
  }

  return visit(queueItemId);
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
  workerConfigs,
  workerScopes,
}: {
  pauseStates: ReadonlyMap<string, QueueTagPauseState>;
  slots: AgentExecutorSlot[];
  tasks: AgentQueueTask[];
  workerConfigs?: AgentQueueWorkerConfig[];
  workerScopes: ReadonlyMap<string, WorkerScope>;
}): AgentWorkerSummary[] {
  const configs =
    workerConfigs && workerConfigs.length > 0
      ? workerConfigs
      : slots.map((slot, index) => ({
          createdAt: "",
          displayOrder: index,
          enabled: true,
          name: slot.label,
          queueTagId: null,
          queueTagName: null,
          scopeKind: "all" as const,
          updatedAt: "",
          workerId: slot.widgetInstanceId,
          workspaceId: "",
        }));

  return configs
    .slice()
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .map((workerConfig, index) => {
    const currentTask =
      tasks.find(
        (task) =>
          task.assignedWorkerId === workerConfig.workerId ||
          task.assignedExecutorWidgetId === workerConfig.workerId,
      ) ?? null;
    const persistedScope =
      workerConfig.scopeKind === "queue_tag" &&
      workerConfig.queueTagId &&
      workerConfig.queueTagName
        ? {
            kind: "queue_tag" as const,
            queueTagId: workerConfig.queueTagId,
            queueTagName: workerConfig.queueTagName,
          }
        : { kind: "all" as const };
    const scope = workerScopes.get(workerConfig.workerId) ?? persistedScope;
    const scopedQueueTagId =
      scope.kind === "queue_tag" ? scope.queueTagId : null;

    return {
      currentItemId: currentTask?.queueItemId ?? null,
      displayOrder: workerConfig.displayOrder ?? index,
      enabled: workerConfig.enabled,
      lastReportSummary: currentTask
        ? `Latest linked item: ${displayTaskTitle(currentTask)}`
        : null,
      name: workerConfig.name,
      scope,
      status: !workerConfig.enabled
        ? "paused"
        : scopedQueueTagId && pauseStates.get(scopedQueueTagId)?.paused
        ? "paused"
        : currentTask?.status === "running"
          ? "running"
          : "idle",
      workerId: workerConfig.workerId,
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
