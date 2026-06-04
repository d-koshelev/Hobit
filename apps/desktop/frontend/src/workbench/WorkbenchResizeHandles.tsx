import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResizeDirection } from "./workbenchLayoutGeometry";

type WorkbenchResizeHandlesProps = {
  activeDirection: ResizeDirection | null;
  onStartResize: (
    direction: ResizeDirection,
    pointerX: number,
    pointerY: number,
  ) => void;
};

const RESIZE_HANDLES: {
  ariaLabel: string;
  direction: ResizeDirection;
  title: string;
}[] = [
  {
    ariaLabel: "Resize widget top edge",
    direction: "top",
    title: "Resize from top edge",
  },
  {
    ariaLabel: "Resize widget width",
    direction: "right",
    title: "Resize from right edge",
  },
  {
    ariaLabel: "Resize widget height",
    direction: "bottom",
    title: "Resize from bottom edge",
  },
  {
    ariaLabel: "Resize widget left edge",
    direction: "left",
    title: "Resize from left edge",
  },
  {
    ariaLabel: "Resize widget top-left corner",
    direction: "top-left",
    title: "Resize from top-left corner",
  },
  {
    ariaLabel: "Resize widget top-right corner",
    direction: "top-right",
    title: "Resize from top-right corner",
  },
  {
    ariaLabel: "Resize widget bottom-left corner",
    direction: "bottom-left",
    title: "Resize from bottom-left corner",
  },
  {
    ariaLabel: "Resize widget",
    direction: "bottom-right",
    title: "Resize from bottom-right corner",
  },
];

export function WorkbenchResizeHandles({
  activeDirection,
  onStartResize,
}: WorkbenchResizeHandlesProps) {
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
      {RESIZE_HANDLES.map(({ ariaLabel, direction, title }) => {
        const className = [
          "widget-resize-handle",
          `widget-resize-handle-${direction}`,
          direction.includes("-") ? "widget-resize-handle-corner" : null,
          activeDirection === direction ? "widget-resize-handle-active" : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            aria-label={ariaLabel}
            className={className}
            data-widget-header-drag-ignore
            key={direction}
            onPointerDown={(event) => startResize(direction, event)}
            title={title}
            type="button"
          />
        );
      })}
    </>
  );
}
