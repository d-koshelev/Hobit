import { WidgetFrame } from "../design-system/WidgetFrame";
import { Badge } from "../design-system/Badge";
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
      info="Current-session activity from Workspace Agent and Agent Executor runs while Hobit is open."
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      title={title}
    >
      <section aria-label="Agent Activity" className="agent-activity-widget">
        <div className="agent-activity-widget-header">
          <div className="agent-activity-widget-copy">
            <h3 className="agent-activity-widget-title">
              Current-session timeline
            </h3>
          </div>
          <Badge variant="neutral">{scopedEvents.length} events</Badge>
        </div>
        <AgentActivityPanel
          compact
          emptyText="Run a Workspace Agent task to see activity."
          events={scopedEvents}
        />
      </section>
    </WidgetFrame>
  );
}
