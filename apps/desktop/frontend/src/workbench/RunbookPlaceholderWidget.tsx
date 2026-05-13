import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

const STEP_STATES = [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
  "blocked",
];

export function RunbookPlaceholderWidget({
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
              <p className="agent-surface-title">Runbook</p>
              <p className="agent-surface-text">
                Step-based procedural work surface for following and managing
                operator-visible steps.
              </p>
            </div>
            <Badge variant="neutral">Procedure</Badge>
          </div>
          <div className="agent-surface-state-row">
            {STEP_STATES.map((state) => (
              <Badge key={state} variant="neutral">
                {state}
              </Badge>
            ))}
          </div>
          <p className="agent-surface-text">
            Runbook editing, builders, and agent-assisted step execution are
            future work.
          </p>
        </section>
      </div>
    </WidgetFrame>
  );
}
