import { useId } from "react";
import { Badge } from "../design-system/Badge";
import type { AgentQueueTask } from "../workspace/types";
import {
  assignmentLabel,
  displayTaskTitle,
  FILTERS,
  formatUpdatedTimestamp,
  itemTypeLabel,
  normalizeItemType,
  normalizeQueueTag,
  normalizeValidationStatus,
  queueTaskPriorityLabel,
  queueDependencyBadgeVariant,
  queueDependencyBlockedSummary,
  queueDependencyStatusLabel,
  statusBadgeVariant,
  statusLabel,
  taskPreview,
  validationBadgeVariant,
  validationStatusLabel,
  workerLabel,
  type QueueFilter,
  type AgentQueueDependencyState,
} from "./agentQueueTaskUiModel";
import {
  firstRoutingBlockedReasonLabel,
  type AgentQueueAssignedWorkerRoutingState,
} from "./queue/agentQueueRoutingModel";

type AgentQueueTaskListProps = {
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>;
  filteredTasks: AgentQueueTask[];
  isLoading: boolean;
  isSelecting: boolean;
  loadError: string | null;
  onSelectTask: (queueItemId: string) => void;
  onStatusFilterChange: (filter: QueueFilter) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  routingStates: ReadonlyMap<string, AgentQueueAssignedWorkerRoutingState>;
  selectedTask: AgentQueueTask | null;
  statusFilter: QueueFilter;
  tasks: AgentQueueTask[];
};

export function AgentQueueTaskList({
  dependencyStates,
  filteredTasks,
  isLoading,
  isSelecting,
  loadError,
  onSelectTask,
  onStatusFilterChange,
  pausedQueueTagIds,
  routingStates,
  selectedTask,
  statusFilter,
  tasks,
}: AgentQueueTaskListProps) {
  const filterInputId = useId();

  return (
    <aside aria-label="Agent Queue tasks" className="agent-queue-task-list-pane">
      <div className="agent-queue-pane-header">
        <div>
          <p className="agent-queue-pane-title">Tasks</p>
          <p className="agent-queue-pane-subtitle">
            {tasks.length === 1 ? "1 task" : `${tasks.length.toString()} tasks`}
          </p>
        </div>
        <select
          aria-label="Task status filter"
          className="input agent-queue-filter-select"
          disabled={isLoading || tasks.length === 0}
          id={filterInputId}
          onChange={(event) =>
            onStatusFilterChange(event.currentTarget.value as QueueFilter)
          }
          value={statusFilter}
        >
          {FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <div className="agent-queue-task-list" role="list">
        {isLoading ? (
          <div className="agent-queue-empty-state agent-queue-empty-state-compact">
            <p className="empty-state-title">Loading tasks.</p>
            <p className="empty-state-text">Queue tasks are loading.</p>
          </div>
        ) : loadError ? (
          <div
            className="agent-queue-empty-state agent-queue-empty-state-compact"
            role="alert"
          >
            <p className="empty-state-title">Queue unavailable.</p>
            <p className="empty-state-text">
              {loadError} Use Refresh to try again.
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="agent-queue-empty-state">
            <p className="empty-state-title">No tasks yet.</p>
            <p className="empty-state-text">
              Use New task to plan workspace work.
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="agent-queue-empty-state agent-queue-empty-state-compact">
            <p className="empty-state-title">No matching tasks.</p>
            <p className="empty-state-text">
              No tasks match the current filter.
            </p>
          </div>
        ) : (
          filteredTasks.map((task, taskIndex) => {
            const updatedText = formatUpdatedTimestamp(task.updatedAt);
            const taskTitle = displayTaskTitle(task);
            const taskHint = taskPreview(task);
            const queueTag = normalizeQueueTag(task);
            const queueTagPaused = pausedQueueTagIds.has(queueTag.queueTagId);
            const validationStatus = normalizeValidationStatus(
              task.validationStatus,
            );
            const itemType = normalizeItemType(task.itemType);
            const dependencyState = dependencyStates.get(task.queueItemId);
            const routingState = routingStates.get(task.queueItemId);
            const routingBlockedLabel =
              routingState && !routingState.canTake
                ? firstRoutingBlockedReasonLabel(routingState.blockedReasons)
                : null;

            return (
              <button
                aria-current={
                  selectedTask?.queueItemId === task.queueItemId
                    ? "true"
                    : undefined
                }
                className={
                  [
                    "agent-queue-task-row",
                    selectedTask?.queueItemId === task.queueItemId
                      ? "agent-queue-task-row-selected"
                      : null,
                    queueTagPaused ? "agent-queue-task-row-paused" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                disabled={isSelecting}
                key={task.queueItemId}
                onClick={() => onSelectTask(task.queueItemId)}
                title={taskHint}
                type="button"
              >
                <span className="agent-queue-task-row-main">
                  <span className="agent-queue-task-row-title">
                    {taskTitle}
                  </span>
                  <Badge variant={statusBadgeVariant(task.status)}>
                    {statusLabel(task.status)}
                  </Badge>
                  {queueTagPaused ? (
                    <Badge variant="warning">Tag paused</Badge>
                  ) : null}
                  {routingState?.assignedWorker ? (
                    <Badge variant={routingState.canTake ? "success" : "warning"}>
                      {routingState.canTake ? "Worker eligible" : "Worker blocked"}
                    </Badge>
                  ) : null}
                  {dependencyState && dependencyState.dependsOn.length > 0 ? (
                    <Badge
                      variant={queueDependencyBadgeVariant(
                        dependencyState.status,
                      )}
                    >
                      {queueDependencyStatusLabel(dependencyState.status)}
                    </Badge>
                  ) : null}
                  <Badge
                    className={
                      validationStatus === "validating"
                        ? "agent-queue-validation-animating"
                        : undefined
                    }
                    variant={validationBadgeVariant(validationStatus)}
                  >
                    {validationStatusLabel(validationStatus)}
                  </Badge>
                </span>
                <span className="agent-queue-task-row-meta">
                  <span>Tag {queueTag.queueTagName}</span>
                  <span>{itemTypeLabel(itemType)}</span>
                  <span>
                    Worker{" "}
                    {workerLabel(
                      task.assignedWorkerId ?? task.assignedExecutorWidgetId,
                    )}
                  </span>
                  {routingBlockedLabel ? <span>{routingBlockedLabel}</span> : null}
                  <span>Priority {queueTaskPriorityLabel(task.priority)}</span>
                  <span>Order {(taskIndex + 1).toString()}</span>
                  <span>{assignmentLabel(task.assignedExecutorWidgetId)}</span>
                  {dependencyState && dependencyState.dependsOn.length > 0 ? (
                    <span>
                      {dependencyState.status === "ready"
                        ? "Dependencies ready"
                        : queueDependencyBlockedSummary(dependencyState)}
                    </span>
                  ) : null}
                  {updatedText ? (
                    <time dateTime={task.updatedAt}>{updatedText}</time>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
