import { Button } from "../design-system/Button";
import { WidgetHost } from "./WidgetHost";
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
        <div className="empty-workbench" aria-label="Empty workbench">
          <div className="empty-workbench-content">
            <h1 className="empty-workbench-title">Your workbench is empty</h1>
            <p className="empty-workbench-text">
              Add widgets to compose your AI workspace.
            </p>
            <Button disabled variant="primary">
              + Add Widget
            </Button>
          </div>
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
