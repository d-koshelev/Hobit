import { DisabledActionReason } from "../../../design-system/ActionPrimitives";
import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import type { QueueTaskViewModel } from "../../queue/queueV2ViewModel";
import {
  queueV2CoordinatorFinalizationView,
  type QueueV2CoordinatorFinalizationView,
} from "./queueV2CoordinatorFinalization";

type QueueV2CoordinatorSectionProps = {
  onOpenLinkedTask?: (taskId: string) => void;
  queue?: AgentQueueController;
  taskViewModel: QueueTaskViewModel;
};

export function QueueV2CoordinatorSection({
  onOpenLinkedTask,
  queue,
  taskViewModel,
}: QueueV2CoordinatorSectionProps) {
  const task = taskViewModel.task;
  const coordinatorView = queueV2CoordinatorFinalizationView(
    task,
    queue?.tasks ?? [task],
  );
  const selectedTaskMismatch = Boolean(
    queue?.selectedTask && queue.selectedTask.queueItemId !== task.queueItemId,
  );
  const actionReason =
    selectedTaskMismatch
      ? "Select this task to enable coordinator decisions."
      : !queue
        ? "Queue coordinator actions are not wired in this view."
        : !queue.coordinatorFinalization.canAct
          ? queue.coordinatorFinalization.message ??
            "Coordinator decision actions are unavailable while the task is editing, saving, or creating."
          : undefined;
  const hasCommitHash = Boolean(coordinatorView.actualCommitHash);
  const acceptWithCommitReason =
    actionReason ??
    (!hasCommitHash
      ? "Accept with commit hash requires an existing recorded commit hash. QueueV2 does not create commits."
      : undefined);
  const linkedDiffReviewTaskId = taskViewModel.diffReview.linkedReviewTaskId;

  return (
    <div className="queue-v2-task-details-section">
      <div className="queue-v2-task-details-block queue-v2-coordinator-header">
        <div>
          <h3>Coordinator</h3>
          <p>
            Explicit finalization only. Validation and Diff Review are evidence,
            not automatic acceptance.
          </p>
        </div>
        <Badge variant={badgeVariant(coordinatorView.cardMarkerTone)}>
          {coordinatorView.cardMarker}
        </Badge>
      </div>
      <dl className="queue-v2-task-details-facts">
        <DetailFact label="Decision state" value={coordinatorView.decisionState} />
        <DetailFact label="Next action" value={coordinatorView.nextAction} />
        <DetailFact
          label="Validation evidence"
          value={coordinatorView.validationGateSummary}
        />
        <DetailFact label="Diff Review" value={coordinatorView.diffReviewSummary} />
        <DetailFact
          label="Expected commit title"
          value={coordinatorView.expectedCommitTitle ?? "Not recorded"}
        />
        <DetailFact label="Actual commit" value={actualCommitLabel(coordinatorView)} />
        <DetailFact
          label="Dependency gate"
          value={coordinatorView.dependencyGateResult}
        />
        <DetailFact label="Operator note" value={coordinatorView.operatorNote} />
      </dl>

      <div className="queue-v2-task-details-block">
        <h3>Coordinator actions</h3>
        <div
          aria-label="QueueV2 coordinator finalization actions"
          className="queue-v2-coordinator-actions"
        >
          <CoordinatorActionButton
            disabled={Boolean(actionReason)}
            label="Accept without commit"
            onClick={() => queue?.coordinatorFinalization.onAcceptWithoutCommit()}
            reason={actionReason}
            variant="secondary"
          />
          <CoordinatorActionButton
            disabled={Boolean(acceptWithCommitReason)}
            label="Accept with commit hash"
            onClick={() => queue?.coordinatorFinalization.onFinalize()}
            reason={acceptWithCommitReason}
            variant="primary"
          />
          <CoordinatorActionButton
            disabled={Boolean(actionReason)}
            label="Request changes"
            onClick={() => queue?.coordinatorFinalization.onMarkNeedsChanges()}
            reason={actionReason}
            variant="secondary"
          />
          <CoordinatorActionButton
            disabled={Boolean(actionReason)}
            label="Follow-up"
            onClick={() => queue?.coordinatorFinalization.onCreateFollowUp()}
            reason={actionReason}
            variant="secondary"
          />
          <CoordinatorActionButton
            disabled={Boolean(actionReason)}
            label="Mark blocked"
            onClick={() => queue?.coordinatorFinalization.onMarkBlocked()}
            reason={actionReason}
            variant="secondary"
          />
          <CoordinatorActionButton
            disabled={Boolean(actionReason)}
            label="Rollback required"
            onClick={() => queue?.coordinatorFinalization.onMarkRollbackRequired()}
            reason={actionReason}
            variant="secondary"
          />
        </div>
        {queue?.coordinatorFinalization.message ? (
          <p className="queue-v2-task-details-note">
            {queue.coordinatorFinalization.message}
          </p>
        ) : null}
      </div>

      <div className="queue-v2-task-details-block">
        <h3>Diff Review link</h3>
        <p>{coordinatorView.diffReviewSummary}</p>
        {linkedDiffReviewTaskId ? (
          <Button
            onClick={() => onOpenLinkedTask?.(linkedDiffReviewTaskId)}
            variant="secondary"
          >
            Open Diff Review
          </Button>
        ) : (
          <p>No linked Diff Review task is recorded.</p>
        )}
      </div>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CoordinatorActionButton({
  disabled,
  label,
  onClick,
  reason,
  variant,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  reason?: string;
  variant: "primary" | "secondary";
}) {
  return (
    <span className="queue-v2-task-details-action-item">
      <Button disabled={disabled} onClick={onClick} title={reason} variant={variant}>
        {label}
      </Button>
      <DisabledActionReason reason={reason} />
    </span>
  );
}

function actualCommitLabel(view: QueueV2CoordinatorFinalizationView) {
  if (!view.actualCommitHash) {
    return "No commit hash recorded";
  }

  return `${view.actualCommitHash}${view.actualCommitTitle ? ` / ${view.actualCommitTitle}` : ""}`;
}

function badgeVariant(tone: QueueV2CoordinatorFinalizationView["cardMarkerTone"]) {
  switch (tone) {
    case "success":
      return "success";
    case "error":
      return "error";
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "neutral":
      return "neutral";
  }
}
