import {
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "./Button";
import { WidgetPopupShell } from "./WidgetPopupShell";

export type ActionMenuItem = {
  readonly danger?: boolean;
  readonly disabledReason?: string | null;
  readonly id: string;
  readonly label: string;
  readonly onSelect: (sourceButton?: HTMLButtonElement | null) => void;
};

type TopbarGroupProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly "data-group"?: string;
  readonly label: string;
  readonly priority?: "primary" | "secondary";
};

type RowActionMenuProps = {
  readonly buttonLabel?: string;
  readonly className?: string;
  readonly items: readonly ActionMenuItem[];
  readonly label: string;
  readonly menuClassName?: string;
  readonly triggerClassName?: string;
};

type ActionMenuProps = {
  readonly className?: string;
  readonly items: readonly ActionMenuItem[];
  readonly label: string;
  readonly onRequestClose?: () => void;
  readonly sourceButton?: HTMLButtonElement | null;
};

type DestructiveConfirmationPopupProps = {
  readonly ariaLabel?: string;
  readonly body: ReactNode;
  readonly cancelLabel?: string;
  readonly className?: string;
  readonly confirmLabel: string;
  readonly id: string;
  readonly isConfirming?: boolean;
  readonly isOpen: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly title: ReactNode;
  readonly titleId?: string;
};

export function TopbarGroup({
  children,
  className,
  "data-group": dataGroup,
  label,
  priority = "secondary",
}: TopbarGroupProps) {
  return (
    <div
      aria-label={label}
      className={[
        "ui-topbar-group",
        `ui-topbar-group-${priority}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-group={dataGroup}
      role="group"
    >
      {children}
    </div>
  );
}

export function RowActionMenu({
  buttonLabel = "More",
  className,
  items,
  label,
  menuClassName,
  triggerClassName,
}: RowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <span className={["ui-row-actions", className ?? ""].filter(Boolean).join(" ")}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={label}
        className={["ui-row-action-trigger", triggerClassName ?? ""]
          .filter(Boolean)
          .join(" ")}
        ref={triggerRef}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        title={label}
        type="button"
      >
        {buttonLabel}
      </button>
      {isOpen ? (
        <ActionMenu
          className={menuClassName}
          items={items}
          label={label.replace(/^More actions/, "Action menu")}
          onRequestClose={() => setIsOpen(false)}
          sourceButton={triggerRef.current}
        />
      ) : null}
    </span>
  );
}

export function ActionMenu({
  className,
  items,
  label,
  onRequestClose,
  sourceButton,
}: ActionMenuProps) {
  return (
    <span
      aria-label={label}
      className={["ui-action-menu", className ?? ""].filter(Boolean).join(" ")}
      onClick={(event) => event.stopPropagation()}
      role="menu"
    >
      {items.map((item) => (
        <ActionMenuEntry
          item={item}
          key={item.id}
          onRequestClose={onRequestClose}
          sourceButton={sourceButton}
        />
      ))}
    </span>
  );
}

function ActionMenuEntry({
  item,
  onRequestClose,
  sourceButton,
}: {
  readonly item: ActionMenuItem;
  readonly onRequestClose?: () => void;
  readonly sourceButton?: HTMLButtonElement | null;
}) {
  const disabled = Boolean(item.disabledReason);

  return (
    <span className="ui-action-menu-item">
      <button
        className={item.danger ? "ui-action-menu-item-danger" : undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          item.onSelect(sourceButton);
          onRequestClose?.();
        }}
        role="menuitem"
        title={item.disabledReason ?? undefined}
        type="button"
      >
        {item.label}
      </button>
      <DisabledActionReason reason={item.disabledReason} />
    </span>
  );
}

export function DisabledActionReason({ reason }: { readonly reason?: string | null }) {
  return reason ? <small className="ui-disabled-action-reason">{reason}</small> : null;
}

export function DestructiveConfirmationPopup({
  ariaLabel,
  body,
  cancelLabel = "Cancel",
  className,
  confirmLabel,
  id,
  isConfirming = false,
  isOpen,
  onCancel,
  onConfirm,
  returnFocusRef,
  title,
  titleId,
}: DestructiveConfirmationPopupProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;

  return (
    <WidgetPopupShell
      bodyClassName="ui-destructive-confirmation-body"
      className={["ui-destructive-confirmation-shell", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      footer={
        <div className="ui-destructive-confirmation-footer">
          <Button disabled={isConfirming} onClick={onCancel} variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            disabled={isConfirming}
            onClick={onConfirm}
            variant="danger"
          >
            {isConfirming ? `${confirmLabel}...` : confirmLabel}
          </Button>
        </div>
      }
      id={id}
      isOpen={isOpen}
      onRequestClose={onCancel}
      returnFocusRef={returnFocusRef}
      title={title}
      titleId={resolvedTitleId}
      variant="floating"
    >
      <section
        aria-label={ariaLabel ?? `${String(title)} confirmation`}
        className="ui-destructive-confirmation"
      >
        {body}
      </section>
    </WidgetPopupShell>
  );
}

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  readonly disabledReason?: string | null;
};
