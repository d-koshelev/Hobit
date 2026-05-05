import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { Input } from "../../design-system/Input";
import { StatusDot } from "../../design-system/StatusDot";
import { WidgetFrame } from "../../design-system/WidgetFrame";
import type { WidgetRenderProps } from "../../workbench/types";

const prompts = [
  "Summarize workspace",
  "Plan next step",
  "Explain current setup",
];

export function AgentCliWidget({ title }: WidgetRenderProps) {
  return (
    <WidgetFrame
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
          <p className="surface-row-title">Agent ready.</p>
          <p className="surface-row-text">Ask the agent to help with this workspace.</p>
        </div>
      </div>

      <div className="suggestions" aria-label="Mock suggested prompts">
        <span className="section-label">Examples</span>
        <div className="suggestion-grid">
          {prompts.map((prompt) => (
            <span className="suggestion-chip" key={prompt}>
              {prompt}
            </span>
          ))}
        </div>
      </div>

      <div className="prompt-row">
        <Input
          aria-label="Agent prompt"
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
