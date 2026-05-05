import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { EmptyState } from "../../design-system/EmptyState";
import { StatusDot } from "../../design-system/StatusDot";
import { WidgetFrame } from "../../design-system/WidgetFrame";
import type { WidgetRenderProps } from "../../workbench/types";

const lines = [
  { kind: "prompt", text: "$ hobit session status" },
  { kind: "output", text: "Preset: Minimal Workbench" },
  { kind: "output", text: "Widgets: Terminal, Agent CLI" },
  { kind: "prompt", text: "$ ls current-workspace" },
  { kind: "muted", text: "mock output only - no command was executed" },
];

export function TerminalWidget({ title }: WidgetRenderProps) {
  return (
    <WidgetFrame
      actions={
        <>
          <Button disabled variant="ghost">
            Clear
          </Button>
          <Button disabled variant="ghost">
            Copy
          </Button>
        </>
      }
      status={<Badge variant="warning">Preview</Badge>}
      subtitle="Mock terminal surface"
      title={title}
    >
      <div className="terminal-screen" aria-label="Mock terminal output">
        <pre className="terminal-lines">
          {lines.map((line) => (
            <span className={`terminal-${line.kind}`} key={line.text}>
              {line.text}
              {"\n"}
            </span>
          ))}
        </pre>
      </div>
      <EmptyState
        text="Commands are static in this milestone. No shell or production system is connected."
        title="Preview terminal"
      />
      <p className="mock-note">
        <StatusDot variant="warning" /> Terminal execution is intentionally not
        implemented.
      </p>
    </WidgetFrame>
  );
}
