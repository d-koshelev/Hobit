import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../design-system/Button";
import { WorkbenchActivity } from "./WorkbenchActivity";
import { WorkbenchResizeHandles } from "./WorkbenchResizeHandles";
import { WorkbenchWidgetGhost } from "./WorkbenchWidgetGhost";
import { WidgetHost } from "./WidgetHost";
import { agentExecutorSlotsFromWidgets } from "./agentQueueTaskUiModel";
import { useDirectWorkGitReviewHandoff } from "./useDirectWorkGitReviewHandoff";
import { useDirectWorkRunHandoff } from "./useDirectWorkRunHandoff";
import { GIT_WIDGET_DEFINITION_ID, isUserFacingWidgetDefinition } from "./widgetRegistry";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type { WidgetInstanceId, WidgetLayout, WorkbenchLayoutMode, WorkbenchViewState } from "./types";
import {
  clampDockedPosition,
  clampDockedSize,
  clampPopoutPosition,
  defaultPopoutPosition,
  nextDockedDragPosition as nextDockedDragPositionFromGeometry,
  nextDockedResizeSize as nextDockedResizeSizeFromGeometry,
  removeSettledDockedDragPositions,
  removeSettledDockedResizeSizes,
  removeStalePopoutPositions,
  removeStaleWidgetIds,
  removeWidgetPosition,
  removeWidgetSize,
  visibleWidgetIdSet,
  widgetDockedPosition,
  widgetDockedSize,
  widgetLayoutItemStyle,
  widgetLayoutSurfaceStyle,
  widgetPopoutLayerStyle,
  type DockedPosition,
  type DockedPositionMap,
  type DockedSize,
  type DockedSizeMap,
  type PopoutPosition,
  type PopoutPositionMap,
  type ResizeDirection,
} from "./workbenchLayoutGeometry";

type WorkbenchCanvasProps = {
  layoutMode: WorkbenchLayoutMode;
  onOpenWidgetCatalog: () => void;
  viewState: WorkbenchViewState;
  widgetActions: WorkbenchWidgetInstanceActions;
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

type ActiveDockedResize = {
  direction: ResizeDirection;
  layout: WidgetLayout;
  originalSize: DockedSize;
  pointerX: number;
  pointerY: number;
  position: DockedPosition;
  widgetInstanceId: WidgetInstanceId;
};

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
    DockedPositionMap
  >({});
  const [dockedResizeSizes, setDockedResizeSizes] = useState<
    DockedSizeMap
  >({});
  const [popoutPositions, setPopoutPositions] = useState<
    PopoutPositionMap
  >({});
  const [activeDockedDrag, setActiveDockedDrag] = useState<ActiveDockedDrag | null>(null);
  const [activeDockedResize, setActiveDockedResize] =
    useState<ActiveDockedResize | null>(null);
  const [activePopoutDrag, setActivePopoutDrag] =
    useState<ActivePopoutDrag | null>(null);
  const dockedDragPositionsRef = useRef(dockedDragPositions);
  const dockedResizeSizesRef = useRef(dockedResizeSizes);
  const layoutSurfaceRef = useRef<HTMLDivElement | null>(null);
  const widgetActionsRef = useRef(widgetActions);
  const userFacingWidgets = viewState.widgets.filter((widget) =>
    isUserFacingWidgetDefinition(widget.definitionId),
  );
  const visibleWidgets = userFacingWidgets
    .filter((widget) => widget.visible)
    .sort((first, second) => first.layout.order - second.layout.order);
  const hasGitWidget = userFacingWidgets.some(
    (widget) => widget.definitionId === GIT_WIDGET_DEFINITION_ID,
  );
  const agentExecutorSlots = useMemo(() => agentExecutorSlotsFromWidgets(viewState.widgets), [viewState.widgets]);
  const directWorkGitReview = useDirectWorkGitReviewHandoff(hasGitWidget);
  const directWorkRunHandoff = useDirectWorkRunHandoff();
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
  const canvasTopSurfaces = (
    <WorkbenchActivity events={viewState.recentEvents} />
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
    const visibleWidgetIds = visibleWidgetIdSet(visibleWidgets);

    setPoppedOutWidgetIds((currentIds) =>
      removeStaleWidgetIds(currentIds, visibleWidgetIds),
    );
    setPopoutPositions((currentPositions) =>
      removeStalePopoutPositions(currentPositions, visibleWidgetIds),
    );
    setDockedDragPositions((currentPositions) =>
      removeSettledDockedDragPositions(currentPositions, visibleWidgets),
    );
    setDockedResizeSizes((currentSizes) =>
      removeSettledDockedResizeSizes(currentSizes, visibleWidgets),
    );
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

    return nextDockedDragPositionFromGeometry({
      height: drag.height,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      surfaceRect,
      width: drag.width,
    });
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

    return nextDockedResizeSizeFromGeometry({
      direction: resize.direction,
      originalSize: resize.originalSize,
      pointerX: event.clientX,
      pointerY: event.clientY,
      position: resize.position,
      resizePointerX: resize.pointerX,
      resizePointerY: resize.pointerY,
      surfaceRect,
    });
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
          {canvasTopSurfaces}
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
        {canvasTopSurfaces}
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
                    <WorkbenchWidgetGhost
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
                        agentExecutorSlots={agentExecutorSlots}
                        directWorkGitReview={directWorkGitReview}
                        directWorkRunHandoff={directWorkRunHandoff}
                        hasGitWidget={hasGitWidget}
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
                      agentExecutorSlots={agentExecutorSlots}
                      dockedSize={dockedSize}
                      directWorkGitReview={directWorkGitReview}
                      directWorkRunHandoff={directWorkRunHandoff}
                      hasGitWidget={hasGitWidget}
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
                      <WorkbenchResizeHandles
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
