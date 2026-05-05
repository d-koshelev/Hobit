import type { ReactNode } from "react";
import { Panel } from "./Panel";

type WidgetFrameProps = {
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  status?: ReactNode;
  subtitle: string;
  title: string;
};

export function WidgetFrame({
  actions,
  children,
  footer,
  status,
  subtitle,
  title,
}: WidgetFrameProps) {
  return (
    <Panel className="widget-frame">
      <header className="widget-header">
        <div className="widget-header-main">
          <div className="widget-heading">
            <div className="widget-title-row">
              <h2 className="widget-title">{title}</h2>
              {status ? <div className="widget-status">{status}</div> : null}
            </div>
            <p className="widget-subtitle">{subtitle}</p>
          </div>
        </div>
        {actions ? <div className="widget-actions">{actions}</div> : null}
      </header>
      <div className="widget-content">{children}</div>
      {footer ? <footer className="widget-footer">{footer}</footer> : null}
    </Panel>
  );
}
