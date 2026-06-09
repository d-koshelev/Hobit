import type { ChangeEvent } from "react";

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
  readonly preflightItems?: readonly WorkspaceAgentV2PreflightItem[];
  readonly prompt?: string;
  readonly queuePreflightItems?: readonly WorkspaceAgentV2PreflightItem[];
  readonly queueRunDisabled?: boolean;
  readonly queueRunDisabledReason?: string;
  readonly queueRunLabel?: string;
  readonly warnings?: readonly string[];
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

export type WorkspaceAgentV2PreflightItem = {
  readonly label: string;
  readonly value: string;
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
  preflightItems = [],
  prompt = "",
  queuePreflightItems = [],
  queueRunDisabled = true,
  queueRunDisabledReason = "Queue Run is not implemented in Workspace Agent v2 yet.",
  queueRunLabel,
  warnings = [],
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
        <label className="workspace-agent-v2-prompt-field">
          <span>Prompt</span>
          <textarea
            aria-label="Workspace Agent v2 prompt"
            className="input workspace-agent-v2-prompt"
            onChange={handlePromptChange}
            placeholder="Describe the next visible Workspace Agent step"
            rows={4}
            value={prompt}
          />
        </label>
      </div>
      <div className="workspace-agent-v2-composer-footer">
        <div className="workspace-agent-v2-composer-options">
          <label className="workspace-agent-v2-new-thread">
            <input
              checked={newThread}
              onChange={handleNewThreadChange}
              type="checkbox"
            />
            <span>New thread</span>
          </label>
          <label className="workspace-agent-v2-mode-select">
            <span>Provider / mode</span>
            <select
              aria-label="Workspace Agent v2 provider and mode"
              className="select"
              value="placeholder"
              onChange={() => undefined}
            >
              <option value="placeholder">Local review placeholder</option>
            </select>
          </label>
          <button
            aria-label="Workspace Agent v2 settings placeholder"
            className="button button-ghost workspace-agent-v2-settings"
            title="Settings placeholder"
            type="button"
          >
            {"\u2699"}
          </button>
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
      <WorkspaceAgentV2PreflightSummary
        errorMessage={errorMessage}
        items={preflightItems}
        queueItems={queuePreflightItems}
        queueRunDisabledReason={queueRunDisabledReason}
        warnings={warnings}
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
        className="button button-primary workspace-agent-v2-run-button workspace-agent-v2-run-button-queue"
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

function WorkspaceAgentV2PreflightSummary({
  errorMessage,
  items,
  queueItems,
  queueRunDisabledReason,
  warnings,
}: {
  readonly errorMessage?: string | null;
  readonly items: readonly WorkspaceAgentV2PreflightItem[];
  readonly queueItems: readonly WorkspaceAgentV2PreflightItem[];
  readonly queueRunDisabledReason: string;
  readonly warnings: readonly string[];
}) {
  return (
    <section
      aria-label="Workspace Agent v2 Direct Run preflight"
      className="workspace-agent-v2-preflight"
    >
      <div className="workspace-agent-v2-preflight-header">
        <h3>Direct Run preflight</h3>
        <p>{queueRunDisabledReason}</p>
      </div>
      <dl className="workspace-agent-v2-preflight-grid">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {warnings.length > 0 ? (
        <ul className="workspace-agent-v2-preflight-warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {errorMessage ? (
        <p className="workspace-agent-v2-preflight-error">{errorMessage}</p>
      ) : null}
      {queueItems.length > 0 ? (
        <section
          aria-label="Workspace Agent v2 Queue Run preflight"
          className="workspace-agent-v2-preflight-mode"
        >
          <div className="workspace-agent-v2-preflight-header">
            <h3>Queue Run preflight</h3>
            <p>Run later from Queue.</p>
          </div>
          <dl className="workspace-agent-v2-preflight-grid">
            {queueItems.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </section>
  );
}
