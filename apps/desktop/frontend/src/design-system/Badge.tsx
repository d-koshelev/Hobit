import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

export function Badge({
  children,
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  const classes = ["badge", `badge-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
