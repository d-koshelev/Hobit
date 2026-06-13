import {
  RowActionMenu,
  type ActionMenuItem,
} from "../../../design-system/ActionPrimitives";
import type { AgentQueueTask } from "../../../workspace/types";
import { getQueuePromptPackImportMetadata } from "../../promptPack/queuePromptPackMetadata";
import {
  normalizeQueueTag,
  normalizeValidationStatus,
} from "../../agentQueueTaskUiModel";
import { queueTagColorToken } from "../../queue/agentQueueTagColors";
import type { QueueTaskViewModel } from "../../queue/queueV2ViewModel";
import type { QueueNextAction } from "../../queue/queueV2NextActionModel";
import {
  queueV2ValidationEvidenceView,
  validationStatusDataAttribute,
} from "./queueV2ValidationEvidence";
import { queueV2CoordinatorFinalizationView } from "./queueV2CoordinatorFinalization";

type QueueV2TaskCardProps = {
  item: QueueTaskViewModel;
  isSelected: boolean;
  onOpenDetails: (taskId: string, sourceButton: HTMLButtonElement | null) => void;
  onSelect: (taskId: string) => void;
};

export function QueueV2TaskCard({
  isSelected,
  item,
  onOpenDetails,
  onSelect,
}: QueueV2TaskCardProps) {
  const tag = normalizeQueueTag(item.task);
  const colorToken = queueTagColorToken(tag.queueTagId);
  const accent = accentForTask(item);
  const workerLabel = runningWorkerLabel(item.task);
  const progressLabel = runningProgressLabel(item.task);
  const promptPackMetadata = getQueuePromptPackImportMetadata(item.task);
  const validation = queueV2ValidationEvidenceView(item.task);
  const coordinator = queueV2CoordinatorFinalizationView(item.task);
  const actionItems: ActionMenuItem[] = [
    {
      id: "open-details",
      label: "Open details",
      onSelect: (sourceButton) => onOpenDetails(item.taskId, sourceButton ?? null),
    },
  ];

  return (
    <article
      aria-current={isSelected ? "true" : undefined}
      className={[
        "queue-v2-task-card",
        colorToken,
        isSelected ? "queue-v2-task-card-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-queue-item-id={item.taskId}
      data-queue-v2-card
      data-queue-v2-lane={item.boardLane}
      data-queue-v2-selected={isSelected ? "true" : "false"}
      data-queue-v2-tag-color={colorToken}
      data-queue-v2-coordinator={item.task.coordinatorStatus ?? "not_reported"}
      data-queue-v2-validation={validationStatusDataAttribute(item.task)}
      data-task-order-id={item.taskId}
      data-tone={accent}
      onClick={() => onSelect(item.taskId)}
      title={item.title}
    >
      <span className="queue-v2-card-stripe" aria-hidden="true" />
      <span className="queue-v2-card-main">
        <span className="queue-v2-card-title-row">
          <button
            className="queue-v2-card-select"
            onClick={() => onSelect(item.taskId)}
            type="button"
          >
            <span className="queue-v2-card-title">{item.title}</span>
          </button>
          <RowActionMenu
            buttonLabel="More"
            className="queue-v2-card-actions"
            items={actionItems}
            label={`More actions for ${item.title}`}
            menuClassName="queue-v2-card-action-menu"
            triggerClassName="queue-v2-card-details"
          />
        </span>
        <span className="queue-v2-card-tag">
          <span className="queue-v2-card-tag-dot" aria-hidden="true" />
          <span>{tag.queueTagName}</span>
        </span>
        <span className="queue-v2-card-meta">{taskStatusText(item)}</span>
        {blockerCardLine(item) ? (
          <span className="queue-v2-card-blocker" title={blockerCardTitle(item)}>
            {blockerCardLine(item)}
          </span>
        ) : null}
        <span
          className="queue-v2-card-validation"
          data-validation-tone={validation.markerTone}
          title={validation.summary}
        >
          {validation.marker}
        </span>
        <span
          className="queue-v2-card-diff-review"
          data-diff-review-status={item.diffReview.status}
          title={diffReviewCardTitle(item)}
        >
          {diffReviewCardLabel(item)}
        </span>
        <span
          className="queue-v2-card-coordinator"
          data-coordinator-tone={coordinator.cardMarkerTone}
          title={coordinator.nextAction}
        >
          {coordinator.cardMarker}
        </span>
        {coordinator.commitSaved ? (
          <span className="queue-v2-card-commit" title={coordinator.actualCommitHash ?? undefined}>
            Commit saved
          </span>
        ) : null}
        {coordinator.blockedMarker ? (
          <span className="queue-v2-card-blocked-marker">
            {coordinator.blockedMarker}
          </span>
        ) : null}
        {promptPackMetadata ? (
          <span
            aria-label="Prompt-pack import metadata"
            className="queue-v2-card-prompt-pack"
          >
            {promptPackMetadata.blockId ? (
              <span>Block {promptPackMetadata.blockId}</span>
            ) : null}
            <span>{dependencySummary(item, promptPackMetadata.dependencies)}</span>
            {promptPackMetadata.validationCommands.length > 0 ? (
              <span>Validation required</span>
            ) : null}
          </span>
        ) : null}
        <span className="queue-v2-card-action">
          {nextActionShortLabel(item.nextAction)}
        </span>
        {item.boardLane === "running" && workerLabel ? (
          <span className="queue-v2-card-run">
            <span>{workerLabel}</span>
            {progressLabel ? <span>{progressLabel}</span> : null}
          </span>
        ) : null}
      </span>
    </article>
  );
}

function diffReviewCardLabel(item: QueueTaskViewModel) {
  if (item.diffReview.isDiffReviewTask) {
    return item.diffReview.sourceTaskId
      ? `Source ${item.diffReview.sourceTaskId}`
      : "Read-only review";
  }

  return `Diff review ${item.diffReview.statusLabel.toLowerCase()}`;
}

function diffReviewCardTitle(item: QueueTaskViewModel) {
  if (item.diffReview.isDiffReviewTask) {
    return item.diffReview.sourceTaskTitle
      ? `Read-only Diff Review for ${item.diffReview.sourceTaskTitle}. It does not change code by default.`
      : "Read-only Diff Review item. Source task link is not recorded.";
  }

  return item.diffReview.linkedReviewTitle
    ? `Linked Diff Review: ${item.diffReview.linkedReviewTitle}`
    : "No linked Diff Review task is recorded.";
}

function dependencySummary(
  item: QueueTaskViewModel,
  promptPackDependencies: readonly string[],
) {
  if (item.blockedReasons.some((reason) => reason.code.startsWith("dependency"))) {
    return "Dependency blocked";
  }

  if (promptPackDependencies.length > 0) {
    return `Depends on ${promptPackDependencies.slice(0, 2).join(", ")}${
      promptPackDependencies.length > 2 ? ` +${(promptPackDependencies.length - 2).toString()}` : ""
    }`;
  }

  if ((item.task.dependsOn?.length ?? 0) > 0) {
    return "Dependencies linked";
  }

  return "No dependencies";
}

export function nextActionShortLabel(action: QueueNextAction) {
  switch (action) {
    case "edit_draft":
      return "Edit draft";
    case "queue_task":
      return "Queue";
    case "validate_readiness":
      return "Check";
    case "run_now":
      return "Run now";
    case "assign_worker":
      return "Assign";
    case "wait_for_capacity":
      return "Wait";
    case "resolve_dependency":
      return "Dependency";
    case "resolve_blocker":
      return "Resolve";
    case "review_report":
      return "Review";
    case "accept_result":
      return "Accept";
    case "request_changes":
      return "Changes";
    case "create_follow_up":
      return "Follow-up";
    case "reject_result":
      return "Reject";
    case "retry_or_rerun":
      return "Retry";
    case "close_cancelled":
      return "Close";
    case "view_history":
      return "History";
  }
}

function accentForTask(item: QueueTaskViewModel) {
  if (item.boardLane === "blocked") {
    return "blocked";
  }

  if (item.boardLane === "review") {
    return "review";
  }

  return "normal";
}

function taskStatusText(item: QueueTaskViewModel) {
  const validationStatus = normalizeValidationStatus(item.task.validationStatus);
  const lifecycle = lifecycleLabel(item.lifecycle);

  if (item.boardLane === "blocked") {
    return lifecycle;
  }

  if (item.boardLane === "review") {
    return item.task.workerExecutionReports?.length
      ? "Report ready"
      : lifecycle;
  }

  if (validationStatus !== "not_started" && item.boardLane !== "closed") {
    return `${lifecycle} / ${validationStatusLabel(validationStatus)}`;
  }

  return lifecycle;
}

function blockerCardLine(item: QueueTaskViewModel) {
  const primaryReason = item.blockerSummary.primaryReason;

  if (!primaryReason || (item.boardLane !== "blocked" && item.lifecycle !== "queued")) {
    return null;
  }

  return `${item.boardLane === "blocked" ? "Blocked" : "Queued"}: ${primaryReason}`;
}

function blockerCardTitle(item: QueueTaskViewModel) {
  return [
    item.blockerSummary.primaryReason,
    ...item.blockerSummary.secondaryReasons,
  ]
    .filter((reason): reason is string => Boolean(reason))
    .join("; ");
}

function lifecycleLabel(lifecycle: QueueTaskViewModel["lifecycle"]) {
  switch (lifecycle) {
    case "draft":
      return "Draft";
    case "queued":
      return "Queued";
    case "ready":
      return "Ready";
    case "running":
      return "Running";
    case "report_ready":
      return "Report ready";
    case "review_required":
      return "Review required";
    case "finalized":
      return "Finalized";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

function validationStatusLabel(status: NonNullable<AgentQueueTask["validationStatus"]>) {
  switch (status) {
    case "validating":
      return "validating";
    case "passed":
      return "passed";
    case "failed":
      return "validation failed";
    case "needs_review":
      return "validation review";
    case "not_started":
      return "not started";
  }
}

function runningWorkerLabel(task: AgentQueueTask) {
  const workerId = task.assignedWorkerId ?? task.assignedExecutorWidgetId;

  return workerId ? `Worker ${workerId}` : null;
}

function runningProgressLabel(task: AgentQueueTask) {
  const latestReport =
    task.workerExecutionReports?.[task.workerExecutionReports.length - 1] ?? null;

  if (latestReport) {
    return latestReport.reportStatus;
  }

  return task.validationStatus === "validating" ? "validating" : "active";
}
