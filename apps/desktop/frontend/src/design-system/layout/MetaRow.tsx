import type { HTMLAttributes, ReactNode } from "react";

type MetaRowProps = HTMLAttributes<HTMLDivElement> & {
  readonly compact?: boolean;
  readonly label: ReactNode;
  readonly value: ReactNode;
};

export function MetaRow({
  compact = false,
  label,
  value,
  className,
  ...props
}: MetaRowProps) {
  const rowClasses = ["ui-meta-row-wrap", className].filter(Boolean).join(" ");

  return (
    <div className={rowClasses} {...props}>
      <span className="ui-meta-label">{label}</span>
      <span className={["ui-meta-value", compact ? "ui-meta-value-compact" : ""].filter(Boolean).join(" ")}>
        {value}
      </span>
   </div>
  );
}
