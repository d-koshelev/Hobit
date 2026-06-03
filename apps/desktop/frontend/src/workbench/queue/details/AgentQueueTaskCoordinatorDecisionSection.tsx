import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import {
  coordinatorStatusBadgeVariant,
  coordinatorStatusBlocksNewWork,
  coordinatorStatusLabel,
} from "../../agentQueueTaskUiModel";
import {
  queueClosureStateBadgeVariant,
  queueClosureStateForTask,
  queueClosureStateLabel,
} from "../agentQueueClosureState";
import { hasReviewEvidenceForTask } from "./agentQueueTaskDetailsEvidence";
import type { AgentQueueController } from "./agentQueueTaskDetailsTypes";

export function AgentQueueTaskCoordinatorDecisionSection({
  queue,
}: {
  queue: AgentQueueController;
}) {
  const finalization = queue.coordinatorFinalization;
  const selectedTask = queue.selectedTask;
  const hasReport = selectedTask
    ? hasReviewEvidenceForTask(queue, selectedTask) ||
      Boolean(queue.reportActionCard.diffReviewReportCard)
    : false;
  const closureState = queueClosureStateForTask(selectedTask);
  const isRelevant =
    hasReport || coordinatorStatusBlocksNewWork(finalization.status);

  if (!isRelevant) {
    return (
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Coordinator finalization</summary>
        <p className="agent-queue-run-note">
          Coordinator finalization becomes relevant after a worker report,
          diff review, or explicit coordinator-review state exists.
        </p>
      </details>
    );
  }

  if (!hasReport) {
    return (
      <section
        aria-label="Coordinator decision"
        className="agent-queue-expanded-section agent-queue-finalization"
      >
        <div className="agent-queue-expanded-section-header">
          <div>
            <p className="agent-queue-execution-group-title">
              Coordinator decision
            </p>
            <p className="agent-queue-run-note">
              Evidence is missing. Final acceptance is disabled until a worker
              report or Direct Work result is attached.
            </p>
          </div>
          <Badge variant="warning">Evidence missing</Badge>
        </div>
        <div className="agent-queue-finalization-actions">
          <Button disabled={true} onClick={() => finalization.onFinalize()} variant="secondary">
            Accept result
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onMarkNeedsChanges()}
            variant="secondary"
          >
            Request changes
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onCreateFollowUp()}
            variant="secondary"
          >
            Create follow-up
          </Button>
          <Button onClick={() => scrollToDeveloperDetails()} variant="ghost">
            Developer details
          </Button>
        </div>
        {finalization.message ? (
          <p className="agent-queue-message">{finalization.message}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Coordinator decision"
      className="agent-queue-expanded-section agent-queue-finalization"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-execution-group-title">
            Coordinator decision
          </p>
          <p className="agent-queue-run-note">
            Choose one explicit next state. Reports are not accepted
            automatically.
          </p>
        </div>
        <Badge variant={queueClosureStateBadgeVariant(closureState)}>
          {queueClosureStateLabel(closureState)}
        </Badge>
        <Badge variant={coordinatorStatusBadgeVariant(finalization.status)}>
          {coordinatorStatusLabel(finalization.status)}
        </Badge>
      </div>
      <div className="agent-queue-finalization-actions">
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onFinalize()}
          variant="primary"
        >
          Accept result
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onAcceptWithoutCommit()}
          variant="secondary"
        >
          Accept without commit
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkNeedsChanges()}
          variant="secondary"
        >
          Request changes
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onCreateFollowUp()}
          variant="secondary"
        >
          Create follow-up
        </Button>
      </div>
      <details className="agent-queue-details agent-queue-secondary-details agent-queue-decision-more">
        <summary>More</summary>
        <div className="agent-queue-finalization-actions">
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onMarkReadyForFinalization()}
            variant="secondary"
          >
            Mark ready for finalization
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onMarkBlocked()}
            variant="secondary"
          >
            Mark blocked
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onMarkFailedRejected()}
            variant="secondary"
          >
            Mark failed/rejected
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onMarkRollbackRequired()}
            variant="secondary"
          >
            Mark rollback required
          </Button>
          <Button onClick={() => scrollToDeveloperDetails()} variant="ghost">
            Raw details
          </Button>
        </div>
      </details>
      {finalization.message ? (
        <p className="agent-queue-message">{finalization.message}</p>
      ) : null}
    </section>
  );
}

function scrollToDeveloperDetails() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-developer-details")
    ?.scrollIntoView({ block: "nearest" });
}
