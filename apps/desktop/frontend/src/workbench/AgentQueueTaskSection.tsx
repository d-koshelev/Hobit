import { Button } from "../design-system/Button";
import {
  EXECUTION_POLICY_OPTIONS,
  isAgentQueueTaskExecutionPolicy,
  isQueueTaskStatus,
  MAX_PRIORITY,
  MIN_PRIORITY,
  STATUS_OPTIONS,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import { AgentQueueDeleteTaskControl } from "./AgentQueueDeleteTaskControl";
import type { AgentQueueDeleteController } from "./queue/useAgentQueueController";

type AgentQueueTaskSectionProps = {
  deleteTask: AgentQueueDeleteController;
  draft: TaskDraft;
  executionPolicyInputId: string;
  isDirty: boolean;
  isSaving: boolean;
  onDraftChange: (nextDraft: Partial<TaskDraft>) => void;
  onPriorityChange: (value: string) => void;
  onSave: () => void;
  priorityInputId: string;
  promptInputId: string;
  selectedTaskHint: string;
  statusInputId: string;
  titleInputId: string;
};

export function AgentQueueTaskSection({
  deleteTask,
  draft,
  executionPolicyInputId,
  isDirty,
  isSaving,
  onDraftChange,
  onPriorityChange,
  onSave,
  priorityInputId,
  promptInputId,
  selectedTaskHint,
  statusInputId,
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
        id={titleInputId}
        onChange={(event) => onDraftChange({ title: event.currentTarget.value })}
        title={selectedTaskHint || undefined}
        value={draft.title}
      />

      <label className="field-label" htmlFor={promptInputId}>
        Prompt
      </label>
      <textarea
        className="input agent-queue-prompt-input"
        id={promptInputId}
        onChange={(event) => onDraftChange({ prompt: event.currentTarget.value })}
        value={draft.prompt}
      />

      <div className="agent-queue-task-control-row">
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

        <div className="agent-queue-editor-actions">
          <Button
            disabled={!isDirty || isSaving}
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
      </div>

      <AgentQueueDeleteTaskControl deleteTask={deleteTask} />
    </section>
  );
}
