import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  const classes = ["input", className].filter(Boolean).join(" ");

  return <input className={classes} {...props} />;
}
