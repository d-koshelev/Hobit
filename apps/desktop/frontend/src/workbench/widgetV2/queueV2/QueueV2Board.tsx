import { useMemo, useRef, useState } from "react";

import type { AgentQueueTask } from "../../../workspace/types";
import {
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "../../agentQueueTaskUiModel";
import {
  selectQueueV2ViewModel,
  type QueueBoardLane,
  type QueueTaskViewModel,
  type QueueWorkerSnapshot,
} from "../../queue/queueV2ViewModel";
import { QueueV2CollapsibleLane } from "./QueueV2CollapsibleLane";
import { QueueV2TaskCard } from "./QueueV2TaskCard";
import { QueueV2TaskDetailsPopup } from "./QueueV2TaskDetailsPopup";

type QueueV2BoardProps = {
  autorunArmed?: boolean;
  globalExecutionState?: QueueGlobalStatus;
  initialSelectedTaskId?: string | null;
  onSelectedTaskChange?: (taskId: string) => void;
  pausedQueueTagIds?: ReadonlySet<string>;
  tasks: readonly AgentQueueTask[];
  workers?: readonly AgentWorkerSummary[];
};

const LEADING_BOARD_LANES: { id: QueueBoardLane; label: string }[] = [
  { id: "intake_draft", label: "Intake" },
  { id: "ready", label: "Ready" },
];

const TRAILING_BOARD_LANES: { id: QueueBoardLane; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
];

const DEFAULT_VISIBLE_CARD_LIMIT = 6;
const RUNNING_VISIBLE_CARD_LIMIT = 4;
const CLOSED_VISIBLE_CARD_LIMIT = 4;

export function QueueV2Board({
  autorunArmed = false,
  globalExecutionState = "started",
  initialSelectedTaskId = null,
  onSelectedTaskChange,
  pausedQueueTagIds = new Set(),
  tasks,
  workers = [],
}: QueueV2BoardProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialSelectedTaskId,
  );
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const detailsReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const viewModelSelectedTaskId = detailsTaskId ?? selectedTaskId;
  const board = useMemo(
    () =>
      selectQueueV2ViewModel({
        autorunArmed,
        globalExecutionState,
        pausedQueueTagIds,
        selectedTaskId: viewModelSelectedTaskId,
        tasks,
        workers,
      }),
    [
      autorunArmed,
      globalExecutionState,
      pausedQueueTagIds,
      tasks,
      viewModelSelectedTaskId,
      workers,
    ],
  );
  const runningGroups = useMemo(
    () => groupRunningTasks(board.lanes.running, board.capacity.workers),
    [board.capacity.workers, board.lanes.running],
  );

  function selectTask(taskId: string) {
    setSelectedTaskId(taskId);
    onSelectedTaskChange?.(taskId);
  }

  function openTaskDetails(taskId: string, sourceButton: HTMLButtonElement | null) {
    detailsReturnFocusRef.current = sourceButton;
    setSelectedTaskId(taskId);
    setDetailsTaskId(taskId);
    onSelectedTaskChange?.(taskId);
  }

  const detailTaskViewModel =
    detailsTaskId && board.inspector
      ? board.tasks.find((item) => item.taskId === detailsTaskId) ?? null
      : null;

  return (
    <section aria-label="Queue v2 board" className="queue-v2-board">
      <div className="queue-v2-lanes" role="list">
        {LEADING_BOARD_LANES.map((lane) => (
          <QueueV2Lane
            items={board.lanes[lane.id]}
            key={lane.id}
            label={lane.label}
            lane={lane.id}
            onOpenTaskDetails={openTaskDetails}
            onSelectTask={selectTask}
            selectedTaskId={selectedTaskId}
          />
        ))}

        <QueueV2RunningLane
          groups={runningGroups}
          onOpenTaskDetails={openTaskDetails}
          onSelectTask={selectTask}
          selectedTaskId={selectedTaskId}
        />

        {TRAILING_BOARD_LANES.map((lane) => (
          <QueueV2Lane
            items={board.lanes[lane.id]}
            key={lane.id}
            label={lane.label}
            lane={lane.id}
            onOpenTaskDetails={openTaskDetails}
            onSelectTask={selectTask}
            selectedTaskId={selectedTaskId}
          />
        ))}

        <QueueV2ClosedLane
          items={board.lanes.closed}
          onOpenTaskDetails={openTaskDetails}
          onSelectTask={selectTask}
          selectedTaskId={selectedTaskId}
        />
      </div>
      <QueueV2TaskDetailsPopup
        inspector={detailsTaskId ? board.inspector : null}
        isOpen={detailsTaskId !== null}
        onRequestClose={() => setDetailsTaskId(null)}
        returnFocusRef={detailsReturnFocusRef}
        taskViewModel={detailTaskViewModel}
      />
    </section>
  );
}

function QueueV2Lane({
  items,
  label,
  lane,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  items: QueueTaskViewModel[];
  label: string;
  lane: QueueBoardLane;
  onOpenTaskDetails: (taskId: string, sourceButton: HTMLButtonElement) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <QueueV2CollapsibleLane
      className="queue-v2-lane"
      count={items.length}
      label={label}
      laneKey={lane}
    >
      <QueueV2CardStack
        emptyLabel="No tasks"
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
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  groups: RunningTaskGroup[];
  onOpenTaskDetails: (taskId: string, sourceButton: HTMLButtonElement) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
}) {
  const runningCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <QueueV2CollapsibleLane
      className="queue-v2-lane queue-v2-running-lane"
      collapsedSummary={<QueueV2RunningCollapsedSummary groups={groups} />}
      count={runningCount}
      label="Running"
      laneKey="running"
    >
      {runningCount === 0 ? (
        <div className="queue-v2-lane-empty">No running tasks</div>
      ) : (
        <div className="queue-v2-worker-groups">
          {groups.map((group) => (
            <section
              aria-label={`${group.label} running group`}
              className="queue-v2-worker-group"
              key={group.workerId}
            >
              <div className="queue-v2-worker-header">
                <span>{group.label}</span>
                <span>{groupSummary(group)}</span>
              </div>
              <QueueV2CardStack
                emptyLabel="No tasks"
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
  items,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  items: QueueTaskViewModel[];
  onOpenTaskDetails: (taskId: string, sourceButton: HTMLButtonElement) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
}) {
  return (
    <QueueV2CollapsibleLane
      className="queue-v2-lane queue-v2-closed-lane"
      count={items.length}
      dataAttributes={{
        "queue-v2-history-block": "state",
      }}
      defaultExpanded={false}
      label="Closed"
      laneKey="closed"
    >
      <div className="queue-v2-closed-history">
        <QueueV2CardStack
          emptyLabel="No closed tasks"
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
  items,
  limit,
  onOpenTaskDetails,
  onSelectTask,
  selectedTaskId,
}: {
  emptyLabel: string;
  items: QueueTaskViewModel[];
  limit: number;
  onOpenTaskDetails: (taskId: string, sourceButton: HTMLButtonElement) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = isExpanded ? items : items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  if (items.length === 0) {
    return (
      <div className="queue-v2-card-stack" role="list">
        <div className="queue-v2-lane-empty">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div className="queue-v2-card-stack" role="list">
      {visibleItems.map((item) => (
        <QueueV2TaskCard
          isSelected={selectedTaskId === item.taskId}
          item={item}
          key={item.taskId}
          onOpenDetails={onOpenTaskDetails}
          onSelect={onSelectTask}
        />
      ))}
      {hiddenCount > 0 ? (
        <button
          className="queue-v2-lane-overflow"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          + {hiddenCount.toString()} more
        </button>
      ) : null}
      {isExpanded && items.length > limit ? (
        <button
          className="queue-v2-lane-overflow"
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
    <div className="queue-v2-lane-collapsed-lines">
      {groups.slice(0, 2).map((group) => (
        <span key={group.workerId}>
          {group.label}: {groupSummary(group)}
        </span>
      ))}
      {groups.length > 2 ? <span>+ {(groups.length - 2).toString()} workers</span> : null}
    </div>
  );
}

type RunningTaskGroup = {
  items: QueueTaskViewModel[];
  label: string;
  status: "online" | "offline";
  workerId: string;
  worker: QueueWorkerSnapshot | null;
};

function groupRunningTasks(
  runningItems: QueueTaskViewModel[],
  workers: QueueWorkerSnapshot[],
): RunningTaskGroup[] {
  const groups = new Map<string, RunningTaskGroup>();

  for (const item of runningItems) {
    const workerId = runningWorkerId(item.task);
    const worker =
      workers.find((candidate) => candidate.workerId === workerId) ?? null;
    const groupKey = workerId ?? "unassigned";
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

function runningWorkerId(task: AgentQueueTask) {
  return task.assignedWorkerId ?? task.assignedExecutorWidgetId ?? null;
}

function groupSummary(group: RunningTaskGroup) {
  const state = group.status === "online" ? "Online" : "Offline";
  const capacity = group.worker
    ? `${group.worker.runningCount.toString()}/${group.worker.capacity.toString()}`
    : group.items.length.toString();

  return `${state} / ${capacity} active`;
}
