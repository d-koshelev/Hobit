import { useMemo, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import type { AgentQueueReportActionCard, AgentQueueTask } from "../workspace/types";
import {
  normalizeQueueTag,
  queueGlobalExecutionStateLabel,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "./agentQueueTaskUiModel";
import { queueTagColorToken } from "./queue/agentQueueTagColors";
import type { WidgetRenderProps } from "./types";
import {
  selectQueueV2ViewModel,
  type QueueBoardLane,
  type QueueTaskViewModel,
  type QueueWorkerSnapshot,
} from "./queue/queueV2ViewModel";
import type { QueueNextAction } from "./queue/queueV2NextActionModel";
import {
  QueueV2TaskDetailsPopup,
  queueV2NextActionLabel,
} from "./widgetV2/queueV2/QueueV2TaskDetailsPopup";
import type { AgentQueueController } from "./queue/details/agentQueueTaskDetailsTypes";

type AgentQueueV2BoardProps = {
  autorunArmed: boolean;
  globalExecutionState: QueueGlobalStatus;
  isSelecting: boolean;
  onCreateKnowledgeDocument?: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill?: WidgetRenderProps["onCreateSkill"];
  onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onRecordKnowledgeDraftReview?: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  onSelectTask: (queueItemId: string) => void;
  onRequestNewTask?: () => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  queue?: AgentQueueController;
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

const BOARD_LANES: { id: QueueBoardLane; label: string }[] = [
  { id: "intake_draft", label: "Intake / Draft" },
  { id: "ready", label: "Ready" },
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
];

const DEFAULT_VISIBLE_CARD_LIMIT = 6;
const RUNNING_VISIBLE_CARD_LIMIT = 4;
const CLOSED_VISIBLE_CARD_LIMIT = 4;

export function AgentQueueV2Board({
  autorunArmed,
  globalExecutionState,
  isSelecting,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  onRequestNewTask,
  onSelectTask,
  onShowQueueReportInWorkspaceChat,
  pausedQueueTagIds,
  queue,
  selectedTask,
  tasks,
  workers,
}: AgentQueueV2BoardProps) {
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const detailsReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const board = useMemo(
    () =>
      selectQueueV2ViewModel({
        autorunArmed,
        globalExecutionState,
        pausedQueueTagIds,
        selectedTaskId: detailsTaskId ?? selectedTask?.queueItemId ?? null,
        tasks,
        workers,
      }),
    [
      autorunArmed,
      detailsTaskId,
      globalExecutionState,
      pausedQueueTagIds,
      selectedTask?.queueItemId,
      tasks,
      workers,
    ],
  );
  const detailTaskViewModel =
    detailsTaskId && board.inspector
      ? board.tasks.find((item) => item.taskId === detailsTaskId) ?? null
      : null;
  const runningGroups = useMemo(
    () => groupRunningTasks(board.lanes.running, board.capacity.workers),
    [board.capacity.workers, board.lanes.running],
  );

  function openTaskDetails(taskId: string, sourceButton: HTMLButtonElement | null) {
    detailsReturnFocusRef.current = sourceButton;
    setDetailsTaskId(taskId);
    onSelectTask(taskId);
  }

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
          {BOARD_LANES.slice(0, 2).map((lane) => (
            <QueueV2Lane
              isSelecting={isSelecting}
              items={board.lanes[lane.id]}
              key={lane.id}
              label={lane.label}
              onOpenTaskDetails={openTaskDetails}
              onSelectTask={onSelectTask}
              selectedTaskId={selectedTask?.queueItemId ?? null}
            />
          ))}
          <QueueV2RunningLane
            groups={runningGroups}
            isSelecting={isSelecting}
            onOpenTaskDetails={openTaskDetails}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTask?.queueItemId ?? null}
          />
          {BOARD_LANES.slice(2).map((lane) => (
            <QueueV2Lane
              isSelecting={isSelecting}
              items={board.lanes[lane.id]}
              key={lane.id}
              label={lane.label}
              onOpenTaskDetails={openTaskDetails}
              onSelectTask={onSelectTask}
              selectedTaskId={selectedTask?.queueItemId ?? null}
            />
          ))}
          <QueueV2ClosedLane
            isSelecting={isSelecting}
            items={board.lanes.closed}
            onOpenTaskDetails={openTaskDetails}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTask?.queueItemId ?? null}
          />
        </div>
      </div>

      <details className="agent-queue-v2-activity-drawer">
        <summary>Activity and raw execution detail</summary>
        <p>
          Raw run links, logs, reports, and developer detail remain collapsed in
          the existing selected-task details path.
        </p>
      </details>
      <QueueV2TaskDetailsPopup
        inspector={detailsTaskId ? board.inspector : null}
        isOpen={detailsTaskId !== null}
        onCreateKnowledgeDocument={onCreateKnowledgeDocument}
        onCreateSkill={onCreateSkill}
        onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
        onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
        onRequestNewTask={onRequestNewTask}
        onRequestClose={() => setDetailsTaskId(null)}
        onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
        queue={queue}
        returnFocusRef={detailsReturnFocusRef}
        taskViewModel={detailTaskViewModel}
      />
    </section>
  );
}

function QueueV2Lane({
  isSelecting,
  items,
  label,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  isSelecting: boolean;
  items: QueueTaskViewModel[];
  label: string;
  onOpenTaskDetails: (queueItemId: string, sourceButton: HTMLButtonElement | null) => void;
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
      <QueueV2CardStack
        emptyLabel="No tasks."
        isSelecting={isSelecting}
        items={items}
        limit={DEFAULT_VISIBLE_CARD_LIMIT}
        onOpenTaskDetails={onOpenTaskDetails}
        onSelectTask={onSelectTask}
        selectedTaskId={selectedTaskId}
      />
    </section>
  );
}

function QueueV2RunningLane({
  groups,
  isSelecting,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  groups: RunningTaskGroup[];
  isSelecting: boolean;
  onOpenTaskDetails: (queueItemId: string, sourceButton: HTMLButtonElement | null) => void;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  const runningCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section
      aria-label="Running lane"
      className="agent-queue-v2-lane agent-queue-v2-running-lane"
      role="listitem"
    >
      <div className="agent-queue-v2-lane-header">
        <p>Running</p>
        <span>{runningCount}</span>
      </div>
      {runningCount === 0 ? (
        <div className="agent-queue-v2-lane-empty">No running tasks.</div>
      ) : (
        <div className="agent-queue-v2-worker-groups">
          {groups.map((group) => (
            <section
              aria-label={`${group.label} running group`}
              className="agent-queue-v2-worker-group"
              key={group.workerId}
            >
              <div className="agent-queue-v2-worker-header">
                <span>{group.label}</span>
                <span>{groupSummary(group)}</span>
              </div>
              <QueueV2CardStack
                emptyLabel="No tasks."
                isSelecting={isSelecting}
                items={group.items}
                limit={RUNNING_VISIBLE_CARD_LIMIT}
                onOpenTaskDetails={onOpenTaskDetails}
                onSelectTask={onSelectTask}
                selectedTaskId={selectedTaskId}
              />
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function QueueV2ClosedLane({
  isSelecting,
  items,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  isSelecting: boolean;
  items: QueueTaskViewModel[];
  onOpenTaskDetails: (queueItemId: string, sourceButton: HTMLButtonElement | null) => void;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section
      aria-label="Closed lane"
      className="agent-queue-v2-lane agent-queue-v2-closed-lane"
      role="listitem"
    >
      <details open={isExpanded}>
        <summary
          onClick={(event) => {
            event.preventDefault();
            setIsExpanded((current) => !current);
          }}
        >
          <span>Closed</span>
          <span>{items.length}</span>
        </summary>
        {isExpanded ? (
          <QueueV2CardStack
            emptyLabel="No closed tasks."
            isSelecting={isSelecting}
            items={items}
            limit={CLOSED_VISIBLE_CARD_LIMIT}
            onOpenTaskDetails={onOpenTaskDetails}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
          />
        ) : null}
      </details>
    </section>
  );
}

function QueueV2CardStack({
  emptyLabel,
  isSelecting,
  items,
  limit,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  emptyLabel: string;
  isSelecting: boolean;
  items: QueueTaskViewModel[];
  limit: number;
  onOpenTaskDetails: (queueItemId: string, sourceButton: HTMLButtonElement | null) => void;
  onSelectTask: (queueItemId: string) => void;
  selectedTaskId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = isExpanded ? items : items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  if (items.length === 0) {
    return (
      <div className="agent-queue-v2-card-stack" role="list">
        <div className="agent-queue-v2-lane-empty">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div className="agent-queue-v2-card-stack" role="list">
      {visibleItems.map((item) => (
        <QueueV2Card
          isSelected={selectedTaskId === item.taskId}
          isSelecting={isSelecting}
          item={item}
          key={item.taskId}
          onOpenTaskDetails={onOpenTaskDetails}
          onSelectTask={onSelectTask}
        />
      ))}
      {hiddenCount > 0 ? (
        <button
          className="agent-queue-v2-lane-overflow"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          + {hiddenCount.toString()} more
        </button>
      ) : null}
      {isExpanded && items.length > limit ? (
        <button
          className="agent-queue-v2-lane-overflow"
          onClick={() => setIsExpanded(false)}
          type="button"
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}

function QueueV2Card({
  isSelected,
  isSelecting,
  item,
  onOpenTaskDetails,
  onSelectTask,
}: {
  isSelected: boolean;
  isSelecting: boolean;
  item: QueueTaskViewModel;
  onOpenTaskDetails: (queueItemId: string, sourceButton: HTMLButtonElement | null) => void;
  onSelectTask: (queueItemId: string) => void;
}) {
  const tag = normalizeQueueTag(item.task);
  const colorToken = queueTagColorToken(tag.queueTagId);
  const attachmentCount =
    (item.task.context?.attachedKnowledgeRefs.length ?? 0) +
    (item.task.context?.attachedSkillRefs.length ?? 0);
  const workerLabel =
    item.task.assignedWorkerId ?? item.task.assignedExecutorWidgetId ?? null;
  const blockerSummary =
    item.blockedReasons[0]?.label ??
    (item.eligibility.blockedReasons[0]?.label || null);

  return (
    <article
      aria-current={isSelected ? "true" : undefined}
      className={[
        "agent-queue-v2-card",
        colorToken,
        isSelected ? "agent-queue-v2-card-selected" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-queue-item-id={item.taskId}
      data-queue-v2-lane={item.boardLane}
      data-queue-v2-tag-color={colorToken}
      data-task-order-id={item.taskId}
      onClick={() => {
        if (!isSelecting) {
          onOpenTaskDetails(item.taskId, null);
        }
      }}
      title={item.title}
    >
      <span className="agent-queue-v2-card-stripe" aria-hidden="true" />
      <button
        className="agent-queue-v2-card-select"
        disabled={isSelecting}
        onClick={(event) => {
          event.stopPropagation();
          onOpenTaskDetails(item.taskId, event.currentTarget);
        }}
        type="button"
      >
        <span className="agent-queue-v2-card-title">{item.title}</span>
      </button>
      <span className="agent-queue-v2-card-line">
        <span className="agent-queue-v2-card-tag-dot" aria-hidden="true" />
        <span>{tag.queueTagName}</span>
      </span>
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
      <button
        className="agent-queue-v2-card-details"
        disabled={isSelecting}
        onClick={(event) => {
          event.stopPropagation();
          onOpenTaskDetails(item.taskId, event.currentTarget);
        }}
        type="button"
      >
        Details
      </button>
    </article>
  );
}

function nextActionLabel(action: QueueNextAction) {
  return queueV2NextActionLabel(action);
}

type RunningTaskGroup = {
  items: QueueTaskViewModel[];
  label: string;
  status: "online" | "offline";
  worker: QueueWorkerSnapshot | null;
  workerId: string;
};

function groupRunningTasks(
  runningItems: QueueTaskViewModel[],
  workers: QueueWorkerSnapshot[],
): RunningTaskGroup[] {
  const groups = new Map<string, RunningTaskGroup>();

  for (const item of runningItems) {
    const workerId = item.task.assignedWorkerId ?? item.task.assignedExecutorWidgetId;
    const groupKey = workerId ?? "unassigned";
    const worker =
      workerId
        ? workers.find((candidate) => candidate.workerId === workerId) ?? null
        : null;
    const group =
      groups.get(groupKey) ??
      ({
        items: [],
        label: worker?.label ?? (workerId ? `Worker ${workerId}` : "Unassigned worker"),
        status: worker?.paused ? "offline" : "online",
        worker,
        workerId: groupKey,
      } satisfies RunningTaskGroup);

    group.items.push(item);
    groups.set(groupKey, group);
  }

  return Array.from(groups.values());
}

function groupSummary(group: RunningTaskGroup) {
  const state = group.status === "online" ? "Online" : "Offline";
  const capacity = group.worker
    ? `${group.worker.runningCount.toString()}/${group.worker.capacity.toString()}`
    : group.items.length.toString();

  return `${state} / ${capacity} active`;
}

function nextActionBadgeVariant(action: QueueNextAction) {
  switch (action) {
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
    default:
      return "neutral";
  }
}
