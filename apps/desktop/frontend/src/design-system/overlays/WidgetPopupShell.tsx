import { type ReactNode, type RefObject } from "react";
import { PopupShell } from "./PopupShell";

type WidgetPopupShellVariant = "anchored" | "floating";

type WidgetPopupShellProps = {
  actions?: ReactNode;
  anchorRef?: RefObject<HTMLElement | null>;
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  headerClassName?: string;
  id: string;
  isOpen: boolean;
  minResizeHeight?: number;
  minResizeWidth?: number;
  onRequestClose: () => void;
  resizable?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: ReactNode;
  titleId: string;
  variant?: WidgetPopupShellVariant;
};

export function WidgetPopupShell({
  actions,
  anchorRef,
  bodyClassName,
  children,
  className,
  eyebrow,
  footer,
  footerClassName,
  headerClassName,
  id,
  isOpen,
  minResizeHeight,
  minResizeWidth,
  onRequestClose,
  resizable,
  returnFocusRef,
  title,
  titleId,
  variant = "anchored",
}: WidgetPopupShellProps) {
  return (
    <PopupShell
      anchorRef={anchorRef}
      className={["popup-shell-with-layout", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      id={id}
      isOpen={isOpen}
      labelId={titleId}
      minResizeHeight={minResizeHeight}
      minResizeWidth={minResizeWidth}
      onRequestClose={onRequestClose}
      resizable={resizable}
      returnFocusRef={returnFocusRef}
      variant={variant}
    >
      <div className="popup-shell-layout">
        <header
          className={[
            "popup-shell-header",
            "ui-popup-section-padding-min",
            headerClassName ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-popup-drag-handle
        >
          <div className="popup-shell-title-block">
            {eyebrow ? <p className="popup-shell-eyebrow">{eyebrow}</p> : null}
            <h3 className="popup-shell-title" id={titleId}>
              {title}
            </h3>
          </div>
          {actions ? (
            <div className="popup-shell-header-actions" data-popup-no-drag>
              {actions}
            </div>
          ) : null}
        </header>
        <div
          className={[
            "popup-shell-body",
            "ui-popup-section-padding-min",
            bodyClassName ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-popup-body
        >
          {children}
        </div>
        {footer ? (
          <footer
            className={[
              "popup-shell-footer",
              "ui-popup-section-padding-min",
              "ui-control-group-gap-min",
              footerClassName ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-popup-no-drag
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </PopupShell>
  );
}
