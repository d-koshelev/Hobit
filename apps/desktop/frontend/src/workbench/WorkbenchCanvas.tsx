import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "../design-system/Button";
import { Panel } from "../design-system/Panel";
import { WorkbenchActivity } from "./WorkbenchActivity";
import { WidgetHost } from "./WidgetHost";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type {
  WidgetInstance,
  WidgetInstanceId,
  WorkbenchViewState,
} from "./types";

type WorkbenchCanvasProps = {
  onOpenWidgetCatalog: () => void;
  viewState: WorkbenchViewState;
  widgetActions: WorkbenchWidgetInstanceActions;
};

export function WorkbenchCanvas({
  onOpenWidgetCatalog,
  viewState,
  widgetActions,
}: WorkbenchCanvasProps) {
  const [poppedOutWidgetIds, setPoppedOutWidgetIds] = useState<
    WidgetInstanceId[]
  >([]);
  const visibleWidgets = viewState.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  const canvasLabel = `${viewState.workbench.preset.title} canvas`;

  useEffect(() => {
    const visibleWidgetIds = new Set(
      viewState.widgets
        .filter((widget) => widget.visible)
        .map((widget) => widget.id),
    );

    setPoppedOutWidgetIds((currentIds) =>
      currentIds.filter((widgetId) => visibleWidgetIds.has(widgetId)),
    );
  }, [viewState.widgets]);

  function popOutWidget(widgetInstanceId: WidgetInstanceId) {
    setPoppedOutWidgetIds((currentIds) =>
      currentIds.includes(widgetInstanceId)
        ? currentIds
        : [...currentIds, widgetInstanceId],
    );
  }

  function dockBackWidget(widgetInstanceId: WidgetInstanceId) {
    setPoppedOutWidgetIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== widgetInstanceId),
    );
  }

  if (visibleWidgets.length === 0) {
    return (
      <section className="canvas-shell" aria-label={canvasLabel}>
        <div className="canvas-stack">
          <WorkbenchActivity events={viewState.recentEvents} />
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
        </div>
      </section>
    );
  }

  return (
    <section className="canvas-shell" aria-label={canvasLabel}>
      <div className="canvas-stack">
        <WorkbenchActivity events={viewState.recentEvents} />
        <div className="widget-grid">
          {visibleWidgets.map((widget) => {
            const isPoppedOut = poppedOutWidgetIds.includes(widget.id);

            return (
              <div className="widget-grid-slot" key={widget.id}>
                <div
                  aria-label={
                    isPoppedOut ? `${widget.title} popped out` : undefined
                  }
                  className={
                    isPoppedOut ? "widget-popout-layer" : "widget-grid-surface"
                  }
                  role={isPoppedOut ? "dialog" : undefined}
                >
                  <WidgetHost
                    instance={widget}
                    onDockBack={dockBackWidget}
                    onPopOut={popOutWidget}
                    presentationMode={isPoppedOut ? "popped-out" : "docked"}
                    widgetActions={widgetActions}
                  />
                </div>
                {isPoppedOut ? (
                  <WidgetGhostPlaceholder
                    instance={widget}
                    onDockBack={dockBackWidget}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type WidgetGhostPlaceholderProps = {
  instance: WidgetInstance;
  onDockBack: (widgetInstanceId: WidgetInstanceId) => void;
};

function WidgetGhostPlaceholder({
  instance,
  onDockBack,
}: WidgetGhostPlaceholderProps) {
  return (
    <Panel
      aria-label={`${instance.title} popped out placeholder`}
      className="widget-ghost"
      style={widgetGhostStyle(instance)}
    >
      <div className="widget-ghost-copy">
        <h2 className="widget-ghost-title">{instance.title}</h2>
        <p className="widget-ghost-status">Popped out</p>
      </div>
      <Button onClick={() => onDockBack(instance.id)} variant="secondary">
        Dock back
      </Button>
    </Panel>
  );
}

function widgetGhostStyle(instance: WidgetInstance): CSSProperties | undefined {
  if (instance.layout.mode !== "docked") {
    return undefined;
  }

  return {
    height: `${instance.layout.height}px`,
    minHeight: `${instance.layout.height}px`,
    width: `min(100%, ${instance.layout.width}px)`,
  };
}
