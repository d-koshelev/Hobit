import type { AgentActivityEvent } from "./agentActivityModel";
import { AgentActivityPanel } from "./AgentActivityPanel";

export function WorkspaceAgentActivitySidePane({
  collapsed,
  events,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  events: AgentActivityEvent[];
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      aria-label="Workspace Agent Activity"
      className={
        collapsed
          ? "interactive-agent-activity-side-pane interactive-agent-activity-side-pane-collapsed"
          : "interactive-agent-activity-side-pane"
      }
    >
      <div className="interactive-agent-activity-side-header">
        {collapsed ? null : (
          <div className="interactive-agent-activity-side-title-copy">
            <p className="interactive-agent-activity-side-title">
              Agent Activity
            </p>
            <p className="interactive-agent-activity-side-subtitle">
              Read-only run lifecycle
            </p>
          </div>
        )}
        <button
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Expand Agent Activity" : "Collapse Agent Activity"
          }
          className="button button-ghost interactive-agent-activity-side-toggle"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand Agent Activity" : "Collapse Agent Activity"}
          type="button"
        >
          {collapsed ? "Activity" : "Collapse"}
        </button>
      </div>
      {collapsed ? null : (
        <AgentActivityPanel
          compact
          emptyText="Run Workspace Agent with Codex to see activity."
          events={events}
        />
      )}
    </aside>
  );
}
