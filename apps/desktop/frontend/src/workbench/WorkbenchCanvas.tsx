import { WidgetHost } from "./WidgetHost";
import { Button } from "../design-system/Button";
import type { WorkbenchPreset } from "./types";

type WorkbenchCanvasProps = {
  preset: WorkbenchPreset;
};

export function WorkbenchCanvas({ preset }: WorkbenchCanvasProps) {
  const visibleWidgets = preset.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);

  if (visibleWidgets.length === 0) {
    return (
      <section className="canvas-shell" aria-label={`${preset.title} canvas`}>
        <div className="workbench-empty-state">
          <h1 className="workbench-empty-title">Your workbench is empty</h1>
          <p className="workbench-empty-subtitle">
            Add widgets to compose your AI workspace
          </p>
          <Button disabled variant="secondary">
            + Add Widget
          </Button>
        </div>
      </section>
    );
  }

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
