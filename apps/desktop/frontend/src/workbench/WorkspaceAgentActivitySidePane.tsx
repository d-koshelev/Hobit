import type { AgentActivityEvent } from "./agentActivityModel";
import { AgentActivityPanel } from "./AgentActivityPanel";

export function WorkspaceAgentActivitySidePane({
  events,
  onRequestCollapse,
}: {
  events: AgentActivityEvent[];
  onRequestCollapse?: () => void;
}) {
  return (
    <aside
      aria-label="Workspace Agent Activity"
      className="interactive-agent-activity-side-pane"
    >
      <div className="interactive-agent-activity-side-header">
        <div className="interactive-agent-activity-side-title-copy">
          <p className="interactive-agent-activity-side-title">
            Agent Activity
          </p>
          <p className="interactive-agent-activity-side-subtitle">
            Read-only run lifecycle
          </p>
        </div>
        {onRequestCollapse ? (
          <button
            aria-label="Hide Workspace Agent Activity"
            className="button button-ghost interactive-agent-activity-side-toggle"
            onClick={onRequestCollapse}
            title="Hide Workspace Agent Activity"
            type="button"
          >
            Hide
          </button>
        ) : null}
      </div>
      <AgentActivityPanel
        compact
        emptyText="Run Workspace Agent with Codex to see activity."
        events={events}
      />
    </aside>
  );
}
