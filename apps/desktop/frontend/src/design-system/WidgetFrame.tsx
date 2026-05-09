import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import { Panel } from "./Panel";

type WidgetFrameProps = {
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
  status?: ReactNode;
  subtitle: string;
  title: string;
};

export function WidgetFrame({
  actions,
  children,
  footer,
  style,
  status,
  subtitle,
  title,
}: WidgetFrameProps) {
  const logPanelId = useId();
  const logPanelTitleId = useId();
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);

  return (
    <Panel className="widget-frame" style={style}>
      <header className="widget-header">
        <div className="widget-heading">
          <div className="widget-title-row">
            <h2 className="widget-title">{title}</h2>
            {status ? <div className="widget-status">{status}</div> : null}
          </div>
          <p className="widget-subtitle">{subtitle}</p>
        </div>
        <div className="widget-actions">
          {actions}
          <Button
            aria-controls={logPanelId}
            aria-expanded={isLogPanelOpen}
            onClick={() => setIsLogPanelOpen((current) => !current)}
            variant={isLogPanelOpen ? "secondary" : "ghost"}
          >
            Logs
          </Button>
        </div>
      </header>
      <div className="widget-content">{children}</div>
      {isLogPanelOpen ? (
        <section
          aria-labelledby={logPanelTitleId}
          className="widget-log-panel"
          id={logPanelId}
        >
          <h3 className="widget-log-title" id={logPanelTitleId}>
            Logs
          </h3>
          <p className="widget-log-placeholder">
            Widget logs will appear here when this widget emits activity.
          </p>
        </section>
      ) : null}
      {footer ? <footer className="widget-footer">{footer}</footer> : null}
    </Panel>
  );
}
