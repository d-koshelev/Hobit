import type { HTMLAttributes, ReactNode } from "react";

type ToolbarProps = HTMLAttributes<HTMLElement> & {
  readonly children: ReactNode;
};

export function Toolbar({ children, className, ...props }: ToolbarProps) {
  return (
    <section className={["ui-toolbar", className].filter(Boolean).join(" ")} role="toolbar" {...props}>
      {children}
    </section>
  );
}

