import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResizeDirection } from "./workbenchLayoutGeometry";

type WorkbenchResizeHandlesProps = {
  onStartResize: (
    direction: ResizeDirection,
    pointerX: number,
    pointerY: number,
  ) => void;
};

export function WorkbenchResizeHandles({
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
