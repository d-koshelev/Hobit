import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

export function InteractiveAgentPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Preview</Badge>}
      title={title}
    >
      <div className="agent-surface-placeholder">
        <section className="agent-surface-card">
          <div className="agent-surface-card-header">
            <div className="agent-surface-copy">
              <p className="agent-surface-title">Interactive Agent</p>
              <p className="agent-surface-text">
                Manual long-running agent chat/work for exploratory problems.
                It is separate from Agent Queue and Agent Executor in v1.
              </p>
            </div>
            <Badge variant="neutral">Manual</Badge>
          </div>
          <ul className="agent-surface-list">
            <li>No Queue integration.</li>
            <li>No monitoring integration.</li>
            <li>No tool execution yet.</li>
          </ul>
        </section>
      </div>
    </WidgetFrame>
  );
}
