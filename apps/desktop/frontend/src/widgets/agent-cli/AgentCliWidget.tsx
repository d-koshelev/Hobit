import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { Input } from "../../design-system/Input";
import { StatusDot } from "../../design-system/StatusDot";
import { WidgetFrame } from "../../design-system/WidgetFrame";
import type { WidgetRenderProps } from "../../workbench/types";

const prompts = [
  "Summarize this workspace",
  "Plan the next change",
  "Explain pending approvals",
];

const statusItems = [
  "No runtime connected",
  "Uses workbench context",
  "Waiting for operator input",
];

export function AgentCliWidget({ title }: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={<Badge variant="neutral">Mock agent</Badge>}
      footer={
        <p className="mock-note">
          <StatusDot variant="neutral" /> Agent calls are intentionally not
          implemented.
        </p>
      }
      status={
        <Badge variant="success">
          <StatusDot variant="success" />
          Idle
        </Badge>
      }
      subtitle="Direct operator surface for agent interaction"
      title={title}
    >
      <div className="agent-hero">
        <div className="surface-row-copy">
          <p className="surface-row-title">Operator prompt surface</p>
          <p className="surface-row-text">
            Ask, review proposals, and approve actions here once the runtime is
            connected.
          </p>
        </div>
        <Badge variant="info">Local mock</Badge>
      </div>

      <div className="agent-thread">
        <div className="agent-message agent-message-compact">
          <p>Mock agent ready.</p>
          <div className="activity-row">
            <StatusDot variant="success" />
            Idle, waiting for operator input
          </div>
        </div>
      </div>

      <div className="agent-status-grid">
        {statusItems.map((item) => (
          <div className="agent-status-item" key={item}>
            <StatusDot variant="neutral" />
            {item}
          </div>
        ))}
      </div>

      <div className="suggestions" aria-label="Mock suggested prompts">
        <span className="section-label">Suggestions</span>
        <div className="suggestion-grid">
          {prompts.map((prompt) => (
            <Button
              className="suggestion"
              disabled
              key={prompt}
              variant="secondary"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      <div className="prompt-row">
        <Input
          aria-label="Mock agent prompt"
          disabled
          placeholder="Ask the agent..."
          type="text"
        />
        <Button disabled variant="primary">
          Send
        </Button>
      </div>
    </WidgetFrame>
  );
}
