import {
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useId,
} from "react";

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
  readonly error?: ReactNode;
  readonly helperText?: ReactNode;
  readonly id?: string;
  readonly label?: ReactNode;
  readonly required?: boolean;
};

type DescribedProps = {
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
  readonly id?: string;
};

export function Field({
  children,
  className,
  error,
  helperText,
  id,
  label,
  required = false,
  ...props
}: FieldProps) {
  const autoId = useId();
  const resolvedId = id ?? autoId;
  const childId =
    isValidElement(children) && "id" in (children as ReactElement<DescribedProps>).props
      ? (children as ReactElement<DescribedProps>).props.id
      : undefined;
  const controlId = childId ?? resolvedId;
  const helperId = helperText ? `${resolvedId}-helper` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldClasses = ["ui-field", className].filter(Boolean).join(" ");
  const ariaInvalid = Boolean(error);
  const labelText = label ? (
    <span className="ui-field-label">
      {label}
      {required ? <span className="ui-required-indicator" aria-hidden="true"> *</span> : null}
    </span>
  ) : null;

  const enhancedControl =
    isValidElement(children)
      ? cloneElement(children as ReactElement<DescribedProps>, {
          id: controlId,
          ...(describedBy
            ? {
                "aria-describedby": mergeDescribedBy(
                  (children as ReactElement<DescribedProps>).props["aria-describedby"],
                  describedBy,
                ),
              }
            : undefined),
          ...(ariaInvalid
            ? {
                "aria-invalid": true,
              }
            : undefined),
        })
      : children;

  return (
    <div className={fieldClasses} {...props}>
      {label ? (
        <label className="ui-field-label-row" htmlFor={controlId}>
          {labelText}
        </label>
      ) : null}
      <div className="ui-field-control">{enhancedControl}</div>
      {helperText ? (
        <p className="ui-field-help" id={helperId}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className="ui-inline-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function mergeDescribedBy(
  existing?: string | undefined,
  additional?: string,
): string | undefined {
  if (!existing) {
    return additional;
  }

  if (!additional) {
    return existing;
  }

  const combined = [existing, additional]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter((entry, index, values) => entry && values.indexOf(entry) === index);

  return combined.join(" ");
}
