import { useMemo } from "react";

import { Badge } from "../design-system/Badge";
import type { AgentQueueTask } from "../workspace/types";
import {
  queueGlobalExecutionStateLabel,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "./agentQueueTaskUiModel";
import {
  selectQueueV2ViewModel,
  type QueueBoardLane,
  type QueueTaskViewModel,
} from "./queue/queueV2ViewModel";
import type { QueueNextAction } from "./queue/queueV2NextActionModel";

type AgentQueueV2BoardProps = {
  autorunArmed: boolean;
  globalExecutionState: QueueGlobalStatus;
  isSelecting: boolean;
  onSelectTask: (queueItemId: string) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

const BOARD_LANES: { id: QueueBoardLane; label: string }[] = [
  { id: "intake_draft", label: "Intake / Draft" },
  { id: "ready", label: "Ready" },
  { id: "running", label: "Running" },
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
  { id: "closed", label: "Closed" },
];

export function AgentQueueV2Board({
  autorunArmed,
  globalExecutionState,
  isSelecting,
  onSelectTask,
  pausedQueueTagIds,
  selectedTask,
  tasks,
  workers,
}: AgentQueueV2BoardProps) {
  const board = useMemo(
    () =>
      selectQueueV2ViewModel({
        autorunArmed,
        globalExecutionState,
        pausedQueueTagIds,
        selectedTaskId: selectedTask?.queueItemId ?? null,
        tasks,
        workers,
      }),
    [
      autorunArmed,
      globalExecutionState,
      pausedQueueTagIds,
      selectedTask?.queueItemId,
      tasks,
      workers,
    ],
  );

  return (
    <section aria-label="Queue v2 board" className="agent-queue-v2-board-pane">
      <div className="agent-queue-v2-command-bar">
        <div>
          <p className="agent-queue-pane-title">Queue Board</p>
          <p className="agent-queue-pane-subtitle">
            {tasks.length === 1 ? "1 task" : `${tasks.length.toString()} tasks`}
          </p>
        </div>
        <dl className="agent-queue-v2-command-facts" aria-label="Queue v2 summary">
          <div>
            <dt>Queue</dt>
            <dd>{queueGlobalExecutionStateLabel(globalExecutionState)}</dd>
          </div>
          <div>
            <dt>Ready now</dt>
            <dd>{board.counts.eligibleNow}</dd>
          </div>
          <div>
            <dt>Running</dt>
            <dd>{board.counts.running}</dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd>{board.counts.reviewNeeded}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>
              {board.capacity.availableSlots}/{board.capacity.totalSlots}
            </dd>
          </div>
        </dl>
      </div>

      <div className="agent-queue-v2-board-scroll">
        <div className="agent-queue-v2-lanes" role="list">
          {BOARD_LANES.map((lane) => (
            <QueueV2Lane
              isSelecting={isSelecting}
              items={board.lanes[lane.id]}
              key={lane.id}
              label={lane.label}
              onSelectTask={onSelectTask}
              selectedTaskId={selectedTask?.queueItemId ?? null}
            />
          ))}
        </div>
      </div>

      <details className="agent-queue-v2-activity-drawer">
        <summary>Activity and raw execution detail</summary>
        <p>
          Raw run links, logs, reports, and developer detail remain collapsed in
          the existing selected-task details path.
        </p>
      </details>
    </section>
  );
}

function QueueV2Lane({
  isSelecting,
  items,
  label,
  onSelectTask,
  selectedTaskId,
}: {
  isSelecting: boolean;
  items: QueueTaskViewModel[];
  label: string;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <section
      aria-label={`${label} lane`}
      className="agent-queue-v2-lane"
      role="listitem"
    >
      <div className="agent-queue-v2-lane-header">
        <p>{label}</p>
        <span>{items.length}</span>
      </div>
      <div className="agent-queue-v2-card-stack" role="list">
        {items.length === 0 ? (
          <div className="agent-queue-v2-lane-empty">No tasks.</div>
        ) : (
          items.map((item) => (
            <QueueV2Card
              isSelected={selectedTaskId === item.taskId}
              isSelecting={isSelecting}
              item={item}
              key={item.taskId}
              onSelectTask={onSelectTask}
            />
          ))
        )}
      </div>
    </section>
  );
}

function QueueV2Card({
  isSelected,
  isSelecting,
  item,
  onSelectTask,
}: {
  isSelected: boolean;
  isSelecting: boolean;
  item: QueueTaskViewModel;
  onSelectTask: (queueItemId: string) => void;
}) {
  const attachmentCount =
    (item.task.context?.attachedKnowledgeRefs.length ?? 0) +
    (item.task.context?.attachedSkillRefs.length ?? 0);
  const workerLabel =
    item.task.assignedWorkerId ?? item.task.assignedExecutorWidgetId ?? null;
  const blockerSummary =
    item.blockedReasons[0]?.label ??
    (item.eligibility.blockedReasons[0]?.label || null);

  return (
    <button
      aria-current={isSelected ? "true" : undefined}
      className={[
        "agent-queue-v2-card",
        isSelected ? "agent-queue-v2-card-selected" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-queue-item-id={item.taskId}
      data-queue-v2-lane={item.boardLane}
      disabled={isSelecting}
      onClick={() => onSelectTask(item.taskId)}
      title={item.title}
      type="button"
    >
      <span className="agent-queue-v2-card-title">{item.title}</span>
      <span className="agent-queue-v2-card-line">
        <span>Next</span>
        <Badge variant={nextActionBadgeVariant(item.nextAction)}>
          {nextActionLabel(item.nextAction)}
        </Badge>
      </span>
      {blockerSummary ? (
        <span className="agent-queue-v2-card-note">{blockerSummary}</span>
      ) : null}
      {item.boardLane === "running" && workerLabel ? (
        <span className="agent-queue-v2-card-note">Worker {workerLabel}</span>
      ) : null}
      {attachmentCount > 0 ? (
        <span className="agent-queue-v2-card-note">
          {attachmentCount.toString()} Knowledge / attachment
          {attachmentCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </button>
  );
}

function nextActionLabel(action: QueueNextAction) {
  switch (action) {
    case "edit_draft":
      return "Edit draft";
    case "queue_task":
      return "Queue task";
    case "validate_readiness":
      return "Check readiness";
    case "run_now":
      return "Run now";
    case "assign_worker":
      return "Assign worker";
    case "wait_for_capacity":
      return "Wait for capacity";
    case "resolve_dependency":
      return "Resolve dependency";
    case "resolve_blocker":
      return "Resolve blocker";
    case "review_report":
      return "Review report";
    case "accept_result":
      return "Accept result";
    case "request_changes":
      return "Request changes";
    case "create_follow_up":
      return "Create follow-up";
    case "reject_result":
      return "Reject result";
    case "retry_or_rerun":
      return "Retry or rerun";
    case "close_cancelled":
      return "Close cancelled";
    case "view_history":
      return "View history";
  }
}

function nextActionBadgeVariant(action: QueueNextAction) {
  switch (action) {
    case "run_now":
      return "success";
    case "review_report":
    case "accept_result":
    case "request_changes":
    case "create_follow_up":
    case "reject_result":
      return "warning";
    case "resolve_dependency":
    case "resolve_blocker":
    case "wait_for_capacity":
    case "assign_worker":
      return "info";
    case "retry_or_rerun":
    case "close_cancelled":
      return "error";
    default:
      return "neutral";
  }
}
