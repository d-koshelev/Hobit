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
  | "files-validation";

type QueueV2TaskDetailsActionId =
  | "refresh"
  | "new-task"
  | "set-workspace"
  | "enable-queue"
  | "promote"
  | "run"
  | "view-report"
  | "attach-report"
  | "accept-without-commit"
  | "finalize"
  | "request-changes"
  | "create-follow-up";

export type QueueV2TaskDetailsAction = {
  disabled: boolean;
  id: QueueV2TaskDetailsActionId;
  label: string;
  onClick: () => void;
  reason: string | undefined;
  technicalReason?: string | undefined;
  variant: "primary" | "secondary" | "ghost";
};

export function buildQueueV2TaskDetailsActions({
  currentWorkspaceRoot,
  inspector,
  onRequestNewTask,
  onSelectTab,
  queue,
  task,
}: {
  currentWorkspaceRoot?: string | null;
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
  const selectionTechnicalReason = selectedTaskMismatch
    ? "The selected task does not match the task driving controller actions."
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
      technicalReason: queue?.apiAvailable
        ? undefined
        : "Queue API bridge callbacks are not injected, so refresh is unavailable in this surface.",
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
      technicalReason: !queue?.apiAvailable
        ? "Task creation callbacks are not wired in this Queue surface."
        : queue?.isLoading
          ? "Queue task list loading has not completed yet."
          : queue?.isCreating
            ? "A create action is already in-flight."
            : undefined,
      variant: "secondary",
    });
  }

  if (task.status === "draft") {
    actions.push({
      disabled:
        !hasQueueController ||
        selectedTaskMismatch ||
        !Boolean(queue?.draftPromotion?.canPromote),
      id: "promote",
      label: queue?.draftPromotion?.isPromoting
        ? "Queuing"
        : "Queue for run",
      onClick: () => queue?.draftPromotion?.onPromote(),
      reason:
        selectionReason ??
        (!hasQueueController
          ? "Queue task update actions are not wired in this view."
          : queue?.draftPromotion?.canPromote
            ? undefined
            : "Save or cancel task edits before queuing this draft."),
      technicalReason:
        selectionTechnicalReason ??
        (!hasQueueController
          ? "Draft promotion requires the Queue task update bridge."
          : queue?.draftPromotion?.canPromote
            ? undefined
            : "Current task draft is not editable into queue state yet."),
      variant: "primary",
    });
  }

  if (!hasExecutionWorkspace(task)) {
    const workspaceRoot = normalizedWorkspaceRoot(currentWorkspaceRoot);

    actions.push({
      disabled:
        !hasQueueController ||
        selectedTaskMismatch ||
        !workspaceRoot ||
        Boolean(queue?.run.isStarting),
      id: "set-workspace",
      label: "Set task workspace",
      onClick: () => {
        if (workspaceRoot) {
          queue?.run.onRepoRootDraftChange(workspaceRoot);
        }
      },
      reason:
        selectionReason ??
        (!hasQueueController
          ? "Queue task update actions are not wired in this view."
          : !workspaceRoot
            ? "Current Workspace root is unavailable. Open a Workspace root before setting this task workspace."
            : queue?.run.isStarting
              ? "Queue task is currently starting."
              : undefined),
      technicalReason:
        selectionTechnicalReason ??
        (!hasQueueController
          ? "Task update actions require queue run controller callbacks."
          : !workspaceRoot
            ? "The popup lacks a usable workspace root to set this task field."
            : queue?.run.isStarting
              ? "Queue run state indicates startup flow in progress."
              : undefined),
      variant: "secondary",
    });
  }

  if (isEnableQueueActionRelevant(inspector)) {
    const missingCodex = !hasCodexExecutable(task);

    actions.push({
      disabled:
        !hasQueueController ||
        selectedTaskMismatch ||
        missingCodex ||
        queue?.foundation.globalExecutionState === "started",
      id: "enable-queue",
      label: "Enable Queue",
      onClick: () => queue?.foundation.onStartWorkers(),
      reason:
        selectionReason ??
        (!hasQueueController
          ? "Queue control actions are not wired in this view."
          : missingCodex
            ? "Set Codex executable before enabling Queue for this task."
            : queue?.foundation.globalExecutionState === "started"
              ? "Queue is already enabled."
              : undefined),
      technicalReason:
        selectionTechnicalReason ??
        (!hasQueueController
          ? "Foundation queue control callbacks are not wired."
          : missingCodex
            ? "Task-level execution settings are missing codex executable."
            : queue?.foundation.globalExecutionState === "started"
              ? "Foundation already reports running scheduler state."
              : undefined),
      variant: "primary",
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
      technicalReason:
        selectionTechnicalReason ??
        (!hasQueueController
          ? "Run callbacks are not available for this task in this surface."
          : queue?.run.canStart
            ? undefined
            : queue?.run.readinessMessage ??
              queue?.run.preconditionMessages[0] ??
              "Runtime checks in the controller blocked direct run."),
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
        !Boolean(queue?.workerReport?.canAttach),
      id: "attach-report",
      label: "Attach report",
      onClick: () => queue?.workerReport?.onAttachDemoReport(),
      reason:
        selectionReason ??
        (!hasQueueController
          ? "Queue report attachment is not wired in this view."
          : queue?.workerReport?.canAttach
            ? undefined
            : queue?.workerReport?.message ??
              "Attach report is unavailable until report evidence exists."),
      technicalReason:
        selectionReason ??
        (!hasQueueController
          ? "Report attachment depends on a live Queue worker report controller bridge."
          : queue?.workerReport?.canAttach
            ? undefined
            : queue?.workerReport?.message ??
              "Report attachment is blocked until a worker report is attached to this task."),
      variant: "secondary",
    });

    actions.push(...coordinatorDecisionActions(queue, selectionReason));
  }

  return actions;
}

function hasExecutionWorkspace(task: AgentQueueTask) {
  return Boolean(task.executionWorkspace?.trim());
}

function hasCodexExecutable(task: AgentQueueTask) {
  return Boolean(task.codexExecutable?.trim());
}

function normalizedWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}

function isEnableQueueActionRelevant(inspector: QueueInspectorSnapshot) {
  return inspector.blockedReasons.some((reason) => reason.code === "queue_disabled");
}

function coordinatorDecisionActions(
  queue: AgentQueueController | undefined,
  selectionReason: string | undefined,
): QueueV2TaskDetailsAction[] {
  const disabled =
    !queue ||
    Boolean(selectionReason) ||
    !queue.coordinatorFinalization?.canAct;
  const reason =
    selectionReason ??
    (!queue
      ? "Queue coordinator actions are not wired in this view."
      : queue.coordinatorFinalization?.canAct
        ? undefined
        : queue.coordinatorFinalization?.message ??
          "Coordinator decision actions are unavailable while the task is editing, saving, or creating.");
  const technicalReason =
    selectionReason ??
    (!queue
      ? "Coordinator decision controls are unavailable in this Queue runtime bridge."
      : queue.coordinatorFinalization?.canAct
        ? undefined
        : queue.coordinatorFinalization?.message ??
          "Coordinator state machine is currently blocked by edit or validation gates.");

  return [
    {
      disabled,
      id: "accept-without-commit",
      label: "Accept without commit",
      onClick: () => queue?.coordinatorFinalization?.onAcceptWithoutCommit(),
      reason,
      technicalReason,
      variant: "secondary",
    },
    {
      disabled,
      id: "finalize",
      label: "Finalize / Accept",
      onClick: () => queue?.coordinatorFinalization?.onFinalize(),
      reason,
      technicalReason,
      variant: "secondary",
    },
    {
      disabled,
      id: "request-changes",
      label: "Request changes",
      onClick: () => queue?.coordinatorFinalization?.onMarkNeedsChanges(),
      reason,
      technicalReason,
      variant: "secondary",
    },
    {
      disabled,
      id: "create-follow-up",
      label: "Create follow-up",
      onClick: () => queue?.coordinatorFinalization?.onCreateFollowUp(),
      reason,
      technicalReason,
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
