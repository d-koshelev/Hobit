import type { HTMLAttributes, ReactNode } from "react";

import { SectionHeader } from "./SectionHeader";

type SectionProps = HTMLAttributes<HTMLElement> & {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly compact?: boolean;
  readonly subtitle?: ReactNode;
  readonly title?: ReactNode;
};

export function Section({
  children,
  className,
  compact = false,
  actions,
  subtitle,
  title,
  ...props
}: SectionProps) {
  const sectionClasses = [
    "ui-section",
    compact ? "ui-section-compact" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClasses} {...props}>
      {title || subtitle || actions ? (
        <SectionHeader actions={actions} subtitle={subtitle} title={title} />
      ) : null}
      <div className="ui-section-body">{children}</div>
    </section>
  );
}

