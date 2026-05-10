import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
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

type DockedSize = {
  height: number;
  width: number;
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

type ResizeDirection = "right" | "bottom" | "bottom-right";

type ActiveDockedResize = {
  direction: ResizeDirection;
  layout: WidgetLayout;
  originalSize: DockedSize;
  pointerX: number;
  pointerY: number;
  position: DockedPosition;
  widgetInstanceId: WidgetInstanceId;
};

const DEFAULT_POPOUT_TOP = 96;
const DEFAULT_NARROW_POPOUT_TOP = 80;
const DOCKED_LAYOUT_MIN_HEIGHT = 520;
const DOCKED_LAYOUT_BOTTOM_PADDING = 240;
const DOCKED_WIDGET_MAX_DIMENSION = 16_384;
const DOCKED_WIDGET_MIN_HEIGHT = 240;
const DOCKED_WIDGET_MIN_WIDTH = 320;
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
  const [dockedResizeSizes, setDockedResizeSizes] = useState<
    Partial<Record<WidgetInstanceId, DockedSize>>
  >({});
  const [popoutPositions, setPopoutPositions] = useState<
    Partial<Record<WidgetInstanceId, PopoutPosition>>
  >({});
  const [activeDockedDrag, setActiveDockedDrag] =
    useState<ActiveDockedDrag | null>(null);
  const [activeDockedResize, setActiveDockedResize] =
    useState<ActiveDockedResize | null>(null);
  const [activePopoutDrag, setActivePopoutDrag] =
    useState<ActivePopoutDrag | null>(null);
  const dockedDragPositionsRef = useRef(dockedDragPositions);
  const dockedResizeSizesRef = useRef(dockedResizeSizes);
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
    dockedResizeSizes,
  );

  useEffect(() => {
    dockedDragPositionsRef.current = dockedDragPositions;
  }, [dockedDragPositions]);

  useEffect(() => {
    dockedResizeSizesRef.current = dockedResizeSizes;
  }, [dockedResizeSizes]);

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
    setDockedResizeSizes((currentSizes) => {
      const visibleWidgetById = new Map(
        viewState.widgets
          .filter((widget) => widget.visible)
          .map((widget) => [widget.id, widget]),
      );

      return Object.fromEntries(
        Object.entries(currentSizes).filter(([widgetId, size]) => {
          const widget = visibleWidgetById.get(widgetId);

          if (!widget || !size) {
            return false;
          }

          return (
            widget.layout.width !== size.width ||
            widget.layout.height !== size.height
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
    setActiveDockedResize(null);
    setDockedDragPositions({});
    setDockedResizeSizes({});
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
    if (!activeDockedResize) {
      return;
    }

    const resize = activeDockedResize;
    const resizeClassName = `widget-docked-resizing-${resize.direction}`;

    document.body.classList.add("widget-docked-resizing", resizeClassName);

    function resizeDockedWidget(event: PointerEvent) {
      const nextSize = nextDockedResizeSize(event, resize);

      setDockedResizeSizes((currentSizes) => ({
        ...currentSizes,
        [resize.widgetInstanceId]: nextSize,
      }));
    }

    function finishDockedWidgetResize(event: PointerEvent) {
      const nextSize = nextDockedResizeSize(event, resize);

      setActiveDockedResize(null);
      setDockedResizeSizes((currentSizes) => ({
        ...currentSizes,
        [resize.widgetInstanceId]: nextSize,
      }));
      void persistDockedWidgetSize(resize, nextSize);
    }

    function cancelDockedWidgetResize() {
      setActiveDockedResize(null);
      setDockedResizeSizes((currentSizes) =>
        removeWidgetSize(currentSizes, resize.widgetInstanceId),
      );
    }

    window.addEventListener("pointermove", resizeDockedWidget);
    window.addEventListener("pointerup", finishDockedWidgetResize);
    window.addEventListener("pointercancel", cancelDockedWidgetResize);

    return () => {
      document.body.classList.remove("widget-docked-resizing", resizeClassName);
      window.removeEventListener("pointermove", resizeDockedWidget);
      window.removeEventListener("pointerup", finishDockedWidgetResize);
      window.removeEventListener("pointercancel", cancelDockedWidgetResize);
    };
  }, [activeDockedResize]);

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
    if (!isLayoutEditing || activeDockedResize) {
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

  function startDockedResize(
    widgetInstanceId: WidgetInstanceId,
    direction: ResizeDirection,
    pointerX: number,
    pointerY: number,
  ) {
    if (!isLayoutEditing || activeDockedDrag) {
      return;
    }

    const surfaceRect = layoutSurfaceRef.current?.getBoundingClientRect();
    const widget = visibleWidgets.find(
      (candidate) => candidate.id === widgetInstanceId,
    );

    if (!surfaceRect || !widget || widget.layout.mode !== "docked") {
      return;
    }

    const position =
      dockedDragPositionsRef.current[widgetInstanceId] ??
      widgetDockedPosition(widget);
    const currentSize =
      dockedResizeSizesRef.current[widgetInstanceId] ?? widgetDockedSize(widget);
    const clampedSize = clampDockedSize(currentSize, surfaceRect, position);

    setDockedResizeSizes((currentSizes) => ({
      ...currentSizes,
      [widgetInstanceId]: clampedSize,
    }));
    setActiveDockedResize({
      direction,
      layout: widget.layout,
      originalSize: clampedSize,
      pointerX,
      pointerY,
      position,
      widgetInstanceId,
    });
  }

  function nextDockedResizeSize(
    event: PointerEvent,
    resize: ActiveDockedResize,
  ): DockedSize {
    const surfaceRect = layoutSurfaceRef.current?.getBoundingClientRect();

    if (!surfaceRect) {
      return resize.originalSize;
    }

    const deltaX = event.clientX - resize.pointerX;
    const deltaY = event.clientY - resize.pointerY;
    const nextSize = {
      height: resize.originalSize.height,
      width: resize.originalSize.width,
    };

    if (resize.direction === "right" || resize.direction === "bottom-right") {
      nextSize.width += deltaX;
    }

    if (resize.direction === "bottom" || resize.direction === "bottom-right") {
      nextSize.height += deltaY;
    }

    return clampDockedSize(nextSize, surfaceRect, resize.position);
  }

  async function persistDockedWidgetSize(
    resize: ActiveDockedResize,
    size: DockedSize,
  ) {
    const nextSize = {
      height: Math.round(size.height),
      width: Math.round(size.width),
    };

    if (
      nextSize.width === resize.originalSize.width &&
      nextSize.height === resize.originalSize.height
    ) {
      setDockedResizeSizes((currentSizes) =>
        removeWidgetSize(currentSizes, resize.widgetInstanceId),
      );
      return;
    }

    try {
      await widgetActionsRef.current.updateWidgetLayout(
        resize.widgetInstanceId,
        {
          ...resize.layout,
          height: nextSize.height,
          mode: "docked",
          width: nextSize.width,
        },
      );
      setDockedResizeSizes((currentSizes) =>
        removeWidgetSize(currentSizes, resize.widgetInstanceId),
      );
    } catch (error) {
      console.error("Failed to update docked widget size.", error);
      setDockedResizeSizes((currentSizes) =>
        removeWidgetSize(currentSizes, resize.widgetInstanceId),
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
            const isResizing =
              activeDockedResize?.widgetInstanceId === widget.id;
            const itemClassName = isDragging
              ? "widget-layout-item widget-layout-item-dragging"
              : isResizing
                ? "widget-layout-item widget-layout-item-resizing"
              : "widget-layout-item";
            const dockedSize =
              dockedResizeSizes[widget.id] ?? widgetDockedSize(widget);

            return (
              <div
                className={itemClassName}
                key={widget.id}
                style={widgetLayoutItemStyle(
                  widget,
                  dockedDragPositions,
                  dockedResizeSizes,
                )}
              >
                {isPoppedOut ? (
                  <>
                    <WidgetGhostPlaceholder
                      instance={widget}
                      onDockBack={dockBackWidget}
                    />
                    <div
                      aria-label={`${widget.title} floating widget`}
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
                      dockedSize={dockedSize}
                      instance={widget}
                      layoutMode={layoutMode}
                      onDockBack={dockBackWidget}
                      onPopOut={popOutWidget}
                      onStartDockedDrag={startDockedDrag}
                      onStartPopoutDrag={startPopoutDrag}
                      presentationMode="docked"
                      widgetActions={widgetActions}
                    />
                    {isLayoutEditing && widget.layout.mode === "docked" ? (
                      <WidgetResizeHandles
                        onStartResize={(direction, pointerX, pointerY) =>
                          startDockedResize(
                            widget.id,
                            direction,
                            pointerX,
                            pointerY,
                          )
                        }
                      />
                    ) : null}
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
  dockedResizeSizes: Partial<Record<WidgetInstanceId, DockedSize>>,
): CSSProperties {
  const maxWidgetBottom = widgets.reduce((maxBottom, widget) => {
    if (widget.layout.mode !== "docked") {
      return maxBottom;
    }

    const position =
      dockedDragPositions[widget.id] ?? widgetDockedPosition(widget);
    const size = dockedResizeSizes[widget.id] ?? widgetDockedSize(widget);

    return Math.max(maxBottom, position.y + size.height);
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
  dockedResizeSizes: Partial<Record<WidgetInstanceId, DockedSize>>,
): CSSProperties {
  const position = dockedDragPositions[widget.id] ?? widgetDockedPosition(widget);
  const size = dockedResizeSizes[widget.id] ?? widgetDockedSize(widget);

  return {
    height: `${size.height}px`,
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `min(100%, ${size.width}px)`,
  };
}

function widgetDockedPosition(widget: WidgetInstance): DockedPosition {
  return {
    x: widget.layout.x,
    y: widget.layout.y,
  };
}

function widgetDockedSize(widget: WidgetInstance): DockedSize {
  return {
    height: widget.layout.height,
    width: widget.layout.width,
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

function clampDockedSize(
  size: DockedSize,
  surfaceRect: DOMRect,
  position: DockedPosition,
): DockedSize {
  const maxWidth = Math.max(
    DOCKED_WIDGET_MIN_WIDTH,
    Math.min(DOCKED_WIDGET_MAX_DIMENSION, surfaceRect.width - position.x),
  );
  const maxHeight = Math.max(
    DOCKED_WIDGET_MIN_HEIGHT,
    Math.min(DOCKED_WIDGET_MAX_DIMENSION, surfaceRect.height - position.y),
  );

  return {
    height: clamp(Math.round(size.height), DOCKED_WIDGET_MIN_HEIGHT, maxHeight),
    width: clamp(Math.round(size.width), DOCKED_WIDGET_MIN_WIDTH, maxWidth),
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

function removeWidgetSize(
  sizes: Partial<Record<WidgetInstanceId, DockedSize>>,
  widgetInstanceId: WidgetInstanceId,
) {
  const nextSizes = { ...sizes };

  delete nextSizes[widgetInstanceId];

  return nextSizes;
}

type WidgetResizeHandlesProps = {
  onStartResize: (
    direction: ResizeDirection,
    pointerX: number,
    pointerY: number,
  ) => void;
};

function WidgetResizeHandles({ onStartResize }: WidgetResizeHandlesProps) {
  function startResize(
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onStartResize(direction, event.clientX, event.clientY);
  }

  return (
    <>
      <button
        aria-label="Resize widget width"
        className="widget-resize-handle widget-resize-handle-right"
        data-widget-header-drag-ignore
        onPointerDown={(event) => startResize("right", event)}
        title="Resize width"
        type="button"
      />
      <button
        aria-label="Resize widget height"
        className="widget-resize-handle widget-resize-handle-bottom"
        data-widget-header-drag-ignore
        onPointerDown={(event) => startResize("bottom", event)}
        title="Resize height"
        type="button"
      />
      <button
        aria-label="Resize widget"
        className="widget-resize-handle widget-resize-handle-bottom-right"
        data-widget-header-drag-ignore
        onPointerDown={(event) => startResize("bottom-right", event)}
        title="Resize"
        type="button"
      />
    </>
  );
}

function LayoutEditingStatus() {
  return (
    <div className="layout-editing-status" role="status">
      <span className="layout-editing-status-dot" aria-hidden="true" />
      Editing layout
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
      aria-label={`${instance.title} floating widget placeholder`}
      className="widget-ghost"
      style={widgetGhostStyle(instance)}
    >
      <div className="widget-ghost-copy">
        <h2 className="widget-ghost-title">{instance.title}</h2>
        <p className="widget-ghost-status">Floating in workspace</p>
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
