import type { ReactNode } from "react";
import { Button } from "../design-system/Button";

type StaticPreviewItem = {
  label: ReactNode;
};

type StaticPreviewField = StaticPreviewItem & {
  value: ReactNode;
};

type StaticPreviewFieldListProps = {
  className: string;
  fieldClassName: string;
  fields: readonly StaticPreviewField[];
  labelClassName: string;
  valueClassName: string;
};

export function StaticPreviewFieldList({
  className,
  fieldClassName,
  fields,
  labelClassName,
  valueClassName,
}: StaticPreviewFieldListProps) {
  return (
    <dl className={className}>
      {fields.map((field, index) => (
        <div className={fieldClassName} key={staticPreviewKey(field, index)}>
          <dt className={labelClassName}>{field.label}</dt>
          <dd className={valueClassName}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type StaticPreviewPlannedActionsProps = {
  actions: readonly StaticPreviewItem[];
  ariaLabel?: string;
  className: string;
};

export function StaticPreviewPlannedActions({
  actions,
  ariaLabel,
  className,
}: StaticPreviewPlannedActionsProps) {
  return (
    <div aria-label={ariaLabel} className={className}>
      {actions.map((action, index) => (
        <Button
          disabled
          key={staticPreviewKey(action, index)}
          variant="secondary"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function staticPreviewKey(item: StaticPreviewItem, index: number) {
  return typeof item.label === "string" ? item.label : index;
}
