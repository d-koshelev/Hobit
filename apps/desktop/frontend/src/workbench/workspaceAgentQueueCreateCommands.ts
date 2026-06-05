import {
  defaultAgentQueueTaskRunSettings,
  type AgentQueueTaskRunSettingsDefaults,
} from "./queue/agentQueueRunSettingsDefaults";
import { createdItemSummary } from "./workspaceAgentQueueCommandFormatting";
import type {
  WorkspaceAgentQueueCommand,
  WorkspaceAgentQueueCommandHandlerOptions,
} from "./workspaceAgentQueueCommandTypes";
import { errorToMessage } from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export async function createQueueItem(
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

export function queueCreateItemRequest(
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

export function hasQueuedCreateWithoutWorkspace(
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

export function missingWorkspaceQueueActionMessage() {
  return [
    "Queue action failed: task workspace is missing. No Queue items were created or run.",
    "Add a task-scoped Workspace setting to the local prompt, for example:",
    "",
    "Workspace:",
    "C:\\path\\to\\project",
  ].join("\n");
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
