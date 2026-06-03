import { ActionFact } from "./WorkspaceAgentQueueActionCardShared";
import {
  workspaceAgentQueueBlockerLabel,
  workspaceAgentQueueNextRecommendedItem,
  workspaceAgentQueueTopBlockers,
} from "./workspaceAgentQueueActions";
import { workspaceAgentQueueAutorunLabel } from "./workspaceAgentQueueCardFormatters";
import type { QueueWidgetSnapshot } from "./queue/agentQueueWidgetApiTypes";

export function WorkspaceAgentQueueSnapshotCard({
  snapshot,
}: {
  snapshot: QueueWidgetSnapshot;
}) {
  const topBlockers = workspaceAgentQueueTopBlockers(snapshot);
  const recommendedItem = workspaceAgentQueueNextRecommendedItem(snapshot);

  return (
    <>
      <dl className="workspace-agent-queue-action-card-facts">
        <ActionFact label="Total" value={snapshot.itemCounts.total.toString()} />
        <ActionFact
          label="Queued"
          value={snapshot.itemCounts.queued.toString()}
        />
        <ActionFact
          label="Running"
          value={snapshot.itemCounts.running.toString()}
        />
        <ActionFact
          label="Blocked"
          value={snapshot.itemCounts.blocked.toString()}
        />
        <ActionFact
          label="Report-ready"
          value={snapshot.itemCounts.reportReady.toString()}
        />
        <ActionFact
          label="Finalized"
          value={snapshot.itemCounts.finalized.toString()}
        />
        <ActionFact label="Autorun" value={workspaceAgentQueueAutorunLabel(snapshot)} />
      </dl>

      {snapshot.selectedItem ? (
        <p className="coordinator-proposal-note">
          Selected item: {snapshot.selectedItem.title} ({snapshot.selectedItem.id})
          is {snapshot.selectedItem.status}.
        </p>
      ) : null}

      {topBlockers.length > 0 ? (
        <ul className="workspace-agent-queue-action-card-list">
          {topBlockers.map((blocker, index) => (
            <li
              key={`${blocker.itemId ?? "queue"}-${blocker.code}-${index.toString()}`}
            >
              {workspaceAgentQueueBlockerLabel(blocker)}
            </li>
          ))}
        </ul>
      ) : recommendedItem ? (
        <p className="coordinator-proposal-note">
          Next recommended item: {recommendedItem.title} ({recommendedItem.id}).
        </p>
      ) : null}
    </>
  );
}
