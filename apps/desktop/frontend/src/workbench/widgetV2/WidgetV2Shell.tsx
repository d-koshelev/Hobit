import {
  type ReactElement,
  type ReactNode,
  isValidElement,
} from "react";

import { InfoTip } from "../../design-system/overlays/InfoTip";
import type { WidgetV2StatusSummary } from "./widgetV2Types";

type WidgetV2HeaderInfo = {
  readonly content: ReactNode;
  readonly label: string;
  readonly title: string;
};

type WidgetV2HeaderProps = {
  readonly developerActions?: ReactNode;
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
  developerActions,
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
        developerActions={developerActions}
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
  developerActions,
  actions,
  info,
  status,
  subtitle,
  title,
}: WidgetV2HeaderProps) {
  const resolvedInfo = resolveHeaderInfo({ info, subtitle, title });
  const shouldRenderStatus = shouldRenderStatusSummary({
    info: resolvedInfo?.content,
    status,
    title,
  });

  return (
    <header className="widget-v2-header">
      <div className="widget-v2-heading">
        <div className="widget-v2-title-row">
          <h2 className="widget-v2-title">{title}</h2>
          {resolvedInfo ? (
            <InfoTip label={resolvedInfo.label} title={resolvedInfo.title}>
              {resolvedInfo.content}
            </InfoTip>
          ) : null}
          {shouldRenderStatus && status ? (
            <span
              className="widget-v2-status"
              data-tone={status.tone}
              aria-live="polite"
            >
              {status.label}
            </span>
          ) : null}
        </div>
      </div>
      {(resolvedInfo || actions || developerActions) && (
        <div className="widget-v2-header-actions">
          {actions}
          {developerActions ? (
            <span
              aria-label="Widget developer actions"
              className="widget-v2-developer-actions"
            >
              {developerActions}
            </span>
          ) : null}
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

function resolveHeaderInfo({
  info,
  subtitle,
  title,
}: {
  readonly info?: WidgetV2HeaderInfo;
  readonly subtitle?: ReactNode;
  readonly title: string;
}) {
  if (info) {
    return info;
  }

  if (!subtitle) {
    return null;
  }

  return {
    content: subtitle,
    label: "Widget information",
    title,
  };
}

function shouldRenderStatusSummary({
  info,
  status,
  title,
}: {
  readonly info?: ReactNode;
  readonly status?: WidgetV2StatusSummary;
  readonly title: string;
}) {
  if (!status?.label) {
    return false;
  }

  const normalizedLabel = normalizeText(extractText(status.label));

  if (!normalizedLabel || isStaticStatusLabel(normalizedLabel)) {
    return false;
  }

  const normalizedTitle = normalizeText(title);
  const normalizedInfo = normalizeText(extractText(info));

  if (
    normalizedLabel === normalizedTitle ||
    (normalizedTitle && includesToken(normalizedLabel, normalizedTitle)) ||
    (normalizedInfo && includesToken(normalizedLabel, normalizedInfo))
  ) {
    return false;
  }

  return true;
}

function isStaticStatusLabel(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }

  const staticWords = new Set([
    "current",
    "experimental",
    "executor",
    "mvp",
    "preview",
  ]);

  return words.every((word) => staticWords.has(word));
}

function includesToken(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  return haystack.includes(needle) || needle.includes(haystack);
}

function normalizeText(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join(" ");
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return extractText(element.props.children);
  }

  return "";
}
