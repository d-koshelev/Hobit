import type { QueueWidgetItemSnapshot } from "./queue/agentQueueWidgetApiTypes";
import { runAutonomousQueue } from "./workspaceAgentQueueAutonomousCommands";
import {
  hasQueuedCreateWithoutWorkspace,
  missingWorkspaceQueueActionMessage,
  queueCreateItemRequest,
} from "./workspaceAgentQueueCreateCommands";
import type {
  WorkspaceAgentQueueCommand,
  WorkspaceAgentQueueCommandHandlerOptions,
} from "./workspaceAgentQueueCommandTypes";
import { errorToMessage } from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export async function runQueueCommandBatch(
  command: Extract<WorkspaceAgentQueueCommand, { type: "batch" }>,
  options: WorkspaceAgentQueueCommandHandlerOptions & {
    bridge: WorkspaceAgentQueueBridge;
  },
) {
  const createdItems: QueueWidgetItemSnapshot[] = [];
  const failedMessages: string[] = [];
  let autonomousStarted = false;
  let autonomousMessage = "";
  const shouldRunAutonomous = command.commands.some(
    (batchCommand) => batchCommand.type === "runAutonomousQueue",
  );

  if (shouldRunAutonomous && hasQueuedCreateWithoutWorkspace(command, options)) {
    return missingWorkspaceQueueActionMessage();
  }

  for (const batchCommand of command.commands) {
    if (batchCommand.type === "createItem") {
      try {
        const result = await options.bridge.createItem(
          queueCreateItemRequest(batchCommand, options),
        );

        if (!result.ok || !result.item) {
          failedMessages.push(
            `Queue item could not be created: ${
              result.error?.message ?? result.message
            }`,
          );
          continue;
        }

        createdItems.push(result.item);
      } catch (error) {
        failedMessages.push(
          `Queue item could not be created: ${errorToMessage(error)}`,
        );
      }
      continue;
    }

    if (batchCommand.type === "runAutonomousQueue") {
      autonomousMessage = await runAutonomousQueue(options.bridge);
      autonomousStarted = /^Autonomous Queue started\./i.test(autonomousMessage);
      if (!autonomousStarted) {
        failedMessages.push(autonomousMessage);
      }
    }
  }

  if (failedMessages.length > 0) {
    const createdSummary =
      createdItems.length > 0
        ? `Created ${createdItems.length.toString()} Queue item${
            createdItems.length === 1 ? "" : "s"
          }. `
        : "";
    return `${createdSummary}Queue action failed: ${failedMessages.join(" ")}`;
  }

  if (createdItems.length > 0 && autonomousStarted) {
    return `Created ${createdItems.length.toString()} Queue item${
      createdItems.length === 1 ? "" : "s"
    } and started Autonomous Queue.`;
  }

  if (createdItems.length > 0) {
    return `Created ${createdItems.length.toString()} Queue item${
      createdItems.length === 1 ? "" : "s"
    }.`;
  }

  return autonomousMessage || "Queue action completed.";
}
