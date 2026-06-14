import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueReportActionCard, AgentQueueTask } from "../workspace/types";
import {
  normalizeQueueTag,
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
import {
  queueV2NextActionLabel,
} from "./queue/queueV2NextActionModel";
import {
  queueV2CardStatusDetail,
  queueV2HumanStatusBadgeVariant,
  queueV2MarkerBadgeVariant,
  queueV2NextActionBadgeVariant,
} from "./queue/queueV2CardStatusUi";
import { QueueV2TaskDetailsPopup } from "./widgetV2/queueV2/QueueV2TaskDetailsPopup";
import { QueueV2CollapsibleLane } from "./widgetV2/queueV2/QueueV2CollapsibleLane";
import {
  queueV2EnableState,
  queueV2StateBadge,
} from "./widgetV2/queueV2/model/queueV2StateBadge";
import type { AgentQueueController } from "./queue/details/agentQueueTaskDetailsTypes";
import {
  queueV2ValidationEvidenceView,
  validationStatusDataAttribute,
} from "./widgetV2/queueV2/queueV2ValidationEvidence";
import { queueV2CoordinatorFinalizationView } from "./widgetV2/queueV2/queueV2CoordinatorFinalization";
import type {
  QueueValidationRunResult,
} from "./queue/queueValidationEvidenceService";
import type { ValidationRunner } from "./validation";

type AgentQueueV2BoardProps = {
  autorunArmed: boolean;
  currentWorkspaceRoot?: string | null;
  globalExecutionState: QueueGlobalStatus;
  isSelecting: boolean;
  onCreateKnowledgeDocument?: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill?: WidgetRenderProps["onCreateSkill"];
  onListKnowledgeDraftReviews?: WidgetRenderProps["onListKnowledgeDraftReviews"];
  onRecordKnowledgeDraftReview?: WidgetRenderProps["onRecordKnowledgeDraftReview"];
  onSelectTask: (queueItemId: string) => void;
  onRequestNewTask?: () => void;
  onRequestValidation?: (task: AgentQueueTask, runner: ValidationRunner) => Promise<QueueValidationRunResult>;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  queue?: AgentQueueController;
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
  validationRunner?: ValidationRunner | null;
  workers: AgentWorkerSummary[];
};

const BOARD_LANES: { id: QueueBoardLane; label: string }[] = [
  { id: "intake_draft", label: "Intake / Draft" },
  { id: "ready", label: "Ready" },
  { id: "waiting_dependency", label: "Waiting dependency" },
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
];

const DEFAULT_VISIBLE_CARD_LIMIT = 6;
const RUNNING_VISIBLE_CARD_LIMIT = 4;
const CLOSED_VISIBLE_CARD_LIMIT = 4;

export function AgentQueueV2Board({
  autorunArmed,
  currentWorkspaceRoot = null,
  globalExecutionState,
  isSelecting,
  onCreateKnowledgeDocument,
  onCreateSkill,
  onListKnowledgeDraftReviews,
  onRecordKnowledgeDraftReview,
  onRequestNewTask,
  onRequestValidation,
  onSelectTask,
  onShowQueueReportInWorkspaceChat,
  onShowQueueTaskInWorkspaceChat,
  pausedQueueTagIds,
  queue,
  selectedTask,
  tasks,
  validationRunner,
  workers,
}: AgentQueueV2BoardProps) {
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const previousDetailsLaneRef = useRef<QueueBoardLane | null>(null);
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
  const detailTaskLane = detailTaskViewModel?.boardLane ?? null;
  const runningGroups = useMemo(
    () => groupRunningTasks(board.lanes.running, board.capacity.workers),
    [board.capacity.workers, board.lanes.running],
  );
  const queueState = queueV2StateBadge({
    apiAvailable: queue?.apiAvailable ?? false,
    availableSlots: board.capacity.availableSlots,
    blockedCount: board.lanes.blocked.length,
    globalExecutionState,
    hasQueueControls: Boolean(queue?.foundation?.onStartWorkers),
    runningCount: board.counts.running,
    totalSlots: board.capacity.totalSlots,
  });
  const enableState = queueV2EnableState({
    apiAvailable: queue?.apiAvailable ?? false,
    globalExecutionState,
    hasCodexExecutable: tasks.some((task) => Boolean(task.codexExecutable?.trim())),
    hasQueueControls: Boolean(queue?.foundation?.onStartWorkers),
  });

  useEffect(() => {
    if (!detailsTaskId) {
      previousDetailsLaneRef.current = null;
      return;
    }

    const previousLane = previousDetailsLaneRef.current;

    if (!detailTaskViewModel) {
      previousDetailsLaneRef.current = null;
      setDetailsTaskId(null);
      return;
    }

    if (
      detailTaskLane === "closed" &&
      previousLane !== null &&
      previousLane !== "closed"
    ) {
      previousDetailsLaneRef.current = null;
      setDetailsTaskId(null);
      return;
    }

    previousDetailsLaneRef.current = detailTaskLane;
  }, [detailTaskLane, detailTaskViewModel, detailsTaskId]);

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
        <div className="agent-queue-v2-state-actions" aria-label="Queue state">
          <Badge
            aria-label={`Queue state: ${queueState.label}`}
            title={queueState.title}
            variant={queueState.variant}
          >
            {queueState.label}
          </Badge>
          {globalExecutionState !== "started" ? (
            <Button
              disabled={enableState.disabled}
              onClick={() => queue?.foundation.onStartWorkers()}
              title={enableState.reason}
              variant="primary"
            >
              Enable Queue
            </Button>
          ) : null}
          {globalExecutionState !== "started" && enableState.reason ? (
            <span>{enableState.reason}</span>
          ) : null}
        </div>
        <dl className="agent-queue-v2-command-facts" aria-label="Queue v2 summary">
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
          {BOARD_LANES.slice(0, 3).map((lane) => (
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
          {BOARD_LANES.slice(3).map((lane) => (
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
        <summary>Activity and execution detail</summary>
        <p>
          Run links, logs, reports, and developer detail remain available from
          the selected-task details path.
        </p>
      </details>
      <QueueV2TaskDetailsPopup
        currentWorkspaceRoot={currentWorkspaceRoot}
        inspector={detailsTaskId ? board.inspector : null}
        isOpen={detailsTaskId !== null}
          onCreateKnowledgeDocument={onCreateKnowledgeDocument}
          onCreateSkill={onCreateSkill}
          onListKnowledgeDraftReviews={onListKnowledgeDraftReviews}
          onRecordKnowledgeDraftReview={onRecordKnowledgeDraftReview}
        onRequestNewTask={onRequestNewTask}
        onRequestValidation={onRequestValidation}
        onRequestClose={() => setDetailsTaskId(null)}
          onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
          onShowQueueTaskInWorkspaceChat={onShowQueueTaskInWorkspaceChat}
        queue={queue}
        returnFocusRef={detailsReturnFocusRef}
        taskViewModel={detailTaskViewModel}
        validationRunner={validationRunner}
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
    <QueueV2CollapsibleLane
      className="agent-queue-v2-lane"
      count={items.length}
      label={label}
    >
      <QueueV2CardStack
        emptyLabel="No tasks."
        isSelecting={isSelecting}
        items={items}
        limit={DEFAULT_VISIBLE_CARD_LIMIT}
        onOpenTaskDetails={onOpenTaskDetails}
        onSelectTask={onSelectTask}
        selectedTaskId={selectedTaskId}
      />
    </QueueV2CollapsibleLane>
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
    <QueueV2CollapsibleLane
      className="agent-queue-v2-lane agent-queue-v2-running-lane"
      collapsedSummary={<QueueV2RunningCollapsedSummary groups={groups} />}
      count={runningCount}
      label="Running"
    >
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
    </QueueV2CollapsibleLane>
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
  return (
    <QueueV2CollapsibleLane
      className="agent-queue-v2-lane agent-queue-v2-closed-lane"
      count={items.length}
      dataAttributes={{
        "queue-v2-history-block": "state",
      }}
      defaultExpanded={false}
      label="Closed"
    >
      <div className="agent-queue-v2-closed-history">
        <QueueV2CardStack
          emptyLabel="No closed tasks."
          isSelecting={isSelecting}
          items={items}
          limit={CLOSED_VISIBLE_CARD_LIMIT}
          onOpenTaskDetails={onOpenTaskDetails}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTaskId}
        />
      </div>
    </QueueV2CollapsibleLane>
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

function QueueV2RunningCollapsedSummary({ groups }: { groups: RunningTaskGroup[] }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="agent-queue-v2-lane-collapsed-lines">
      {groups.slice(0, 2).map((group) => (
        <span key={group.workerId}>
          {group.label}: {groupSummary(group)}
        </span>
      ))}
      {groups.length > 2 ? <span>+ {(groups.length - 2).toString()} workers</span> : null}
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
  const blockerSummary = queueV2CardStatusDetail(item);
  const validation = queueV2ValidationEvidenceView(item.task);
  const coordinator = queueV2CoordinatorFinalizationView(item.task);

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
      data-queue-v2-coordinator={item.task.coordinatorStatus ?? "not_reported"}
      data-queue-v2-validation={validationStatusDataAttribute(item.task)}
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
        <span>Status</span>
        <Badge variant={queueV2HumanStatusBadgeVariant(item.humanStatus.status)}>
          {item.humanStatus.text}
        </Badge>
      </span>
      <span className="agent-queue-v2-card-line">
        <span>Next</span>
        <Badge variant={queueV2NextActionBadgeVariant(item.nextAction)}>
          {queueV2NextActionLabel(item.nextAction)}
        </Badge>
      </span>
      <span className="agent-queue-v2-card-line">
        <span>Validation</span>
        <Badge variant={queueV2MarkerBadgeVariant(validation.markerTone)}>
          {validation.marker}
        </Badge>
      </span>
      <span className="agent-queue-v2-card-line">
        <span>Coordinator</span>
        <Badge variant={queueV2MarkerBadgeVariant(coordinator.cardMarkerTone)}>
          {coordinator.cardMarker}
        </Badge>
      </span>
      {coordinator.commitSaved ? (
        <span className="agent-queue-v2-card-note">Commit saved</span>
      ) : null}
      {coordinator.blockedMarker ? (
        <span className="agent-queue-v2-card-note">
          {coordinator.blockedMarker}
        </span>
      ) : null}
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

type RunningTaskGroup = {
  items: QueueTaskViewModel[]; label: string; status: "online" | "offline";
  worker: QueueWorkerSnapshot | null; workerId: string;
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
