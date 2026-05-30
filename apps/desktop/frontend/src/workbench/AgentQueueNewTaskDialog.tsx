import { Button } from "../design-system/Button";
import {
  EXECUTION_POLICY_OPTIONS,
  isAgentQueueTaskExecutionPolicy,
  MAX_PRIORITY,
  MIN_PRIORITY,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import type { QueueTaskInsertPosition } from "./queue/useAgentQueueController";

type AgentQueueNewTaskDialogProps = {
  apiAvailable: boolean;
  createDescriptionInputId: string;
  createDialogError: string | null;
  createDialogTitleId: string;
  createDraft: TaskDraft;
  createExecutionPolicyInputId: string;
  createPriorityInputId: string;
  createPromptInputId: string;
  createTitleInputId: string;
  insertPosition: QueueTaskInsertPosition;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (nextDraft: Partial<TaskDraft>) => void;
  onInsertPositionChange: (insertPosition: QueueTaskInsertPosition) => void;
  onPriorityChange: (value: string) => void;
};

export function AgentQueueNewTaskDialog({
  apiAvailable,
  createDescriptionInputId,
  createDialogError,
  createDialogTitleId,
  createDraft,
  createExecutionPolicyInputId,
  createPriorityInputId,
  createPromptInputId,
  createTitleInputId,
  insertPosition,
  isCreating,
  onCancel,
  onConfirm,
  onDraftChange,
  onInsertPositionChange,
  onPriorityChange,
}: AgentQueueNewTaskDialogProps) {
  return (
    <div className="agent-queue-create-dialog-layer" data-widget-header-drag-ignore>
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
          <Button disabled={isCreating} onClick={() => onCancel()} variant="ghost">
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
                onDraftChange({
                  title: event.currentTarget.value,
                })
              }
              value={createDraft.title}
            />
          </div>

          <div className="agent-queue-editor-field">
            <label className="field-label" htmlFor={createDescriptionInputId}>
              Description
            </label>
            <textarea
              className="input agent-queue-description-input"
              id={createDescriptionInputId}
              onChange={(event) =>
                onDraftChange({
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
                onDraftChange({
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
                htmlFor={`${createTitleInputId}-queue-tag`}
              >
                Queue tag
              </label>
              <input
                className="input agent-queue-tag-input"
                id={`${createTitleInputId}-queue-tag`}
                onChange={(event) =>
                  onDraftChange({
                    queueTagName: event.currentTarget.value,
                  })
                }
                value={createDraft.queueTagName}
              />
            </div>

            <div className="agent-queue-editor-field">
              <label
                className="field-label"
                htmlFor={`${createTitleInputId}-insert-position`}
              >
                Insert
              </label>
              <select
                className="input agent-queue-insert-position-select"
                id={`${createTitleInputId}-insert-position`}
                onChange={(event) =>
                  onInsertPositionChange(
                    event.currentTarget.value as QueueTaskInsertPosition,
                  )
                }
                value={insertPosition}
              >
                <option value="bottom">Bottom of tag</option>
                <option value="top">Top of tag</option>
              </select>
            </div>

            <div className="agent-queue-editor-field">
              <label className="field-label" htmlFor={createPriorityInputId}>
                Priority
              </label>
              <input
                className="input agent-queue-priority-input"
                id={createPriorityInputId}
                max={MAX_PRIORITY}
                min={MIN_PRIORITY}
                onChange={(event) => onPriorityChange(event.currentTarget.value)}
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

                  if (isAgentQueueTaskExecutionPolicy(nextExecutionPolicy)) {
                    onDraftChange({
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
          <Button disabled={isCreating} onClick={() => onCancel()} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={isCreating || !apiAvailable}
            onClick={() => onConfirm()}
            variant="primary"
          >
            {isCreating ? "Creating" : "Create task"}
          </Button>
        </div>
      </div>
    </div>
  );
}
