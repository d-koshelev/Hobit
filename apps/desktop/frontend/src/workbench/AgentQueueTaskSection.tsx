import { useEffect, useMemo, useState } from "react";
import { Button } from "../design-system/Button";
import type { AgentQueueTask } from "../workspace/types";
import {
  EXECUTION_POLICY_OPTIONS,
  ITEM_TYPE_OPTIONS,
  displayTaskTitle,
  getQueueTaskDependencyState,
  isAgentQueueTaskExecutionPolicy,
  MAX_PRIORITY,
  MIN_PRIORITY,
  normalizeItemType,
  normalizeTaskDependencies,
  queueDependencyBadgeVariant,
  queueDependencyBlockedSummary,
  queueDependencyBlockerLabel,
  queueDependencyStatusLabel,
  normalizeValidationStatus,
  statusBadgeVariant,
  statusLabel,
  VALIDATION_STATUS_OPTIONS,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import { AgentQueueDeleteTaskControl } from "./AgentQueueDeleteTaskControl";
import type {
  AgentQueueDeleteController,
  AgentQueueEditController,
} from "./queue/useAgentQueueController";
import { Badge } from "../design-system/Badge";

type AgentQueueTaskSectionProps = {
  deleteTask: AgentQueueDeleteController;
  draft: TaskDraft;
  editTask: AgentQueueEditController;
  executionPolicyInputId: string;
  isDirty: boolean;
  isSaving: boolean;
  onDraftChange: (nextDraft: Partial<TaskDraft>) => void;
  onPriorityChange: (value: string) => void;
  onSave: () => void;
  priorityInputId: string;
  promptInputId: string;
  descriptionInputId: string;
  selectedTask: AgentQueueTask;
  selectedTaskHint: string;
  statusInputId: string;
  tasks: AgentQueueTask[];
  titleInputId: string;
};

export function AgentQueueTaskSection({
  deleteTask,
  draft,
  editTask,
  executionPolicyInputId,
  isDirty,
  isSaving,
  onDraftChange,
  onPriorityChange,
  onSave,
  priorityInputId,
  promptInputId,
  descriptionInputId,
  selectedTask,
  selectedTaskHint,
  statusInputId,
  tasks,
  titleInputId,
}: AgentQueueTaskSectionProps) {
  return (
    <section
      aria-label="Selected task details"
      className="agent-queue-editor-section agent-queue-task-section"
    >
      <input
        aria-label="Task title"
        className="input agent-queue-title-input"
        disabled={!editTask.isEditing}
        id={titleInputId}
        onChange={(event) => onDraftChange({ title: event.currentTarget.value })}
        title={selectedTaskHint || undefined}
        value={draft.title}
      />

      <div className="agent-queue-readonly-status-row">
        <div>
          <p className="field-label" id={statusInputId}>
            Execution status
          </p>
          <Badge variant={statusBadgeVariant(draft.status)}>
            {statusLabel(draft.status)}
          </Badge>
        </div>
        <p className="agent-queue-run-note">
          Status is shown for review. Workers do not finalize queue items from this edit form.
        </p>
      </div>

      <label className="field-label" htmlFor={descriptionInputId}>
        Details
      </label>
      <textarea
        className="input agent-queue-description-input"
        disabled={!editTask.isEditing}
        id={descriptionInputId}
        onChange={(event) =>
          onDraftChange({ description: event.currentTarget.value })
        }
        value={draft.description}
      />

      <label className="field-label" htmlFor={promptInputId}>
        Prompt
      </label>
      <textarea
        className="input agent-queue-prompt-input"
        disabled={!editTask.isEditing}
        id={promptInputId}
        onChange={(event) => onDraftChange({ prompt: event.currentTarget.value })}
        value={draft.prompt}
      />

      <DependencyEditor
        draft={draft}
        isEditing={editTask.isEditing}
        onDraftChange={onDraftChange}
        selectedTask={selectedTask}
        tasks={tasks}
      />

      <div className="agent-queue-task-control-row">
        <div className="agent-queue-editor-field">
          <label className="field-label" htmlFor={priorityInputId}>
            Priority
          </label>
          <input
            className="input agent-queue-priority-input"
            id={priorityInputId}
            max={MAX_PRIORITY}
            min={MIN_PRIORITY}
            disabled={!editTask.isEditing}
            onChange={(event) => onPriorityChange(event.currentTarget.value)}
            type="number"
            value={draft.priority}
          />
        </div>

        <div className="agent-queue-editor-field">
          <label className="field-label" htmlFor={`${titleInputId}-tag`}>
            Queue tag
          </label>
          <input
            className="input agent-queue-tag-input"
            disabled={!editTask.isEditing}
            id={`${titleInputId}-tag`}
            onChange={(event) =>
              onDraftChange({ queueTagName: event.currentTarget.value })
            }
            value={draft.queueTagName}
          />
        </div>

        <div className="agent-queue-editor-field agent-queue-editor-field-policy">
          <label
            className="field-label"
            htmlFor={executionPolicyInputId}
            title="Manual tasks require explicit operator run. Auto policies are used only by visible Queue runner controls."
          >
            Execution policy
          </label>
          <select
            className="input agent-queue-execution-policy-select"
            disabled={!editTask.isEditing}
            id={executionPolicyInputId}
            onChange={(event) => {
              const nextExecutionPolicy = event.currentTarget.value;

              if (isAgentQueueTaskExecutionPolicy(nextExecutionPolicy)) {
                onDraftChange({
                  executionPolicy: nextExecutionPolicy,
                });
              }
            }}
            value={draft.executionPolicy}
          >
            {EXECUTION_POLICY_OPTIONS.map((executionPolicy) => (
              <option key={executionPolicy.value} value={executionPolicy.value}>
                {executionPolicy.label}
              </option>
            ))}
          </select>
        </div>

        <div className="agent-queue-editor-field">
          <label className="field-label" htmlFor={`${titleInputId}-type`}>
            Item type
          </label>
          <select
            className="input agent-queue-item-type-select"
            disabled={!editTask.isEditing}
            id={`${titleInputId}-type`}
            onChange={(event) =>
              onDraftChange({
                itemType: normalizeItemType(event.currentTarget.value),
              })
            }
            value={draft.itemType}
          >
            {ITEM_TYPE_OPTIONS.map((itemType) => (
              <option key={itemType.value} value={itemType.value}>
                {itemType.label}
              </option>
            ))}
          </select>
        </div>

        <div className="agent-queue-editor-field">
          <label className="field-label" htmlFor={`${titleInputId}-validation`}>
            Validation
          </label>
          <select
            className="input agent-queue-validation-select"
            disabled={!editTask.isEditing}
            id={`${titleInputId}-validation`}
            onChange={(event) =>
              onDraftChange({
                validationStatus: normalizeValidationStatus(
                  event.currentTarget.value,
                ),
              })
            }
            value={draft.validationStatus}
          >
            {VALIDATION_STATUS_OPTIONS.map((validationStatus) => (
              <option
                key={validationStatus.value}
                value={validationStatus.value}
              >
                {validationStatus.label}
              </option>
            ))}
          </select>
        </div>

        <div className="agent-queue-editor-actions">
          {editTask.isEditing ? (
            <>
              <Button
                disabled={!isDirty || isSaving}
                onClick={() => onSave()}
                variant="primary"
              >
                {isSaving ? "Saving" : "Save task"}
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => editTask.onCancel()}
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              disabled={isSaving}
              onClick={() => editTask.onStart()}
              variant="secondary"
            >
              Edit task
            </Button>
          )}
          <Button
            className="agent-queue-delete-button"
            disabled={!deleteTask.canRequest}
            onClick={() => deleteTask.onRequest()}
            title={
              deleteTask.blockedReason ??
              "Delete this Queue task. Executor runs and artifacts are preserved."
            }
            variant="ghost"
          >
            Delete task
          </Button>
        </div>
      </div>

      <AgentQueueDeleteTaskControl deleteTask={deleteTask} />
    </section>
  );
}

function DependencyEditor({
  draft,
  isEditing,
  onDraftChange,
  selectedTask,
  tasks,
}: {
  draft: TaskDraft;
  isEditing: boolean;
  onDraftChange: (nextDraft: Partial<TaskDraft>) => void;
  selectedTask: AgentQueueTask;
  tasks: AgentQueueTask[];
}) {
  const dependencyState = getQueueTaskDependencyState(
    { ...selectedTask, dependsOn: draft.dependsOn },
    tasks,
  );
  const dependencyChoices = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.queueItemId !== selectedTask.queueItemId &&
          !normalizeTaskDependencies(draft.dependsOn).includes(task.queueItemId),
      ),
    [draft.dependsOn, selectedTask.queueItemId, tasks],
  );
  const [selectedDependencyId, setSelectedDependencyId] = useState("");

  useEffect(() => {
    setSelectedDependencyId((currentDependencyId) =>
      dependencyChoices.some(
        (dependency) => dependency.queueItemId === currentDependencyId,
      )
        ? currentDependencyId
        : dependencyChoices[0]?.queueItemId ?? "",
    );
  }, [dependencyChoices]);

  function addDependency() {
    if (!selectedDependencyId) {
      return;
    }

    onDraftChange({
      dependsOn: normalizeTaskDependencies([
        ...draft.dependsOn,
        selectedDependencyId,
      ]),
    });
  }

  function removeDependency(queueItemId: string) {
    onDraftChange({
      dependsOn: draft.dependsOn.filter(
        (dependencyId) => dependencyId !== queueItemId,
      ),
    });
  }

  return (
    <div className="agent-queue-dependency-editor">
      <div className="agent-queue-dependency-header">
        <div>
          <p className="field-label">Dependencies</p>
          <p className="agent-queue-run-note">
            Dependencies gate readiness only. They do not start workers.
          </p>
        </div>
        <Badge variant={queueDependencyBadgeVariant(dependencyState.status)}>
          {dependencyState.dependsOn.length > 0
            ? queueDependencyStatusLabel(dependencyState.status)
            : "No deps"}
        </Badge>
      </div>

      {dependencyState.dependsOn.length > 0 ? (
        <div className="agent-queue-dependency-list">
          {dependencyState.dependsOn.map((dependencyId) => {
            const dependencyTask = tasks.find(
              (task) => task.queueItemId === dependencyId,
            );

            return (
              <div className="agent-queue-dependency-row" key={dependencyId}>
                <span>
                  {dependencyTask
                    ? displayTaskTitle(dependencyTask)
                    : dependencyId}
                </span>
                <Button
                  disabled={!isEditing}
                  onClick={() => removeDependency(dependencyId)}
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="agent-queue-run-note">No dependencies.</p>
      )}

      {isEditing ? (
        <div className="agent-queue-dependency-add-row">
          <select
            className="input agent-queue-dependency-select"
            disabled={dependencyChoices.length === 0}
            onChange={(event) =>
              setSelectedDependencyId(event.currentTarget.value)
            }
            value={selectedDependencyId}
          >
            {dependencyChoices.length === 0 ? (
              <option value="">No available task</option>
            ) : (
              dependencyChoices.map((task) => (
                <option key={task.queueItemId} value={task.queueItemId}>
                  {displayTaskTitle(task)}
                </option>
              ))
            )}
          </select>
          <Button
            disabled={!selectedDependencyId}
            onClick={addDependency}
            variant="secondary"
          >
            Add dependency
          </Button>
        </div>
      ) : null}

      {dependencyState.status !== "ready" ? (
        <div className="agent-queue-run-warning-list">
          <p className="agent-queue-run-warning">
            {queueDependencyBlockedSummary(dependencyState)}
          </p>
          {dependencyState.blockedBy.map((blocker) => (
            <p
              className="agent-queue-run-warning"
              key={`${blocker.queueItemId}-${blocker.reason}`}
            >
              {queueDependencyBlockerLabel(blocker)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
