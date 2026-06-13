import {
  forwardRef,
  type ReactNode,
} from "react";
import { InfoTip } from "./InfoTip";

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
  return (
    <div className="widget-info">
      <InfoTip label={label} title={title}>
        {children}
      </InfoTip>
    </div>
  );
}
