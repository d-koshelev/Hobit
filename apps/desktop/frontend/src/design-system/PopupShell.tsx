import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type PopupShellVariant = "anchored" | "floating";

type PopupShellProps = {
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  id: string;
  isOpen: boolean;
  labelId: string;
  minResizeHeight?: number;
  minResizeWidth?: number;
  onRequestClose: () => void;
  resizable?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  variant?: PopupShellVariant;
};

type AnchoredPosition = {
  maxHeight: number;
  right: number;
  top: number;
};

type DragPosition = {
  left: number;
  top: number;
};

type ActiveDrag = {
  offsetX: number;
  offsetY: number;
};

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

type ResizeSize = {
  height: number;
  width: number;
};

type ActiveResize = {
  direction: ResizeDirection;
  height: number;
  left: number;
  startX: number;
  startY: number;
  top: number;
  width: number;
};

const POPUP_EDGE_GAP = 12;
const POPUP_ANCHOR_GAP = 6;
const POPUP_DEFAULT_MIN_WIDTH = 320;
const POPUP_DEFAULT_MIN_HEIGHT = 180;
const POPUP_MIN_MAX_HEIGHT = 180;
const POPUP_DRAG_IGNORE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[contenteditable='true']",
  "[data-popup-no-drag]",
  "[role='button']",
  "[role='checkbox']",
  "[role='link']",
  "[role='radio']",
  "[role='switch']",
  "[role='tab']",
].join(",");

export function PopupShell({
  anchorRef,
  children,
  className,
  id,
  isOpen,
  labelId,
  minResizeHeight = POPUP_DEFAULT_MIN_HEIGHT,
  minResizeWidth = POPUP_DEFAULT_MIN_WIDTH,
  onRequestClose,
  resizable = false,
  returnFocusRef,
  variant = "anchored",
}: PopupShellProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const activeResizeRef = useRef<ActiveResize | null>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  const [resizeSize, setResizeSize] = useState<ResizeSize | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    activeDragRef.current = null;
    activeResizeRef.current = null;
    setDragPosition(null);
    setResizeSize(null);
    setIsDragging(false);
    setIsResizing(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    popupRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || variant !== "anchored") {
      return;
    }

    if (dragPosition) {
      return;
    }

    function updatePosition() {
      const anchor = anchorRef?.current;

      if (!anchor) {
        setPosition(null);
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const viewportHeight = Math.max(0, window.innerHeight - POPUP_EDGE_GAP * 2);
      const belowTop = rect.bottom + POPUP_ANCHOR_GAP;
      const belowHeight = Math.max(
        0,
        window.innerHeight - belowTop - POPUP_EDGE_GAP,
      );
      const aboveHeight = Math.max(
        0,
        rect.top - POPUP_ANCHOR_GAP - POPUP_EDGE_GAP,
      );
      const shouldOpenAbove =
        belowHeight < POPUP_MIN_MAX_HEIGHT && aboveHeight > belowHeight;
      const availableHeight = shouldOpenAbove ? aboveHeight : belowHeight;
      const maxHeight = Math.max(
        Math.min(POPUP_MIN_MAX_HEIGHT, viewportHeight),
        Math.min(availableHeight, viewportHeight),
      );
      const measuredHeight =
        popupRef.current?.getBoundingClientRect().height ??
        POPUP_MIN_MAX_HEIGHT;
      const clampedHeight = Math.min(
        measuredHeight || POPUP_MIN_MAX_HEIGHT,
        maxHeight,
      );
      const top = shouldOpenAbove
        ? Math.max(POPUP_EDGE_GAP, rect.top - POPUP_ANCHOR_GAP - clampedHeight)
        : Math.min(
            Math.max(POPUP_EDGE_GAP, belowTop),
            POPUP_EDGE_GAP + viewportHeight - clampedHeight,
          );

      setPosition({
        maxHeight,
        right: Math.max(POPUP_EDGE_GAP, window.innerWidth - rect.right),
        top,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, dragPosition, isOpen, variant]);

  useEffect(() => {
    if (!isOpen || !isDragging) {
      return;
    }

    function movePopup(event: PointerEvent) {
      const activeDrag = activeDragRef.current;
      const popup = popupRef.current;

      if (!activeDrag || !popup) {
        return;
      }

      const rect = popup.getBoundingClientRect();
      const maxLeft = Math.max(POPUP_EDGE_GAP, window.innerWidth - rect.width - POPUP_EDGE_GAP);
      const maxTop = Math.max(POPUP_EDGE_GAP, window.innerHeight - rect.height - POPUP_EDGE_GAP);

      setDragPosition({
        left: clamp(event.clientX - activeDrag.offsetX, POPUP_EDGE_GAP, maxLeft),
        top: clamp(event.clientY - activeDrag.offsetY, POPUP_EDGE_GAP, maxTop),
      });
    }

    function stopPopupDrag() {
      activeDragRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener("pointermove", movePopup);
    window.addEventListener("pointerup", stopPopupDrag);
    window.addEventListener("pointercancel", stopPopupDrag);

    return () => {
      window.removeEventListener("pointermove", movePopup);
      window.removeEventListener("pointerup", stopPopupDrag);
      window.removeEventListener("pointercancel", stopPopupDrag);
    };
  }, [isDragging, isOpen]);

  useEffect(() => {
    if (!isOpen || !isResizing) {
      return;
    }

    function resizePopup(event: PointerEvent) {
      const activeResize = activeResizeRef.current;

      if (!activeResize) {
        return;
      }

      const maxWidth = Math.max(
        minResizeWidth,
        window.innerWidth - POPUP_EDGE_GAP * 2,
      );
      const maxHeight = Math.max(
        minResizeHeight,
        window.innerHeight - POPUP_EDGE_GAP * 2,
      );
      const deltaX = event.clientX - activeResize.startX;
      const deltaY = event.clientY - activeResize.startY;
      const growsEast = activeResize.direction.includes("e");
      const growsSouth = activeResize.direction.includes("s");
      const growsWest = activeResize.direction.includes("w");
      const growsNorth = activeResize.direction.includes("n");
      let nextLeft = activeResize.left;
      let nextTop = activeResize.top;
      let nextWidth = activeResize.width;
      let nextHeight = activeResize.height;

      if (growsEast) {
        nextWidth = activeResize.width + deltaX;
      }

      if (growsSouth) {
        nextHeight = activeResize.height + deltaY;
      }

      if (growsWest) {
        nextWidth = activeResize.width - deltaX;
      }

      if (growsNorth) {
        nextHeight = activeResize.height - deltaY;
      }

      nextWidth = clamp(nextWidth, minResizeWidth, maxWidth);
      nextHeight = clamp(nextHeight, minResizeHeight, maxHeight);

      if (growsWest) {
        nextLeft = activeResize.left + activeResize.width - nextWidth;
      }

      if (growsNorth) {
        nextTop = activeResize.top + activeResize.height - nextHeight;
      }

      nextLeft = clamp(
        nextLeft,
        POPUP_EDGE_GAP,
        Math.max(POPUP_EDGE_GAP, window.innerWidth - nextWidth - POPUP_EDGE_GAP),
      );
      nextTop = clamp(
        nextTop,
        POPUP_EDGE_GAP,
        Math.max(POPUP_EDGE_GAP, window.innerHeight - nextHeight - POPUP_EDGE_GAP),
      );

      setDragPosition({
        left: nextLeft,
        top: nextTop,
      });
      setResizeSize({
        height: nextHeight,
        width: nextWidth,
      });
    }

    function stopPopupResize() {
      activeResizeRef.current = null;
      setIsResizing(false);
    }

    window.addEventListener("pointermove", resizePopup);
    window.addEventListener("pointerup", stopPopupResize);
    window.addEventListener("pointercancel", stopPopupResize);

    return () => {
      window.removeEventListener("pointermove", resizePopup);
      window.removeEventListener("pointerup", stopPopupResize);
      window.removeEventListener("pointercancel", stopPopupResize);
    };
  }, [isOpen, isResizing, minResizeHeight, minResizeWidth]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeAndReturnFocus() {
      onRequestClose();
      window.setTimeout(() => {
        returnFocusRef?.current?.focus();
      }, 0);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeAndReturnFocus();
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        popupRef.current?.contains(target) ||
        returnFocusRef?.current?.contains(target)
      ) {
        return;
      }

      closeAndReturnFocus();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen, onRequestClose, returnFocusRef]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  function startPopupDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const dragHandle = event.target.closest("[data-popup-drag-handle]");

    if (!dragHandle || !popupRef.current?.contains(dragHandle)) {
      return;
    }

    if (isPopupDragIgnored(event.target, dragHandle)) {
      return;
    }

    const rect = popupRef.current.getBoundingClientRect();
    activeDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setDragPosition({
      left: rect.left,
      top: rect.top,
    });
    setIsDragging(true);
    event.preventDefault();
  }

  function startPopupResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    const popup = popupRef.current;
    const direction = event.currentTarget.dataset
      .popupResizeHandle as ResizeDirection;

    if (!popup || !direction) {
      return;
    }

    const rect = popup.getBoundingClientRect();
    activeResizeRef.current = {
      direction,
      height: rect.height,
      left: rect.left,
      startX: event.clientX,
      startY: event.clientY,
      top: rect.top,
      width: rect.width,
    };
    setDragPosition({
      left: rect.left,
      top: rect.top,
    });
    setResizeSize({
      height: rect.height,
      width: rect.width,
    });
    setIsResizing(true);
    event.preventDefault();
    event.stopPropagation();
  }

  return createPortal(
    <div
      aria-labelledby={labelId}
      className={[
        "popup-shell",
        `popup-shell-${variant}`,
        isDragging ? "popup-shell-dragging" : "",
        isResizing ? "popup-shell-resizing" : "",
        resizable ? "popup-shell-resizable" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      id={id}
      onPointerDown={startPopupDrag}
      ref={popupRef}
      role="dialog"
      style={popupStyle(variant, position, dragPosition, resizeSize)}
      tabIndex={-1}
    >
      {children}
      {resizable ? (
        <PopupResizeHandles onPointerDown={startPopupResize} />
      ) : null}
    </div>,
    document.body,
  );
}

function PopupResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const handles: { direction: ResizeDirection; label: string }[] = [
    { direction: "n", label: "Resize popup from top edge" },
    { direction: "ne", label: "Resize popup from top right corner" },
    { direction: "e", label: "Resize popup from right edge" },
    { direction: "se", label: "Resize popup from bottom right corner" },
    { direction: "s", label: "Resize popup from bottom edge" },
    { direction: "sw", label: "Resize popup from bottom left corner" },
    { direction: "w", label: "Resize popup from left edge" },
    { direction: "nw", label: "Resize popup from top left corner" },
  ];

  return (
    <div aria-hidden="true" className="popup-shell-resize-handles">
      {handles.map((handle) => (
        <button
          aria-label={handle.label}
          className={`popup-shell-resize-handle popup-shell-resize-${handle.direction}`}
          data-popup-no-drag
          data-popup-resize-handle={handle.direction}
          key={handle.direction}
          onPointerDown={onPointerDown}
          tabIndex={-1}
          type="button"
        />
      ))}
    </div>
  );
}

function popupStyle(
  variant: PopupShellVariant,
  position: AnchoredPosition | null,
  dragPosition: DragPosition | null,
  resizeSize: ResizeSize | null,
): CSSProperties | undefined {
  const sizeStyle: CSSProperties = resizeSize
    ? {
        height: `${resizeSize.height}px`,
        width: `${resizeSize.width}px`,
      }
    : {};

  if (dragPosition) {
    return {
      ...sizeStyle,
      left: `${dragPosition.left}px`,
      maxHeight: `calc(100vh - ${POPUP_EDGE_GAP * 2}px)`,
      right: "auto",
      top: `${dragPosition.top}px`,
      transform: "none",
    };
  }

  if (variant === "floating") {
    return undefined;
  }

  if (!position) {
    return {
      ...sizeStyle,
      maxHeight: `calc(100vh - ${POPUP_EDGE_GAP * 2}px)`,
    };
  }

  return {
    ...sizeStyle,
    maxHeight: `${position.maxHeight}px`,
    right: `${position.right}px`,
    top: `${position.top}px`,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isPopupDragIgnored(target: Element, dragHandle: Element) {
  const ignoredTarget = target.closest(POPUP_DRAG_IGNORE_SELECTOR);

  return Boolean(ignoredTarget && dragHandle.contains(ignoredTarget));
}
