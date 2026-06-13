import { useId } from "react";
import { type ReactNode, type SelectHTMLAttributes } from "react";

import { Field, type FieldProps } from "./Field";
import { Select } from "./Select";

type SelectFieldProps = Omit<
  FieldProps,
  "children" | "error" | "helperText" | "id" | "label" | "required"
> &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "id" | "aria-describedby"> & {
    readonly children: ReactNode;
    readonly error?: ReactNode;
    readonly helperText?: ReactNode;
    readonly id?: string;
    readonly label?: ReactNode;
    readonly required?: boolean;
  };

export function SelectField({
  children,
  className,
  error,
  helperText,
  id,
  label,
  required,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const resolvedId = id ?? autoId;

  return (
    <Field
      error={error}
      helperText={helperText}
      id={resolvedId}
      label={label}
      required={required}
    >
      <Select
        className={["ui-select-control", className].filter(Boolean).join(" ")}
        id={resolvedId}
        {...props}
      >
        {children}
      </Select>
    </Field>
  );
}
