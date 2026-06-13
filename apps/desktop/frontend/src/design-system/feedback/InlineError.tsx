import type { HTMLAttributes, ReactNode } from "react";

type InlineErrorProps = Omit<
  HTMLAttributes<HTMLParagraphElement>,
  "children"
> & {
  readonly children: ReactNode;
};

export function InlineError({ children, className, ...props }: InlineErrorProps) {
  const classes = ["ui-inline-error", className].filter(Boolean).join(" ");

  return (
    <p {...props} className={classes} role="alert">
      {children}
    </p>
  );
}

