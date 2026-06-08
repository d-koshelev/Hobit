import type { ChangeEvent } from "react";

type WorkspaceAgentV2ComposerProps = {
  readonly newThread?: boolean;
  readonly onDirectRun?: () => void;
  readonly onNewThreadChange?: (newThread: boolean) => void;
  readonly onPromptChange?: (prompt: string) => void;
  readonly onQueueRun?: () => void;
  readonly prompt?: string;
};

type WorkspaceAgentV2RunControlsProps = {
  readonly onDirectRun?: () => void;
  readonly onQueueRun?: () => void;
};

export function WorkspaceAgentV2Composer({
  newThread = false,
  onDirectRun,
  onNewThreadChange,
  onPromptChange,
  onQueueRun,
  prompt = "",
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
          onDirectRun={onDirectRun}
          onQueueRun={onQueueRun}
        />
      </div>
    </section>
  );
}

export function WorkspaceAgentV2RunControls({
  onDirectRun,
  onQueueRun,
}: WorkspaceAgentV2RunControlsProps) {
  return (
    <div
      aria-label="Workspace Agent v2 run controls"
      className="workspace-agent-v2-run-controls"
      role="group"
    >
      <button
        className="button button-primary workspace-agent-v2-run-button"
        onClick={onDirectRun}
        type="button"
      >
        Direct Run
      </button>
      <button
        className="button button-primary workspace-agent-v2-run-button workspace-agent-v2-run-button-queue"
        onClick={onQueueRun}
        type="button"
      >
        Queue Run
      </button>
    </div>
  );
}
