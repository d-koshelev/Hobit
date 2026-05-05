import { Badge } from "../design-system/Badge";
import { StatusDot } from "../design-system/StatusDot";
import { AgentCliWidget } from "../widgets/agent-cli/AgentCliWidget";
import { TerminalWidget } from "../widgets/terminal/TerminalWidget";

export function WorkbenchCanvas() {
  return (
    <section className="canvas-shell" aria-label="Minimal Workbench canvas">
      <div className="canvas-summary">
        <div className="summary-copy">
          <h1 className="summary-title">Minimal Workbench</h1>
          <p className="summary-text">
            Static preview with Terminal and Agent CLI widget blocks.
          </p>
        </div>
        <Badge variant="success">
          <StatusDot variant="success" />
          2 mock widgets
        </Badge>
      </div>

      <div className="widget-grid">
        <TerminalWidget />
        <AgentCliWidget />
      </div>
    </section>
  );
}
