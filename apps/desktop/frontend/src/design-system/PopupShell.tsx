import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type PopupShellVariant = "anchored" | "floating";

type PopupShellProps = {
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  id: string;
  isOpen: boolean;
  labelId: string;
  onRequestClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  variant?: PopupShellVariant;
};

type AnchoredPosition = {
  maxHeight: number;
  right: number;
  top: number;
};

const POPUP_EDGE_GAP = 12;
const POPUP_ANCHOR_GAP = 6;
const POPUP_MIN_MAX_HEIGHT = 180;

export function PopupShell({
  anchorRef,
  children,
  id,
  isOpen,
  labelId,
  onRequestClose,
  returnFocusRef,
  variant = "anchored",
}: PopupShellProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

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

    function updatePosition() {
      const anchor = anchorRef?.current;

      if (!anchor) {
        setPosition(null);
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const top = Math.min(
        window.innerHeight - POPUP_EDGE_GAP,
        rect.bottom + POPUP_ANCHOR_GAP,
      );

      setPosition({
        maxHeight: Math.max(
          POPUP_MIN_MAX_HEIGHT,
          window.innerHeight - top - POPUP_EDGE_GAP,
        ),
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
  }, [anchorRef, isOpen, variant]);

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

  return createPortal(
    <div
      aria-labelledby={labelId}
      className={`popup-shell popup-shell-${variant}`}
      id={id}
      ref={popupRef}
      role="dialog"
      style={popupStyle(variant, position)}
      tabIndex={-1}
    >
      {children}
    </div>,
    document.body,
  );
}

function popupStyle(
  variant: PopupShellVariant,
  position: AnchoredPosition | null,
): CSSProperties | undefined {
  if (variant === "floating") {
    return undefined;
  }

  if (!position) {
    return {
      maxHeight: `calc(100vh - ${POPUP_EDGE_GAP * 2}px)`,
    };
  }

  return {
    maxHeight: `${position.maxHeight}px`,
    right: `${position.right}px`,
    top: `${position.top}px`,
  };
}
