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
      subtitle="Operator prompt surface"
      title={title}
    >
      <div className="agent-intro">
        <p className="agent-title">Agent ready.</p>
        <p className="agent-text">Ask the agent to help with this workspace.</p>
      </div>

      <div className="suggestion-grid" aria-label="Mock suggested prompts">
        {prompts.map((prompt) => (
          <span className="suggestion-chip" key={prompt}>
            {prompt}
          </span>
        ))}
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
