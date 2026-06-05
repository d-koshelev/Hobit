import {
  runAutonomousQueue,
  stopAutonomousQueueAfterCurrent,
} from "./workspaceAgentQueueAutonomousCommands";
import { runQueueCommandBatch } from "./workspaceAgentQueueBatchCommandExecutor";
import { queueSummary } from "./workspaceAgentQueueCommandFormatting";
import { parseWorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandParser";
import type {
  WorkspaceAgentQueueCommandHandlerOptions,
  WorkspaceAgentQueueCommandResult,
} from "./workspaceAgentQueueCommandTypes";
import { errorToMessage } from "./workspaceAgentQueueCommandUtils";
import { createQueueItem } from "./workspaceAgentQueueCreateCommands";
import { explainQueueFailure } from "./workspaceAgentQueueFailureExplanation";
import { updateQueueItem } from "./workspaceAgentQueueUpdateCommandExecutor";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export async function runWorkspaceAgentQueueCommand(
  text: string,
  options: WorkspaceAgentQueueCommandHandlerOptions,
): Promise<WorkspaceAgentQueueCommandResult> {
  const command = parseWorkspaceAgentQueueCommand(text);

  if (!command) {
    return { body: "", handled: false };
  }

  if (!options.bridge) {
    return {
      body: "Agent Queue API is not available in this workspace view.",
      handled: true,
    };
  }

  switch (command.type) {
    case "analyzeQueue":
      return {
        body: await analyzeQueue(options.bridge),
        handled: true,
      };
    case "explainFailure":
      return {
        body: await explainQueueFailure(options.bridge),
        handled: true,
      };
    case "batch":
      return {
        body: await runQueueCommandBatch(command, {
          ...options,
          bridge: options.bridge,
        }),
        handled: true,
      };
    case "createItem":
      return {
        body: await createQueueItem(command, options),
        handled: true,
      };
    case "updateItem":
      return {
        body: await updateQueueItem(command, options.bridge),
        handled: true,
      };
    case "runAutonomousQueue":
      return {
        body: await runAutonomousQueue(options.bridge),
        handled: true,
      };
    case "stopAutonomousQueueAfterCurrent":
      return {
        body: await stopAutonomousQueueAfterCurrent(options.bridge),
        handled: true,
      };
    case "unsupportedQueueCommand":
      return {
        body: "Queue action failed: no supported Queue command was recognized.",
        handled: true,
      };
  }
}

async function analyzeQueue(bridge: WorkspaceAgentQueueBridge) {
  try {
    const result = await bridge.getSnapshot({ includeSelectedItem: true });
    const snapshot = result.snapshot ?? result.item;

    if (!result.ok || !snapshot) {
      return `Queue snapshot could not be loaded: ${
        result.error?.message ?? result.message
      }`;
    }

    return queueSummary(snapshot);
  } catch (error) {
    return `Queue snapshot could not be loaded: ${errorToMessage(error)}`;
  }
}
