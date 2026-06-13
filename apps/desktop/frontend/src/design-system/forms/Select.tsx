import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  const classes = ["select", className].filter(Boolean).join(" ");

  return <select className={classes} {...props} />;
}
