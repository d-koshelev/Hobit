import type {
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import {
  defaultAgentQueueTaskRunSettings,
  type AgentQueueTaskRunSettingsDefaults,
} from "./queue/agentQueueRunSettingsDefaults";
import {
  autonomousResultMessage,
  createdItemSummary,
  findQueueUpdateTarget,
  queueSummary,
} from "./workspaceAgentQueueCommandFormatting";
import { parseWorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandParser";
import type {
  WorkspaceAgentQueueCommand,
  WorkspaceAgentQueueCommandHandlerOptions,
  WorkspaceAgentQueueCommandResult,
} from "./workspaceAgentQueueCommandTypes";
import { errorToMessage } from "./workspaceAgentQueueCommandUtils";
import { queueFailureExplanation } from "./workspaceAgentQueueFailureExplanation";
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

async function explainQueueFailure(bridge: WorkspaceAgentQueueBridge) {
  try {
    const result = await bridge.getSnapshot({ includeSelectedItem: true });
    const snapshot = result.snapshot ?? result.item;

    if (!result.ok || !snapshot) {
      return `Queue failure evidence could not be loaded: ${
        result.error?.message ?? result.message
      }`;
    }

    return queueFailureExplanation(snapshot);
  } catch (error) {
    return `Queue failure evidence could not be loaded: ${errorToMessage(error)}`;
  }
}

async function createQueueItem(
  command: Extract<WorkspaceAgentQueueCommand, { type: "createItem" }>,
  options: WorkspaceAgentQueueCommandHandlerOptions,
) {
  const request = queueCreateItemRequest(command, options);

  try {
    const result = await options.bridge?.createItem(request);

    if (!result) {
      return "Queue item could not be created: Agent Queue bridge is unavailable.";
    }

    if (!result.ok || !result.item) {
      return `Queue item could not be created: ${
        result.error?.message ?? result.message
      }`;
    }

    return createdItemSummary(result.item);
  } catch (error) {
    return `Queue item could not be created: ${errorToMessage(error)}`;
  }
}

async function runQueueCommandBatch(
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

function missingWorkspaceQueueActionMessage() {
  return [
    "Queue action failed: task workspace is missing. No Queue items were created or run.",
    "Add a task-scoped Workspace setting to the local prompt, for example:",
    "",
    "Workspace:",
    "C:\\path\\to\\project",
  ].join("\n");
}

function queueCreateItemRequest(
  command: Extract<WorkspaceAgentQueueCommand, { type: "createItem" }>,
  options: WorkspaceAgentQueueCommandHandlerOptions,
): Parameters<WorkspaceAgentQueueBridge["createItem"]>[0] {
  const runSettings = queueCreateRunSettings(options, command.runSettings);
  const hasExecutionWorkspace = Boolean(runSettings.executionWorkspace);
  const request: Parameters<WorkspaceAgentQueueBridge["createItem"]>[0] = {
    approvalPolicy: runSettings.approvalPolicy,
    codexExecutable: runSettings.codexExecutable,
    executionPolicy: command.executionPolicy ?? "manual",
    executionWorkspace: runSettings.executionWorkspace || undefined,
    priority: 0,
    prompt: command.prompt,
    queueTag: { name: command.queueTagName ?? "Default" },
    sandbox: runSettings.sandbox,
    status: hasExecutionWorkspace ? command.status ?? "queued" : "draft",
    title: command.title,
  };

  if (command.description) {
    request.description = command.description;
  }

  if (command.itemType) {
    request.itemType = command.itemType;
  }

  return request;
}

function hasQueuedCreateWithoutWorkspace(
  command: Extract<WorkspaceAgentQueueCommand, { type: "batch" }>,
  options: WorkspaceAgentQueueCommandHandlerOptions,
) {
  return command.commands.some((batchCommand) => {
    if (batchCommand.type !== "createItem") {
      return false;
    }

    const runSettings = queueCreateRunSettings(
      options,
      batchCommand.runSettings,
    );

    return batchCommand.status === "queued" && !runSettings.executionWorkspace;
  });
}

async function updateQueueItem(
  command: Extract<WorkspaceAgentQueueCommand, { type: "updateItem" }>,
  bridge: WorkspaceAgentQueueBridge,
) {
  if (!command.target.trim()) {
    return "Queue update needs a task id or title match.";
  }

  if (Object.keys(command.patch).length === 0) {
    return "Queue update needs at least one supported field change.";
  }

  let snapshot: QueueWidgetSnapshot | null = null;
  try {
    const snapshotResult = await bridge.getSnapshot();
    snapshot = snapshotResult.snapshot ?? snapshotResult.item ?? null;
    if (!snapshotResult.ok || !snapshot) {
      return `Queue update could not inspect Queue: ${
        snapshotResult.error?.message ?? snapshotResult.message
      }`;
    }
  } catch (error) {
    return `Queue update could not inspect Queue: ${errorToMessage(error)}`;
  }

  const match = findQueueUpdateTarget(snapshot.items, command.target);
  if (match.kind === "missing") {
    return `Queue update needs a specific task. No item matched "${command.target}".`;
  }

  if (match.kind === "ambiguous") {
    return `Queue update needs a specific task. Matching items: ${match.items
      .map((item) => `${item.id} (${item.title})`)
      .join(", ")}.`;
  }

  try {
    const result = await bridge.updateItem({
      itemId: match.item.id,
      patch: command.patch,
    });

    if (!result.ok || !result.item) {
      return `Queue item could not be updated: ${
        result.error?.message ?? result.message
      }`;
    }

    const changed = command.changedFieldLabels.length
      ? command.changedFieldLabels.join(", ")
      : Object.keys(command.patch).join(", ");
    return `Updated Queue item: ${result.item.id} - ${result.item.title}. ${
      changed ? `Changed: ${changed}.` : "No fields changed."
    }`;
  } catch (error) {
    return `Queue item could not be updated: ${errorToMessage(error)}`;
  }
}

async function runAutonomousQueue(bridge: WorkspaceAgentQueueBridge) {
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

async function stopAutonomousQueueAfterCurrent(
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

function explicitWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "~") {
    return null;
  }

  return trimmed;
}

function queueCreateRunSettings(
  options: WorkspaceAgentQueueCommandHandlerOptions,
  commandSettings: Partial<AgentQueueTaskRunSettingsDefaults> = {},
): AgentQueueTaskRunSettingsDefaults {
  const baseSettings = defaultAgentQueueTaskRunSettings();
  const bridgeSettings = options.bridge?.getRunSettingsDefaults?.() ?? null;
  const mergedSettings = {
    ...baseSettings,
    ...(bridgeSettings ?? {}),
    ...commandSettings,
  };
  const executionWorkspace =
    explicitWorkspaceRoot(commandSettings.executionWorkspace) ??
    explicitWorkspaceRoot(bridgeSettings?.executionWorkspace) ??
    explicitWorkspaceRoot(options.currentWorkspaceRoot) ??
    "";
  const codexExecutable =
    mergedSettings.codexExecutable.trim() || baseSettings.codexExecutable;

  return {
    approvalPolicy: mergedSettings.approvalPolicy,
    codexExecutable,
    executionWorkspace,
    sandbox: mergedSettings.sandbox,
  };
}
