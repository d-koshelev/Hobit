import { DisabledActionReason } from "../../../design-system/ActionPrimitives";
import { Button } from "../../../design-system/Button";
import type { QueueTaskViewModel } from "../../queue/queueV2ViewModel";

type QueueV2DiffReviewSectionProps = {
  onOpenLinkedTask?: (taskId: string) => void;
  taskViewModel: QueueTaskViewModel;
};

export function QueueV2DiffReviewSection({
  onOpenLinkedTask,
  taskViewModel,
}: QueueV2DiffReviewSectionProps) {
  const diffReview = taskViewModel.diffReview;
  const targetTaskId = diffReview.isDiffReviewTask
    ? diffReview.sourceTaskId
    : diffReview.linkedReviewTaskId;
  const targetLabel = diffReview.isDiffReviewTask
    ? "Open source task"
    : "Open Diff Review";

  return (
    <section
      aria-label="Diff Review"
      className="queue-v2-task-details-block queue-v2-diff-review-section"
    >
      <div className="queue-v2-diff-review-header">
        <div>
          <h3>Diff Review</h3>
          <p>{diffReviewSummaryLine(taskViewModel)}</p>
        </div>
        <span
          className="queue-v2-diff-review-badge"
          data-diff-review-status={diffReview.status}
        >
          {diffReview.statusLabel}
        </span>
      </div>
      {diffReview.isDiffReviewTask ? (
        <p className="queue-v2-task-details-note">
          Read-only Diff Review item. It should inspect the source task and
          report findings; it does not edit code by default.
        </p>
      ) : null}
      <dl className="queue-v2-task-details-facts">
        <DetailFact
          label={diffReview.isDiffReviewTask ? "Source task" : "Review task"}
          value={
            diffReview.isDiffReviewTask
              ? diffReview.sourceTaskTitle ?? diffReview.sourceTaskId ?? "Not linked"
              : diffReview.linkedReviewTitle ??
                diffReview.linkedReviewTaskId ??
                "Not requested"
          }
        />
        <DetailFact
          label="Review mode"
          value={diffReview.reviewModeLabel ?? "Not recorded"}
        />
        <DetailFact
          label="Source report"
          value={diffReview.availability.hasReport ? "Available" : "Missing"}
        />
        <DetailFact
          label="Validation"
          value={diffReview.availability.hasValidation ? "Available" : "Missing"}
        />
        <DetailFact
          label="Diff / files"
          value={
            diffReview.availability.hasDiffSummary ? "Available" : "Missing"
          }
        />
      </dl>
      <CompactList
        emptyLabel="No Diff Review warnings."
        items={diffReview.availability.warnings}
        label="Warnings"
      />
      <div className="queue-v2-diff-review-actions">
        <Button
          disabled={!targetTaskId || !onOpenLinkedTask}
          onClick={() => {
            if (targetTaskId) {
              onOpenLinkedTask?.(targetTaskId);
            }
          }}
          title={
            !targetTaskId
              ? "No linked task is recorded."
              : !onOpenLinkedTask
                ? "Linked task opening is unavailable in this view."
                : undefined
          }
          variant="secondary"
        >
          {targetLabel}
        </Button>
        {!targetTaskId || !onOpenLinkedTask ? (
          <DisabledActionReason
            reason={
              !targetTaskId
                ? "No linked task is recorded."
                : "Linked task opening is unavailable in this view."
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function diffReviewSummaryLine(taskViewModel: QueueTaskViewModel) {
  const diffReview = taskViewModel.diffReview;

  if (diffReview.isDiffReviewTask) {
    return diffReview.sourceTaskTitle
      ? `Linked source: ${diffReview.sourceTaskTitle}`
      : "Source task link is not recorded.";
  }

  return diffReview.linkedReviewTitle
    ? `Linked review item: ${diffReview.linkedReviewTitle}`
    : "No linked Diff Review task is recorded for this implementation task.";
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CompactList({
  emptyLabel,
  items,
  label,
}: {
  emptyLabel: string;
  items: readonly string[];
  label: string;
}) {
  return (
    <div className="queue-v2-task-details-block">
      <h3>{label}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </div>
  );
}
