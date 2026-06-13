import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  const classes = ["ui-textarea", className].filter(Boolean).join(" ");

  return <textarea className={classes} {...props} />;
}

