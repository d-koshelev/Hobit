import { classifyPromptPackImportIntent } from "./workspaceAgentProductActionGuards";
import { parseWorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandParser";
import type { WorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandTypes";

export type WorkspaceAgentProductIntent =
  | {
      kind: "queue_action";
      queueAction: WorkspaceAgentQueueProductAction;
      route: "agent_queue";
    }
  | {
      kind: "prompt_pack_import";
      route: "prompt_pack";
    }
  | {
      kind: "none";
      route: "codex_or_provider";
    };

export type WorkspaceAgentQueueProductAction =
  | "analyze"
  | "create_items"
  | "needs_input"
  | "run_autonomous"
  | "stop_autonomous"
  | "update_item";

export function classifyWorkspaceAgentProductIntent(
  text: string,
  options: { hasPendingPromptPackImport?: boolean } = {},
): WorkspaceAgentProductIntent {
  const trimmed = text.trim();
  if (!trimmed) {
    return { kind: "none", route: "codex_or_provider" };
  }

  const queueCommand = parseWorkspaceAgentQueueCommand(trimmed);
  const promptPackIntent = classifyPromptPackImportIntent(trimmed, {
    hasPendingImport: Boolean(options.hasPendingPromptPackImport),
  });

  if (
    queueCommand &&
    !(
      options.hasPendingPromptPackImport &&
      promptPackIntent.kind === "confirm_prompt_pack_import_preview"
    )
  ) {
    return {
      kind: "queue_action",
      queueAction: queueProductAction(queueCommand),
      route: "agent_queue",
    };
  }

  if (promptPackIntent.kind !== "unknown") {
    return { kind: "prompt_pack_import", route: "prompt_pack" };
  }

  return { kind: "none", route: "codex_or_provider" };
}

function queueProductAction(
  command: WorkspaceAgentQueueCommand,
): WorkspaceAgentQueueProductAction {
  if (command.type === "analyzeQueue" || command.type === "explainFailure") {
    return "analyze";
  }

  if (command.type === "createItem" || command.type === "batch") {
    return "create_items";
  }

  if (command.type === "queueCreationNeedsInput") {
    return "needs_input";
  }

  if (command.type === "runAutonomousQueue") {
    return "run_autonomous";
  }

  if (command.type === "stopAutonomousQueueAfterCurrent") {
    return "stop_autonomous";
  }

  if (command.type === "updateItem") {
    return "update_item";
  }

  return "needs_input";
}
