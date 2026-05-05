import type { HTMLAttributes } from "react";

type StatusDotVariant = "neutral" | "success" | "warning" | "info";

type StatusDotProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: StatusDotVariant;
};

export function StatusDot({
  className,
  variant = "neutral",
  ...props
}: StatusDotProps) {
  const classes = ["status-dot", `status-dot-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} {...props} />;
}
