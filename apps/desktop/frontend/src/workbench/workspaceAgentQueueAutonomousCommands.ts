import { autonomousResultMessage } from "./workspaceAgentQueueCommandFormatting";
import { errorToMessage } from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export async function runAutonomousQueue(bridge: WorkspaceAgentQueueBridge) {
  if (!bridge.runAutonomousQueue) {
    return "Autonomous Queue could not start: Queue autonomous controls are unavailable.";
  }

  try {
    return autonomousResultMessage(
      await bridge.runAutonomousQueue(),
      "Autonomous Queue started.",
      "Autonomous Queue could not start",
    );
  } catch (error) {
    return `Autonomous Queue could not start: ${errorToMessage(error)}`;
  }
}

export async function stopAutonomousQueueAfterCurrent(
  bridge: WorkspaceAgentQueueBridge,
) {
  if (!bridge.stopAutonomousQueueAfterCurrent) {
    return "Autonomous Queue could not stop: Queue autonomous controls are unavailable.";
  }

  try {
    return autonomousResultMessage(
      await bridge.stopAutonomousQueueAfterCurrent(),
      "Autonomous Queue will stop after the current task.",
      "Autonomous Queue could not stop",
    );
  } catch (error) {
    return `Autonomous Queue could not stop: ${errorToMessage(error)}`;
  }
}
