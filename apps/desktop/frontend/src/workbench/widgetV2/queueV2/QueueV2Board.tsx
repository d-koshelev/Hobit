import { useMemo, useRef, useState } from "react";
import { WidgetDebugPopup } from "../../../design-system/widget/WidgetDebugPopup";

import type { AgentQueueTask } from "../../../workspace/types";
import type {
  QueueValidationRunResult,
} from "../../queue/queueValidationEvidenceService";
import type { ValidationRunner } from "../../validation";
import {
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "../../agentQueueTaskUiModel";
import type { AgentQueueController } from "../../queue/details/agentQueueTaskDetailsTypes";
import {
  selectQueueV2ViewModel,
  type QueueBoardLane,
  type QueueTaskViewModel,
  type QueueWorkerSnapshot,
} from "../../queue/queueV2ViewModel";
import { QueueV2CollapsibleLane } from "./QueueV2CollapsibleLane";
import { buildQueueV2DebugModel } from "./debug/queueV2DebugModel";
import { QueueV2DebugContent } from "./debug/QueueV2DebugContent";
import { QueueV2TaskCard } from "./QueueV2TaskCard";
import { QueueV2TaskDetailsPopup } from "./QueueV2TaskDetailsPopup";
import { buildQueueV2TaskDetailsActions } from "./queueV2TaskDetailsActions";
import {
  validationRequestDisabledReason,
} from "./QueueV2ValidationEvidenceSection";

type QueueV2BoardProps = {
  autorunArmed?: boolean;
  currentWorkspaceRoot?: string | null;
  globalExecutionState?: QueueGlobalStatus;
  initialSelectedTaskId?: string | null;
  onSelectedTaskChange?: (taskId: string) => void;
  onRequestValidation?: (
    task: AgentQueueTask,
    runner: ValidationRunner,
  ) => Promise<QueueValidationRunResult>;
  pausedQueueTagIds?: ReadonlySet<string>;
  queue?: AgentQueueController;
  tasks: readonly AgentQueueTask[];
  validationRunner?: ValidationRunner | null;
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
  currentWorkspaceRoot = null,
  globalExecutionState = "started",
  initialSelectedTaskId = null,
  onSelectedTaskChange,
  onRequestValidation,
  pausedQueueTagIds = new Set(),
  queue,
  tasks,
  validationRunner,
  workers = [],
}: QueueV2BoardProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialSelectedTaskId,
  );
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [debugTaskId, setDebugTaskId] = useState<string | null>(null);
  const detailsReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const debugReturnFocusRef = useRef<HTMLButtonElement | null>(null);
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

  function openTaskDebug(taskId: string, sourceButton: HTMLButtonElement | null) {
    debugReturnFocusRef.current = sourceButton;
    setSelectedTaskId(taskId);
    setDebugTaskId(taskId);
    onSelectedTaskChange?.(taskId);
  }

  function openLinkedTaskDetails(taskId: string) {
    setSelectedTaskId(taskId);
    setDetailsTaskId(taskId);
    onSelectedTaskChange?.(taskId);
  }

  const detailTaskViewModel =
    detailsTaskId && board.inspector
      ? board.tasks.find((item) => item.taskId === detailsTaskId) ?? null
      : null;
  const debugTaskViewModel =
    debugTaskId && board.inspector
      ? board.tasks.find((item) => item.taskId === debugTaskId) ?? null
      : null;
  const debugActions = useMemo(
    () =>
      buildQueueV2TaskDetailsActions({
        currentWorkspaceRoot,
        inspector: board.inspector,
        onRequestNewTask: undefined,
        onSelectTab: () => undefined,
        queue,
        task: debugTaskViewModel?.task ?? null,
      }),
    [board.inspector, currentWorkspaceRoot, debugTaskViewModel?.task, queue],
  );
  const debugModel =
    debugTaskViewModel && board.inspector
      ? buildQueueV2DebugModel({
          currentWorkspaceRoot,
          inspector: board.inspector,
          queue,
          task: debugTaskViewModel.task,
          taskActions: debugActions,
          validationDisabledReason: validationRequestDisabledReason({
            onRequestValidation,
            task: debugTaskViewModel.task,
            validationRunner,
          }),
        })
      : null;

  function closeDebugPopup() {
    setDebugTaskId(null);
  }

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
            onOpenTaskDebug={openTaskDebug}
            onSelectTask={selectTask}
            selectedTaskId={selectedTaskId}
          />
        ))}

        <QueueV2RunningLane
          groups={runningGroups}
          onOpenTaskDebug={openTaskDebug}
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
            onOpenTaskDebug={openTaskDebug}
            onSelectTask={selectTask}
            selectedTaskId={selectedTaskId}
          />
        ))}

        <QueueV2ClosedLane
          items={board.lanes.closed}
          onOpenTaskDetails={openTaskDetails}
          onOpenTaskDebug={openTaskDebug}
          onSelectTask={selectTask}
          selectedTaskId={selectedTaskId}
        />
      </div>
      <QueueV2TaskDetailsPopup
        currentWorkspaceRoot={currentWorkspaceRoot}
        inspector={detailsTaskId ? board.inspector : null}
        isOpen={detailsTaskId !== null}
        onOpenLinkedTask={openLinkedTaskDetails}
        onRequestValidation={onRequestValidation}
        onRequestClose={() => setDetailsTaskId(null)}
        queue={queue}
        returnFocusRef={detailsReturnFocusRef}
        taskViewModel={detailTaskViewModel}
        validationRunner={validationRunner}
      />
      <WidgetDebugPopup
        open={debugTaskId !== null}
        returnFocusRef={debugReturnFocusRef}
        onClose={closeDebugPopup}
        title={
          debugTaskViewModel
            ? `${debugTaskViewModel.task.title} - Queue runtime details`
            : "Queue runtime details"
        }
      >
        {debugModel ? <QueueV2DebugContent model={debugModel} /> : null}
      </WidgetDebugPopup>
    </section>
  );
}

function QueueV2Lane({
  items,
  label,
  lane,
  onOpenTaskDetails,
  onOpenTaskDebug,
  onSelectTask,
  selectedTaskId,
}: {
  items: QueueTaskViewModel[];
  label: string;
  lane: QueueBoardLane;
  onOpenTaskDetails: (
    taskId: string,
    sourceButton: HTMLButtonElement | null,
  ) => void;
  onOpenTaskDebug: (taskId: string, sourceButton: HTMLButtonElement | null) => void;
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
        onOpenTaskDebug={onOpenTaskDebug}
        onSelectTask={onSelectTask}
        selectedTaskId={selectedTaskId}
      />
    </QueueV2CollapsibleLane>
  );
}

function QueueV2RunningLane({
  groups,
  onOpenTaskDetails,
  onOpenTaskDebug,
  onSelectTask,
  selectedTaskId,
}: {
  groups: RunningTaskGroup[];
  onOpenTaskDetails: (
    taskId: string,
    sourceButton: HTMLButtonElement | null,
  ) => void;
  onOpenTaskDebug: (taskId: string, sourceButton: HTMLButtonElement | null) => void;
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
                onOpenTaskDebug={onOpenTaskDebug}
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
  onOpenTaskDebug,
  onSelectTask,
  selectedTaskId,
}: {
  items: QueueTaskViewModel[];
  onOpenTaskDetails: (
    taskId: string,
    sourceButton: HTMLButtonElement | null,
  ) => void;
  onOpenTaskDebug: (taskId: string, sourceButton: HTMLButtonElement | null) => void;
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
        onOpenTaskDebug={onOpenTaskDebug}
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
  onOpenTaskDebug,
  onSelectTask,
  selectedTaskId,
}: {
  emptyLabel: string;
  items: QueueTaskViewModel[];
  limit: number;
  onOpenTaskDetails: (
    taskId: string,
    sourceButton: HTMLButtonElement | null,
  ) => void;
  onOpenTaskDebug: (taskId: string, sourceButton: HTMLButtonElement | null) => void;
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
          onOpenDebug={onOpenTaskDebug}
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
