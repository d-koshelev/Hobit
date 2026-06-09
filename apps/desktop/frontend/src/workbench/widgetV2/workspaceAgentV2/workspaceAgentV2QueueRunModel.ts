import type {
  QueueWidgetItemSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";
import type {
  WorkspaceAgentV2QueueRunResult,
  WorkspaceAgentV2QueueRunUnsupportedResult,
} from "./workspaceAgentV2QueueRunService";

export type WorkspaceAgentV2QueueRunStatus =
  | "idle"
  | "preparing"
  | "creating_task"
  | "attaching_context"
  | "created"
  | "failed"
  | "unsupported";

export type WorkspaceAgentV2QueueRunCreatedTask = {
  readonly id: string;
  readonly status: QueueWidgetItemSnapshot["status"];
  readonly title: string;
};

export type WorkspaceAgentV2QueueRunOpenTaskAction = {
  readonly action: "queue.selectItem";
  readonly queueItemId: string;
  readonly title: string;
};

export type WorkspaceAgentV2QueueRunControllerResult = {
  readonly attachedContextCount: number;
  readonly createdTask?: WorkspaceAgentV2QueueRunCreatedTask;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly message: string;
  readonly ok: boolean;
  readonly openTaskAction?: WorkspaceAgentV2QueueRunOpenTaskAction;
  readonly status: Extract<
    WorkspaceAgentV2QueueRunStatus,
    "created" | "failed" | "unsupported"
  >;
  readonly warnings: readonly string[];
};

export function workspaceAgentV2QueueRunResultFromService(
  result: WorkspaceAgentV2QueueRunResult,
): WorkspaceAgentV2QueueRunControllerResult {
  if (result.status === "created") {
    return {
      attachedContextCount: result.visibleContextRefs.length,
      createdTask: {
        id: result.createdItem.id,
        status: result.createdItem.status,
        title: result.createdItem.title,
      },
      message: result.message,
      ok: true,
      openTaskAction: {
        action: "queue.selectItem",
        queueItemId: result.createdItem.id,
        title: result.createdItem.title,
      },
      status: "created",
      warnings: [
        result.safetyMessage,
        ...contextAttachmentWarnings(result.visibleContextRefs.length),
      ],
    };
  }

  if (result.status === "failed") {
    return {
      attachedContextCount: result.visibleContextRefs.length,
      errorCode: result.errorCode,
      errorMessage: result.queueCreateResult.error?.message ?? result.message,
      message: result.message,
      ok: false,
      status: "failed",
      warnings: contextAttachmentWarnings(result.visibleContextRefs.length),
    };
  }

  return unsupportedControllerResult(result);
}

export function unsupportedControllerResult(
  result: WorkspaceAgentV2QueueRunUnsupportedResult,
): WorkspaceAgentV2QueueRunControllerResult {
  return {
    attachedContextCount: 0,
    errorCode: result.code,
    errorMessage: result.message,
    message: result.message,
    ok: false,
    status: "unsupported",
    warnings: [],
  };
}

export function failedControllerResult({
  attachedContextCount = 0,
  errorMessage,
}: {
  readonly attachedContextCount?: number;
  readonly errorMessage: string;
}): WorkspaceAgentV2QueueRunControllerResult {
  return {
    attachedContextCount,
    errorMessage,
    message: errorMessage,
    ok: false,
    status: "failed",
    warnings: contextAttachmentWarnings(attachedContextCount),
  };
}

export function isWorkspaceAgentV2QueueRunBusy(
  status: WorkspaceAgentV2QueueRunStatus,
) {
  return (
    status === "preparing" ||
    status === "attaching_context" ||
    status === "creating_task"
  );
}

function contextAttachmentWarnings(attachedContextCount: number) {
  if (attachedContextCount > 0) {
    return [
      "Visible context refs were recorded on the Queue task description only; no hidden context was attached.",
    ];
  }

  return ["No visible context refs were attached to this Queue task."];
}
