import { useEffect, useRef, useState } from "react";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import type { WidgetInstance, WidgetInstanceId, WidgetLayout } from "./types";
import {
  clampDockedPosition,
  clampDockedSize,
  nextDockedDragPosition as nextDockedDragPositionFromGeometry,
  nextDockedResizeSize as nextDockedResizeSizeFromGeometry,
  removeSettledDockedDragPositions,
  removeSettledDockedResizeSizes,
  removeWidgetPosition,
  removeWidgetSize,
  widgetDockedPosition,
  widgetDockedSize,
  type DockedPosition,
  type DockedPositionMap,
  type DockedSize,
  type DockedSizeMap,
  type ResizeDirection,
  type WorkbenchGridSize,
} from "./workbenchLayoutGeometry";

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

type WorkbenchLayoutInteractionsOptions = {
  gridSize: WorkbenchGridSize;
  isLayoutEditing: boolean;
  visibleWidgets: WidgetInstance[];
  widgetActions: WorkbenchWidgetInstanceActions;
  widgets: WidgetInstance[];
};

export function useWorkbenchLayoutInteractions({
  gridSize,
  isLayoutEditing,
  visibleWidgets,
  widgetActions,
  widgets,
}: WorkbenchLayoutInteractionsOptions) {
  const [dockedDragPositions, setDockedDragPositions] =
    useState<DockedPositionMap>({});
  const [dockedResizeSizes, setDockedResizeSizes] =
    useState<DockedSizeMap>({});
  const [activeDockedDrag, setActiveDockedDrag] =
    useState<ActiveDockedDrag | null>(null);
  const [activeDockedResize, setActiveDockedResize] =
    useState<ActiveDockedResize | null>(null);
  const dockedDragPositionsRef = useRef(dockedDragPositions);
  const dockedResizeSizesRef = useRef(dockedResizeSizes);
  const layoutSurfaceRef = useRef<HTMLDivElement | null>(null);
  const widgetActionsRef = useRef(widgetActions);

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
    setDockedDragPositions((currentPositions) =>
      removeSettledDockedDragPositions(currentPositions, visibleWidgets),
    );
    setDockedResizeSizes((currentSizes) =>
      removeSettledDockedResizeSizes(currentSizes, visibleWidgets),
    );
  }, [widgets]);

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
  }, [activeDockedDrag, gridSize]);

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
  }, [activeDockedResize, gridSize]);

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
      gridSize,
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
      gridSize,
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
    const clampedSize = clampDockedSize(
      currentSize,
      surfaceRect,
      position,
      gridSize,
      {
        minHeight: widget.layout.minHeight,
        minWidth: widget.layout.minWidth,
      },
    );

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
      gridSize,
      minimumSize: {
        minHeight: resize.layout.minHeight,
        minWidth: resize.layout.minWidth,
      },
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

  return {
    activeDockedDragWidgetInstanceId:
      activeDockedDrag?.widgetInstanceId ?? null,
    activeDockedResizeWidgetInstanceId:
      activeDockedResize?.widgetInstanceId ?? null,
    dockedDragPositions,
    dockedResizeSizes,
    layoutSurfaceRef,
    startDockedDrag,
    startDockedResize,
  };
}
