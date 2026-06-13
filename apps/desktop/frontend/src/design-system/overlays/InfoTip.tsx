import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PopupShell } from "./PopupShell";

type InfoTipProps = {
  children: ReactNode;
  interactive?: boolean;
  label: string;
  title?: ReactNode;
};

export function InfoTip({
  children,
  interactive = false,
  label,
  title,
}: InfoTipProps) {
  const contentId = useId();
  const popupId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const suppressFocusOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const popupLabelId = title ? titleId : contentId;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      closeTip({ focusTrigger: true });
      event.preventDefault();
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function closeTip({ focusTrigger = false }: { focusTrigger?: boolean } = {}) {
    setIsOpen(false);

    if (!focusTrigger) {
      return;
    }

    suppressFocusOpenRef.current = true;

    window.setTimeout(() => {
      triggerRef.current?.focus();
      suppressFocusOpenRef.current = false;
    }, 0);
  }

  function openTip() {
    if (suppressFocusOpenRef.current) {
      return;
    }

    setIsOpen(true);
  }

  function toggleTip() {
    setIsOpen((currentIsOpen) => !currentIsOpen);
  }

  function handleBlur() {
    if (interactive) {
      return;
    }

    setTimeout(() => {
      const popup = document.getElementById(popupId);
      const activeElement = document.activeElement;

      if (
        triggerRef.current?.contains(activeElement) ||
        (popup && popup.contains(activeElement))
      ) {
        return;
      }

      setIsOpen(false);
    }, 0);
  }

  return (
    <span className="ui-info-tip" data-widget-header-drag-ignore>
      <button
        aria-controls={popupId}
        aria-expanded={isOpen}
        aria-haspopup={interactive ? "dialog" : "true"}
        aria-describedby={isOpen ? contentId : undefined}
        aria-label={label}
        className="ui-info-tip-trigger"
        onBlur={handleBlur}
        onClick={toggleTip}
        onFocus={openTip}
        onMouseEnter={openTip}
        onMouseOver={openTip}
        onPointerEnter={openTip}
        onPointerOver={openTip}
        onMouseLeave={interactive ? undefined : () => closeTip()}
        ref={triggerRef}
        type="button"
      >
        i
      </button>
      <PopupShell
        anchorRef={triggerRef}
        className="ui-info-tip-shell"
        id={popupId}
        isOpen={isOpen}
        labelId={popupLabelId}
        onRequestClose={() => closeTip()}
      >
        <section className="ui-info-tip-popover">
          {title ? (
            <h3 className="ui-info-tip-title" id={titleId}>
              {title}
            </h3>
          ) : null}
          <div className="ui-info-tip-content" id={contentId}>
            {typeof children === "string" ? <p>{children}</p> : children}
          </div>
        </section>
      </PopupShell>
    </span>
  );
}
