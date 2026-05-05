import type { ReactNode } from "react";
import { Panel } from "./Panel";

type WidgetFrameProps = {
  actions?: ReactNode;
  children: ReactNode;
  status?: ReactNode;
  subtitle: string;
  title: string;
};

export function WidgetFrame({
  actions,
  children,
  status,
  subtitle,
  title,
}: WidgetFrameProps) {
  return (
    <Panel className="widget-frame">
      <header className="widget-header">
        <div className="widget-heading">
          <div className="widget-title-row">
            <h2 className="widget-title">{title}</h2>
            {status}
          </div>
          <p className="widget-subtitle">{subtitle}</p>
        </div>
        {actions ? <div className="widget-actions">{actions}</div> : null}
      </header>
      <div className="widget-content">{children}</div>
    </Panel>
  );
}
