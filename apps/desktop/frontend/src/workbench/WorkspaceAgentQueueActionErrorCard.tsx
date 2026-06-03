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
      {result.error.message}
    </p>
  );
}
