export function WorkspaceAgentV2TopBar({
  isActivityVisible,
  onActivityToggle,
}: {
  readonly isActivityVisible?: boolean;
  readonly onActivityToggle?: () => void;
}) {
  return (
    <div
      aria-label="Workspace Agent v2 provider and mode placeholders"
      className="workspace-agent-v2-topbar"
    >
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>Codex</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>Codex Direct Run only</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Experimental</dd>
        </div>
        <div>
          <dt>Tools</dt>
          <dd>Disabled</dd>
        </div>
      </dl>
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
    </div>
  );
}
