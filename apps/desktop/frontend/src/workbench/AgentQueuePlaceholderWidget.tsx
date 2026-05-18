import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { AgentQueueTask } from "../workspace/types";
import { AgentQueueTaskAssignmentPanel } from "./AgentQueueTaskAssignmentPanel";
import { AgentQueueTaskList } from "./AgentQueueTaskList";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueWidgetStatusBadge } from "./AgentQueueWidgetStatusBadge";
import { clamp, DEFAULT_TASK_TITLE, emptyDraft, errorToMessage, formatUpdatedTimestamp, isQueueTaskStatus, MAX_PRIORITY, MIN_PRIORITY, normalizeTaskStatus, statusBadgeVariant, statusLabel, STATUS_OPTIONS, type QueueFilter, type TaskDraft, validateDraft } from "./agentQueueTaskUiModel";
import type { WidgetRenderProps } from "./types";
import { useQueueTaskAutoRefreshFromExecutor } from "./useQueueTaskAutoRefreshFromExecutor";

export function AgentQueuePlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  agentExecutorSlots = [],
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onGetAgentQueueTask,
  onListAgentQueueTasks,
  onLoadLogs,
  onDirectWorkRunHandoffStarted,
  queueTaskAutoRefreshRequest,
  onStartFrameMove,
  onStartAssignedAgentQueueTask,
  onUpdateAgentQueueTask,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const descriptionInputId = useId();
  const promptInputId = useId();
  const statusInputId = useId();
  const priorityInputId = useId();
  const assignmentInputId = useId();
  const apiAvailable = Boolean(
    onCreateAgentQueueTask &&
      onGetAgentQueueTask &&
      onListAgentQueueTasks &&
      onUpdateAgentQueueTask,
  );
  const assignmentApiAvailable = Boolean(
    onAssignAgentQueueTaskToExecutor && onClearAgentQueueTaskAssignment,
  );
  const [tasks, setTasks] = useState<AgentQueueTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentQueueTask | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft());
  const [statusFilter, setStatusFilter] = useState<QueueFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(
    null,
  );
  const [selectedExecutorWidgetId, setSelectedExecutorWidgetId] =
    useState("");
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
    async (preferredTaskId?: string | null, options?: { preserveCurrentOnError?: boolean }) => {
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
        return "Agent Queue task persistence is not available in this runtime.";
      }

      setIsLoading(true);
      setLoadError(null);
      setEditorError(null);
      setAssignmentError(null);
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
          return null;
        }

        const detail = await onGetAgentQueueTask(taskIdToSelect);

        if (!detail) {
          clearSelectedTask();
          setEditorError("The selected queue task could not be found.");
          return "The selected queue task could not be found.";
        }

        setSelectedDraft(detail);
        setSaveStateText("Saved");
        return null;
      } catch (error) {
        if (!options?.preserveCurrentOnError) {
          setTasks([]);
          clearSelectedTask();
          setLoadError(errorToMessage(error, "Unable to load Agent Queue tasks."));
        }
        return errorToMessage(error, "Unable to load Agent Queue tasks.");
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
  useQueueTaskAutoRefreshFromExecutor({ autoRefreshRequest: queueTaskAutoRefreshRequest, isDirty, loadTasks, setValidationMessage });

  useEffect(() => {
    if (!selectedTask) {
      setSelectedExecutorWidgetId("");
      return;
    }

    setSelectedExecutorWidgetId((currentSelection) => {
      if (selectedTask.assignedExecutorWidgetId) {
        return selectedTask.assignedExecutorWidgetId;
      }

      if (
        currentSelection &&
        agentExecutorSlots.some(
          (slot) => slot.widgetInstanceId === currentSelection,
        )
      ) {
        return currentSelection;
      }

      return agentExecutorSlots[0]?.widgetInstanceId ?? "";
    });
  }, [
    agentExecutorSlots,
    selectedTask?.assignedExecutorWidgetId,
    selectedTask?.queueItemId,
  ]);

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
    setAssignmentError(null);
    setAssignmentMessage(null);
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
    setAssignmentError(null);
    setAssignmentMessage(null);
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
    setAssignmentError(null);
    setAssignmentMessage(null);
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
    setAssignmentMessage(null);
    setValidationMessage(null);
  }

  function updatePriority(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? clamp(parsedValue, MIN_PRIORITY, MAX_PRIORITY)
      : MIN_PRIORITY;

    updateDraft({ priority });
  }

  async function assignSelectedTask() {
    if (
      !selectedTask ||
      !onAssignAgentQueueTaskToExecutor ||
      !selectedExecutorWidgetId ||
      isAssigning ||
      isDirty
    ) {
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      const updatedTask = await onAssignAgentQueueTaskToExecutor({
        executorWidgetInstanceId: selectedExecutorWidgetId,
        queueItemId: selectedTask.queueItemId,
      });
      await loadTasks(updatedTask.queueItemId);
      setAssignmentMessage("Assignment saved.");
    } catch (error) {
      setAssignmentError(errorToMessage(error, "Unable to assign queue task."));
    } finally {
      setIsAssigning(false);
    }
  }

  async function clearSelectedTaskAssignment() {
    if (
      !selectedTask ||
      !onClearAgentQueueTaskAssignment ||
      isAssigning ||
      isDirty
    ) {
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      const updatedTask = await onClearAgentQueueTaskAssignment({
        queueItemId: selectedTask.queueItemId,
      });
      await loadTasks(updatedTask.queueItemId);
      setAssignmentMessage("Assignment cleared.");
    } catch (error) {
      setAssignmentError(
        errorToMessage(error, "Unable to clear queue task assignment."),
      );
    } finally {
      setIsAssigning(false);
    }
  }

  async function startAssignedTask(
    request: Parameters<NonNullable<typeof onStartAssignedAgentQueueTask>>[0],
  ) {
    if (!onStartAssignedAgentQueueTask) {
      throw new Error("Agent Queue execution is not available in this runtime.");
    }

    const response = await onStartAssignedAgentQueueTask(request);
    onDirectWorkRunHandoffStarted?.({
      executorWidgetInstanceId: response.executorWidgetInstanceId,
      queueItemId: response.queueItemId,
      repoRoot: request.repoRoot,
      runId: response.runId,
      startedAt: new Date().toISOString(),
      taskTitle: selectedTask?.title ?? "Queue task",
      workbenchId: response.workbenchId,
      workspaceId: response.workspaceId,
    });
    await loadTasks(response.queueItemId);
    return response;
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
      status={
        <AgentQueueWidgetStatusBadge
          apiAvailable={apiAvailable}
          isDirty={isDirty}
          isLoading={isLoading}
          isSaving={isSaving}
          loadError={loadError}
          selectedTask={selectedTask}
        />
      }
      style={frameStyle}
      title={title}
    >
      <div className="agent-queue-product-shell">
        <section className="agent-queue-product-summary">
          <div className="agent-queue-product-summary-copy">
            <p className="agent-queue-product-eyebrow">Workspace task queue</p>
            <p className="agent-queue-product-summary-text">
              Manual task planning, visible executor assignment, and explicit
              run starts. Automatic dispatch is not implemented.
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
          <AgentQueueTaskList
            apiAvailable={apiAvailable}
            filteredTasks={filteredTasks}
            isCreating={isCreating}
            isLoading={isLoading}
            isSelecting={isSelecting}
            loadError={loadError}
            onCreateTask={() => void createTask()}
            onSelectTask={(queueItemId) => void selectTask(queueItemId)}
            onStatusFilterChange={setStatusFilter}
            selectedTask={selectedTask}
            statusFilter={statusFilter}
            tasks={tasks}
          />

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

                <AgentQueueTaskAssignmentPanel
                  apiAvailable={assignmentApiAvailable}
                  assignmentError={assignmentError}
                  assignmentMessage={assignmentMessage}
                  currentSelection={selectedExecutorWidgetId}
                  executorSlots={agentExecutorSlots}
                  inputId={assignmentInputId}
                  isAssigning={isAssigning}
                  isDirty={isDirty}
                  onAssign={() => void assignSelectedTask()}
                  onClear={() => void clearSelectedTaskAssignment()}
                  onSelectionChange={(executorWidgetInstanceId) => {
                    setSelectedExecutorWidgetId(executorWidgetInstanceId);
                    setAssignmentError(null);
                    setAssignmentMessage(null);
                  }}
                  selectedTask={selectedTask}
                />

                <AgentQueueTaskRunPanel
                  isDirty={isDirty}
                  onStartAssignedTask={onStartAssignedAgentQueueTask ? startAssignedTask : undefined}
                  selectedTask={selectedTask}
                />

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
                  Queue tasks are workspace-local records. Queue does not show
                  live logs, auto-dispatch work, launch Terminal commands, or
                  mutate Git.
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
