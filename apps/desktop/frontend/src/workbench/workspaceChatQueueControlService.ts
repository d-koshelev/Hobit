import type {
  AgentQueueReportActionType,
  AgentQueueTask,
} from "../workspace/types";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import {
  requestValidationForQueueItem,
  type QueueValidationRunResult,
} from "./queue/queueValidationEvidenceService";
import {
  canCreateDiffReviewItem,
  latestWorkerExecutionReport,
} from "./queue/agentQueueDiffReviewModel";
import {
  createDiffReviewQueueItem,
  type DiffReviewQueueItemCreationWarning,
  type DiffReviewQueueItemCreationResult,
} from "./diffReview";
import type {
  ValidationRunner,
  ValidationRunRequest,
} from "./validation";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import { coordinatorDecisionThroughQueueBridge } from "./workspaceChatQueueFinalizationActions";
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
      request: ValidationRunRequest;
      queueItemId: string;
    }
  | {
      kind: "create_diff_review";
      queueItemId: string;
    }
  | {
      actionType: AgentQueueReportActionType;
      decisionInput?: WorkspaceChatCoordinatorDecisionInput;
      kind: "coordinator_decision";
      queueItemId: string;
    };

export type WorkspaceChatQueueActionStatus =
  | "success"
  | "unavailable"
  | "failed";

export type WorkspaceChatQueueActionResult = {
  action: WorkspaceChatQueueAction["kind"];
  coordinatorFinalization?: WorkspaceChatCoordinatorDecisionResult;
  diffReviewCreation?: WorkspaceChatDiffReviewCreationResult;
  message: string;
  queueItemId?: string;
  reason?: string;
  status: WorkspaceChatQueueActionStatus;
  validationResult?: QueueValidationRunResult;
  widgetResult?: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
};

export type WorkspaceChatCoordinatorDecisionInput = {
  commitHash?: string;
  commitTitle?: string;
  decision?: "accepted_with_commit" | "accepted_without_commit";
  expectedCommitTitle?: string;
  noCommitReason?: string;
  operatorNote?: string;
};

export type WorkspaceChatCoordinatorDecisionResult = {
  commitHash: string | null;
  commitTitle: string | null;
  decisionApplied: string;
  dependencyGateSummary: string;
  dependents: Array<{
    dependentItemId: string;
    ready: boolean;
    summary: string;
  }>;
  nextAction: string;
  warnings: string[];
};

export type WorkspaceChatDiffReviewCreationResult = {
  createdReviewTaskId: string | null;
  createdReviewTaskTitle: string | null;
  sourceTaskId: string;
  warnings: DiffReviewQueueItemCreationWarning[];
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
  validationRunner?: ValidationRunner | null;
};

export function createWorkspaceChatQueueControlService({
  bridge,
  onOpenQueueItem,
  queue,
  validationRunner,
}: WorkspaceChatQueueControlServiceOptions): WorkspaceChatQueueControlService {
  return {
    execute: (action) =>
      executeWorkspaceChatQueueAction(action, {
        bridge,
        onOpenQueueItem,
        queue,
        validationRunner,
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
        return await requestValidation(action, options);
      case "create_diff_review":
        return await createDiffReview(action, options);
      case "coordinator_decision":
        return await coordinatorDecision(action, options);
    }
  } catch (error) {
    return failed(action.kind, errorToMessage(error), actionQueueItemId(action));
  }
}

async function createDiffReview(
  action: Extract<WorkspaceChatQueueAction, { kind: "create_diff_review" }>,
  options: WorkspaceChatQueueControlServiceOptions,
): Promise<WorkspaceChatQueueActionResult> {
  if (!options.bridge) {
    return unavailable(
      "create_diff_review",
      "Workspace Agent Queue bridge is unavailable. No Diff Review Queue item was created.",
      action.queueItemId,
    );
  }

  const sourceTask = findQueueTask(action.queueItemId, options.queue);
  if (!sourceTask) {
    return unavailable(
      "create_diff_review",
      "Source Queue task is unavailable in the current Queue controller state. No Diff Review Queue item was created.",
      action.queueItemId,
    );
  }

  if (!canCreateDiffReviewItem(sourceTask)) {
    return unavailable(
      "create_diff_review",
      "Source Queue task is not ready for Diff Review creation. No Diff Review Queue item was created.",
      action.queueItemId,
    );
  }

  const result = await createDiffReviewQueueItem({
    createItem: options.bridge.createItem,
    dependentTasks: (options.queue?.tasks ?? []).filter((task) =>
      (task.dependsOn ?? []).includes(sourceTask.queueItemId),
    ),
    report: latestWorkerExecutionReport(sourceTask),
    sourceTask,
  });

  return diffReviewCreationActionResult(result);
}

function diffReviewCreationActionResult(
  result: DiffReviewQueueItemCreationResult,
): WorkspaceChatQueueActionResult {
  const warningSummary = result.warnings.length
    ? ` Warnings: ${result.warnings.map((warning) => warning.message).join(" ")}`
    : "";

  if (result.status !== "created" || !result.createdReviewTaskId) {
    return {
      action: "create_diff_review",
      diffReviewCreation: {
        createdReviewTaskId: result.createdReviewTaskId,
        createdReviewTaskTitle: result.createdReviewTaskTitle,
        sourceTaskId: result.sourceTaskId,
        warnings: result.warnings,
      },
      message:
        result.createResult.error?.message ??
        `Diff Review Queue item could not be created.${warningSummary}`,
      queueItemId: result.sourceTaskId,
      reason: result.warnings[0]?.message ?? result.createResult.error?.message,
      status: "failed",
      widgetResult: result.createResult,
    };
  }

  return {
    action: "create_diff_review",
    diffReviewCreation: {
      createdReviewTaskId: result.createdReviewTaskId,
      createdReviewTaskTitle: result.createdReviewTaskTitle,
      sourceTaskId: result.sourceTaskId,
      warnings: result.warnings,
    },
    message: `Diff Review Queue item ${result.createdReviewTaskId} created. It was not run.${warningSummary}`,
    queueItemId: result.createdReviewTaskId,
    status: "success",
    widgetResult: result.createResult,
  };
}

async function requestValidation(
  action: Extract<WorkspaceChatQueueAction, { kind: "request_validation" }>,
  options: WorkspaceChatQueueControlServiceOptions,
): Promise<WorkspaceChatQueueActionResult> {
  if (!options.validationRunner) {
    return unavailable(
      "request_validation",
      "Validation runner is unavailable in this Workspace Chat surface. No validation was started.",
      action.queueItemId,
    );
  }

  if (!options.bridge) {
    return unavailable(
      "request_validation",
      "Queue update bridge is unavailable, so validation evidence cannot be attached. No validation was started.",
      action.queueItemId,
    );
  }

  const result = await requestValidationForQueueItem({
    queueApi: {
      getSnapshot: (request) => {
        const { workspaceId: _workspaceId, ...rest } = request ?? {};
        return options.bridge!.getSnapshot(rest);
      },
      updateItem: (request) => {
        const { workspaceId: _workspaceId, ...rest } = request;
        return options.bridge!.updateItem(rest);
      },
    },
    request: action.request,
    runner: options.validationRunner,
  });
  const summary = result.runnerOutput.summary;
  const status = result.runnerOutput.unavailable
    ? "unavailable"
    : summary.status === "passed"
      ? "success"
      : "failed";

  return {
    action: "request_validation",
    message: result.runnerOutput.unavailable
      ? `Validation unavailable: ${summary.summary || result.runnerOutput.result.errors[0] || "runner unavailable"}.`
      : `Validation ${summary.status}: ${summary.summary || "no command summary available"}.`,
    queueItemId: action.queueItemId,
    reason: status === "success" ? undefined : summary.errors[0] ?? summary.warnings[0],
    status,
    validationResult: result,
    widgetResult: result.attachment.updateResult ?? undefined,
  };
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

async function coordinatorDecision(
  action: Extract<WorkspaceChatQueueAction, { kind: "coordinator_decision" }>,
  options: WorkspaceChatQueueControlServiceOptions,
): Promise<WorkspaceChatQueueActionResult> {
  const { bridge, queue } = options;
  const selectedCheck = selectedTaskActionCheck(action.queueItemId, queue);

  if (selectedCheck) {
    return selectedCheckFor("coordinator_decision", selectedCheck);
  }

  if (bridge) {
    const task = findQueueTask(action.queueItemId, queue);
    const result = task
      ? await coordinatorDecisionThroughQueueBridge({
          actionType: action.actionType,
          bridge,
          decisionInput: action.decisionInput,
          queueItemId: action.queueItemId,
          task,
          tasks: queue?.tasks ?? [task],
        })
      : null;

    if (result) {
      return result;
    }
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

function findQueueTask(
  queueItemId: string,
  queue: AgentQueueController | null | undefined,
) {
  if (queue?.selectedTask?.queueItemId === queueItemId) {
    return queue.selectedTask;
  }

  return queue?.tasks?.find((task) => task.queueItemId === queueItemId) ?? null;
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
