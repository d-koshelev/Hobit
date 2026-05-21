import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { AgentQueueAutorunPanel } from "./AgentQueueAutorunPanel";
import { AgentQueueTaskAssignmentPanel } from "./AgentQueueTaskAssignmentPanel";
import { AgentQueueTaskList } from "./AgentQueueTaskList";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueWidgetStatusBadge } from "./AgentQueueWidgetStatusBadge";
import {
  formatUpdatedTimestamp,
  EXECUTION_POLICY_OPTIONS,
  displayTaskTitle,
  emptyDraft,
  isAgentQueueTaskExecutionPolicy,
  isQueueTaskStatus,
  MAX_PRIORITY,
  MIN_PRIORITY,
  queueSingleState,
  statusBadgeVariant,
  statusLabel,
  STATUS_OPTIONS,
  taskPreview,
  validateDraft,
  type TaskDraft,
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
  onGetAgentQueueRunnerSnapshot,
  onListAgentQueueTasks,
  onLoadLogs,
  onDirectWorkRunHandoffStarted,
  queueTaskAutoRefreshRequest,
  onStartFrameMove,
  onStartAssignedAgentQueueTask,
  onStartAgentQueueRunnerSession,
  onStopAgentQueueRunnerSession,
  onUpdateAgentQueueTask,
  title,
}: WidgetRenderProps) {
  const titleInputId = useId();
  const descriptionInputId = useId();
  const promptInputId = useId();
  const statusInputId = useId();
  const priorityInputId = useId();
  const executionPolicyInputId = useId();
  const assignmentInputId = useId();
  const createTitleInputId = useId();
  const createDescriptionInputId = useId();
  const createPromptInputId = useId();
  const createPriorityInputId = useId();
  const createExecutionPolicyInputId = useId();
  const createDialogTitleId = useId();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<TaskDraft>(() =>
    newTaskDialogDraft(),
  );
  const [createDialogError, setCreateDialogError] = useState<string | null>(
    null,
  );
  const queue = useAgentQueueController({
    agentExecutorSlots,
    onAssignAgentQueueTaskToExecutor,
    onClearAgentQueueTaskAssignment,
    onCreateAgentQueueTask,
    onDirectWorkRunHandoffStarted,
    onGetAgentQueueTask,
    onGetAgentQueueRunnerSnapshot,
    onListAgentQueueTasks,
    onStartAssignedAgentQueueTask,
    onStartAgentQueueRunnerSession,
    onStopAgentQueueRunnerSession,
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
        onClick={() => {
          setCreateDraft(newTaskDialogDraft());
          setCreateDialogError(null);
          setIsCreateDialogOpen(true);
        }}
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
  });
  const selectedTaskHint = selectedTask ? taskPreview(selectedTask) : "";

  function updateCreateDraft(nextDraft: Partial<TaskDraft>) {
    setCreateDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setCreateDialogError(null);
  }

  function updateCreatePriority(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? Math.min(MAX_PRIORITY, Math.max(MIN_PRIORITY, parsedValue))
      : MIN_PRIORITY;

    updateCreateDraft({ priority });
  }

  async function confirmCreateTask() {
    const validationError = validateDraft(createDraft);

    if (validationError) {
      setCreateDialogError(validationError);
      return;
    }

    if (isDirty) {
      setCreateDialogError("Save current task before creating another task.");
      return;
    }

    const didCreate = await createTask(createDraft);

    if (didCreate) {
      setCreateDraft(newTaskDialogDraft());
      setCreateDialogError(null);
      setIsCreateDialogOpen(false);
    }
  }

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
                  <section
                    aria-label="Task"
                    className="agent-queue-editor-section agent-queue-task-section"
                  >
                    <div className="agent-queue-section-header">
                      <div>
                        <p
                          className="agent-queue-section-title"
                          title={`${displayTaskTitle(
                            selectedTask,
                          )}: ${selectedTaskHint}`}
                        >
                          Task
                        </p>
                        <p className="agent-queue-section-copy">
                          {selectedUpdatedText
                            ? `${selectedUpdatedText} · ${
                                isDirty ? "Unsaved changes" : saveStateText
                              }`
                            : isDirty
                              ? "Unsaved changes"
                              : saveStateText}
                        </p>
                      </div>
                      <div className="agent-queue-editor-status">
                        <Badge variant={statusBadgeVariant(draft.status)}>
                          {statusLabel(draft.status)}
                        </Badge>
                        <Badge variant="neutral">
                          Priority {draft.priority.toString()}
                        </Badge>
                      </div>
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
                      title={selectedTaskHint}
                      value={draft.title}
                    />

                    <details className="agent-queue-details">
                      <summary title={selectedTaskHint}>
                        Description
                        <span className="agent-queue-details-hint">
                          Hover task titles for this hint.
                        </span>
                      </summary>
                      <textarea
                        className="input agent-queue-description-input"
                        id={descriptionInputId}
                        onChange={(event) =>
                          updateDraft({
                            description: event.currentTarget.value,
                          })
                        }
                        placeholder="Optional task hint shown on hover."
                        value={draft.description}
                      />
                    </details>

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
                        <label
                          className="field-label"
                          htmlFor={priorityInputId}
                        >
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

                      <div className="agent-queue-editor-field agent-queue-editor-field-wide">
                        <label
                          className="field-label"
                          htmlFor={executionPolicyInputId}
                          title="Manual tasks require explicit operator run. Auto policies are used only by visible Queue runner controls."
                        >
                          Execution policy
                        </label>
                        <select
                          className="input agent-queue-execution-policy-select"
                          id={executionPolicyInputId}
                          onChange={(event) => {
                            const nextExecutionPolicy =
                              event.currentTarget.value;

                            if (
                              isAgentQueueTaskExecutionPolicy(
                                nextExecutionPolicy,
                              )
                            ) {
                              updateDraft({
                                executionPolicy: nextExecutionPolicy,
                              });
                            }
                          }}
                          value={draft.executionPolicy}
                        >
                          {EXECUTION_POLICY_OPTIONS.map((executionPolicy) => (
                            <option
                              key={executionPolicy.value}
                              value={executionPolicy.value}
                            >
                              {executionPolicy.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="agent-queue-editor-actions">
                      <Button
                        disabled={!selectedTask || !isDirty || isSaving}
                        onClick={() => void saveTask()}
                        variant="primary"
                      >
                        {isSaving ? "Saving" : "Save task"}
                      </Button>
                    </div>
                  </section>

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
                    runner={queue.runner}
                    selectedTask={selectedTask}
                  />

                  <AgentQueueAutorunPanel autorun={queue.autorun} />

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
                  <details className="agent-queue-details agent-queue-safety-details">
                    <summary>Queue boundaries</summary>
                    <p className="agent-queue-boundary-note">
                      Queue tasks are workspace-local records. Queue does not
                      show live logs, run hidden background scheduling, launch
                      Terminal commands, or mutate Git.
                    </p>
                  </details>
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
        {isCreateDialogOpen ? (
          <div
            className="agent-queue-create-dialog-layer"
            data-widget-header-drag-ignore
          >
            <div
              aria-labelledby={createDialogTitleId}
              aria-modal="true"
              className="agent-queue-create-dialog"
              role="dialog"
            >
              <div className="agent-queue-create-dialog-header">
                <div>
                  <h3
                    className="agent-queue-create-dialog-title"
                    id={createDialogTitleId}
                  >
                    New task
                  </h3>
                  <p className="agent-queue-create-dialog-copy">
                    Create a draft task without changing the selected task.
                  </p>
                </div>
                <Button
                  disabled={isCreating}
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setCreateDialogError(null);
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>

              <div className="agent-queue-create-dialog-body">
                <div className="agent-queue-editor-field">
                  <label className="field-label" htmlFor={createTitleInputId}>
                    Title
                  </label>
                  <input
                    className="input agent-queue-title-input"
                    id={createTitleInputId}
                    onChange={(event) =>
                      updateCreateDraft({
                        title: event.currentTarget.value,
                      })
                    }
                    value={createDraft.title}
                  />
                </div>

                <div className="agent-queue-editor-field">
                  <label
                    className="field-label"
                    htmlFor={createDescriptionInputId}
                  >
                    Description
                  </label>
                  <textarea
                    className="input agent-queue-description-input"
                    id={createDescriptionInputId}
                    onChange={(event) =>
                      updateCreateDraft({
                        description: event.currentTarget.value,
                      })
                    }
                    value={createDraft.description}
                  />
                </div>

                <div className="agent-queue-editor-field">
                  <label className="field-label" htmlFor={createPromptInputId}>
                    Prompt
                  </label>
                  <textarea
                    className="input agent-queue-prompt-input"
                    id={createPromptInputId}
                    onChange={(event) =>
                      updateCreateDraft({
                        prompt: event.currentTarget.value,
                      })
                    }
                    value={createDraft.prompt}
                  />
                </div>

                <div className="agent-queue-editor-grid">
                  <div className="agent-queue-editor-field">
                    <label
                      className="field-label"
                      htmlFor={createPriorityInputId}
                    >
                      Priority
                    </label>
                    <input
                      className="input agent-queue-priority-input"
                      id={createPriorityInputId}
                      max={MAX_PRIORITY}
                      min={MIN_PRIORITY}
                      onChange={(event) =>
                        updateCreatePriority(event.currentTarget.value)
                      }
                      type="number"
                      value={createDraft.priority}
                    />
                  </div>

                  <div className="agent-queue-editor-field">
                    <label
                      className="field-label"
                      htmlFor={createExecutionPolicyInputId}
                    >
                      Execution policy
                    </label>
                    <select
                      className="input agent-queue-execution-policy-select"
                      id={createExecutionPolicyInputId}
                      onChange={(event) => {
                        const nextExecutionPolicy = event.currentTarget.value;

                        if (
                          isAgentQueueTaskExecutionPolicy(nextExecutionPolicy)
                        ) {
                          updateCreateDraft({
                            executionPolicy: nextExecutionPolicy,
                          });
                        }
                      }}
                      value={createDraft.executionPolicy}
                    >
                      {EXECUTION_POLICY_OPTIONS.map((executionPolicy) => (
                        <option
                          key={executionPolicy.value}
                          value={executionPolicy.value}
                        >
                          {executionPolicy.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {createDialogError ? (
                  <p
                    className="agent-queue-message agent-queue-message-warning"
                    role="alert"
                  >
                    {createDialogError}
                  </p>
                ) : null}
              </div>

              <div className="agent-queue-create-dialog-actions">
                <Button
                  disabled={isCreating}
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setCreateDialogError(null);
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isCreating || !apiAvailable}
                  onClick={() => void confirmCreateTask()}
                  variant="primary"
                >
                  {isCreating ? "Creating" : "Create task"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </WidgetFrame>
  );
}

function newTaskDialogDraft(): TaskDraft {
  return {
    ...emptyDraft(),
    title: "New task",
  };
}
