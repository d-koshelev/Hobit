import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PopupShell } from "./PopupShell";

type WidgetInfoButtonProps = {
  "aria-label"?: string;
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  onClick?: () => void;
  title?: string;
};

type WidgetInfoPopoverProps = {
  children: ReactNode;
  label: string;
  title: string;
};

export const WidgetInfoButton = forwardRef<
  HTMLButtonElement,
  WidgetInfoButtonProps
>(function WidgetInfoButton({
  "aria-label": ariaLabel = "Widget information",
  "aria-controls": ariaControls,
  "aria-expanded": ariaExpanded,
  onClick,
  title = "Widget information",
}, ref) {
  return (
    <button
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      className="widget-info-button"
      onClick={onClick}
      ref={ref}
      title={title}
      type="button"
    >
      i
    </button>
  );
});

export function WidgetInfoPopover({
  children,
  label,
  title,
}: WidgetInfoPopoverProps) {
  const popupId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="widget-info" data-widget-header-drag-ignore>
      <WidgetInfoButton
        aria-controls={popupId}
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => setIsOpen((current) => !current)}
        title={label}
        ref={buttonRef}
      />
      <PopupShell
        anchorRef={buttonRef}
        id={popupId}
        isOpen={isOpen}
        labelId={titleId}
        onRequestClose={() => setIsOpen(false)}
        returnFocusRef={buttonRef}
      >
        <section className="widget-info-popover">
          <h3 data-popup-drag-handle id={titleId}>
            {title}
          </h3>
          <div className="widget-info-popover-content">{children}</div>
        </section>
      </PopupShell>
    </div>
  );
}
