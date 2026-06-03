import type { QueueWidgetItemSnapshot } from "./queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueActionCardResult } from "./workspaceAgentQueueActions";

export const WORKSPACE_AGENT_QUEUE_SAFE_RESULT_NOTE =
  "Result is a safe Queue API summary. No execution, delete, Queue Autorun, Codex run, Terminal command, Git mutation, or coordinator finalization was started.";

export const WORKSPACE_AGENT_QUEUE_APPLY_DRAFT_NOTE =
  "Applying uses the Queue Widget API bridge only. It does not run the task, start Queue Autorun, call Codex, launch Terminal, delete items, or finalize coordinator state.";

export function queueItemFromActionResult(
  item: WorkspaceAgentQueueActionCardResult["item"],
): QueueWidgetItemSnapshot | null {
  if (item && "queueTag" in item && "status" in item) {
    return item;
  }

  return null;
}

export function workspaceAgentQueueAutorunLabel(
  snapshot: NonNullable<WorkspaceAgentQueueActionCardResult["snapshot"]>,
) {
  if (!snapshot.autonomousRunnerState.available) {
    return "Unavailable";
  }

  return `${snapshot.autonomousRunnerState.status}${
    snapshot.autonomousRunnerState.isSessionOnly ? " session-only" : ""
  }`;
}
