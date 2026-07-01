import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type ModulePopupPosition = {
  readonly x: number;
  readonly y: number;
};

type ModulePopupProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> & {
  readonly bodyClassName?: string;
  readonly children: ReactNode;
  readonly closeLabel?: string;
  readonly defaultPosition?: ModulePopupPosition;
  readonly dragLabel?: string;
  readonly dragTitle?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: ReactNode;
  readonly titleId?: string;
};

type ModulePopupDragState = {
  readonly originX: number;
  readonly originY: number;
  readonly pointerX: number;
  readonly pointerY: number;
};

const DEFAULT_MODULE_POPUP_POSITION: ModulePopupPosition = {
  x: 420,
  y: 44,
};

export function ModulePopup({
  bodyClassName,
  children,
  className,
  closeLabel = "Close popup",
  defaultPosition = DEFAULT_MODULE_POPUP_POSITION,
  dragLabel = "Move popup",
  dragTitle = "Drag popup",
  id,
  onClose,
  open,
  style,
  title,
  titleId,
  ...props
}: ModulePopupProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? `${id ?? generatedTitleId}-title`;
  const popupDrag = useRef<ModulePopupDragState | null>(null);
  const popupDragCleanup = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(defaultPosition);

  useEffect(() => {
    return () => {
      popupDragCleanup.current?.();
    };
  }, []);

  useEffect(() => {
    if (open) {
      return;
    }

    stopPopupDrag();
  }, [open]);

  const popupStyle = {
    ...style,
    "--module-popup-x": `${Math.round(position.x)}px`,
    "--module-popup-y": `${Math.round(position.y)}px`,
  } as CSSProperties;

  function startPopupDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    popupDragCleanup.current?.();
    popupDrag.current = {
      originX: position.x,
      originY: position.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    setDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = popupDrag.current;

      if (!drag) {
        return;
      }

      setPosition({
        x: drag.originX + moveEvent.clientX - drag.pointerX,
        y: drag.originY + moveEvent.clientY - drag.pointerY,
      });
    };

    const stopDrag = () => {
      stopPopupDrag();
    };

    popupDragCleanup.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
  }

  function stopPopupDrag() {
    popupDragCleanup.current?.();
    popupDragCleanup.current = null;
    popupDrag.current = null;
    setDragging(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="module-shell-floating-layer"
      data-module-floating-layer="true"
    >
      <div
        {...props}
        aria-labelledby={resolvedTitleId}
        className={["module-popup", className].filter(Boolean).join(" ")}
        data-module-popup-floating="true"
        data-module-popup-moving={dragging ? "true" : "false"}
        id={id}
        role="dialog"
        style={popupStyle}
      >
        <header
          aria-label={dragLabel}
          className="module-popup-header"
          data-module-popup-drag-handle="true"
          onPointerDown={startPopupDrag}
          title={dragTitle}
        >
          <div className="module-popup-header-group module-popup-header-group-left">
            <h3 className="module-popup-title" id={resolvedTitleId}>
              {title}
            </h3>
          </div>
          <div className="module-popup-header-group module-popup-header-group-right">
            <button
              aria-label={closeLabel}
              className="module-popup-close"
              data-module-popup-close="true"
              data-module-popup-close-flat="true"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              x
            </button>
          </div>
        </header>
        <div
          className={["module-popup-body", bodyClassName]
            .filter(Boolean)
            .join(" ")}
          data-module-popup-body="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
