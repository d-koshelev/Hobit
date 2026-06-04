import { WorkspaceAgentQueueCreateDraftCard } from "./WorkspaceAgentQueueCreateDraftCard";
import { WorkspaceAgentQueueUpdateDraftCard } from "./WorkspaceAgentQueueUpdateDraftCard";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  type WorkspaceAgentQueueActionCardResult,
} from "./workspaceAgentQueueActions";
import {
  type WorkspaceAgentQueueIntentDraft,
} from "./workspaceAgentQueueIntent";

export function WorkspaceAgentQueueIntentDraftCard({
  bridge,
  draft,
  onActionResult,
  onDiscard,
  onPatchDraft,
}: {
  bridge?: WorkspaceAgentQueueBridge;
  draft: WorkspaceAgentQueueIntentDraft;
  onActionResult: (result: WorkspaceAgentQueueActionCardResult) => void;
  onDiscard: (draftId: string) => void;
  onPatchDraft: (
    draftId: string,
    patch: Partial<WorkspaceAgentQueueIntentDraft>,
  ) => void;
}) {
  if (draft.intentType === "createItem") {
    return (
      <WorkspaceAgentQueueCreateDraftCard
        bridge={bridge}
        draft={draft}
        onActionResult={onActionResult}
        onDiscard={onDiscard}
        onPatchDraft={onPatchDraft}
      />
    );
  }

  return (
    <WorkspaceAgentQueueUpdateDraftCard
      bridge={bridge}
      draft={draft}
      onActionResult={onActionResult}
      onDiscard={onDiscard}
      onPatchDraft={onPatchDraft}
    />
  );
}

export { WorkspaceAgentQueueActionResultCard } from "./WorkspaceAgentQueueResultCard";
