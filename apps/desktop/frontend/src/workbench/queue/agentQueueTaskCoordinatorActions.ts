import type {
  AgentQueueCoordinatorStatus,
  AgentQueueReportActionType,
  AgentQueueTask,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
} from "../../workspace/types";
import { DEFAULT_TASK_TITLE } from "../agentQueueTaskUiModel";

export function coordinatorDecisionForAction(
  actionType: AgentQueueReportActionType,
):
  | {
      coordinatorStatus: AgentQueueCoordinatorStatus;
      message: string;
      status: AgentQueueTaskStatus;
      validationStatus: AgentQueueTaskValidationStatus;
    }
  | null {
  switch (actionType) {
    case "mark_ready_for_finalization":
      return {
        coordinatorStatus: "ready_for_finalization",
        message:
          "Marked ready for coordinator finalization. No dependent item was started.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "finalize_accept_item":
      return {
        coordinatorStatus: "finalized",
        message:
          "Finalized / accepted by coordinator. This action did not auto-accept other work; an active Autonomous Queue may re-evaluate eligible dependencies.",
        status: "completed",
        validationStatus: "passed",
      };
    case "mark_needs_changes":
      return {
        coordinatorStatus: "needs_changes",
        message:
          "Marked needs changes. Dependencies remain blocked; create a follow-up when ready.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_follow_up_required":
      return {
        coordinatorStatus: "follow_up_required",
        message:
          "Marked follow-up required. Dependencies remain blocked until reviewed and accepted.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_blocked":
      return {
        coordinatorStatus: "blocked",
        message:
          "Marked blocked by coordinator. The item remains visible and no follow-up was auto-run.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_failed_rejected":
      return {
        coordinatorStatus: "failed",
        message:
          "Marked failed / rejected by coordinator. Evidence is preserved and rollback was not executed.",
        status: "failed",
        validationStatus: "failed",
      };
    case "mark_rollback_required":
      return {
        coordinatorStatus: "rollback_required",
        message:
          "Marked rollback required as a coordinator decision marker only. No rollback, git reset, or process kill ran.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    default:
      return null;
  }
}

export function followUpPromptFromTask(task: AgentQueueTask) {
  const report = task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ];

  return [
    `Follow-up/sub-block for Queue item ${task.queueItemId}.`,
    "",
    `Source title: ${task.title.trim() || DEFAULT_TASK_TITLE}`,
    `Source status: ${task.status}`,
    `Coordinator decision: follow-up required`,
    report ? `Source report: ${report.reportId}` : null,
    report?.summary ? `Report summary: ${report.summary}` : null,
    report?.followUpRecommendation
      ? `Follow-up recommendation: ${report.followUpRecommendation}`
      : "Follow-up recommendation: coordinator requested changes before finalization.",
    "",
    "Do not run automatically. Complete this focused sub-block and return it for coordinator review.",
  ]
    .filter(Boolean)
    .join("\n");
}
