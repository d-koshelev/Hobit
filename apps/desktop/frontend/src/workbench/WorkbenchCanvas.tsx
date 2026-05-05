import { WidgetHost } from "./WidgetHost";
import type { WorkbenchPreset } from "./types";

type WorkbenchCanvasProps = {
  preset: WorkbenchPreset;
};

export function WorkbenchCanvas({ preset }: WorkbenchCanvasProps) {
  const visibleWidgets = preset.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  const widgetSummary = visibleWidgets
    .map((widget) => widget.title.replace(" Widget", ""))
    .join(" + ");

  return (
    <section className="canvas-shell" aria-label={`${preset.title} canvas`}>
      <div className="canvas-summary">
        <div className="summary-copy">
          <h1 className="summary-title">{preset.title}</h1>
          <p className="summary-text">{widgetSummary}</p>
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
