import { Badge } from "../design-system/Badge";
import { ActionFact } from "./WorkspaceAgentQueueActionCardShared";
import { WorkspaceAgentQueueActionErrorCard } from "./WorkspaceAgentQueueActionErrorCard";
import { WorkspaceAgentQueueSnapshotCard } from "./WorkspaceAgentQueueSnapshotCard";
import {
  workspaceAgentQueueActionCardTitle,
  workspaceAgentQueueActionSummary,
  type WorkspaceAgentQueueActionCardResult,
} from "./workspaceAgentQueueActions";
import {
  queueItemFromActionResult,
  WORKSPACE_AGENT_QUEUE_SAFE_RESULT_NOTE,
} from "./workspaceAgentQueueCardFormatters";

export function WorkspaceAgentQueueActionResultCard({
  result,
}: {
  result: WorkspaceAgentQueueActionCardResult;
}) {
  const title = workspaceAgentQueueActionCardTitle(result);
  const summary = workspaceAgentQueueActionSummary(result);
  const snapshot = result.snapshot;
  const item = snapshot ? null : queueItemFromActionResult(result.item);

  return (
    <section
      aria-label={title}
      className={`workspace-agent-queue-action-card workspace-agent-queue-action-card-${result.ok ? "success" : "error"}`}
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">{result.action}</p>
          <h4 className="coordinator-proposal-title">{title}</h4>
        </div>
        <Badge variant={result.ok ? "success" : "error"}>
          {result.ok ? "Completed" : "Failed"}
        </Badge>
      </div>

      <p className="coordinator-proposal-section-value">{summary}</p>

      <WorkspaceAgentQueueActionErrorCard result={result} />

      {item ? (
        <dl className="workspace-agent-queue-action-card-facts">
          <ActionFact label="Item id" value={item.id} />
          <ActionFact label="Title" value={item.title} />
          <ActionFact label="Status" value={item.status} />
          <ActionFact label="Priority" value={item.priority.toString()} />
          <ActionFact label="Policy" value={item.executionPolicy} />
          {item.queueTag.name ? (
            <ActionFact label="Queue tag" value={item.queueTag.name} />
          ) : null}
          {item.executionWorkspace ? (
            <ActionFact
              label="Execution workspace"
              value={item.executionWorkspace}
            />
          ) : null}
          {item.codexExecutable ? (
            <ActionFact label="Codex executable" value={item.codexExecutable} />
          ) : null}
          {item.sandbox ? <ActionFact label="Sandbox" value={item.sandbox} /> : null}
          {item.approvalPolicy ? (
            <ActionFact label="Approval" value={item.approvalPolicy} />
          ) : null}
        </dl>
      ) : null}

      {snapshot ? <WorkspaceAgentQueueSnapshotCard snapshot={snapshot} /> : null}

      <p className="coordinator-proposal-note">
        {WORKSPACE_AGENT_QUEUE_SAFE_RESULT_NOTE}
      </p>
    </section>
  );
}
