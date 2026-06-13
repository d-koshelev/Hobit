import { type ReactNode, type RefObject, useId } from "react";

import { Button } from "../actions/Button";
import { WidgetPopupShell } from "../overlays/WidgetPopupShell";

export type WidgetDebugPopupCopyDiagnostics = {
  readonly disabled?: boolean;
  readonly disabledReason?: string | null;
  readonly label?: string;
  readonly onCopy: () => void | Promise<void>;
};

type WidgetDebugPopupProps = {
  readonly anchorRef?: RefObject<HTMLElement | null>;
  readonly bodyClassName?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly copyDiagnostics?: WidgetDebugPopupCopyDiagnostics;
  readonly footer?: ReactNode;
  readonly id?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly title: ReactNode;
  readonly titleId?: string;
};

export function WidgetDebugPopup({
  anchorRef,
  bodyClassName,
  children,
  className,
  copyDiagnostics,
  footer,
  id,
  onClose,
  open,
  returnFocusRef,
  title,
  titleId,
}: WidgetDebugPopupProps) {
  const generatedId = useId();
  const popupId = id ?? `${generatedId}-widget-debug-popup`;
  const popupTitleId = titleId ?? `${generatedId}-widget-debug-popup-title`;

  return (
    <WidgetPopupShell
      actions={
        <div className="widget-debug-popup-actions">
          {copyDiagnostics ? (
            <Button
              disabled={copyDiagnostics.disabled}
              onClick={() => {
                void copyDiagnostics.onCopy();
              }}
              title={copyDiagnostics.disabledReason ?? undefined}
              variant="ghost"
            >
              {copyDiagnostics.label ?? "Copy diagnostics"}
            </Button>
          ) : null}
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
      }
      anchorRef={anchorRef}
      bodyClassName={["widget-debug-popup-body", bodyClassName ?? ""]
        .filter(Boolean)
        .join(" ")}
      className={["widget-debug-popup", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      eyebrow="Developer details"
      footer={footer}
      footerClassName="widget-debug-popup-footer"
      id={popupId}
      isOpen={open}
      onRequestClose={onClose}
      returnFocusRef={returnFocusRef}
      title={title}
      titleId={popupTitleId}
      variant="floating"
    >
      {children}
    </WidgetPopupShell>
  );
}
