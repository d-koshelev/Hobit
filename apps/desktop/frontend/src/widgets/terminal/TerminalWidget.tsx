import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
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
      status={
        <Badge variant="warning">
          Preview
        </Badge>
      }
      subtitle="Command and output surface"
      title={title}
    >
      <div className="terminal-meta">
        <div className="surface-row-copy">
          <p className="surface-row-title">Preview output only</p>
          <p className="surface-row-text">
            Commands are not executed.
          </p>
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
