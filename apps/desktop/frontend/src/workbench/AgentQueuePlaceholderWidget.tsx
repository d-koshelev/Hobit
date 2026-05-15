import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { AgentQueueTask } from "../workspace/types";
import {
  clamp,
  DEFAULT_TASK_TITLE,
  displayTaskTitle,
  emptyDraft,
  errorToMessage,
  FILTERS,
  formatUpdatedTimestamp,
  isQueueTaskStatus,
  MAX_PRIORITY,
  MIN_PRIORITY,
  normalizeTaskStatus,
  statusBadgeVariant,
  statusLabel,
  STATUS_OPTIONS,
  taskPreview,
  type QueueFilter,
  type TaskDraft,
  validateDraft,
} from "./agentQueueTaskUiModel";
import type { WidgetRenderProps } from "./types";

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCreateAgentQueueTask,
  onGetAgentQueueTask,
  onListAgentQueueTasks,
  onLoadLogs,
  onStartFrameMove,
  onUpdateAgentQueueTask,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const descriptionInputId = useId();
  const promptInputId = useId();
  const statusInputId = useId();
  const priorityInputId = useId();
  const apiAvailable = Boolean(
    onCreateAgentQueueTask &&
      onGetAgentQueueTask &&
      onListAgentQueueTasks &&
      onUpdateAgentQueueTask,
  );
  const [tasks, setTasks] = useState<AgentQueueTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentQueueTask | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft());
  const [statusFilter, setStatusFilter] = useState<QueueFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [saveStateText, setSaveStateText] = useState("Saved");

  const isDirty = Boolean(
    selectedTask &&
      (draft.title !== selectedTask.title ||
        draft.description !== selectedTask.description ||
        draft.prompt !== selectedTask.prompt ||
        draft.status !== normalizeTaskStatus(selectedTask.status) ||
        draft.priority !== selectedTask.priority),
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") {
      return tasks;
    }

    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  const loadTasks = useCallback(
    async (preferredTaskId?: string | null) => {
      if (
        !onCreateAgentQueueTask ||
        !onGetAgentQueueTask ||
        !onListAgentQueueTasks ||
        !onUpdateAgentQueueTask
      ) {
        setTasks([]);
        clearSelectedTask();
        setLoadError(
          "Agent Queue task persistence is not available in this runtime.",
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setEditorError(null);
      setValidationMessage(null);

      try {
        const loadedTasks = await onListAgentQueueTasks();
        setTasks(loadedTasks);

        const preferredExists = loadedTasks.some(
          (task) => task.queueItemId === preferredTaskId,
        );
        const taskIdToSelect = preferredExists
          ? preferredTaskId
          : loadedTasks[0]?.queueItemId;

        if (!taskIdToSelect) {
          clearSelectedTask();
          return;
        }

        const detail = await onGetAgentQueueTask(taskIdToSelect);

        if (!detail) {
          clearSelectedTask();
          setEditorError("The selected queue task could not be found.");
          return;
        }

        setSelectedDraft(detail);
        setSaveStateText("Saved");
      } catch (error) {
        setTasks([]);
        clearSelectedTask();
        setLoadError(errorToMessage(error, "Unable to load Agent Queue tasks."));
      } finally {
        setIsLoading(false);
      }
    },
    [
      onCreateAgentQueueTask,
      onGetAgentQueueTask,
      onListAgentQueueTasks,
      onUpdateAgentQueueTask,
    ],
  );

  useEffect(() => {
    void loadTasks(null);
  }, [loadTasks]);

  async function createTask() {
    if (!onCreateAgentQueueTask || isCreating || isLoading) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current task before creating another task.");
      return;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const createdTask = await onCreateAgentQueueTask({
        title: DEFAULT_TASK_TITLE,
        description: "",
        prompt: "",
        status: "draft",
        priority: 0,
      });
      await loadTasks(createdTask.queueItemId);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create queue task."));
    } finally {
      setIsCreating(false);
    }
  }

  async function refreshTasks() {
    if (isDirty) {
      setValidationMessage("Save current task before refreshing the queue.");
      return;
    }

    await loadTasks(selectedTask?.queueItemId ?? null);
  }

  async function selectTask(queueItemId: string) {
    if (
      !onGetAgentQueueTask ||
      isSelecting ||
      selectedTask?.queueItemId === queueItemId
    ) {
      return;
    }

    if (isDirty) {
      setValidationMessage("Save current task before selecting another task.");
      return;
    }

    setIsSelecting(true);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const detail = await onGetAgentQueueTask(queueItemId);

      if (!detail) {
        setEditorError("The selected queue task could not be found.");
        return;
      }

      setSelectedDraft(detail);
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.queueItemId === detail.queueItemId ? detail : task,
        ),
      );
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open queue task."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function saveTask() {
    if (!selectedTask || !onUpdateAgentQueueTask || !isDirty || isSaving) {
      return;
    }

    const validationError = validateDraft(draft);

    if (validationError) {
      setValidationMessage(validationError);
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setValidationMessage(null);
    setSaveStateText("Saving");

    try {
      const updatedTask = await onUpdateAgentQueueTask({
        queueItemId: selectedTask.queueItemId,
        title: draft.title.trim(),
        description: draft.description,
        prompt: draft.prompt,
        status: draft.status,
        priority: draft.priority,
      });

      if (!updatedTask) {
        setEditorError("The selected queue task could not be found.");
        setSaveStateText("Unsaved changes");
        return;
      }

      await loadTasks(updatedTask.queueItemId);
      setSaveStateText("Saved");
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save queue task."));
      setSaveStateText("Unsaved changes");
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraft(nextDraft: Partial<TaskDraft>) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setValidationMessage(null);
  }

  function updatePriority(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? clamp(parsedValue, MIN_PRIORITY, MAX_PRIORITY)
      : MIN_PRIORITY;

    updateDraft({ priority });
  }

  function setSelectedDraft(task: AgentQueueTask) {
    setSelectedTask(task);
    setDraft({
      description: task.description,
      priority: task.priority,
      prompt: task.prompt,
      status: normalizeTaskStatus(task.status),
      title: task.title,
    });
  }

  function clearSelectedTask() {
    setSelectedTask(null);
    setDraft(emptyDraft());
    setSaveStateText("Saved");
  }

  const queueFrameActions = (
    <>
      <Button
        disabled={isLoading || isSaving || !apiAvailable}
        onClick={() => void refreshTasks()}
        variant="ghost"
      >
        Refresh
      </Button>
      <Button
        disabled={isCreating || isLoading || !apiAvailable}
        onClick={() => void createTask()}
        variant="primary"
      >
        {isCreating ? "Creating" : "New task"}
      </Button>
      {frameActions}
    </>
  );
  const selectedUpdatedText = selectedTask
    ? formatUpdatedTimestamp(selectedTask.updatedAt)
    : null;

  return (
    <WidgetFrame
      actions={queueFrameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={statusBadge({
        apiAvailable,
        isDirty,
        isLoading,
        isSaving,
        loadError,
        selectedTask,
      })}
      style={frameStyle}
      title={title}
    >
      <div className="agent-queue-product-shell">
        <section className="agent-queue-product-summary">
          <div className="agent-queue-product-summary-copy">
            <p className="agent-queue-product-eyebrow">Workspace task queue</p>
            <p className="agent-queue-product-summary-text">
              Manual task planning and history prep. Execution and executor
              assignment are future work.
            </p>
          </div>
          <div className="agent-queue-product-summary-badges">
            <Badge variant="neutral">
              {tasks.length === 1 ? "1 task" : `${tasks.length.toString()} tasks`}
            </Badge>
            <Badge variant="neutral">One per workspace</Badge>
            <Badge variant="neutral">No dispatch</Badge>
          </div>
        </section>

        <div className="agent-queue-product-layout">
          <aside
            aria-label="Agent Queue tasks"
            className="agent-queue-task-list-pane"
          >
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
                  onClick={() => setStatusFilter(filter.value)}
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
                    onClick={() => void createTask()}
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
                    onClick={() => void selectTask(task.queueItemId)}
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

          <section
            aria-label="Selected Agent Queue task"
            className="agent-queue-task-editor-pane"
          >
            {isLoading ? (
              <div className="agent-queue-empty-state">
                <p className="empty-state-title">Loading queue.</p>
                <p className="empty-state-text">
                  Workspace queue tasks are loading from desktop storage.
                </p>
              </div>
            ) : loadError ? (
              <div className="agent-queue-empty-state" role="alert">
                <p className="empty-state-title">Queue unavailable.</p>
                <p className="empty-state-text">{loadError}</p>
              </div>
            ) : selectedTask ? (
              <div className="agent-queue-task-editor">
                <div className="agent-queue-editor-meta">
                  <span>{selectedUpdatedText}</span>
                  <span>{isDirty ? "Unsaved changes" : saveStateText}</span>
                </div>

                <label className="field-label" htmlFor={titleInputId}>
                  Title
                </label>
                <input
                  className="input agent-queue-title-input"
                  id={titleInputId}
                  onChange={(event) =>
                    updateDraft({ title: event.currentTarget.value })
                  }
                  value={draft.title}
                />

                <label className="field-label" htmlFor={descriptionInputId}>
                  Description
                </label>
                <textarea
                  className="input agent-queue-description-input"
                  id={descriptionInputId}
                  onChange={(event) =>
                    updateDraft({ description: event.currentTarget.value })
                  }
                  value={draft.description}
                />

                <label className="field-label" htmlFor={promptInputId}>
                  Prompt
                </label>
                <textarea
                  className="input agent-queue-prompt-input"
                  id={promptInputId}
                  onChange={(event) =>
                    updateDraft({ prompt: event.currentTarget.value })
                  }
                  value={draft.prompt}
                />

                <div className="agent-queue-editor-grid">
                  <div className="agent-queue-editor-field">
                    <label className="field-label" htmlFor={statusInputId}>
                      Status
                    </label>
                    <select
                      className="input agent-queue-status-select"
                      id={statusInputId}
                      onChange={(event) => {
                        const nextStatus = event.currentTarget.value;

                        if (isQueueTaskStatus(nextStatus)) {
                          updateDraft({ status: nextStatus });
                        }
                      }}
                      value={draft.status}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="agent-queue-editor-field">
                    <label className="field-label" htmlFor={priorityInputId}>
                      Priority
                    </label>
                    <input
                      className="input agent-queue-priority-input"
                      id={priorityInputId}
                      max={MAX_PRIORITY}
                      min={MIN_PRIORITY}
                      onChange={(event) =>
                        updatePriority(event.currentTarget.value)
                      }
                      type="number"
                      value={draft.priority}
                    />
                  </div>
                </div>

                <div className="agent-queue-editor-actions">
                  <div className="agent-queue-editor-status">
                    <Badge variant={statusBadgeVariant(draft.status)}>
                      {statusLabel(draft.status)}
                    </Badge>
                    <Badge variant="neutral">
                      Priority {draft.priority.toString()}
                    </Badge>
                  </div>
                  <Button
                    disabled={!selectedTask || !isDirty || isSaving}
                    onClick={() => void saveTask()}
                    variant="primary"
                  >
                    {isSaving ? "Saving" : "Save"}
                  </Button>
                </div>

                {validationMessage ? (
                  <p
                    className="agent-queue-message agent-queue-message-warning"
                    role="alert"
                  >
                    {validationMessage}
                  </p>
                ) : null}
                {editorError ? (
                  <p
                    className="agent-queue-message agent-queue-message-error"
                    role="alert"
                  >
                    {editorError}
                  </p>
                ) : null}
                <p className="agent-queue-boundary-note">
                  Queue tasks are workspace-local records. This UI does not run
                  agents, launch Terminal commands, assign executors, or mutate
                  Git.
                </p>
              </div>
            ) : (
              <div className="agent-queue-empty-state">
                <p className="empty-state-title">No task selected.</p>
                <p className="empty-state-text">
                  Select a task or create a new workspace queue task.
                </p>
                <Button
                  disabled={isCreating || !apiAvailable}
                  onClick={() => void createTask()}
                  variant="primary"
                >
                  New task
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </WidgetFrame>
  );
}

function statusBadge({
  apiAvailable,
  isDirty,
  isLoading,
  isSaving,
  loadError,
  selectedTask,
}: {
  apiAvailable: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  selectedTask: AgentQueueTask | null;
}) {
  if (!apiAvailable) {
    return <Badge variant="warning">Unsupported</Badge>;
  }

  if (isLoading) {
    return <Badge variant="info">Loading</Badge>;
  }

  if (loadError) {
    return <Badge variant="warning">Unavailable</Badge>;
  }

  if (isSaving) {
    return <Badge variant="info">Saving</Badge>;
  }

  if (isDirty) {
    return <Badge variant="warning">Unsaved</Badge>;
  }

  return <Badge variant={selectedTask ? "success" : "neutral"}>Queue</Badge>;
}
