import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueTask } from "../workspace/types";
import {
  displayTaskTitle,
  EXECUTION_POLICY_OPTIONS,
  isAgentQueueTaskExecutionPolicy,
  isQueueTaskStatus,
  MAX_PRIORITY,
  MIN_PRIORITY,
  statusBadgeVariant,
  statusLabel,
  STATUS_OPTIONS,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import { AgentQueueDeleteTaskControl } from "./AgentQueueDeleteTaskControl";
import type { AgentQueueDeleteController } from "./queue/useAgentQueueController";

type AgentQueueTaskSectionProps = {
  deleteTask: AgentQueueDeleteController;
  descriptionInputId: string;
  draft: TaskDraft;
  executionPolicyInputId: string;
  isDirty: boolean;
  isSaving: boolean;
  onDraftChange: (nextDraft: Partial<TaskDraft>) => void;
  onPriorityChange: (value: string) => void;
  onSave: () => void;
  priorityInputId: string;
  promptInputId: string;
  saveStateText: string;
  selectedTask: AgentQueueTask;
  selectedTaskHint: string;
  selectedUpdatedText: string | null;
  statusInputId: string;
  titleInputId: string;
};

export function AgentQueueTaskSection({
  deleteTask,
  descriptionInputId,
  draft,
  executionPolicyInputId,
  isDirty,
  isSaving,
  onDraftChange,
  onPriorityChange,
  onSave,
  priorityInputId,
  promptInputId,
  saveStateText,
  selectedTask,
  selectedTaskHint,
  selectedUpdatedText,
  statusInputId,
  titleInputId,
}: AgentQueueTaskSectionProps) {
  return (
    <section
      aria-label="Task"
      className="agent-queue-editor-section agent-queue-task-section"
    >
      <div className="agent-queue-section-header">
        <div>
          <p
            className="agent-queue-section-title"
            title={`${displayTaskTitle(selectedTask)}: ${selectedTaskHint}`}
          >
            Task
          </p>
          <p className="agent-queue-section-copy">
            {selectedUpdatedText
              ? `${selectedUpdatedText} \u00b7 ${
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
          <Badge variant="neutral">Priority {draft.priority.toString()}</Badge>
        </div>
      </div>

      <label className="field-label" htmlFor={titleInputId}>
        Title
      </label>
      <input
        className="input agent-queue-title-input"
        id={titleInputId}
        onChange={(event) => onDraftChange({ title: event.currentTarget.value })}
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
            onDraftChange({
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
        onChange={(event) => onDraftChange({ prompt: event.currentTarget.value })}
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
                onDraftChange({ status: nextStatus });
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
            onChange={(event) => onPriorityChange(event.currentTarget.value)}
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
      </div>

      <div className="agent-queue-editor-actions">
        <Button
          disabled={!selectedTask || !isDirty || isSaving}
          onClick={() => onSave()}
          variant="primary"
        >
          {isSaving ? "Saving" : "Save task"}
        </Button>
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

      <AgentQueueDeleteTaskControl deleteTask={deleteTask} />
    </section>
  );
}
