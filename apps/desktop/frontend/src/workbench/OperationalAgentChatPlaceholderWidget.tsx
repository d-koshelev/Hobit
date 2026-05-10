import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

export function OperationalAgentChatPlaceholderWidget({
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
      status={<Badge variant="neutral">Placeholder</Badge>}
      subtitle="Operational agent chat placeholder"
      title={title}
    >
      <div aria-label="Static agent chat preview" className="agent-chat-preview">
        <div className="agent-chat-message agent-chat-message-operator">
          <p className="agent-chat-message-label">Operator</p>
          <p className="agent-chat-message-text">Ask the operational agent...</p>
        </div>
        <div className="agent-chat-message">
          <p className="agent-chat-message-label">Agent</p>
          <p className="agent-chat-message-text">
            Operational agent chat is planned. Agent execution and
            workspace-context access are not available yet.
          </p>
        </div>
      </div>

      <ul className="agent-chat-future-list">
        <li>Future: use approved Workspace context</li>
        <li>Future: propose actions for operator review</li>
        <li>Future: no hidden execution</li>
      </ul>

      <div
        aria-label="Disabled operational agent prompt"
        className="agent-chat-prompt-row"
      >
        <input
          className="input"
          disabled
          placeholder="Ask the operational agent..."
          readOnly
          type="text"
        />
        <Button disabled variant="secondary">
          Send
        </Button>
      </div>
    </WidgetFrame>
  );
}
