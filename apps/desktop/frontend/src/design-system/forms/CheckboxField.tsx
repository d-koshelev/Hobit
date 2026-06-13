import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { Field } from "./Field";

type CheckboxFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "id" | "type"
> & {
  readonly error?: ReactNode;
  readonly helperText?: ReactNode;
  readonly id?: string;
  readonly label?: ReactNode;
  readonly required?: boolean;
};

export function CheckboxField({
  id,
  label,
  required,
  error,
  helperText,
  className,
  ...props
}: CheckboxFieldProps) {
  const autoId = useId();
  const resolvedId = id ?? autoId;

  return (
    <Field
      className={["ui-checkbox-field", className].filter(Boolean).join(" ")}
      error={error}
      helperText={helperText}
      id={resolvedId}
      label={label}
      required={required}
    >
      <input
        className="ui-checkbox-input"
        id={resolvedId}
        {...props}
        type="checkbox"
      />
    </Field>
  );
}

