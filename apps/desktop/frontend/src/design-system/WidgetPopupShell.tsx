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
  onRequestClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title?: ReactNode;
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
  onRequestClose,
  returnFocusRef,
  title,
  titleId,
  variant = "anchored",
}: WidgetPopupShellProps) {
  const usesStandardLayout =
    title !== undefined ||
    eyebrow !== undefined ||
    actions !== undefined ||
    footer !== undefined ||
    bodyClassName !== undefined ||
    headerClassName !== undefined ||
    footerClassName !== undefined;

  return (
    <PopupShell
      anchorRef={anchorRef}
      className={[
        usesStandardLayout ? "popup-shell-with-layout" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      id={id}
      isOpen={isOpen}
      labelId={titleId}
      onRequestClose={onRequestClose}
      returnFocusRef={returnFocusRef}
      variant={variant}
    >
      {usesStandardLayout ? (
        <div className="popup-shell-layout">
          {title !== undefined || eyebrow !== undefined || actions !== undefined ? (
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
                {title !== undefined ? (
                  <h3 className="popup-shell-title" id={titleId}>
                    {title}
                  </h3>
                ) : null}
              </div>
              {actions ? (
                <div className="popup-shell-header-actions" data-popup-no-drag>
                  {actions}
                </div>
              ) : null}
            </header>
          ) : null}
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
      ) : (
        children
      )}
    </PopupShell>
  );
}
