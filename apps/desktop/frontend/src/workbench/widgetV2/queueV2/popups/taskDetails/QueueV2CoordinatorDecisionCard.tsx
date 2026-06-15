import { Badge, KeyValueList, Notice, Section } from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import {
  queueCoordinatorDecisionCardViewModelForTask,
} from "../../../../queue/queueCoordinatorDecisionViewModel";

type QueueV2CoordinatorDecisionCardProps = {
  readonly task: AgentQueueTask;
};

export function QueueV2CoordinatorDecisionCard({
  task,
}: QueueV2CoordinatorDecisionCardProps) {
  const model = queueCoordinatorDecisionCardViewModelForTask(task);

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
          { label: "Action availability", value: model.actionAvailability },
        ]}
      />
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
      <Notice variant="info" title="Decision proposal only">
        Queue shows this proposal for review. No retry, rollback, Workspace
        Agent request, Git change, or worker start runs from this card.
      </Notice>
    </Section>
  );
}
