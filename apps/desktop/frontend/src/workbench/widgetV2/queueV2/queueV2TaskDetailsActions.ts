import type { AgentQueueTask } from "../../../workspace/types";
import {
  coordinatorStatusBlocksNewWork,
  normalizeTaskStatus,
} from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type { QueueInspectorSnapshot } from "../../queue/queueV2ViewModel";

export type QueueV2DetailsTab =
  | "overview"
  | "prompt"
  | "result"
  | "agent-log"
  | "coordinator"
  | "context"
  | "files-validation"
  | "developer";

type QueueV2TaskDetailsActionId =
  | "refresh"
  | "new-task"
  | "run"
  | "view-report"
  | "attach-report"
  | "accept-without-commit"
  | "finalize"
  | "request-changes"
  | "create-follow-up"
  | "developer";

export type QueueV2TaskDetailsAction = {
  disabled: boolean;
  id: QueueV2TaskDetailsActionId;
  label: string;
  onClick: () => void;
  reason: string | undefined;
  variant: "primary" | "secondary" | "ghost";
};

export function buildQueueV2TaskDetailsActions({
  inspector,
  onRequestNewTask,
  onSelectTab,
  queue,
  task,
}: {
  inspector: QueueInspectorSnapshot | null;
  onRequestNewTask?: () => void;
  onSelectTab: (tab: QueueV2DetailsTab) => void;
  queue?: AgentQueueController;
  task: AgentQueueTask | null;
}): QueueV2TaskDetailsAction[] {
  if (!task || !inspector) {
    return [];
  }

  const hasQueueController = Boolean(queue);
  const selectedTaskMismatch = Boolean(
    queue?.selectedTask && queue.selectedTask.queueItemId !== task.queueItemId,
  );
  const selectionReason = selectedTaskMismatch
    ? "Select this task to enable Queue actions."
    : undefined;
  const actions: QueueV2TaskDetailsAction[] = [
    {
      disabled: !queue?.apiAvailable,
      id: "refresh",
      label: "Refresh",
      onClick: () => void queue?.refreshTasks(),
      reason: queue?.apiAvailable
        ? undefined
        : "Queue API is unavailable in this runtime.",
      variant: "ghost",
    },
  ];

  if (onRequestNewTask) {
    actions.push({
      disabled: !queue?.apiAvailable || Boolean(queue?.isCreating || queue?.isLoading),
      id: "new-task",
      label: "New task",
      onClick: onRequestNewTask,
      reason: !queue?.apiAvailable
        ? "Queue API is unavailable in this runtime."
        : queue?.isLoading
          ? "Queue tasks are still loading."
          : queue?.isCreating
            ? "A task is already being created."
            : undefined,
      variant: "secondary",
    });
  }

  if (isRunActionRelevant(task, inspector)) {
    actions.push({
      disabled:
        !hasQueueController ||
        selectedTaskMismatch ||
        !Boolean(queue?.run.canStart),
      id: "run",
      label: queue?.run.isStarting ? "Starting" : "Run task",
      onClick: () => queue?.run.onStartAssignedTask(),
      reason:
        selectionReason ??
        (!hasQueueController
          ? "Queue runtime actions are not wired in this view."
          : queue?.run.canStart
            ? undefined
            : queue?.run.readinessMessage ??
              queue?.run.preconditionMessages[0] ??
              "Run is unavailable for the selected task state."),
      variant: "primary",
    });
  }

  if (isReviewActionRelevant(task)) {
    actions.push({
      disabled: false,
      id: "view-report",
      label: "View report",
      onClick: () => onSelectTab("result"),
      reason: undefined,
      variant: "primary",
    });
    actions.push({
      disabled:
        !hasQueueController ||
        selectedTaskMismatch ||
        !Boolean(queue?.workerReport.canAttach),
      id: "attach-report",
      label: "Attach report",
      onClick: () => queue?.workerReport.onAttachDemoReport(),
      reason:
        selectionReason ??
        (!hasQueueController
          ? "Queue report attachment is not wired in this view."
          : queue?.workerReport.canAttach
            ? undefined
            : queue?.workerReport.message ??
              "Attach report is unavailable until report evidence exists."),
      variant: "secondary",
    });

    actions.push(...coordinatorDecisionActions(queue, selectionReason));
  }

  actions.push({
    disabled: false,
    id: "developer",
    label: "Developer details",
    onClick: () => onSelectTab("developer"),
    reason: undefined,
    variant: "ghost",
  });

  return actions;
}

function coordinatorDecisionActions(
  queue: AgentQueueController | undefined,
  selectionReason: string | undefined,
): QueueV2TaskDetailsAction[] {
  const disabled =
    !queue || Boolean(selectionReason) || !queue.coordinatorFinalization.canAct;
  const reason =
    selectionReason ??
    (!queue
      ? "Queue coordinator actions are not wired in this view."
      : queue.coordinatorFinalization.canAct
        ? undefined
        : queue.coordinatorFinalization.message ??
          "Coordinator decision actions are unavailable while the task is editing, saving, or creating.");

  return [
    {
      disabled,
      id: "accept-without-commit",
      label: "Accept without commit",
      onClick: () => queue?.coordinatorFinalization.onAcceptWithoutCommit(),
      reason,
      variant: "secondary",
    },
    {
      disabled,
      id: "finalize",
      label: "Finalize / Accept",
      onClick: () => queue?.coordinatorFinalization.onFinalize(),
      reason,
      variant: "secondary",
    },
    {
      disabled,
      id: "request-changes",
      label: "Request changes",
      onClick: () => queue?.coordinatorFinalization.onMarkNeedsChanges(),
      reason,
      variant: "secondary",
    },
    {
      disabled,
      id: "create-follow-up",
      label: "Create follow-up",
      onClick: () => queue?.coordinatorFinalization.onCreateFollowUp(),
      reason,
      variant: "secondary",
    },
  ];
}

function isRunActionRelevant(
  task: AgentQueueTask,
  inspector: QueueInspectorSnapshot,
) {
  const status = normalizeTaskStatus(task.status);

  return (
    inspector.nextAction === "run_now" ||
    status === "queued" ||
    status === "ready" ||
    status === "review_needed"
  );
}

function isReviewActionRelevant(task: AgentQueueTask) {
  const status = normalizeTaskStatus(task.status);

  return (
    status === "completed" ||
    status === "failed" ||
    status === "review_needed" ||
    Boolean(task.workerExecutionReports?.length) ||
    coordinatorStatusBlocksNewWork(task.coordinatorStatus)
  );
}
