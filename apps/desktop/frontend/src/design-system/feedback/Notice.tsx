import type { HTMLAttributes, ReactNode } from "react";

type NoticeVariant = "info" | "error" | "success" | "warning";

type NoticeProps = HTMLAttributes<HTMLElement> & {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly variant?: NoticeVariant;
};

export function Notice({
  children,
  className,
  title,
  variant = "info",
  ...props
}: NoticeProps) {
  const classes = ["ui-notice", `ui-notice-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} role={variant === "error" ? "alert" : "status"} {...props}>
      {title ? <h3 className="ui-notice-title">{title}</h3> : null}
      <p className="ui-notice-message">{children}</p>
    </section>
  );
}

