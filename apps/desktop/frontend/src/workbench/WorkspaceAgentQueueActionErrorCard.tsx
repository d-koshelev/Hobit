import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { WorkspaceAgentQueueActionCardResult } from "./workspaceAgentQueueActions";

export function WorkspaceAgentQueueActionErrorCard({
  result,
}: {
  result: WorkspaceAgentQueueActionCardResult;
}) {
  if (!result.error) {
    return null;
  }

  return (
    <p className="coordinator-proposal-result coordinator-proposal-result-error">
      {cappedPreviewText(
        result.error.message,
        RENDER_MEMORY_CAPS.transcriptPayloadChars,
      )}
    </p>
  );
}
