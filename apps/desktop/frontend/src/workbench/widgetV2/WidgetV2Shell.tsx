import type { ReactNode } from "react";

import { WidgetInfoPopover } from "../../design-system/WidgetInfoPopover";
import type { WidgetV2StatusSummary } from "./widgetV2Types";

type WidgetV2HeaderInfo = {
  readonly content: ReactNode;
  readonly label: string;
  readonly title: string;
};

type WidgetV2HeaderProps = {
  readonly actions?: ReactNode;
  readonly info?: WidgetV2HeaderInfo;
  readonly status?: WidgetV2StatusSummary;
  readonly subtitle?: ReactNode;
  readonly title: string;
};

type WidgetV2ShellProps = WidgetV2HeaderProps & {
  readonly children: ReactNode;
};

type WidgetV2SlotProps = {
  readonly children: ReactNode;
  readonly label?: string;
};

type WidgetV2PanelLayoutProps = {
  readonly bottomDrawer?: ReactNode;
  readonly leftRail?: ReactNode;
  readonly primary: ReactNode;
  readonly primaryLabel?: string;
  readonly rightInspector?: ReactNode;
};

export function WidgetV2Shell({
  actions,
  children,
  info,
  status,
  subtitle,
  title,
}: WidgetV2ShellProps) {
  return (
    <section className="widget-v2-shell" data-widget-v2-shell>
      <WidgetV2Header
        actions={actions}
        info={info}
        status={status}
        subtitle={subtitle}
        title={title}
      />
      <div className="widget-v2-shell-body">{children}</div>
    </section>
  );
}

export function WidgetV2Header({
  actions,
  info,
  status,
  subtitle,
  title,
}: WidgetV2HeaderProps) {
  const statusTone = status?.tone ?? "neutral";

  return (
    <header className="widget-v2-header">
      <div className="widget-v2-heading">
        <div className="widget-v2-title-row">
          <h2 className="widget-v2-title">{title}</h2>
          {status ? (
            <span
              className="widget-v2-status"
              data-tone={statusTone}
              title={status.detail}
            >
              {status.label}
            </span>
          ) : null}
        </div>
        {subtitle ? <div className="widget-v2-subtitle">{subtitle}</div> : null}
      </div>
      {(info || actions) && (
        <div className="widget-v2-header-actions">
          {info ? (
            <WidgetInfoPopover label={info.label} title={info.title}>
              {info.content}
            </WidgetInfoPopover>
          ) : null}
          {actions}
        </div>
      )}
    </header>
  );
}

export function WidgetV2Toolbar({
  children,
  label = "Widget actions",
}: WidgetV2SlotProps) {
  return (
    <div
      aria-label={label}
      className="widget-v2-toolbar ui-control-group-gap-min"
      role="toolbar"
    >
      {children}
    </div>
  );
}

export function WidgetV2PanelLayout({
  bottomDrawer,
  leftRail,
  primary,
  primaryLabel = "Primary widget surface",
  rightInspector,
}: WidgetV2PanelLayoutProps) {
  const layoutClassName = [
    "widget-v2-panel-layout",
    leftRail ? "widget-v2-panel-layout-has-left" : "",
    rightInspector ? "widget-v2-panel-layout-has-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClassName}>
      <div className="widget-v2-panel-main">
        {leftRail}
        <section
          aria-label={primaryLabel}
          className="widget-v2-primary-surface ui-surface-inset-min"
          data-widget-v2-slot="primary"
          role="region"
        >
          {primary}
        </section>
        {rightInspector}
      </div>
      {bottomDrawer}
    </div>
  );
}

export function WidgetV2LeftRail({
  children,
  label = "Widget navigation",
}: WidgetV2SlotProps) {
  return (
    <aside
      aria-label={label}
      className="widget-v2-left-rail ui-surface-inset-min"
      data-widget-v2-slot="left-rail"
      role="complementary"
    >
      {children}
    </aside>
  );
}

export function WidgetV2RightInspector({
  children,
  label = "Widget inspector",
}: WidgetV2SlotProps) {
  return (
    <aside
      aria-label={label}
      className="widget-v2-right-inspector ui-surface-inset-min"
      data-widget-v2-slot="right-inspector"
      role="complementary"
    >
      {children}
    </aside>
  );
}

export function WidgetV2BottomDrawer({
  children,
  label = "Widget drawer",
}: WidgetV2SlotProps) {
  return (
    <section
      aria-label={label}
      className="widget-v2-bottom-drawer ui-surface-inset-min"
      data-widget-v2-slot="bottom-drawer"
      role="region"
    >
      {children}
    </section>
  );
}
