import type { ChangeEvent } from "react";
import {
  CheckboxField,
  Field,
  InlineError,
  Notice,
  Textarea,
} from "../../../design-system";

type WorkspaceAgentV2ComposerProps = {
  readonly directRunDisabled?: boolean;
  readonly directRunDisabledReason?: string;
  readonly directRunLabel?: string;
  readonly errorMessage?: string | null;
  readonly newThread?: boolean;
  readonly onDirectRun?: () => void;
  readonly onNewThreadChange?: (newThread: boolean) => void;
  readonly onPromptChange?: (prompt: string) => void;
  readonly onQueueRun?: () => void;
  readonly prompt?: string;
  readonly queueRunDisabled?: boolean;
  readonly queueRunDisabledReason?: string;
  readonly queueRunLabel?: string;
};

type WorkspaceAgentV2RunControlsProps = {
  readonly directRunDisabled?: boolean;
  readonly directRunDisabledReason?: string;
  readonly directRunLabel?: string;
  readonly onDirectRun?: () => void;
  readonly onQueueRun?: () => void;
  readonly queueRunDisabled?: boolean;
  readonly queueRunDisabledReason?: string;
  readonly queueRunLabel?: string;
};

export function WorkspaceAgentV2Composer({
  directRunDisabled = false,
  directRunDisabledReason,
  directRunLabel,
  errorMessage,
  newThread = false,
  onDirectRun,
  onNewThreadChange,
  onPromptChange,
  onQueueRun,
  prompt = "",
  queueRunDisabled = true,
  queueRunDisabledReason = "Queue Run is not implemented in Workspace Agent v2 yet.",
  queueRunLabel,
}: WorkspaceAgentV2ComposerProps) {
  function handlePromptChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onPromptChange?.(event.currentTarget.value);
  }

  function handleNewThreadChange(event: ChangeEvent<HTMLInputElement>) {
    onNewThreadChange?.(event.currentTarget.checked);
  }

  return (
    <section
      aria-label="Workspace Agent v2 composer"
      className="workspace-agent-v2-composer"
    >
      <div className="workspace-agent-v2-composer-row">
        <Field
          className="workspace-agent-v2-prompt-field"
          helperText="Only visible prompt and explicitly attached context are used."
          label="Prompt"
        >
          <Textarea
            aria-label="Workspace Agent v2 prompt"
            className="workspace-agent-v2-prompt"
            onChange={handlePromptChange}
            placeholder="Describe the next visible Workspace Agent step"
            rows={4}
            value={prompt}
          />
        </Field>
      </div>
      <div className="workspace-agent-v2-composer-footer">
        <div className="workspace-agent-v2-composer-options">
          <CheckboxField
            checked={newThread}
            className="workspace-agent-v2-new-thread"
            label="New thread"
            onChange={handleNewThreadChange}
          />
        </div>
        <WorkspaceAgentV2RunControls
          directRunDisabled={directRunDisabled}
          directRunDisabledReason={directRunDisabledReason}
          directRunLabel={directRunLabel}
          onDirectRun={onDirectRun}
          onQueueRun={onQueueRun}
          queueRunDisabled={queueRunDisabled}
          queueRunDisabledReason={queueRunDisabledReason}
          queueRunLabel={queueRunLabel}
        />
      </div>
      <WorkspaceAgentV2ComposerFeedback
        directRunDisabledReason={directRunDisabledReason}
        errorMessage={errorMessage}
      />
    </section>
  );
}

export function WorkspaceAgentV2RunControls({
  directRunDisabled = false,
  directRunDisabledReason,
  directRunLabel = "Direct Run",
  onDirectRun,
  onQueueRun,
  queueRunDisabled = true,
  queueRunDisabledReason = "Queue Run is not implemented in Workspace Agent v2 yet.",
  queueRunLabel = "Queue Run",
}: WorkspaceAgentV2RunControlsProps) {
  return (
    <div
      aria-label="Workspace Agent v2 run controls"
      className="workspace-agent-v2-run-controls"
      role="group"
    >
      <button
        className="button button-primary workspace-agent-v2-run-button"
        disabled={directRunDisabled}
        onClick={onDirectRun}
        title={directRunDisabledReason}
        type="button"
      >
        {directRunLabel}
      </button>
      <button
        className="button button-secondary workspace-agent-v2-run-button workspace-agent-v2-run-button-queue"
        disabled={queueRunDisabled}
        onClick={onQueueRun}
        title={queueRunDisabledReason}
        type="button"
      >
        {queueRunLabel}
      </button>
    </div>
  );
}

function WorkspaceAgentV2ComposerFeedback({
  directRunDisabledReason,
  errorMessage,
}: {
  readonly directRunDisabledReason?: string;
  readonly errorMessage?: string | null;
}) {
  if (errorMessage) {
    return <InlineError>{errorMessage}</InlineError>;
  }

  if (directRunDisabledReason?.includes("unsupported")) {
    return (
      <Notice title="Direct Run unavailable" variant="error">
        {directRunDisabledReason}
      </Notice>
    );
  }

  if (directRunDisabledReason?.includes("working directory")) {
    return (
      <Notice title="Working directory required" variant="warning">
        {directRunDisabledReason}
      </Notice>
    );
  }

  return null;
}
