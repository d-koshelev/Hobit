import { Button, InfoTip, WidgetPopupShell } from "../design-system";
import {
  EXECUTION_POLICY_OPTIONS,
  isAgentQueueTaskExecutionPolicy,
  MAX_PRIORITY,
  MIN_PRIORITY,
  type TaskDraft,
} from "./agentQueueTaskUiModel";
import type { QueueTaskInsertPosition } from "./queue/useAgentQueueController";
import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";

export type AgentQueueNewTaskRunSetup = {
  approvalPolicy: DirectWorkApprovalPolicy;
  codexExecutableDraft: string;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox;
};

type AgentQueueNewTaskDialogProps = {
  apiAvailable: boolean;
  createDescriptionInputId: string;
  createDialogError: string | null;
  createDialogTitleId: string;
  createDraft: TaskDraft;
  createExecutionPolicyInputId: string;
  createExecutionStateInputId: string;
  createRunApprovalPolicyInputId: string;
  createRunCodexExecutableInputId: string;
  createRunSandboxInputId: string;
  createRunWorkspaceInputId: string;
  createPriorityInputId: string;
  createPromptInputId: string;
  createTitleInputId: string;
  insertPosition: QueueTaskInsertPosition;
  isCreating: boolean;
  onCancel: () => void;
  onConfirmDraft: () => void;
  onConfirmQueued: () => void;
  onDraftChange: (nextDraft: Partial<TaskDraft>) => void;
  onInsertPositionChange: (insertPosition: QueueTaskInsertPosition) => void;
  onPriorityChange: (value: string) => void;
  onRunSetupChange: (nextSetup: Partial<AgentQueueNewTaskRunSetup>) => void;
  runSetup: AgentQueueNewTaskRunSetup;
};

export function AgentQueueNewTaskDialog({
  apiAvailable,
  createDescriptionInputId,
  createDialogError,
  createDialogTitleId,
  createDraft,
  createExecutionPolicyInputId,
  createExecutionStateInputId,
  createRunApprovalPolicyInputId,
  createRunCodexExecutableInputId,
  createRunSandboxInputId,
  createRunWorkspaceInputId,
  createPriorityInputId,
  createPromptInputId,
  createTitleInputId,
  insertPosition,
  isCreating,
  onCancel,
  onConfirmDraft,
  onConfirmQueued,
  onDraftChange,
  onInsertPositionChange,
  onPriorityChange,
  onRunSetupChange,
  runSetup,
}: AgentQueueNewTaskDialogProps) {
  const queuedCreateReady = canCreateQueuedTask(createDraft, runSetup);
  const primaryCreateLabel =
    createDraft.status === "queued" ? "Create queued task" : "Create draft";
  const primaryCreateDisabled =
    createDraft.status === "queued"
      ? isCreating || !apiAvailable || !queuedCreateReady
      : isCreating || !apiAvailable || !createDraft.title.trim();
  const primaryCreateAction =
    createDraft.status === "queued" ? onConfirmQueued : onConfirmDraft;

  return (
    <WidgetPopupShell
      actions={
        <Button disabled={isCreating} onClick={() => onCancel()} variant="ghost">
          Close
        </Button>
      }
      bodyClassName="agent-queue-create-dialog-body"
      className="agent-queue-create-dialog"
      footer={
        <>
          <Button disabled={isCreating} onClick={() => onCancel()} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={primaryCreateDisabled}
            onClick={() => primaryCreateAction()}
            variant="primary"
          >
            {isCreating ? "Creating" : primaryCreateLabel}
          </Button>
        </>
      }
      id="agent-queue-new-task-popup"
      isOpen
      minResizeHeight={420}
      minResizeWidth={420}
      onRequestClose={onCancel}
      resizable
      title={
        <span className="agent-queue-create-dialog-title-inline">
          New task
          <InfoTip label="New task information" title="New task">
            Create a draft, or set the initial state to queued and save task run
            settings for a later explicit run.
          </InfoTip>
        </span>
      }
      titleId={createDialogTitleId}
      variant="floating"
    >
          <section className="agent-queue-create-section" aria-label="Basic">
            <p className="agent-queue-create-section-title">Basic</p>
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
              <label className="field-label" htmlFor={createPromptInputId}>
                Prompt
              </label>
              <textarea
                className="input agent-queue-prompt-input"
                id={createPromptInputId}
                onChange={(event) =>
                  onDraftChange({
                    prompt: event.currentTarget.value,
                    status:
                      event.currentTarget.value.trim() &&
                      runSetup.repoRootDraft.trim()
                        ? "queued"
                        : createDraft.status,
                  })
                }
                value={createDraft.prompt}
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
          </section>

          <section className="agent-queue-create-section" aria-label="Run setup">
            <div className="agent-queue-create-section-header">
              <p className="agent-queue-create-section-title">Run setup</p>
              <span>Task settings</span>
            </div>
            <p className="agent-queue-create-section-copy">
              These settings are saved on this Queue item. Defaults only prefill
              this dialog.
            </p>
            <div className="agent-queue-editor-grid agent-queue-create-run-grid">
              <div className="agent-queue-editor-field agent-queue-create-field-wide">
                <label
                  className="field-label"
                  htmlFor={createRunWorkspaceInputId}
                >
                  Task workspace
                </label>
                <input
                  autoComplete="off"
                  className="input"
                  id={createRunWorkspaceInputId}
                  onChange={(event) => {
                    const repoRootDraft = event.currentTarget.value;

                    onRunSetupChange({ repoRootDraft });
                    if (repoRootDraft.trim() && createDraft.prompt.trim()) {
                      onDraftChange({ status: "queued" });
                    }
                  }}
                  placeholder="C:\\path\\to\\repo-or-project"
                  spellCheck={false}
                  value={runSetup.repoRootDraft}
                />
              </div>

              <div className="agent-queue-editor-field agent-queue-create-field-wide">
                <label
                  className="field-label"
                  htmlFor={createRunCodexExecutableInputId}
                >
                  Codex executable
                </label>
                <input
                  autoComplete="off"
                  className="input"
                  id={createRunCodexExecutableInputId}
                  onChange={(event) =>
                    onRunSetupChange({
                      codexExecutableDraft: event.currentTarget.value,
                    })
                  }
                  spellCheck={false}
                  value={runSetup.codexExecutableDraft}
                />
              </div>

              <div className="agent-queue-editor-field">
                <label className="field-label" htmlFor={createRunSandboxInputId}>
                  Sandbox
                </label>
                <select
                  className="input"
                  id={createRunSandboxInputId}
                  onChange={(event) =>
                    onRunSetupChange({
                      sandbox: event.currentTarget.value as DirectWorkSandbox,
                    })
                  }
                  value={runSetup.sandbox}
                >
                  <option value="read_only">read_only</option>
                  <option value="workspace_write">workspace_write</option>
                  <option value="danger_full_access">
                    danger_full_access
                  </option>
                </select>
              </div>

              <div className="agent-queue-editor-field">
                <label
                  className="field-label"
                  htmlFor={createRunApprovalPolicyInputId}
                >
                  Approval policy
                </label>
                <select
                  className="input"
                  id={createRunApprovalPolicyInputId}
                  onChange={(event) =>
                    onRunSetupChange({
                      approvalPolicy:
                        event.currentTarget.value as DirectWorkApprovalPolicy,
                    })
                  }
                  value={runSetup.approvalPolicy}
                >
                  <option value="never">never</option>
                  <option value="on_request">on_request</option>
                  <option value="untrusted">untrusted</option>
                </select>
              </div>
            </div>
            {runSetup.sandbox === "danger_full_access" ? (
              <p className="agent-queue-run-warning" role="alert">
                danger_full_access is unsafe local-dev mode. Hobit still will
                not auto-run, auto-commit, push, reset, clean, stash, roll back,
                validate, or finalize coordinator review.
              </p>
            ) : null}
          </section>

          <section className="agent-queue-create-section" aria-label="Queue options">
            <p className="agent-queue-create-section-title">Queue options</p>
            <div className="agent-queue-editor-grid">
              <div className="agent-queue-editor-field">
                <label className="field-label" htmlFor={createExecutionStateInputId}>
                  Initial state
                </label>
                <select
                  className="input"
                  id={createExecutionStateInputId}
                  onChange={(event) =>
                    onDraftChange({
                      status: event.currentTarget.value === "queued"
                        ? "queued"
                        : "draft",
                    })
                  }
                  value={createDraft.status === "queued" ? "queued" : "draft"}
                >
                  <option value="draft">Draft</option>
                  <option value="queued">Queued</option>
                </select>
              </div>

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
          </section>

          {createDialogError ? (
            <p
              className="agent-queue-message agent-queue-message-warning"
              role="alert"
            >
              {createDialogError}
            </p>
          ) : null}
    </WidgetPopupShell>
  );
}

function canCreateQueuedTask(
  draft: TaskDraft,
  runSetup: AgentQueueNewTaskRunSetup,
) {
  return Boolean(
    draft.title.trim() &&
      draft.prompt.trim() &&
      runSetup.repoRootDraft.trim() &&
      runSetup.codexExecutableDraft.trim() &&
      runSetup.sandbox &&
      runSetup.approvalPolicy,
  );
}
