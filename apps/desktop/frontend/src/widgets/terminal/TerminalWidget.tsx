import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { StatusDot } from "../../design-system/StatusDot";
import { WidgetFrame } from "../../design-system/WidgetFrame";
import type { WidgetRenderProps } from "../../workbench/types";

const lines = [
  { kind: "prompt", text: "$ hobit workbench status" },
  { kind: "output", text: "preset        Minimal Workbench" },
  { kind: "output", text: "widgets       Terminal, Agent CLI" },
  { kind: "output", text: "connection    mock / read-only preview" },
  { kind: "prompt", text: "$ hobit tools list" },
  { kind: "muted", text: "terminal execution is not connected in this milestone" },
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
      footer={
        <p className="mock-note">
          <StatusDot variant="warning" /> No shell or production system is
          connected.
        </p>
      }
      status={
        <Badge variant="warning">
          <StatusDot variant="warning" />
          Preview
        </Badge>
      }
      subtitle="Mock command and output surface"
      title={title}
    >
      <div className="terminal-meta">
        <div className="surface-row-copy">
          <p className="surface-row-title">Local preview terminal</p>
          <p className="surface-row-text">
            Static output only. Commands are not executed.
          </p>
        </div>
        <div className="terminal-meta-badges">
          <Badge variant="neutral">Mock</Badge>
          <Badge variant="warning">No runtime</Badge>
        </div>
      </div>

      <div className="terminal-screen" aria-label="Mock terminal output">
        <div className="terminal-chrome">
          <div className="terminal-window-controls" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="terminal-path">hobit://minimal/terminal</span>
          <Badge variant="neutral">Read-only</Badge>
        </div>
        <pre className="terminal-lines">
          {lines.map((line) => (
            <span className={`terminal-${line.kind}`} key={line.text}>
              {line.text}
              {"\n"}
            </span>
          ))}
        </pre>
      </div>
    </WidgetFrame>
  );
}
