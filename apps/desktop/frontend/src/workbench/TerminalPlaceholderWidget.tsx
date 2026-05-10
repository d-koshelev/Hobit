import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

export function TerminalPlaceholderWidget({
  frameActions,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  title,
}: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      style={frameStyle}
      status={<Badge variant="neutral">Placeholder</Badge>}
      subtitle="Terminal runtime placeholder"
      title={title}
    >
      <div className="empty-state">
        <p className="empty-state-title">Terminal runtime planned</p>
        <p className="empty-state-text">
          Terminal runtime is planned. Command execution is not available yet.
        </p>
      </div>
      <pre
        aria-label="Static terminal preview"
        className="terminal-placeholder-output"
      >
        <code>$ command execution planned</code>
      </pre>
    </WidgetFrame>
  );
}
