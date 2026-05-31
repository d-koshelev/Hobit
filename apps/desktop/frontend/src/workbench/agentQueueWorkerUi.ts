import type {
  AgentQueueTask,
  AgentQueueWorkerConfig,
} from "../workspace/types";
import type { AgentQueueWorkerRoutingSummary } from "./queue/agentQueueRoutingModel";
import type { AgentExecutorSlot, WidgetInstance } from "./types";
import {
  DEFAULT_QUEUE_TAG_ID,
  DEFAULT_QUEUE_TAG_NAME,
  coordinatorStatusBlocksNewWork,
  displayTaskTitle,
  coordinatorStatusLabel,
  normalizeTaskPriority,
  normalizeValidationStatus,
} from "./agentQueueStatusLabels";
import {
  queueDependencyBlockedSummary,
  type AgentQueueDependencyState,
} from "./agentQueueDependencyUi";
import { type BadgeVariant } from "./agentQueueFormatting";
import { AGENT_RUN_WIDGET_DEFINITION_ID } from "./widgetRegistry";

export type QueueTagStatus = "running" | "paused";
export type QueueTagPauseReason = "manual" | "edit_review";
export type WorkerStatus = "idle" | "running" | "paused" | "failed";
export type WorkerScope =
  | { kind: "all" }
  | { kind: "queue_tag"; queueTagId: string; queueTagName: string };

export type AgentQueueExecutorInfoTone =
  | "waiting"
  | "blocked"
  | "executing"
  | "validating"
  | "reported"
  | "needs_review"
  | "done"
  | "failed";

export type AgentQueueExecutorInfo = {
  detail: string;
  label: string;
  tone: AgentQueueExecutorInfoTone;
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

export function normalizeQueueTag(
  task: Pick<AgentQueueTask, "queueTagId" | "queueTagName">,
) {
  const queueTagName = task.queueTagName?.trim() || DEFAULT_QUEUE_TAG_NAME;
  const queueTagId =
    task.queueTagId?.trim() ||
    queueTagNameToId(queueTagName) ||
    DEFAULT_QUEUE_TAG_ID;

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

export function queueExecutorInfoForTask({
  dependencyState,
  routingState,
  task,
}: {
  dependencyState?: AgentQueueDependencyState;
  routingState?: {
    blockedReasons: readonly { code: string; label: string }[];
    canTake: boolean;
  };
  task: AgentQueueTask;
}): AgentQueueExecutorInfo {
  const validationStatus = normalizeValidationStatus(task.validationStatus);

  if (task.status === "failed" || validationStatus === "failed") {
    return {
      detail:
        task.status === "failed"
          ? "Execution status is failed."
          : "Validation status is failed.",
      label: "Failed",
      tone: "failed",
    };
  }

  if (task.status === "completed") {
    return {
      detail: "Execution status is completed.",
      label: "Done",
      tone: "done",
    };
  }

  if ((task.workerExecutionReports?.length ?? 0) > 0) {
    return {
      detail:
        "Worker report is available as evidence. Coordinator review is still required.",
      label: "Reported",
      tone: "reported",
    };
  }

  if (coordinatorStatusBlocksNewWork(task.coordinatorStatus)) {
    return {
      detail: `${coordinatorStatusLabel(task.coordinatorStatus)}. Coordinator action controls final status.`,
      label: coordinatorStatusLabel(task.coordinatorStatus),
      tone:
        task.coordinatorStatus === "failed"
          ? "failed"
          : task.coordinatorStatus === "ready_for_finalization" ||
              task.coordinatorStatus === "worker_reported"
            ? "reported"
            : "needs_review",
    };
  }

  if (task.status === "review_needed" || validationStatus === "needs_review") {
    return {
      detail: "Queue item needs operator or coordinator review.",
      label: "Needs review",
      tone: "needs_review",
    };
  }

  const dependencyBlocked =
    dependencyState &&
    dependencyState.dependsOn.length > 0 &&
    dependencyState.status !== "ready";

  if (dependencyBlocked) {
    return {
      detail: queueDependencyBlockedSummary(dependencyState),
      label: "Blocked",
      tone: "blocked",
    };
  }

  if (
    validationStatus === "validating" ||
    task.coordinatorStatus === "awaiting_validation"
  ) {
    return {
      detail: "Validation is in progress or expected before review.",
      label: "Validating",
      tone: "validating",
    };
  }

  if (task.status === "running") {
    return {
      detail: "Execution status is running.",
      label: "Executing",
      tone: "executing",
    };
  }

  if (task.coordinatorStatus === "worker_reported") {
    return {
      detail: "Worker report is available for coordinator review.",
      label: "Reported",
      tone: "reported",
    };
  }

  const firstRoutingBlocker =
    routingState && !routingState.canTake
      ? routingState.blockedReasons.find(
          (reason) =>
            reason.code !== "item_not_runnable_status" &&
            reason.code !== "item_missing_prompt" &&
            reason.code !== "item_validation_in_progress",
        )
      : null;

  if (firstRoutingBlocker) {
    return {
      detail: firstRoutingBlocker.label,
      label: "Blocked",
      tone: "blocked",
    };
  }

  return {
    detail: task.assignedExecutorWidgetId
      ? "Assigned and waiting for an explicit operator start."
      : "Waiting for assignment or explicit operator action.",
    label: "Waiting",
    tone: "waiting",
  };
}

export function queueExecutorInfoBadgeVariant(
  tone: AgentQueueExecutorInfoTone,
): BadgeVariant {
  switch (tone) {
    case "done":
      return "success";
    case "executing":
    case "validating":
    case "reported":
      return "info";
    case "blocked":
    case "needs_review":
      return "warning";
    case "failed":
      return "error";
    case "waiting":
    default:
      return "neutral";
  }
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
    summaries.set(
      DEFAULT_QUEUE_TAG_ID,
      createSummary({
        queueTagId: DEFAULT_QUEUE_TAG_ID,
        queueTagName: DEFAULT_QUEUE_TAG_NAME,
      }),
    );
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
    } satisfies Record<
      NonNullable<ReturnType<typeof normalizeValidationStatus>>,
      number
    >,
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
          ? currentTask.workerExecutionReports?.length
            ? `Latest report: ${displayTaskTitle(currentTask)}`
            : `Latest linked item: ${displayTaskTitle(currentTask)}`
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
