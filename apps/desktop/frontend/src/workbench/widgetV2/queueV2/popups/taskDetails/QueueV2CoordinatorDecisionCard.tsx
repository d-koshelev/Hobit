import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  Field,
  KeyValueList,
  Notice,
  Section,
  Textarea,
} from "../../../../../design-system";
import type { AgentQueueTask } from "../../../../../workspace/types";
import {
  queueCoordinatorDecisionCardViewModelForTask,
} from "../../../../queue/queueCoordinatorDecisionViewModel";
import type {
  AgentQueueSmartAssistanceRequest,
} from "../../../../queue/agentQueueSmartAssistanceActions";
import type { AgentQueueController } from "../../../../queue/details/agentQueueTaskDetailsTypes";

type QueueV2CoordinatorDecisionCardProps = {
  readonly queue?: AgentQueueController;
  readonly task: AgentQueueTask;
};

export function QueueV2CoordinatorDecisionCard({
  queue,
  task,
}: QueueV2CoordinatorDecisionCardProps) {
  const model = queueCoordinatorDecisionCardViewModelForTask(task);
  const showRetrySameButton = Boolean(
    model?.retrySameAvailable && queue?.smartQueueRetry,
  );
  const showRetryWithModifiedPromptButton = Boolean(
    model?.retryWithModifiedPromptAvailable &&
      queue?.smartQueueRetry?.onRetryWithModifiedPrompt,
  );
  const showAskWorkspaceAgentButton = Boolean(
    model?.askWorkspaceAgentAvailable &&
      queue?.smartQueueAssistance?.available,
  );
  const [isModifiedPromptEditorOpen, setIsModifiedPromptEditorOpen] =
    useState(false);
  const [modifiedPromptDraft, setModifiedPromptDraft] = useState(task.prompt);
  const [modifiedPromptError, setModifiedPromptError] = useState<string | null>(
    null,
  );
  const [assistanceRequest, setAssistanceRequest] =
    useState<AgentQueueSmartAssistanceRequest | null>(null);

  useEffect(() => {
    setIsModifiedPromptEditorOpen(false);
    setModifiedPromptDraft(task.prompt);
    setModifiedPromptError(null);
    setAssistanceRequest(null);
  }, [task.queueItemId, task.prompt]);

  if (!model) {
    return null;
  }

  const unavailableActionLabels = model.allowedActionLabels.filter((label) => {
    if (
      showRetryWithModifiedPromptButton &&
      label === model.retryWithModifiedPromptLabel
    ) {
      return false;
    }

    return !(showAskWorkspaceAgentButton && label === model.askWorkspaceAgentLabel);
  });

  async function submitModifiedPromptRetry() {
    const cleanPrompt = modifiedPromptDraft.trim();

    if (!cleanPrompt) {
      setModifiedPromptError("Enter a modified prompt before queueing retry.");
      return;
    }

    setModifiedPromptError(null);
    const accepted =
      (await queue?.smartQueueRetry?.onRetryWithModifiedPrompt(cleanPrompt)) ??
      false;

    if (accepted) {
      setIsModifiedPromptEditorOpen(false);
    }
  }

  async function prepareWorkspaceAgentAssistance() {
    const request =
      (await queue?.smartQueueAssistance?.onAskWorkspaceAgent()) ?? null;

    if (request) {
      setAssistanceRequest(request);
    }
  }

  return (
    <Section
      aria-label="Coordinator Decision card"
      className="queue-v2-coordinator-decision-card"
      compact
      title="Coordinator decision"
    >
      <KeyValueList
        compact
        items={[
          { label: "What happened", value: model.statusLabel },
          { label: "Why decision is needed", value: model.evidenceSummary },
          { label: "Recommended action", value: model.recommendedActionLabel },
          {
            label: "Allowed next actions",
            value: (
              <span className="queue-v2-coordinator-decision-actions">
                {unavailableActionLabels.map((label) => (
                  <Badge key={label} variant="neutral">
                    {label}
                  </Badge>
                ))}
              </span>
            ),
          },
          { label: "Approval", value: model.requiresApprovalLabel },
          { label: "Destructive", value: model.destructiveLabel },
          ...(showRetrySameButton || showRetryWithModifiedPromptButton
            ? []
            : [{ label: "Action availability", value: model.actionAvailability }]),
        ]}
      />
      {showRetrySameButton && queue?.smartQueueRetry ? (
        <div className="queue-v2-coordinator-decision-controls">
          <Button
            disabled={
              !queue.smartQueueRetry.canRetrySame ||
              queue.smartQueueRetry.isRetrying
            }
            onClick={() => queue.smartQueueRetry.onRetrySame()}
            variant="secondary"
          >
            {queue.smartQueueRetry.isRetrying ? "Retrying" : model.retrySameLabel}
          </Button>
        </div>
      ) : null}
      {showRetryWithModifiedPromptButton && queue?.smartQueueRetry ? (
        <div className="queue-v2-coordinator-decision-controls">
          <Button
            disabled={
              !queue.smartQueueRetry.canRetryWithModifiedPrompt ||
              queue.smartQueueRetry.isRetrying
            }
            onClick={() => {
              setModifiedPromptDraft(task.prompt);
              setModifiedPromptError(null);
              setIsModifiedPromptEditorOpen(true);
            }}
            variant="secondary"
          >
            {model.retryWithModifiedPromptLabel}
          </Button>
        </div>
      ) : null}
      {showAskWorkspaceAgentButton && queue?.smartQueueAssistance ? (
        <div className="queue-v2-coordinator-decision-controls">
          <Button
            disabled={
              !queue.smartQueueAssistance.canAskWorkspaceAgent ||
              queue.smartQueueAssistance.isRequesting
            }
            onClick={() => void prepareWorkspaceAgentAssistance()}
            variant="secondary"
          >
            {queue.smartQueueAssistance.isRequesting
              ? "Preparing request"
              : model.askWorkspaceAgentLabel}
          </Button>
        </div>
      ) : null}
      {isModifiedPromptEditorOpen && queue?.smartQueueRetry ? (
        <div
          aria-label="Retry with modified prompt editor"
          className="queue-v2-coordinator-decision-editor"
        >
          <Field label="Current prompt">
            <Textarea className="input" readOnly rows={4} value={task.prompt} />
          </Field>
          <Field
            error={modifiedPromptError}
            helperText="This becomes the runnable prompt for the next attempt."
            label="Modified prompt"
            required
          >
            <Textarea
              aria-label="Modified retry prompt"
              className="input"
              onChange={(event) => {
                setModifiedPromptDraft(event.currentTarget.value);
                if (modifiedPromptError) {
                  setModifiedPromptError(null);
                }
              }}
              rows={6}
              value={modifiedPromptDraft}
            />
          </Field>
          <div className="queue-v2-coordinator-decision-editor-actions">
            <Button
              disabled={queue.smartQueueRetry.isRetrying}
              onClick={() => {
                setIsModifiedPromptEditorOpen(false);
                setModifiedPromptDraft(task.prompt);
                setModifiedPromptError(null);
              }}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={queue.smartQueueRetry.isRetrying}
              onClick={() => void submitModifiedPromptRetry()}
              variant="primary"
            >
              {queue.smartQueueRetry.isRetrying
                ? "Queueing retry"
                : "Queue retry"}
            </Button>
          </div>
        </div>
      ) : null}
      {queue?.smartQueueRetry?.message ? (
        <span className="queue-v2-coordinator-decision-message">
          {queue.smartQueueRetry.message}
        </span>
      ) : null}
      {queue?.smartQueueRetry?.error ? (
        <span className="queue-v2-coordinator-decision-message">
          {queue.smartQueueRetry.error}
        </span>
      ) : null}
      {queue?.smartQueueAssistance?.message ? (
        <span className="queue-v2-coordinator-decision-message">
          {queue.smartQueueAssistance.message}
        </span>
      ) : null}
      {queue?.smartQueueAssistance?.error ? (
        <span className="queue-v2-coordinator-decision-message">
          {queue.smartQueueAssistance.error}
        </span>
      ) : null}
      {assistanceRequest ? (
        <div
          aria-label="Workspace Agent assistance handoff"
          className="queue-v2-coordinator-decision-editor"
        >
          <Notice variant="success" title="Assistance request prepared">
            Handoff prompt is ready.
          </Notice>
          <Field label="Handoff prompt">
            <Textarea
              aria-label="Workspace Agent handoff prompt"
              className="input queue-v2-coordinator-decision-handoff"
              readOnly
              rows={8}
              value={assistanceRequest.recommendedPrompt}
            />
          </Field>
          <div className="queue-v2-coordinator-decision-editor-actions">
            <Button
              onClick={() => {
                const prompt = document.querySelector<HTMLTextAreaElement>(
                  "textarea[aria-label='Workspace Agent handoff prompt']",
                );
                prompt?.focus();
                prompt?.select();
              }}
              variant="secondary"
            >
              Select prompt
            </Button>
          </div>
        </div>
      ) : null}
      <div className="queue-v2-coordinator-decision-flags">
        {model.requiresApproval ? (
          <Badge variant="warning">Approval required</Badge>
        ) : (
          <Badge variant="neutral">No approval required</Badge>
        )}
        {model.destructive ? (
          <Badge variant="error">Destructive</Badge>
        ) : (
          <Badge variant="neutral">Not destructive</Badge>
        )}
      </div>
      <Notice variant="info" title="Decision proposal">
        Queue shows this proposal for review. Retry only returns the task to
        Ready through the Queue controller; Workspace Agent requests prepare a
        handoff only. Rollback, Git changes, Terminal commands, and worker
        starts do not run from this card.
      </Notice>
    </Section>
  );
}
