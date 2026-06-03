import type {
  AgentQueueClosureState,
  AgentQueueCoordinatorStatus,
  AgentQueueReportActionType,
  AgentQueueTask,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
} from "../../workspace/types";
import { DEFAULT_TASK_TITLE } from "../agentQueueTaskUiModel";
import { closureStateForAcceptingReport } from "./agentQueueClosureState";

export function coordinatorDecisionForAction(
  actionType: AgentQueueReportActionType,
  task?: AgentQueueTask | null,
):
  | {
      closureState: AgentQueueClosureState;
      coordinatorStatus: AgentQueueCoordinatorStatus;
      message: string;
      status: AgentQueueTaskStatus;
      validationStatus: AgentQueueTaskValidationStatus;
    }
  | null {
  switch (actionType) {
    case "mark_ready_for_finalization":
      return {
        closureState: "closure_required",
        coordinatorStatus: "ready_for_finalization",
        message:
          "Marked ready for coordinator finalization. No dependent item was started.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "finalize_accept_item":
      if (task) {
        const closureState = closureStateForAcceptingReport(task);

        if (closureState === "commit_required") {
          return {
            closureState,
            coordinatorStatus: "ready_for_finalization",
            message:
              "Closure requires an explicit commit. No commit was created and the Queue item was not finalized.",
            status: "review_needed",
            validationStatus: "needs_review",
          };
        }

        return {
          closureState,
          coordinatorStatus: "finalized",
          message:
            closureState === "commit_created"
              ? "Finalized / accepted by coordinator with an existing commit reference. No commit was created by Queue."
              : "Finalized / accepted by coordinator as no-change work. No commit was created.",
          status: "completed",
          validationStatus: "passed",
        };
      }

      return {
        closureState: "no_change_accepted",
        coordinatorStatus: "finalized",
        message:
          "Finalized / accepted by coordinator. This action did not auto-accept other work; an active Autonomous Queue may re-evaluate eligible dependencies.",
        status: "completed",
        validationStatus: "passed",
      };
    case "accept_without_commit": {
      const closureState = task
        ? closureStateForAcceptingReport(task)
        : "no_change_accepted";

      if (closureState !== "no_change_accepted") {
        return {
          closureState,
          coordinatorStatus: "ready_for_finalization",
          message:
            "Accept without commit requires a no-change report. No commit was created and the Queue item was not finalized.",
          status: "review_needed",
          validationStatus: "needs_review",
        };
      }

      return {
        closureState: "no_change_accepted",
        coordinatorStatus: "finalized",
        message:
          "No file changes; no commit created. Queue item finalized / accepted and evidence was preserved.",
        status: "completed",
        validationStatus: "passed",
      };
    }
    case "mark_needs_changes":
      return {
        closureState: "closure_blocked",
        coordinatorStatus: "needs_changes",
        message:
          "Marked needs changes. Dependencies remain blocked; create a follow-up when ready.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_follow_up_required":
      return {
        closureState: "closure_blocked",
        coordinatorStatus: "follow_up_required",
        message:
          "Marked follow-up required. Dependencies remain blocked until reviewed and accepted.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_blocked":
      return {
        closureState: "closure_blocked",
        coordinatorStatus: "blocked",
        message:
          "Marked blocked by coordinator. The item remains visible and no follow-up was auto-run.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_failed_rejected":
      return {
        closureState: "closure_blocked",
        coordinatorStatus: "failed",
        message:
          "Marked failed / rejected by coordinator. Evidence is preserved and rollback was not executed.",
        status: "failed",
        validationStatus: "failed",
      };
    case "mark_rollback_required":
      return {
        closureState: "closure_blocked",
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
