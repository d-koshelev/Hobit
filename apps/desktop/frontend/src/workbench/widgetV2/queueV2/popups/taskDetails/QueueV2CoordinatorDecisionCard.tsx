import {
  Badge,
  Button,
  KeyValueList,
  Notice,
  Section,
} from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import {
  queueCoordinatorDecisionCardViewModelForTask,
} from "../../../../queue/queueCoordinatorDecisionViewModel";
import type { AgentQueueController } from "../../../../queue/details/agentQueueTaskDetailsTypes";

type QueueV2CoordinatorDecisionCardProps = {
  readonly queue?: AgentQueueController;
  readonly task: AgentQueueTask;
};

export function QueueV2CoordinatorDecisionCard({
  queue,
  task,
}: QueueV2CoordinatorDecisionCardProps) {
  const model = queueCoordinatorDecisionCardViewModelForTask(task);
  const showRetrySameButton = Boolean(
    model?.retrySameAvailable && queue?.smartQueueRetry,
  );

  if (!model) {
    return null;
  }

  return (
    <Section
      aria-label="Coordinator Decision card"
      className="queue-v2-coordinator-decision-card"
      compact
      title="Coordinator decision"
    >
      <KeyValueList
        compact
        items={[
          { label: "What happened", value: model.statusLabel },
          { label: "Why decision is needed", value: model.evidenceSummary },
          { label: "Recommended action", value: model.recommendedActionLabel },
          {
            label: "Allowed next actions",
            value: (
              <span className="queue-v2-coordinator-decision-actions">
                {model.allowedActionLabels.map((label) => (
                  <Badge key={label} variant="neutral">
                    {label}
                  </Badge>
                ))}
              </span>
            ),
          },
          { label: "Approval", value: model.requiresApprovalLabel },
          { label: "Destructive", value: model.destructiveLabel },
          ...(showRetrySameButton
            ? []
            : [{ label: "Action availability", value: model.actionAvailability }]),
        ]}
      />
      {showRetrySameButton && queue?.smartQueueRetry ? (
        <div className="queue-v2-coordinator-decision-controls">
          <Button
            disabled={
              !queue.smartQueueRetry.canRetrySame ||
              queue.smartQueueRetry.isRetrying
            }
            onClick={() => queue.smartQueueRetry.onRetrySame()}
            variant="secondary"
          >
            {queue.smartQueueRetry.isRetrying ? "Retrying" : model.retrySameLabel}
          </Button>
          {queue?.smartQueueRetry?.message ? (
            <span>{queue.smartQueueRetry.message}</span>
          ) : null}
          {queue?.smartQueueRetry?.error ? (
            <span>{queue.smartQueueRetry.error}</span>
          ) : null}
        </div>
      ) : null}
      <div className="queue-v2-coordinator-decision-flags">
        {model.requiresApproval ? (
          <Badge variant="warning">Approval required</Badge>
        ) : (
          <Badge variant="neutral">No approval required</Badge>
        )}
        {model.destructive ? (
          <Badge variant="error">Destructive</Badge>
        ) : (
          <Badge variant="neutral">Not destructive</Badge>
        )}
      </div>
      <Notice variant="info" title="Decision proposal">
        Queue shows this proposal for review. Retry only returns the task to
        Ready through the Queue controller; rollback, Workspace Agent requests,
        Git changes, Terminal commands, and worker starts do not run from this
        card.
      </Notice>
    </Section>
  );
}
