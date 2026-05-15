import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueTask } from "../workspace/types";
import {
  assignmentLabel,
  displayTaskTitle,
  FILTERS,
  formatUpdatedTimestamp,
  statusBadgeVariant,
  statusLabel,
  taskPreview,
  type QueueFilter,
} from "./agentQueueTaskUiModel";

type AgentQueueTaskListProps = {
  apiAvailable: boolean;
  filteredTasks: AgentQueueTask[];
  isCreating: boolean;
  isLoading: boolean;
  isSelecting: boolean;
  loadError: string | null;
  onCreateTask: () => void;
  onSelectTask: (queueItemId: string) => void;
  onStatusFilterChange: (filter: QueueFilter) => void;
  selectedTask: AgentQueueTask | null;
  statusFilter: QueueFilter;
  tasks: AgentQueueTask[];
};

export function AgentQueueTaskList({
  apiAvailable,
  filteredTasks,
  isCreating,
  isLoading,
  isSelecting,
  loadError,
  onCreateTask,
  onSelectTask,
  onStatusFilterChange,
  selectedTask,
  statusFilter,
  tasks,
}: AgentQueueTaskListProps) {
  return (
    <aside aria-label="Agent Queue tasks" className="agent-queue-task-list-pane">
      <div className="agent-queue-pane-header">
        <div>
          <p className="agent-queue-pane-title">Tasks</p>
          <p className="agent-queue-pane-subtitle">
            Priority first, then latest update.
          </p>
        </div>
      </div>

      <div className="agent-queue-filter-row" aria-label="Task filters">
        {FILTERS.map((filter) => (
          <button
            aria-pressed={statusFilter === filter.value}
            className={
              statusFilter === filter.value
                ? "agent-queue-filter-button agent-queue-filter-button-active"
                : "agent-queue-filter-button"
            }
            key={filter.value}
            onClick={() => onStatusFilterChange(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="agent-queue-task-list" role="list">
        {isLoading ? (
          <p className="empty-state-text">Loading queue tasks.</p>
        ) : loadError ? (
          <p className="empty-state-text" role="alert">
            {loadError}
          </p>
        ) : tasks.length === 0 ? (
          <div className="agent-queue-empty-state">
            <p className="empty-state-title">No tasks yet.</p>
            <p className="empty-state-text">
              Create the first workspace queue task.
            </p>
            <Button
              disabled={isCreating || !apiAvailable}
              onClick={() => onCreateTask()}
              variant="primary"
            >
              New task
            </Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <p className="empty-state-text">No tasks match this status.</p>
        ) : (
          filteredTasks.map((task) => (
            <button
              aria-current={
                selectedTask?.queueItemId === task.queueItemId
                  ? "true"
                  : undefined
              }
              className={
                selectedTask?.queueItemId === task.queueItemId
                  ? "agent-queue-task-row agent-queue-task-row-selected"
                  : "agent-queue-task-row"
              }
              disabled={isSelecting}
              key={task.queueItemId}
              onClick={() => onSelectTask(task.queueItemId)}
              type="button"
            >
              <span className="agent-queue-task-row-main">
                <span className="agent-queue-task-row-title">
                  {displayTaskTitle(task)}
                </span>
                <Badge variant={statusBadgeVariant(task.status)}>
                  {statusLabel(task.status)}
                </Badge>
              </span>
              <span className="agent-queue-task-row-preview">
                {taskPreview(task)}
              </span>
              <span className="agent-queue-task-row-meta">
                <span>{assignmentLabel(task.assignedExecutorWidgetId)}</span>
                <span>Priority {task.priority.toString()}</span>
                <time dateTime={task.updatedAt}>
                  {formatUpdatedTimestamp(task.updatedAt)}
                </time>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
