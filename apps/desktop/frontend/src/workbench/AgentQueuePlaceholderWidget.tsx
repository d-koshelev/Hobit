import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { AgentQueueTaskAssignmentPanel } from "./AgentQueueTaskAssignmentPanel";
import { AgentQueueTaskList } from "./AgentQueueTaskList";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueWidgetStatusBadge } from "./AgentQueueWidgetStatusBadge";
import {
  formatUpdatedTimestamp,
  isQueueTaskStatus,
  MAX_PRIORITY,
  MIN_PRIORITY,
  queueSingleState,
  statusBadgeVariant,
  statusLabel,
  STATUS_OPTIONS,
} from "./agentQueueTaskUiModel";
import { useAgentQueueController } from "./queue/useAgentQueueController";
import type { WidgetRenderProps } from "./types";

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
  const queue = useAgentQueueController({
    agentExecutorSlots,
    onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask,
    onDirectWorkRunHandoffStarted,
    onGetAgentQueueTask,
    onListAgentQueueTasks,
    onStartAssignedAgentQueueTask,
    onUpdateAgentQueueTask,
    queueTaskAutoRefreshRequest,
  });
  const {
    apiAvailable,
    assignmentApiAvailable,
    assignmentError,
    assignmentMessage,
    assignSelectedTask,
    clearSelectedTaskAssignment,
    createTask,
    draft,
    editorError,
    filteredTasks,
    isAssigning,
    isCreating,
    isDirty,
    isLoading,
    isSaving,
    isSelecting,
    loadError,
    refreshTasks,
    run,
    saveStateText,
    saveTask,
    selectedExecutorWidgetId,
    selectedTask,
    selectExecutorWidget,
    selectTask,
    setStatusFilter,
    statusFilter,
    tasks,
    updateDraft,
    updatePriority,
    validationMessage,
  } = queue;

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
  const singleState = queueSingleState({
    isLoading,
    loadError,
    taskCount: tasks.length,
  });

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
        {singleState ? (
          <div
            className="agent-queue-empty-state agent-queue-empty-state-compact"
            role={loadError ? "alert" : undefined}
          >
            <p className="empty-state-title">{singleState.title}</p>
            <p className="empty-state-text">{singleState.text}</p>
          </div>
        ) : (
          <div className="agent-queue-product-layout">
            <AgentQueueTaskList
              filteredTasks={filteredTasks}
              isLoading={isLoading}
              isSelecting={isSelecting}
              loadError={loadError}
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
                    {selectedUpdatedText ? (
                      <span>{selectedUpdatedText}</span>
                    ) : null}
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
                      selectExecutorWidget(executorWidgetInstanceId);
                    }}
                    selectedTask={selectedTask}
                  />

                  <AgentQueueTaskRunPanel
                    run={run}
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
                    Select a task to plan, assign, or run it.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}
