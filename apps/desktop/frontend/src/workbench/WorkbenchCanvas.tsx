import { Badge } from "../design-system/Badge";
import { StatusDot } from "../design-system/StatusDot";
import { WidgetHost } from "./WidgetHost";
import type { WorkbenchPreset } from "./types";

type WorkbenchCanvasProps = {
  preset: WorkbenchPreset;
};

export function WorkbenchCanvas({ preset }: WorkbenchCanvasProps) {
  const visibleWidgets = preset.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);

  return (
    <section className="canvas-shell" aria-label={`${preset.title} canvas`}>
      <div className="canvas-summary">
        <div className="summary-copy">
          <span className="summary-eyebrow">Active Workbench</span>
          <div className="summary-row">
            <h1 className="summary-title">{preset.title}</h1>
            <Badge variant="neutral">Local mock</Badge>
          </div>
          <p className="summary-text">
            {preset.description} Static preview, rendered from preset data.
          </p>
        </div>
        <div className="canvas-status">
          <Badge variant="info">
            <StatusDot variant="info" />
            Preset-driven
          </Badge>
          <Badge variant="neutral">{visibleWidgets.length} mock widgets</Badge>
        </div>
      </div>

      <div className="widget-grid">
        {visibleWidgets.map((widget) => (
          <WidgetHost instance={widget} key={widget.id} />
        ))}
      </div>
    </section>
  );
}
