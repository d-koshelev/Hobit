import { Badge } from "../design-system/Badge";
import {
  agentChatContextSourceOptions,
  isContextSourceSelected,
  type AgentChatApprovedContextSelection,
  type AgentChatApprovedContextSnapshot,
  type AgentChatContextSourceId,
} from "./agentChatApprovedContext";

type AgentChatApprovedContextSectionProps = {
  isContextAvailable: boolean;
  onSelectionChange: (
    sourceId: AgentChatContextSourceId,
    isSelected: boolean,
  ) => void;
  selection: AgentChatApprovedContextSelection;
  snapshot: AgentChatApprovedContextSnapshot;
};

export function AgentChatApprovedContextSection({
  isContextAvailable,
  onSelectionChange,
  selection,
  snapshot,
}: AgentChatApprovedContextSectionProps) {
  return (
    <section
      aria-label="Agent Chat approved context"
      className="agent-chat-proposal-panel agent-chat-context-panel"
    >
      <div className="agent-chat-proposal-header">
        <div className="agent-chat-proposal-copy">
          <p className="agent-chat-proposal-title">Approved context</p>
          <p className="agent-chat-proposal-text">
            Only selected current-view metadata is included in the mock
            proposal. No hidden workspace, file, Git, Notes, logs, Queue, or
            Terminal output is read.
          </p>
        </div>
        <Badge variant="neutral">Current session</Badge>
      </div>

      <div
        aria-label="Agent Chat approved context options"
        className="agent-chat-context-options"
      >
        {agentChatContextSourceOptions.map((option) => (
          <label className="agent-chat-context-option" key={option.id}>
            <input
              checked={isContextSourceSelected(selection, option.id)}
              className="agent-chat-context-checkbox"
              disabled={!isContextAvailable}
              onChange={(event) =>
                onSelectionChange(option.id, event.target.checked)
              }
              type="checkbox"
            />
            <span className="agent-chat-context-option-copy">
              <span className="agent-chat-context-option-label">
                {option.label}
              </span>
              <span className="agent-chat-context-option-text">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div
        aria-label="Agent Chat approved context preview"
        className="agent-chat-context-preview"
      >
        <div className="agent-chat-context-preview-header">
          <p className="agent-chat-proposal-section-title">
            Selected context preview
          </p>
          <Badge variant={snapshot.status === "approved" ? "info" : "neutral"}>
            {snapshot.status === "approved" ? "Context approved" : "Prompt only"}
          </Badge>
        </div>
        <p className="agent-chat-proposal-text">{snapshot.summary}</p>
        {snapshot.items.length > 0 ? (
          <div className="agent-chat-context-preview-groups">
            {snapshot.items.map((item) => (
              <div
                className="agent-chat-context-preview-group"
                key={item.sourceId}
              >
                <p className="agent-chat-context-preview-title">
                  {item.title}
                </p>
                <ul className="agent-chat-list">
                  {item.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
