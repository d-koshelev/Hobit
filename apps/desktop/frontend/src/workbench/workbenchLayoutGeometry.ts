import type { CSSProperties } from "react";
import type { WidgetInstance, WidgetInstanceId } from "./types";

export type PopoutPosition = {
  x: number;
  y: number;
};

export type DockedPosition = {
  x: number;
  y: number;
};

export type DockedSize = {
  height: number;
  width: number;
};

export type ResizeDirection = "right" | "bottom" | "bottom-right";

export type DockedPositionMap = Partial<
  Record<WidgetInstanceId, DockedPosition>
>;

export type DockedSizeMap = Partial<Record<WidgetInstanceId, DockedSize>>;

export type PopoutPositionMap = Partial<
  Record<WidgetInstanceId, PopoutPosition>
>;

type LayoutSurfaceRect = Pick<DOMRect, "height" | "left" | "top" | "width">;

// Keep this in sync with --workbench-grid-step in styles/tokens.css.
export const WORKBENCH_GRID_STEP = 24;

const DEFAULT_POPOUT_TOP = 96;
const DEFAULT_NARROW_POPOUT_TOP = 80;
const DOCKED_LAYOUT_MIN_HEIGHT = WORKBENCH_GRID_STEP * 22;
const DOCKED_LAYOUT_BOTTOM_PADDING = WORKBENCH_GRID_STEP * 10;
const DOCKED_WIDGET_MAX_DIMENSION = 16_384;
const DOCKED_WIDGET_MIN_HEIGHT = WORKBENCH_GRID_STEP * 10;
const DOCKED_WIDGET_MIN_WIDTH = WORKBENCH_GRID_STEP * 14;
const POPOUT_DESKTOP_MARGIN = 48;
const POPOUT_NARROW_MARGIN = 32;
const POPOUT_EDGE_MARGIN = 16;
const POPOUT_MAX_WIDTH = 760;
const POPOUT_MIN_VISIBLE_WIDTH = 180;
const POPOUT_MIN_VISIBLE_HEIGHT = 96;

export function widgetLayoutSurfaceStyle(
  widgets: WidgetInstance[],
  dockedDragPositions: DockedPositionMap,
  dockedResizeSizes: DockedSizeMap,
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

export function widgetLayoutItemStyle(
  widget: WidgetInstance,
  dockedDragPositions: DockedPositionMap,
  dockedResizeSizes: DockedSizeMap,
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

export function widgetDockedPosition(widget: WidgetInstance): DockedPosition {
  return {
    x: widget.layout.x,
    y: widget.layout.y,
  };
}

export function widgetDockedSize(widget: WidgetInstance): DockedSize {
  return {
    height: widget.layout.height,
    width: widget.layout.width,
  };
}

export function clampDockedPosition(
  position: DockedPosition,
  surfaceRect: LayoutSurfaceRect,
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
    x: clamp(
      snapToWorkbenchGrid(position.x),
      0,
      snapMaximumToWorkbenchGrid(maxX, 0),
    ),
    y: clamp(
      snapToWorkbenchGrid(position.y),
      0,
      snapMaximumToWorkbenchGrid(maxY, 0),
    ),
  };
}

export function clampDockedSize(
  size: DockedSize,
  surfaceRect: LayoutSurfaceRect,
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
    height: clamp(
      snapToWorkbenchGrid(size.height),
      DOCKED_WIDGET_MIN_HEIGHT,
      snapMaximumToWorkbenchGrid(maxHeight, DOCKED_WIDGET_MIN_HEIGHT),
    ),
    width: clamp(
      snapToWorkbenchGrid(size.width),
      DOCKED_WIDGET_MIN_WIDTH,
      snapMaximumToWorkbenchGrid(maxWidth, DOCKED_WIDGET_MIN_WIDTH),
    ),
  };
}

export function snapToWorkbenchGrid(value: number) {
  return Math.round(value / WORKBENCH_GRID_STEP) * WORKBENCH_GRID_STEP;
}

export function nextDockedDragPosition({
  height,
  offsetX,
  offsetY,
  pointerX,
  pointerY,
  surfaceRect,
  width,
}: {
  height: number;
  offsetX: number;
  offsetY: number;
  pointerX: number;
  pointerY: number;
  surfaceRect: LayoutSurfaceRect;
  width: number;
}): DockedPosition {
  return clampDockedPosition(
    {
      x: pointerX - surfaceRect.left - offsetX,
      y: pointerY - surfaceRect.top - offsetY,
    },
    surfaceRect,
    width,
    height,
  );
}

export function nextDockedResizeSize({
  direction,
  originalSize,
  pointerX,
  pointerY,
  position,
  resizePointerX,
  resizePointerY,
  surfaceRect,
}: {
  direction: ResizeDirection;
  originalSize: DockedSize;
  pointerX: number;
  pointerY: number;
  position: DockedPosition;
  resizePointerX: number;
  resizePointerY: number;
  surfaceRect: LayoutSurfaceRect;
}): DockedSize {
  const deltaX = pointerX - resizePointerX;
  const deltaY = pointerY - resizePointerY;
  const nextSize = {
    height: originalSize.height,
    width: originalSize.width,
  };

  if (direction === "right" || direction === "bottom-right") {
    nextSize.width += deltaX;
  }

  if (direction === "bottom" || direction === "bottom-right") {
    nextSize.height += deltaY;
  }

  return clampDockedSize(nextSize, surfaceRect, position);
}

export function removeWidgetPosition(
  positions: DockedPositionMap,
  widgetInstanceId: WidgetInstanceId,
) {
  const nextPositions = { ...positions };

  delete nextPositions[widgetInstanceId];

  return nextPositions;
}

export function removeWidgetSize(
  sizes: DockedSizeMap,
  widgetInstanceId: WidgetInstanceId,
) {
  const nextSizes = { ...sizes };

  delete nextSizes[widgetInstanceId];

  return nextSizes;
}

export function visibleWidgetIdSet(widgets: WidgetInstance[]) {
  return new Set(
    widgets.filter((widget) => widget.visible).map((widget) => widget.id),
  );
}

export function removeStaleWidgetIds(
  widgetIds: WidgetInstanceId[],
  visibleWidgetIds: Set<WidgetInstanceId>,
) {
  return widgetIds.filter((widgetId) => visibleWidgetIds.has(widgetId));
}

export function removeStalePopoutPositions(
  positions: PopoutPositionMap,
  visibleWidgetIds: Set<WidgetInstanceId>,
) {
  return Object.fromEntries(
    Object.entries(positions).filter(([widgetId]) =>
      visibleWidgetIds.has(widgetId),
    ),
  );
}

export function removeSettledDockedDragPositions(
  positions: DockedPositionMap,
  widgets: WidgetInstance[],
) {
  const visibleWidgetById = visibleWidgetMap(widgets);

  return Object.fromEntries(
    Object.entries(positions).filter(([widgetId, position]) => {
      const widget = visibleWidgetById.get(widgetId);

      if (!widget || !position) {
        return false;
      }

      return widget.layout.x !== position.x || widget.layout.y !== position.y;
    }),
  );
}

export function removeSettledDockedResizeSizes(
  sizes: DockedSizeMap,
  widgets: WidgetInstance[],
) {
  const visibleWidgetById = visibleWidgetMap(widgets);

  return Object.fromEntries(
    Object.entries(sizes).filter(([widgetId, size]) => {
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
}

export function widgetPopoutLayerStyle(
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

export function widgetGhostStyle(
  instance: WidgetInstance,
): CSSProperties | undefined {
  if (instance.layout.mode !== "docked") {
    return undefined;
  }

  return {
    height: `${instance.layout.height}px`,
    minHeight: `${instance.layout.height}px`,
    width: `min(100%, ${instance.layout.width}px)`,
  };
}

export function defaultPopoutPosition(): PopoutPosition {
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

export function clampPopoutPosition(position: PopoutPosition): PopoutPosition {
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

function visibleWidgetMap(widgets: WidgetInstance[]) {
  return new Map(
    widgets
      .filter((widget) => widget.visible)
      .map((widget) => [widget.id, widget]),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapMaximumToWorkbenchGrid(value: number, minimum: number) {
  return Math.max(
    minimum,
    Math.floor(value / WORKBENCH_GRID_STEP) * WORKBENCH_GRID_STEP,
  );
}

function popoutViewportMargin() {
  return window.innerWidth <= 720
    ? POPOUT_NARROW_MARGIN
    : POPOUT_DESKTOP_MARGIN;
}
