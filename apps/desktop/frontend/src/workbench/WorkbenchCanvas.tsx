import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "../design-system/Button";
import { Panel } from "../design-system/Panel";
import { WorkbenchActivity } from "./WorkbenchActivity";
import { WidgetHost } from "./WidgetHost";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type {
  WidgetInstance,
  WidgetInstanceId,
  WorkbenchLayoutMode,
  WorkbenchViewState,
} from "./types";

type WorkbenchCanvasProps = {
  layoutMode: WorkbenchLayoutMode;
  onOpenWidgetCatalog: () => void;
  viewState: WorkbenchViewState;
  widgetActions: WorkbenchWidgetInstanceActions;
};

type PopoutPosition = {
  x: number;
  y: number;
};

type ActivePopoutDrag = {
  offsetX: number;
  offsetY: number;
  widgetInstanceId: WidgetInstanceId;
};

const DEFAULT_POPOUT_TOP = 96;
const DEFAULT_NARROW_POPOUT_TOP = 80;
const POPOUT_DESKTOP_MARGIN = 48;
const POPOUT_NARROW_MARGIN = 32;
const POPOUT_EDGE_MARGIN = 16;
const POPOUT_MAX_WIDTH = 760;
const POPOUT_MIN_VISIBLE_WIDTH = 180;
const POPOUT_MIN_VISIBLE_HEIGHT = 96;

export function WorkbenchCanvas({
  layoutMode,
  onOpenWidgetCatalog,
  viewState,
  widgetActions,
}: WorkbenchCanvasProps) {
  const [poppedOutWidgetIds, setPoppedOutWidgetIds] = useState<
    WidgetInstanceId[]
  >([]);
  const [popoutPositions, setPopoutPositions] = useState<
    Partial<Record<WidgetInstanceId, PopoutPosition>>
  >({});
  const [activePopoutDrag, setActivePopoutDrag] =
    useState<ActivePopoutDrag | null>(null);
  const visibleWidgets = viewState.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  const canvasLabel = `${viewState.workbench.preset.title} canvas`;
  const isLayoutEditing = layoutMode === "editing";
  const canvasShellClass = isLayoutEditing
    ? "canvas-shell canvas-shell-layout-editing"
    : "canvas-shell";

  useEffect(() => {
    const visibleWidgetIds = new Set(
      viewState.widgets
        .filter((widget) => widget.visible)
        .map((widget) => widget.id),
    );

    setPoppedOutWidgetIds((currentIds) =>
      currentIds.filter((widgetId) => visibleWidgetIds.has(widgetId)),
    );
    setPopoutPositions((currentPositions) =>
      Object.fromEntries(
        Object.entries(currentPositions).filter(([widgetId]) =>
          visibleWidgetIds.has(widgetId),
        ),
      ),
    );
  }, [viewState.widgets]);

  useEffect(() => {
    if (!activePopoutDrag) {
      return;
    }

    const drag = activePopoutDrag;

    document.body.classList.add("widget-popout-dragging");

    function movePopout(event: PointerEvent) {
      setPopoutPositions((currentPositions) => ({
        ...currentPositions,
        [drag.widgetInstanceId]: clampPopoutPosition({
          x: event.clientX - drag.offsetX,
          y: event.clientY - drag.offsetY,
        }),
      }));
    }

    function finishDrag() {
      setActivePopoutDrag(null);
    }

    window.addEventListener("pointermove", movePopout);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      document.body.classList.remove("widget-popout-dragging");
      window.removeEventListener("pointermove", movePopout);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [activePopoutDrag]);

  useEffect(() => {
    function clampPositionsToViewport() {
      setPopoutPositions((currentPositions) => {
        const nextPositions = { ...currentPositions };

        for (const widgetId of Object.keys(nextPositions)) {
          const position = nextPositions[widgetId];

          if (position) {
            nextPositions[widgetId] = clampPopoutPosition(position);
          }
        }

        return nextPositions;
      });
    }

    window.addEventListener("resize", clampPositionsToViewport);

    return () => {
      window.removeEventListener("resize", clampPositionsToViewport);
    };
  }, []);

  function popOutWidget(widgetInstanceId: WidgetInstanceId) {
    setPoppedOutWidgetIds((currentIds) =>
      currentIds.includes(widgetInstanceId)
        ? currentIds
        : [...currentIds, widgetInstanceId],
    );
    setPopoutPositions((currentPositions) => ({
      ...currentPositions,
      [widgetInstanceId]:
        currentPositions[widgetInstanceId] ?? defaultPopoutPosition(),
    }));
  }

  function dockBackWidget(widgetInstanceId: WidgetInstanceId) {
    setPoppedOutWidgetIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== widgetInstanceId),
    );
    setPopoutPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };

      delete nextPositions[widgetInstanceId];

      return nextPositions;
    });
    setActivePopoutDrag((currentDrag) =>
      currentDrag?.widgetInstanceId === widgetInstanceId ? null : currentDrag,
    );
  }

  function startPopoutDrag(
    widgetInstanceId: WidgetInstanceId,
    pointerX: number,
    pointerY: number,
  ) {
    const currentPosition =
      popoutPositions[widgetInstanceId] ?? defaultPopoutPosition();

    setPopoutPositions((currentPositions) => ({
      ...currentPositions,
      [widgetInstanceId]: currentPosition,
    }));
    setActivePopoutDrag({
      offsetX: pointerX - currentPosition.x,
      offsetY: pointerY - currentPosition.y,
      widgetInstanceId,
    });
  }

  if (visibleWidgets.length === 0) {
    return (
      <section className={canvasShellClass} aria-label={canvasLabel}>
        <div className="canvas-stack">
          <WorkbenchActivity events={viewState.recentEvents} />
          {isLayoutEditing ? <LayoutEditingStatus /> : null}
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
    <section className={canvasShellClass} aria-label={canvasLabel}>
      <div className="canvas-stack">
        <WorkbenchActivity events={viewState.recentEvents} />
        {isLayoutEditing ? <LayoutEditingStatus /> : null}
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
                  style={
                    isPoppedOut
                      ? widgetPopoutLayerStyle(popoutPositions[widget.id])
                      : undefined
                  }
                >
                  <WidgetHost
                    instance={widget}
                    onDockBack={dockBackWidget}
                    onPopOut={popOutWidget}
                    onStartPopoutDrag={startPopoutDrag}
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

function LayoutEditingStatus() {
  return (
    <div className="layout-editing-status" role="status">
      Layout editing enabled
    </div>
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

function widgetPopoutLayerStyle(
  position: PopoutPosition | undefined,
): CSSProperties | undefined {
  if (!position) {
    return undefined;
  }

  return {
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: "none",
  };
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

function defaultPopoutPosition(): PopoutPosition {
  if (typeof window === "undefined") {
    return {
      x: POPOUT_EDGE_MARGIN,
      y: DEFAULT_POPOUT_TOP,
    };
  }

  const width = Math.min(
    POPOUT_MAX_WIDTH,
    Math.max(0, window.innerWidth - popoutViewportMargin()),
  );

  return clampPopoutPosition({
    x: (window.innerWidth - width) / 2,
    y:
      window.innerWidth <= 720
        ? DEFAULT_NARROW_POPOUT_TOP
        : DEFAULT_POPOUT_TOP,
  });
}

function clampPopoutPosition(position: PopoutPosition): PopoutPosition {
  if (typeof window === "undefined") {
    return position;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const minX = Math.min(POPOUT_EDGE_MARGIN, viewportWidth);
  const maxX = Math.max(minX, viewportWidth - POPOUT_MIN_VISIBLE_WIDTH);
  const minY = Math.min(POPOUT_EDGE_MARGIN, viewportHeight);
  const maxY = Math.max(minY, viewportHeight - POPOUT_MIN_VISIBLE_HEIGHT);

  return {
    x: clamp(position.x, minX, maxX),
    y: clamp(position.y, minY, maxY),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function popoutViewportMargin() {
  return window.innerWidth <= 720
    ? POPOUT_NARROW_MARGIN
    : POPOUT_DESKTOP_MARGIN;
}
