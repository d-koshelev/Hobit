import type { QueueWidgetSnapshot } from "./queue/agentQueueWidgetApiTypes";
import { findQueueUpdateTarget } from "./workspaceAgentQueueCommandFormatting";
import type { WorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandTypes";
import { errorToMessage } from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";

export async function updateQueueItem(
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
