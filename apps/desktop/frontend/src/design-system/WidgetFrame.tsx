import {
  useId,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { Panel } from "./Panel";
import {
  WidgetLogsPanel,
  type WidgetLogsPanelLogEntry,
} from "./WidgetLogsPanel";

export type WidgetFrameLogEntry = WidgetLogsPanelLogEntry;

type WidgetFrameProps = {
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  logRefreshToken?: number;
  moveEnabled?: boolean;
  onMoveStart?: (pointerX: number, pointerY: number) => void;
  onLoadLogs?: () => Promise<WidgetFrameLogEntry[]>;
  style?: CSSProperties;
  status?: ReactNode;
  subtitle?: string;
  title: string;
};

export function WidgetFrame({
  actions,
  children,
  footer,
  logRefreshToken,
  moveEnabled = false,
  onMoveStart,
  onLoadLogs,
  style,
  status,
  subtitle,
  title,
}: WidgetFrameProps) {
  const logPanelId = useId();
  const logPanelTitleId = useId();
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);

  function startMove(event: ReactPointerEvent<HTMLElement>) {
    if (
      !moveEnabled ||
      !onMoveStart ||
      !event.isPrimary ||
      event.button !== 0 ||
      isInteractiveHeaderTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    onMoveStart(event.clientX, event.clientY);
  }

  const frameClassName = moveEnabled
    ? "widget-frame widget-frame-editing"
    : "widget-frame";
  const headerClassName = moveEnabled
    ? "widget-header widget-header-movable"
    : "widget-header";
  const titleHint = subtitle ? `${title} - ${subtitle}` : title;

  return (
    <Panel className={frameClassName} style={style}>
      <header className={headerClassName} onPointerDown={startMove}>
        <div className="widget-heading">
          <div className="widget-title-row">
            <h2
              aria-label={subtitle ? `${title}. ${subtitle}` : undefined}
              className="widget-title"
              title={titleHint}
            >
              {title}
            </h2>
            {status ? <div className="widget-status">{status}</div> : null}
          </div>
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
      <WidgetLogsPanel
        id={logPanelId}
        isOpen={isLogPanelOpen}
        logRefreshToken={logRefreshToken}
        onLoadLogs={onLoadLogs}
        titleId={logPanelTitleId}
      />
      {footer ? <footer className="widget-footer">{footer}</footer> : null}
    </Panel>
  );
}

function isInteractiveHeaderTarget(target: EventTarget) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        ".widget-actions",
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "summary",
        "[contenteditable='true']",
        "[data-widget-header-drag-ignore]",
        "[role='button']",
        "[role='link']",
      ].join(","),
    ),
  );
}
