import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export type ModuleHeaderStateTone =
  | "idle"
  | "active"
  | "running"
  | "completed"
  | "blocked"
  | "error"
  | "draft"
  | "disabled";

export type ModuleHeaderGroupSide = "left" | "right";

type ModuleShellProps = HTMLAttributes<HTMLElement> & {
  readonly bodyCollapsed?: boolean;
  readonly children: ReactNode;
};

type ModuleHeaderProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  readonly left: ReactNode;
  readonly right?: ReactNode;
};

type ModuleHeaderGroupProps = HTMLAttributes<HTMLDivElement> & {
  readonly children?: ReactNode;
  readonly side: ModuleHeaderGroupSide;
};

type ModuleHeaderTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  readonly children: ReactNode;
};

type ModuleHeaderStateProps = HTMLAttributes<HTMLSpanElement> & {
  readonly children: ReactNode;
  readonly tone: ModuleHeaderStateTone;
};

type ModuleHeaderActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly active?: boolean;
  readonly children: ReactNode;
};

type ModuleHeaderMinimizeProps = Omit<
  ModuleHeaderActionProps,
  "active" | "children"
> & {
  readonly collapsed: boolean;
  readonly collapseLabel?: string;
  readonly expandLabel?: string;
};

type ModuleBodyProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
  readonly collapsed?: boolean;
};

export const ModuleShell = forwardRef<HTMLElement, ModuleShellProps>(
  function ModuleShell(
    { bodyCollapsed = false, children, className, ...props },
    ref,
  ) {
    return (
      <section
        {...props}
        className={["module-shell", className].filter(Boolean).join(" ")}
        data-module-body-collapsed={bodyCollapsed ? "true" : "false"}
        ref={ref}
      >
        {children}
      </section>
    );
  },
);

export function ModuleHeader({
  className,
  left,
  right,
  ...props
}: ModuleHeaderProps) {
  return (
    <header
      {...props}
      className={["module-header", className].filter(Boolean).join(" ")}
    >
      <ModuleHeaderGroup side="left">{left}</ModuleHeaderGroup>
      <ModuleHeaderGroup side="right">{right}</ModuleHeaderGroup>
    </header>
  );
}

export function ModuleHeaderGroup({
  children,
  className,
  side,
  ...props
}: ModuleHeaderGroupProps) {
  return (
    <div
      {...props}
      className={[
        "module-header-group",
        `module-header-group-${side}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-module-header-group={side}
    >
      {children}
    </div>
  );
}

export function ModuleHeaderTitle({
  children,
  className,
  ...props
}: ModuleHeaderTitleProps) {
  return (
    <h2
      {...props}
      className={[
        "module-header-segment",
        "module-header-title",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </h2>
  );
}

export function ModuleHeaderState({
  children,
  className,
  tone,
  ...props
}: ModuleHeaderStateProps) {
  return (
    <span
      {...props}
      className={[
        "module-header-segment",
        "module-header-state",
        `module-header-state-${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-module-state-tone={tone}
    >
      {children}
    </span>
  );
}

export function ModuleHeaderAction({
  active = false,
  children,
  className,
  type = "button",
  ...props
}: ModuleHeaderActionProps) {
  return (
    <button
      {...props}
      className={[
        "module-header-segment",
        "module-header-action",
        active ? "module-header-action-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-active={active ? "true" : "false"}
      type={type}
    >
      {children}
    </button>
  );
}

export function ModuleHeaderMinimize({
  className,
  collapsed,
  collapseLabel = "Collapse module body",
  expandLabel = "Expand module body",
  title,
  ...props
}: ModuleHeaderMinimizeProps) {
  const defaultLabel = collapsed ? expandLabel : collapseLabel;
  const {
    "aria-label": ariaLabel,
    ...buttonProps
  } = props;

  return (
    <ModuleHeaderAction
      {...buttonProps}
      aria-expanded={!collapsed}
      aria-label={ariaLabel ?? defaultLabel}
      className={["module-header-minimize", className]
        .filter(Boolean)
        .join(" ")}
      title={title ?? defaultLabel}
    >
      <span
        aria-hidden="true"
        className="module-header-minimize-mark"
        data-collapsed={collapsed ? "true" : "false"}
      />
    </ModuleHeaderAction>
  );
}

export function ModuleBody({
  children,
  className,
  collapsed = false,
  hidden,
  ...props
}: ModuleBodyProps) {
  const isHidden = hidden || collapsed;

  return (
    <div
      {...props}
      className={["module-body", className].filter(Boolean).join(" ")}
      data-module-body-collapsed={collapsed ? "true" : "false"}
      hidden={isHidden}
    >
      {children}
    </div>
  );
}

export { ModuleRail, ModuleSplit, ModuleSplitRegion } from "./ModuleSplit";
export type {
  ModuleRailOrientation,
  ModuleSplitRegionKind,
} from "./ModuleSplit";
