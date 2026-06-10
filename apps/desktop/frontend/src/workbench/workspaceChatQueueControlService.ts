import type {
  AgentQueueReportActionType,
  AgentQueueTask,
} from "../workspace/types";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT,
  workspaceAgentQueueCreateRequestFromDraft,
  type WorkspaceAgentQueueCreateDraft,
} from "./workspaceAgentQueueActions";

export type WorkspaceChatQueueTaskDraft = WorkspaceAgentQueueCreateDraft;

export type WorkspaceChatQueueAction =
  | {
      draft: WorkspaceChatQueueTaskDraft;
      kind: "create_task";
    }
  | {
      kind: "open_task";
      queueItemId: string;
    }
  | {
      kind: "run_task";
      queueItemId: string;
    }
  | {
      kind: "stop_task" | "cancel_task";
      queueItemId: string;
    }
  | {
      kind: "request_validation";
      queueItemId: string;
    }
  | {
      kind: "create_diff_review";
      queueItemId: string;
    }
  | {
      actionType: AgentQueueReportActionType;
      kind: "coordinator_decision";
      queueItemId: string;
    };

export type WorkspaceChatQueueActionStatus =
  | "success"
  | "unavailable"
  | "failed";

export type WorkspaceChatQueueActionResult = {
  action: WorkspaceChatQueueAction["kind"];
  message: string;
  queueItemId?: string;
  reason?: string;
  status: WorkspaceChatQueueActionStatus;
  widgetResult?: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
};

export type WorkspaceChatQueueControlService = {
  execute: (
    action: WorkspaceChatQueueAction,
  ) => Promise<WorkspaceChatQueueActionResult>;
};

export type WorkspaceChatQueueControlServiceOptions = {
  bridge?: WorkspaceAgentQueueBridge | null;
  onOpenQueueItem?: (queueItemId: string) => void;
  queue?: AgentQueueController | null;
};

export function createWorkspaceChatQueueControlService({
  bridge,
  onOpenQueueItem,
  queue,
}: WorkspaceChatQueueControlServiceOptions): WorkspaceChatQueueControlService {
  return {
    execute: (action) =>
      executeWorkspaceChatQueueAction(action, {
        bridge,
        onOpenQueueItem,
        queue,
      }),
  };
}

export function emptyWorkspaceChatQueueTaskDraft(): WorkspaceChatQueueTaskDraft {
  return { ...EMPTY_WORKSPACE_AGENT_QUEUE_CREATE_DRAFT };
}

async function executeWorkspaceChatQueueAction(
  action: WorkspaceChatQueueAction,
  options: WorkspaceChatQueueControlServiceOptions,
): Promise<WorkspaceChatQueueActionResult> {
  try {
    switch (action.kind) {
      case "create_task":
        return await createTask(action.draft, options.bridge);
      case "open_task":
        return openTask(action.queueItemId, options.onOpenQueueItem);
      case "run_task":
        return await runTask(action.queueItemId, options.queue);
      case "stop_task":
      case "cancel_task":
        return unavailable(
          action.kind,
          "Queue selected-task stop/cancel is not exposed as a typed Queue action. Use the owning Agent Executor run controls when available.",
          action.queueItemId,
        );
      case "request_validation":
        return unavailable(
          action.kind,
          "Queue validation execution is not exposed to Workspace Chat. No validation was started.",
          action.queueItemId,
        );
      case "create_diff_review":
        return await createDiffReview(action.queueItemId, options.queue);
      case "coordinator_decision":
        return await coordinatorDecision(action, options.queue);
    }
  } catch (error) {
    return failed(action.kind, errorToMessage(error), actionQueueItemId(action));
  }
}

async function createTask(
  draft: WorkspaceChatQueueTaskDraft,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
): Promise<WorkspaceChatQueueActionResult> {
  const validationReason = queueTaskDraftValidationReason(draft);
  if (validationReason) {
    return unavailable("create_task", validationReason);
  }

  if (!bridge) {
    return unavailable(
      "create_task",
      "Workspace Agent Queue bridge is unavailable. No Queue task was created.",
    );
  }

  const result = await bridge.createItem(
    workspaceAgentQueueCreateRequestFromDraft(draft),
  );

  if (!result.ok || !result.item) {
    return {
      action: "create_task",
      message: result.error?.message ?? result.message,
      reason: result.error?.message ?? result.message,
      status: "failed",
      widgetResult: result,
    };
  }

  return {
    action: "create_task",
    message: `Queue task ${result.item.id} created. It was not run.`,
    queueItemId: result.item.id,
    status: "success",
    widgetResult: result,
  };
}

function queueTaskDraftValidationReason(
  draft: WorkspaceChatQueueTaskDraft,
): string | null {
  if (!draft.title.trim()) {
    return "Queue task title is required. No Queue task was created.";
  }

  if (!draft.prompt.trim()) {
    return "Queue task prompt is required. No Queue task was created.";
  }

  return null;
}

function openTask(
  queueItemId: string,
  onOpenQueueItem: ((queueItemId: string) => void) | undefined,
): WorkspaceChatQueueActionResult {
  if (!onOpenQueueItem) {
    return unavailable(
      "open_task",
      "Queue open/select action is unavailable in this Workspace Agent surface.",
      queueItemId,
    );
  }

  onOpenQueueItem(queueItemId);

  return {
    action: "open_task",
    message: `Open Queue task request sent for ${queueItemId}.`,
    queueItemId,
    status: "success",
  };
}

async function runTask(
  queueItemId: string,
  queue: AgentQueueController | null | undefined,
): Promise<WorkspaceChatQueueActionResult> {
  const selectedCheck = selectedTaskActionCheck(queueItemId, queue);

  if (selectedCheck) {
    return selectedCheck;
  }

  if (!queue?.run.canStart) {
    return unavailable(
      "run_task",
      queue?.run.readinessMessage ??
        queue?.run.preconditionMessages[0] ??
        "Queue run action is unavailable for the selected task.",
      queueItemId,
    );
  }

  queue.run.onStartAssignedTask();

  return {
    action: "run_task",
    message: `Explicit Queue run request sent for ${queueItemId}.`,
    queueItemId,
    status: "success",
  };
}

async function createDiffReview(
  queueItemId: string,
  queue: AgentQueueController | null | undefined,
): Promise<WorkspaceChatQueueActionResult> {
  const selectedCheck = selectedTaskActionCheck(queueItemId, queue);

  if (selectedCheck) {
    return selectedCheckFor("create_diff_review", selectedCheck);
  }

  if (!queue?.diffReview.canCreate) {
    return unavailable(
      "create_diff_review",
      queue?.diffReview.message ??
        "Diff Review task creation is unavailable for the selected Queue task.",
      queueItemId,
    );
  }

  queue.diffReview.onCreate();

  return {
    action: "create_diff_review",
    message: `Diff Review Queue task creation requested for ${queueItemId}. It was not run.`,
    queueItemId,
    status: "success",
  };
}

async function coordinatorDecision(
  action: Extract<WorkspaceChatQueueAction, { kind: "coordinator_decision" }>,
  queue: AgentQueueController | null | undefined,
): Promise<WorkspaceChatQueueActionResult> {
  const selectedCheck = selectedTaskActionCheck(action.queueItemId, queue);

  if (selectedCheck) {
    return selectedCheckFor("coordinator_decision", selectedCheck);
  }

  if (!queue?.coordinatorFinalization.canAct) {
    return unavailable(
      "coordinator_decision",
      queue?.coordinatorFinalization.message ??
        "Coordinator decision actions are unavailable for the selected Queue task.",
      action.queueItemId,
    );
  }

  const handler = coordinatorDecisionHandler(action.actionType, queue);

  if (!handler) {
    return unavailable(
      "coordinator_decision",
      `Coordinator decision ${action.actionType} is not exposed by the existing Queue action surface.`,
      action.queueItemId,
    );
  }

  handler();

  return {
    action: "coordinator_decision",
    message: `Coordinator decision ${action.actionType} requested for ${action.queueItemId}.`,
    queueItemId: action.queueItemId,
    status: "success",
  };
}

function selectedTaskActionCheck(
  queueItemId: string,
  queue: AgentQueueController | null | undefined,
): WorkspaceChatQueueActionResult | null {
  if (!queue) {
    return unavailable(
      "run_task",
      "Queue controller actions are unavailable in this Workspace Agent surface.",
      queueItemId,
    );
  }

  if (!isSelectedTask(queue.selectedTask, queueItemId)) {
    return unavailable(
      "run_task",
      "Select or open this Queue task before applying selected-task actions.",
      queueItemId,
    );
  }

  return null;
}

function selectedCheckFor(
  action: WorkspaceChatQueueAction["kind"],
  result: WorkspaceChatQueueActionResult,
): WorkspaceChatQueueActionResult {
  return {
    ...result,
    action,
  };
}

function coordinatorDecisionHandler(
  actionType: AgentQueueReportActionType,
  queue: AgentQueueController,
): (() => void) | null {
  switch (actionType) {
    case "accept_without_commit":
      return queue.coordinatorFinalization.onAcceptWithoutCommit;
    case "create_follow_up":
      return queue.coordinatorFinalization.onCreateFollowUp;
    case "finalize_accept_item":
      return queue.coordinatorFinalization.onFinalize;
    case "mark_blocked":
      return queue.coordinatorFinalization.onMarkBlocked;
    case "mark_failed_rejected":
      return queue.coordinatorFinalization.onMarkFailedRejected;
    case "mark_follow_up_required":
      return queue.coordinatorFinalization.onMarkFollowUpRequired;
    case "mark_needs_changes":
      return queue.coordinatorFinalization.onMarkNeedsChanges;
    case "mark_ready_for_finalization":
      return queue.coordinatorFinalization.onMarkReadyForFinalization;
    case "mark_rollback_required":
      return queue.coordinatorFinalization.onMarkRollbackRequired;
    default:
      return null;
  }
}

function isSelectedTask(task: AgentQueueTask | null, queueItemId: string) {
  return task?.queueItemId === queueItemId;
}

function unavailable(
  action: WorkspaceChatQueueAction["kind"],
  reason: string,
  queueItemId?: string,
): WorkspaceChatQueueActionResult {
  return {
    action,
    message: reason,
    queueItemId,
    reason,
    status: "unavailable",
  };
}

function failed(
  action: WorkspaceChatQueueAction["kind"],
  message: string,
  queueItemId?: string,
): WorkspaceChatQueueActionResult {
  return {
    action,
    message,
    queueItemId,
    reason: message,
    status: "failed",
  };
}

function actionQueueItemId(action: WorkspaceChatQueueAction) {
  return "queueItemId" in action ? action.queueItemId : undefined;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Queue action failed visibly. No hidden work ran.";
}
