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
      <div className="widget-grid">
        {visibleWidgets.map((widget) => (
          <WidgetHost instance={widget} key={widget.id} />
        ))}
      </div>
    </section>
  );
}
