import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { AgentActivityPanel } from "./AgentActivityPanel";
import type { WidgetRenderProps } from "./types";

export function AgentActivityWidget({
  agentActivityEvents = [],
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
  workspaceId,
}: WidgetRenderProps) {
  const scopedEvents = agentActivityEvents.filter(
    (event) => !workspaceId || event.workspaceId === workspaceId,
  );

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="success">MVP</Badge>}
      title={title}
    >
      <section aria-label="Agent Activity" className="agent-activity-widget">
        <div className="agent-activity-widget-header">
          <div className="agent-activity-widget-copy">
            <h3 className="agent-activity-widget-title">
              Current-session timeline
            </h3>
            <p className="agent-activity-widget-text">
              Workspace Agent and Agent Executor activity appears here while
              Hobit is open.
            </p>
          </div>
          <Badge variant="neutral">{scopedEvents.length} events</Badge>
        </div>
        <AgentActivityPanel
          emptyText="Run a Workspace Agent task to see activity."
          events={scopedEvents}
        />
      </section>
    </WidgetFrame>
  );
}
