import type {
  AgentQueueReportActionType,
  AgentQueueTask,
} from "../workspace/types";
import {
  createCoordinatorFollowUp,
  finalizeQueueItemWithCoordinatorDecision,
  markQueueItemBlockedByCoordinator,
  markQueueItemRollbackRequired,
  requestQueueItemChanges,
  type QueueCoordinatorFinalizationApi,
  type QueueCoordinatorFinalizationDecision,
} from "./queue/queueCoordinatorFinalizationService";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type { WorkspaceChatQueueActionResult } from "./workspaceChatQueueControlService";

export async function coordinatorDecisionThroughQueueBridge({
  actionType,
  bridge,
  queueItemId,
  task,
  tasks,
}: {
  actionType: AgentQueueReportActionType;
  bridge: WorkspaceAgentQueueBridge;
  queueItemId: string;
  task: AgentQueueTask;
  tasks: AgentQueueTask[];
}): Promise<WorkspaceChatQueueActionResult | null> {
  if (actionType === "mark_ready_for_finalization") {
    return null;
  }

  const queueApi = queueFinalizationApiFromBridge(bridge);
  const baseInput = {
    queueApi,
    queueItemId,
    task,
    tasks,
    workspaceId: task.workspaceId,
  };
  const latestReport = latestReportForTask(task);
  const commitHash = latestReport?.commitHash;

  switch (actionType) {
    case "accept_without_commit":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          commit: {
            noCommitReason:
              "Accepted explicitly from Workspace Chat without a Queue-created commit.",
          },
          decision: "accepted_without_commit",
        }),
        queueItemId,
      );
    case "create_follow_up":
      return finalizationActionResult(
        await createCoordinatorFollowUp(baseInput),
        queueItemId,
      );
    case "finalize_accept_item":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          commit: commitForFinalizeAction({
            commitHash,
            decision: decisionForFinalizeAction(task),
          }),
          decision: decisionForFinalizeAction(task),
        }),
        queueItemId,
      );
    case "mark_blocked":
      return finalizationActionResult(
        await markQueueItemBlockedByCoordinator(baseInput),
        queueItemId,
      );
    case "mark_failed_rejected":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          decision: "failed",
        }),
        queueItemId,
      );
    case "mark_follow_up_required":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          decision: "follow_up_required",
        }),
        queueItemId,
      );
    case "mark_needs_changes":
      return finalizationActionResult(
        await requestQueueItemChanges(baseInput),
        queueItemId,
      );
    case "mark_rollback_required":
      return finalizationActionResult(
        await markQueueItemRollbackRequired(baseInput),
        queueItemId,
      );
    default:
      return null;
  }
}

function queueFinalizationApiFromBridge(
  bridge: WorkspaceAgentQueueBridge,
): QueueCoordinatorFinalizationApi {
  return {
    createItem: (request) => {
      const { workspaceId: _workspaceId, ...rest } = request;
      return bridge.createItem(rest);
    },
    updateItem: (request) => {
      const { workspaceId: _workspaceId, ...rest } = request;
      return bridge.updateItem(rest);
    },
  };
}

function decisionForFinalizeAction(
  task: AgentQueueTask,
): QueueCoordinatorFinalizationDecision {
  const latestReport = latestReportForTask(task);
  if (latestReport?.commitHash) {
    return "accepted_with_commit";
  }

  return (latestReport?.changedFiles.length ?? 0) > 0
    ? "accepted_with_commit"
    : "accepted_without_commit";
}

function commitForFinalizeAction({
  commitHash,
  decision,
}: {
  commitHash?: string;
  decision: QueueCoordinatorFinalizationDecision;
}) {
  return decision === "accepted_with_commit"
    ? commitHash
      ? { commitHash, verificationStatus: "unverified" as const }
      : undefined
    : {
        noCommitReason:
          "Accepted explicitly from Workspace Chat as no-change work.",
      };
}

function finalizationActionResult(
  result: Awaited<ReturnType<typeof finalizeQueueItemWithCoordinatorDecision>>,
  queueItemId: string,
): WorkspaceChatQueueActionResult {
  const warningSummary = result.warnings.length
    ? ` Warnings: ${result.warnings.map((warning) => warning.message).join(" ")}`
    : "";

  return {
    action: "coordinator_decision",
    message: `${result.message}${warningSummary}`,
    queueItemId,
    reason: result.updateResult.ok
      ? result.warnings[0]?.message
      : result.updateResult.error?.message,
    status: result.updateResult.ok ? "success" : "failed",
    widgetResult: result.updateResult,
  };
}

function latestReportForTask(task: AgentQueueTask) {
  return task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ] ?? null;
}
