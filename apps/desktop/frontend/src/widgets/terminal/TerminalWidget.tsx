import { Badge } from "../../design-system/Badge";
import { WidgetFrame } from "../../design-system/WidgetFrame";
import type { WidgetRenderProps } from "../../workbench/types";

const lines = [
  { kind: "prompt", text: "$ hobit workbench status" },
  { kind: "output", text: "preset        Minimal Workbench" },
  { kind: "output", text: "widgets       Terminal, Agent CLI" },
  { kind: "prompt", text: "$ ls workspace" },
  { kind: "output", text: "README.md   docs/   apps/   crates/" },
  { kind: "muted", text: "# sample output" },
];

export function TerminalWidget({ title }: WidgetRenderProps) {
  return (
    <WidgetFrame
      status={
        <Badge variant="warning">
          Preview
        </Badge>
      }
      subtitle="Commands are not executed"
      title={title}
    >
      <div className="terminal-screen" aria-label="Mock terminal output">
        <div className="terminal-chrome">
          <div className="terminal-window-controls" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="terminal-path">hobit://minimal/terminal</span>
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
