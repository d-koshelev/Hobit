import type { AgentQueueTask } from "../../workspace/types";
import { normalizeCoordinatorStatus } from "../agentQueueTaskUiModel";
import type { QueueNextAction } from "./queueV2NextActionModel";
import type { QueueTaskViewModel } from "./queueV2ViewModel";

export function queueV2ReviewActionHintForTask(
  task: AgentQueueTask,
): "request_changes" | "create_follow_up" | null {
  switch (normalizeCoordinatorStatus(task.coordinatorStatus)) {
    case "needs_changes":
      return "request_changes";
    case "follow_up_required":
      return "create_follow_up";
    default:
      return null;
  }
}

export function secondaryActionsForTask(
  viewModel: QueueTaskViewModel,
): QueueNextAction[] {
  if (
    viewModel.lifecycle === "report_ready" ||
    viewModel.lifecycle === "review_required"
  ) {
    return ["accept_result", "request_changes", "create_follow_up", "reject_result"];
  }

  if (viewModel.lifecycle === "failed") {
    return ["review_report", "retry_or_rerun"];
  }

  return [];
}
