import type { HTMLAttributes, ReactNode } from "react";

type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly title?: ReactNode;
};

export function SectionHeader({
  actions,
  children,
  className,
  subtitle,
  title,
  ...props
}: SectionHeaderProps) {
  const headerClasses = ["ui-section-header", className].filter(Boolean).join(" ");

  return (
    <header className={headerClasses} {...props}>
      <div className="ui-section-header-copy">
        {title ? <h2 className="ui-section-title">{title}</h2> : null}
        {subtitle ? <p className="ui-section-subtitle">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="ui-section-actions">{actions}</div> : null}
    </header>
  );
}

