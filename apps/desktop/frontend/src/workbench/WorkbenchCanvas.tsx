import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "../design-system/Button";
import { Panel } from "../design-system/Panel";
import { WorkbenchActivity } from "./WorkbenchActivity";
import { WidgetHost } from "./WidgetHost";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type {
  WidgetInstance,
  WidgetInstanceId,
  WidgetLayout,
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

type DockedPosition = {
  x: number;
  y: number;
};

type ActivePopoutDrag = {
  offsetX: number;
  offsetY: number;
  widgetInstanceId: WidgetInstanceId;
};

type ActiveDockedDrag = {
  height: number;
  layout: WidgetLayout;
  offsetX: number;
  offsetY: number;
  originalPosition: DockedPosition;
  widgetInstanceId: WidgetInstanceId;
  width: number;
};

const DEFAULT_POPOUT_TOP = 96;
const DEFAULT_NARROW_POPOUT_TOP = 80;
const DOCKED_LAYOUT_MIN_HEIGHT = 520;
const DOCKED_LAYOUT_BOTTOM_PADDING = 240;
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
  const [dockedDragPositions, setDockedDragPositions] = useState<
    Partial<Record<WidgetInstanceId, DockedPosition>>
  >({});
  const [popoutPositions, setPopoutPositions] = useState<
    Partial<Record<WidgetInstanceId, PopoutPosition>>
  >({});
  const [activeDockedDrag, setActiveDockedDrag] =
    useState<ActiveDockedDrag | null>(null);
  const [activePopoutDrag, setActivePopoutDrag] =
    useState<ActivePopoutDrag | null>(null);
  const dockedDragPositionsRef = useRef(dockedDragPositions);
  const layoutSurfaceRef = useRef<HTMLDivElement | null>(null);
  const widgetActionsRef = useRef(widgetActions);
  const visibleWidgets = viewState.widgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  const canvasLabel = `${viewState.workbench.preset.title} canvas`;
  const isLayoutEditing = layoutMode === "editing";
  const canvasShellClass = isLayoutEditing
    ? "canvas-shell canvas-shell-layout-editing"
    : "canvas-shell";
  const layoutSurfaceStyle = widgetLayoutSurfaceStyle(
    visibleWidgets,
    dockedDragPositions,
  );

  useEffect(() => {
    dockedDragPositionsRef.current = dockedDragPositions;
  }, [dockedDragPositions]);

  useEffect(() => {
    widgetActionsRef.current = widgetActions;
  }, [widgetActions]);

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
    setDockedDragPositions((currentPositions) => {
      const visibleWidgetById = new Map(
        viewState.widgets
          .filter((widget) => widget.visible)
          .map((widget) => [widget.id, widget]),
      );

      return Object.fromEntries(
        Object.entries(currentPositions).filter(([widgetId, position]) => {
          const widget = visibleWidgetById.get(widgetId);

          if (!widget || !position) {
            return false;
          }

          return (
            widget.layout.x !== position.x || widget.layout.y !== position.y
          );
        }),
      );
    });
  }, [viewState.widgets]);

  useEffect(() => {
    if (isLayoutEditing) {
      return;
    }

    setActiveDockedDrag(null);
    setDockedDragPositions({});
  }, [isLayoutEditing]);

  useEffect(() => {
    if (!activeDockedDrag) {
      return;
    }

    const drag = activeDockedDrag;

    document.body.classList.add("widget-docked-dragging");

    function moveDockedWidget(event: PointerEvent) {
      const nextPosition = nextDockedDragPosition(event, drag);

      setDockedDragPositions((currentPositions) => ({
        ...currentPositions,
        [drag.widgetInstanceId]: nextPosition,
      }));
    }

    function finishDockedWidgetDrag(event: PointerEvent) {
      const nextPosition = nextDockedDragPosition(event, drag);

      setActiveDockedDrag(null);
      setDockedDragPositions((currentPositions) => ({
        ...currentPositions,
        [drag.widgetInstanceId]: nextPosition,
      }));
      void persistDockedWidgetPosition(drag, nextPosition);
    }

    function cancelDockedWidgetDrag() {
      setActiveDockedDrag(null);
      setDockedDragPositions((currentPositions) =>
        removeWidgetPosition(currentPositions, drag.widgetInstanceId),
      );
    }

    window.addEventListener("pointermove", moveDockedWidget);
    window.addEventListener("pointerup", finishDockedWidgetDrag);
    window.addEventListener("pointercancel", cancelDockedWidgetDrag);

    return () => {
      document.body.classList.remove("widget-docked-dragging");
      window.removeEventListener("pointermove", moveDockedWidget);
      window.removeEventListener("pointerup", finishDockedWidgetDrag);
      window.removeEventListener("pointercancel", cancelDockedWidgetDrag);
    };
  }, [activeDockedDrag]);

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

  function startDockedDrag(
    widgetInstanceId: WidgetInstanceId,
    pointerX: number,
    pointerY: number,
  ) {
    if (!isLayoutEditing) {
      return;
    }

    const surfaceRect = layoutSurfaceRef.current?.getBoundingClientRect();
    const widget = visibleWidgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!surfaceRect || !widget || widget.layout.mode !== "docked") {
      return;
    }

    const currentPosition =
      dockedDragPositionsRef.current[widgetInstanceId] ??
      widgetDockedPosition(widget);
    const clampedPosition = clampDockedPosition(
      currentPosition,
      surfaceRect,
      widget.layout.width,
      widget.layout.height,
    );

    setDockedDragPositions((currentPositions) => ({
      ...currentPositions,
      [widgetInstanceId]: clampedPosition,
    }));
    setActiveDockedDrag({
      height: widget.layout.height,
      layout: widget.layout,
      offsetX: pointerX - surfaceRect.left - clampedPosition.x,
      offsetY: pointerY - surfaceRect.top - clampedPosition.y,
      originalPosition: widgetDockedPosition(widget),
      widgetInstanceId,
      width: widget.layout.width,
    });
  }

  function nextDockedDragPosition(
    event: PointerEvent,
    drag: ActiveDockedDrag,
  ): DockedPosition {
    const surfaceRect = layoutSurfaceRef.current?.getBoundingClientRect();

    if (!surfaceRect) {
      return drag.originalPosition;
    }

    return clampDockedPosition(
      {
        x: event.clientX - surfaceRect.left - drag.offsetX,
        y: event.clientY - surfaceRect.top - drag.offsetY,
      },
      surfaceRect,
      drag.width,
      drag.height,
    );
  }

  async function persistDockedWidgetPosition(
    drag: ActiveDockedDrag,
    position: DockedPosition,
  ) {
    const nextPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };

    if (
      nextPosition.x === drag.originalPosition.x &&
      nextPosition.y === drag.originalPosition.y
    ) {
      setDockedDragPositions((currentPositions) =>
        removeWidgetPosition(currentPositions, drag.widgetInstanceId),
      );
      return;
    }

    try {
      await widgetActionsRef.current.updateWidgetLayout(drag.widgetInstanceId, {
        ...drag.layout,
        mode: "docked",
        x: nextPosition.x,
        y: nextPosition.y,
      });
      setDockedDragPositions((currentPositions) =>
        removeWidgetPosition(currentPositions, drag.widgetInstanceId),
      );
    } catch (error) {
      console.error("Failed to update docked widget position.", error);
      setDockedDragPositions((currentPositions) =>
        removeWidgetPosition(currentPositions, drag.widgetInstanceId),
      );
    }
  }

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
        <div
          className="widget-layout-surface"
          ref={layoutSurfaceRef}
          style={layoutSurfaceStyle}
        >
          {visibleWidgets.map((widget) => {
            const isPoppedOut = poppedOutWidgetIds.includes(widget.id);
            const isDragging = activeDockedDrag?.widgetInstanceId === widget.id;
            const itemClassName = isDragging
              ? "widget-layout-item widget-layout-item-dragging"
              : "widget-layout-item";

            return (
              <div
                className={itemClassName}
                key={widget.id}
                style={widgetLayoutItemStyle(widget, dockedDragPositions)}
              >
                {isPoppedOut ? (
                  <>
                    <WidgetGhostPlaceholder
                      instance={widget}
                      onDockBack={dockBackWidget}
                    />
                    <div
                      aria-label={`${widget.title} popped out`}
                      className="widget-popout-layer"
                      role="dialog"
                      style={widgetPopoutLayerStyle(
                        popoutPositions[widget.id],
                      )}
                    >
                      <WidgetHost
                        instance={widget}
                        layoutMode={layoutMode}
                        onDockBack={dockBackWidget}
                        onPopOut={popOutWidget}
                        onStartDockedDrag={startDockedDrag}
                        onStartPopoutDrag={startPopoutDrag}
                        presentationMode="popped-out"
                        widgetActions={widgetActions}
                      />
                    </div>
                  </>
                ) : (
                  <div className="widget-docked-surface">
                    <WidgetHost
                      instance={widget}
                      layoutMode={layoutMode}
                      onDockBack={dockBackWidget}
                      onPopOut={popOutWidget}
                      onStartDockedDrag={startDockedDrag}
                      onStartPopoutDrag={startPopoutDrag}
                      presentationMode="docked"
                      widgetActions={widgetActions}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function widgetLayoutSurfaceStyle(
  widgets: WidgetInstance[],
  dockedDragPositions: Partial<Record<WidgetInstanceId, DockedPosition>>,
): CSSProperties {
  const maxWidgetBottom = widgets.reduce((maxBottom, widget) => {
    if (widget.layout.mode !== "docked") {
      return maxBottom;
    }

    const position =
      dockedDragPositions[widget.id] ?? widgetDockedPosition(widget);

    return Math.max(maxBottom, position.y + widget.layout.height);
  }, 0);

  return {
    minHeight: `${Math.max(
      DOCKED_LAYOUT_MIN_HEIGHT,
      maxWidgetBottom + DOCKED_LAYOUT_BOTTOM_PADDING,
    )}px`,
  };
}

function widgetLayoutItemStyle(
  widget: WidgetInstance,
  dockedDragPositions: Partial<Record<WidgetInstanceId, DockedPosition>>,
): CSSProperties {
  const position = dockedDragPositions[widget.id] ?? widgetDockedPosition(widget);

  return {
    height: `${widget.layout.height}px`,
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `min(100%, ${widget.layout.width}px)`,
  };
}

function widgetDockedPosition(widget: WidgetInstance): DockedPosition {
  return {
    x: widget.layout.x,
    y: widget.layout.y,
  };
}

function clampDockedPosition(
  position: DockedPosition,
  surfaceRect: DOMRect,
  widgetWidth: number,
  widgetHeight: number,
): DockedPosition {
  const maxX = Math.max(
    0,
    surfaceRect.width - Math.min(widgetWidth, surfaceRect.width),
  );
  const maxY = Math.max(
    0,
    surfaceRect.height - Math.min(widgetHeight, surfaceRect.height),
  );

  return {
    x: clamp(Math.round(position.x), 0, maxX),
    y: clamp(Math.round(position.y), 0, maxY),
  };
}

function removeWidgetPosition(
  positions: Partial<Record<WidgetInstanceId, DockedPosition>>,
  widgetInstanceId: WidgetInstanceId,
) {
  const nextPositions = { ...positions };

  delete nextPositions[widgetInstanceId];

  return nextPositions;
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
