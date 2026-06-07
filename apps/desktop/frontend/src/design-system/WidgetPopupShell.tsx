import { type ReactNode, type RefObject } from "react";
import { PopupShell } from "./PopupShell";

type WidgetPopupShellVariant = "anchored" | "floating";

type WidgetPopupShellProps = {
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  id: string;
  isOpen: boolean;
  onRequestClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  titleId: string;
  variant?: WidgetPopupShellVariant;
};

export function WidgetPopupShell({
  anchorRef,
  children,
  id,
  isOpen,
  onRequestClose,
  returnFocusRef,
  titleId,
  variant = "anchored",
}: WidgetPopupShellProps) {
  return (
    <PopupShell
      anchorRef={anchorRef}
      id={id}
      isOpen={isOpen}
      labelId={titleId}
      onRequestClose={onRequestClose}
      returnFocusRef={returnFocusRef}
      variant={variant}
    >
      {children}
    </PopupShell>
  );
}
