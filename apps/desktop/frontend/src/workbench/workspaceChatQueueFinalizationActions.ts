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
import type {
  WorkspaceChatCoordinatorDecisionInput,
  WorkspaceChatQueueActionResult,
} from "./workspaceChatQueueControlService";

export async function coordinatorDecisionThroughQueueBridge({
  actionType,
  bridge,
  decisionInput,
  queueItemId,
  task,
  tasks,
}: {
  actionType: AgentQueueReportActionType;
  bridge: WorkspaceAgentQueueBridge;
  decisionInput?: WorkspaceChatCoordinatorDecisionInput;
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
              decisionInput?.noCommitReason ??
              "Accepted explicitly from Workspace Chat without a Queue-created commit.",
          },
          decision: "accepted_without_commit",
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "create_follow_up":
      return finalizationActionResult(
        await createCoordinatorFollowUp({
          ...baseInput,
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "finalize_accept_item":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          commit: commitForFinalizeAction({
            commitHash,
            decisionInput,
            decision: decisionForFinalizeAction(task, decisionInput),
          }),
          decision: decisionForFinalizeAction(task, decisionInput),
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "mark_blocked":
      return finalizationActionResult(
        await markQueueItemBlockedByCoordinator({
          ...baseInput,
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "mark_failed_rejected":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          decision: "failed",
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "mark_follow_up_required":
      return finalizationActionResult(
        await finalizeQueueItemWithCoordinatorDecision({
          ...baseInput,
          decision: "follow_up_required",
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "mark_needs_changes":
      return finalizationActionResult(
        await requestQueueItemChanges({
          ...baseInput,
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
        queueItemId,
      );
    case "mark_rollback_required":
      return finalizationActionResult(
        await markQueueItemRollbackRequired({
          ...baseInput,
          operatorNote: decisionInput?.operatorNote,
        }),
        decisionInput,
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
  decisionInput?: WorkspaceChatCoordinatorDecisionInput,
): QueueCoordinatorFinalizationDecision {
  if (decisionInput?.decision === "accepted_with_commit") {
    return "accepted_with_commit";
  }

  if (decisionInput?.decision === "accepted_without_commit") {
    return "accepted_without_commit";
  }

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
  decisionInput,
  decision,
}: {
  commitHash?: string;
  decisionInput?: WorkspaceChatCoordinatorDecisionInput;
  decision: QueueCoordinatorFinalizationDecision;
}) {
  const resolvedCommitHash = decisionInput?.commitHash?.trim() || commitHash;

  return decision === "accepted_with_commit"
    ? resolvedCommitHash
      ? {
          commitHash: resolvedCommitHash,
          commitTitle: decisionInput?.commitTitle?.trim() || undefined,
          expectedCommitTitle:
            decisionInput?.expectedCommitTitle?.trim() || undefined,
          verificationStatus: "unverified" as const,
        }
      : undefined
    : {
        noCommitReason: decisionInput?.noCommitReason ??
          "Accepted explicitly from Workspace Chat as no-change work.",
      };
}

function finalizationActionResult(
  result: Awaited<ReturnType<typeof finalizeQueueItemWithCoordinatorDecision>>,
  decisionInput: WorkspaceChatCoordinatorDecisionInput | undefined,
  queueItemId: string,
): WorkspaceChatQueueActionResult {
  const warningSummary = result.warnings.length
    ? ` Warnings: ${result.warnings.map((warning) => warning.message).join(" ")}`
    : "";

  return {
    action: "coordinator_decision",
    coordinatorFinalization: {
      commitHash: result.report.commitHash ?? decisionInput?.commitHash ?? null,
      commitTitle: decisionInput?.commitTitle ?? null,
      decisionApplied: result.report.summary,
      dependencyGateSummary: result.dependencyGate.summary,
      dependents: result.dependencyGate.dependents.map((dependent) => ({
        dependentItemId: dependent.dependentItemId,
        ready: dependent.ready,
        summary: dependent.summary,
      })),
      nextAction: nextActionForFinalizationResult(result),
      warnings: result.warnings.map((warning) => warning.message),
    },
    message: `${result.message}${warningSummary}`,
    queueItemId,
    reason: result.updateResult.ok
      ? result.warnings[0]?.message
      : result.updateResult.error?.message,
    status: result.updateResult.ok ? "success" : "failed",
    widgetResult: result.updateResult,
  };
}

function nextActionForFinalizationResult(
  result: Awaited<ReturnType<typeof finalizeQueueItemWithCoordinatorDecision>>,
) {
  if (!result.updateResult.ok) {
    return "Review the visible Queue update failure and retry the decision.";
  }

  if (result.decisionState.coordinatorStatus === "finalized") {
    return result.dependencyGate.dependents.length
      ? "Review dependency-ready dependents manually; no dependent task was started."
      : "No follow-up action is required by this Queue item.";
  }

  if (result.decisionState.coordinatorStatus === "needs_changes") {
    return "Create or run a follow-up only through explicit Queue controls.";
  }

  if (result.decisionState.coordinatorStatus === "rollback_required") {
    return "Plan rollback manually; this decision did not run rollback.";
  }

  return "Review the recorded coordinator state before starting more work.";
}

function latestReportForTask(task: AgentQueueTask) {
  return task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ] ?? null;
}
