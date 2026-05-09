import { Button } from "../design-system/Button";
import { WidgetHost } from "./WidgetHost";
import type { WidgetInstanceId, WidgetLayout, WidgetState } from "./types";
import type { WorkbenchViewState } from "./viewState";

type WorkbenchCanvasProps = {
  onOpenWidgetCatalog: () => void;
  onUpdateWidgetLayout: (
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) => Promise<void>;
  onUpdateWidgetState: (
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) => Promise<void>;
  viewState: WorkbenchViewState;
};

export function WorkbenchCanvas({
  onOpenWidgetCatalog,
  onUpdateWidgetLayout,
  onUpdateWidgetState,
  viewState,
}: WorkbenchCanvasProps) {
  const visibleWidgets = viewState.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  const canvasLabel = `${viewState.workbench.preset.title} canvas`;

  if (visibleWidgets.length === 0) {
    return (
      <section className="canvas-shell" aria-label={canvasLabel}>
        <div className="empty-workbench" aria-label="Empty workbench">
          <div className="empty-workbench-content">
            <h1 className="empty-workbench-title">Your workbench is empty</h1>
            <p className="empty-workbench-text">
              Add widgets to compose your AI workspace.
            </p>
            <Button onClick={onOpenWidgetCatalog} variant="primary">
              + Add Widget
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas-shell" aria-label={canvasLabel}>
      <div className="widget-grid">
        {visibleWidgets.map((widget) => (
          <WidgetHost
            instance={widget}
            key={widget.id}
            onUpdateLayout={onUpdateWidgetLayout}
            onUpdateState={onUpdateWidgetState}
          />
        ))}
      </div>
    </section>
  );
}
