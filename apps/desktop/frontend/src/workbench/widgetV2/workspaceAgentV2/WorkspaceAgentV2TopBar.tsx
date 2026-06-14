import { TopbarGroup } from "../../../design-system/ActionPrimitives";

export function WorkspaceAgentV2TopBar({
  isActivityVisible,
  onActivityToggle,
  onDebugOpen,
}: {
  readonly isActivityVisible?: boolean;
  readonly onActivityToggle?: () => void;
  readonly onDebugOpen?: () => void;
}) {
  return (
    <div
      aria-label="Workspace Agent v2 controls"
      className="workspace-agent-v2-topbar"
    >
      {onActivityToggle || onDebugOpen ? (
        <TopbarGroup
          className="workspace-agent-v2-topbar-controls"
          data-group="secondary"
          label="Workspace Agent v2 secondary controls"
        >
          {onActivityToggle ? (
            <button
              aria-expanded={Boolean(isActivityVisible)}
              aria-label={
                isActivityVisible
                  ? "Hide Workspace Agent v2 activity"
                  : "Show Workspace Agent v2 activity"
              }
              className="button button-secondary button-sm workspace-agent-v2-activity-toggle"
              onClick={onActivityToggle}
              type="button"
            >
              {isActivityVisible ? "Hide activity" : "Show activity"}
            </button>
          ) : null}
          {onDebugOpen ? (
            <button
              aria-label="Open Workspace Agent v2 debug details"
              className="button button-ghost button-sm workspace-agent-v2-debug-toggle"
              onClick={onDebugOpen}
              type="button"
            >
              Debug
            </button>
          ) : null}
        </TopbarGroup>
      ) : null}
    </div>
  );
}
