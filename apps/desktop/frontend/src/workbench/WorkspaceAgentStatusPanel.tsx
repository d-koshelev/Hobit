import { useId, useRef, useState } from "react";
import { Badge } from "../design-system/Badge";
import { WidgetPopupShell } from "../design-system/WidgetPopupShell";
import type { WorkspaceAgentSuggestedPrompt } from "./workspaceAgentSuggestedPrompts";
import type { CoordinatorDirectWorkStatus } from "./workspaceAgentDirectWorkModel";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export function WorkspaceAgentHeaderStatus({
  agentLabel = "Codex",
  onPromptExampleClick,
  promptExamples = [],
  status,
}: {
  agentLabel?: string;
  onPromptExampleClick?: (prompt: string) => void;
  promptExamples?: WorkspaceAgentSuggestedPrompt[];
  status: CoordinatorDirectWorkStatus;
}) {
  const promptExamplesButtonRef = useRef<HTMLButtonElement | null>(null);
  const promptExamplesTitleId = useId();
  const [promptExamplesOpen, setPromptExamplesOpen] = useState(false);
  const showPromptExamples = promptExamples.length > 0 && onPromptExampleClick;

  return (
    <div className="interactive-agent-frame-status">
      <label className="interactive-agent-agent-picker">
        <span>Provider</span>
        <select
          aria-label="Workspace Agent picker"
          className="input interactive-agent-agent-select"
          defaultValue="codex"
          disabled
        >
          <option value="codex">{agentLabel}</option>
        </select>
      </label>
      <span className="interactive-agent-frame-status-label">Status</span>
      <Badge variant={workspaceAgentStatusVariant(status)}>
        {workspaceAgentStatusLabel(status)}
      </Badge>
      {showPromptExamples ? (
        <div className="interactive-agent-examples-menu">
          <button
            aria-expanded={promptExamplesOpen}
            aria-label="Toggle Workspace Agent prompt examples"
            className="button button-secondary interactive-agent-examples-toggle"
            onClick={() => setPromptExamplesOpen((isOpen) => !isOpen)}
            ref={promptExamplesButtonRef}
            type="button"
          >
            Examples
          </button>
          <WidgetPopupShell
            anchorRef={promptExamplesButtonRef}
            id="workspace-agent-prompt-examples-popup"
            isOpen={promptExamplesOpen}
            onRequestClose={() => setPromptExamplesOpen(false)}
            returnFocusRef={promptExamplesButtonRef}
            titleId={promptExamplesTitleId}
          >
            <section
              aria-label="Workspace Agent prompt examples"
              aria-labelledby={promptExamplesTitleId}
              className="interactive-agent-examples-panel"
            >
              <div className="interactive-agent-popup-header">
                <p
                  className="interactive-agent-popup-title"
                  data-popup-drag-handle
                  id={promptExamplesTitleId}
                >
                  Prompt examples
                </p>
              </div>
              <div className="interactive-agent-suggestion-list">
                {promptExamples.map((suggestion) => (
                  <button
                    className="interactive-agent-suggestion"
                    key={suggestion.label}
                    onClick={() => {
                      onPromptExampleClick(suggestion.prompt);
                      setPromptExamplesOpen(false);
                    }}
                    type="button"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </section>
          </WidgetPopupShell>
        </div>
      ) : null}
    </div>
  );
}

function workspaceAgentStatusLabel(
  status: CoordinatorDirectWorkStatus,
): string {
  if (status === "running") {
    return "Running";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Ready";
}

function workspaceAgentStatusVariant(
  status: CoordinatorDirectWorkStatus,
): BadgeVariant {
  if (status === "running") {
    return "info";
  }

  if (status === "failed") {
    return "error";
  }

  return "success";
}
