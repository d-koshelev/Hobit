import {
  validateWorkspaceAgentQueueIntentDraft,
  workspaceAgentQueueIntentCanApply,
  type WorkspaceAgentQueueIntentDraft,
} from "./workspaceAgentQueueIntent";
import type { QueueWidgetActionName } from "./queue/agentQueueWidgetApiTypes";

export function workspaceAgentQueueDraftReviewState(
  draft: WorkspaceAgentQueueIntentDraft,
) {
  const validation = validateWorkspaceAgentQueueIntentDraft(draft);

  return {
    badgeLabel:
      validation.blockingMessages.length > 0
        ? "Needs review"
        : "Ready to apply",
    badgeVariant:
      validation.blockingMessages.length > 0 ? "warning" : "info",
    validation,
  } as const;
}

export function workspaceAgentQueueDraftCanApply({
  bridgeAvailable,
  draft,
  pendingAction,
}: {
  bridgeAvailable: boolean;
  draft: WorkspaceAgentQueueIntentDraft;
  pendingAction: QueueWidgetActionName | null;
}) {
  return (
    bridgeAvailable &&
    workspaceAgentQueueIntentCanApply(draft) &&
    !pendingAction
  );
}
