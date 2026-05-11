import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { Panel } from "./Panel";

export type WidgetFrameLogEntry = {
  id: string;
  createdAt: string;
  level: string;
  message: string;
  runId?: string | null;
};

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
  const [logEntries, setLogEntries] = useState<WidgetFrameLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logErrorMessage, setLogErrorMessage] = useState<string | null>(null);
  const loadLogsRef = useRef(onLoadLogs);

  useEffect(() => {
    loadLogsRef.current = onLoadLogs;
  }, [onLoadLogs]);

  useEffect(() => {
    if (!isLogPanelOpen) {
      return;
    }

    let shouldUpdate = true;

    async function loadLogs() {
      setIsLoadingLogs(true);
      setLogErrorMessage(null);

      try {
        const logs = loadLogsRef.current ? await loadLogsRef.current() : [];

        if (shouldUpdate) {
          setLogEntries(logs);
        }
      } catch (error) {
        if (shouldUpdate) {
          setLogEntries([]);
          setLogErrorMessage(errorToMessage(error));
        }
      } finally {
        if (shouldUpdate) {
          setIsLoadingLogs(false);
        }
      }
    }

    void loadLogs();

    return () => {
      shouldUpdate = false;
    };
  }, [isLogPanelOpen, logRefreshToken]);

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

  return (
    <Panel className={frameClassName} style={style}>
      <header className={headerClassName} onPointerDown={startMove}>
        <div className="widget-heading">
          <div className="widget-title-row">
            <h2 className="widget-title">{title}</h2>
            {status ? <div className="widget-status">{status}</div> : null}
          </div>
          {subtitle ? <p className="widget-subtitle">{subtitle}</p> : null}
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
          <WidgetLogPanelBody
            errorMessage={logErrorMessage}
            isLoading={isLoadingLogs}
            logs={logEntries}
          />
        </section>
      ) : null}
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

type WidgetLogPanelBodyProps = {
  errorMessage: string | null;
  isLoading: boolean;
  logs: WidgetFrameLogEntry[];
};

function WidgetLogPanelBody({
  errorMessage,
  isLoading,
  logs,
}: WidgetLogPanelBodyProps) {
  if (isLoading) {
    return <p className="widget-log-placeholder">Loading widget logs...</p>;
  }

  if (errorMessage) {
    return (
      <p className="widget-log-placeholder" role="alert">
        {errorMessage}
      </p>
    );
  }

  if (logs.length === 0) {
    return <p className="widget-log-placeholder">No widget logs yet.</p>;
  }

  return (
    <ol className="widget-log-list">
      {logs.map((log) => (
        <li className="widget-log-item" key={log.id}>
          <div className="widget-log-meta">
            <time dateTime={logDateTimeValue(log.createdAt)}>
              {formatLogTime(log.createdAt)}
            </time>
            <span>{log.level}</span>
            {log.runId ? <span>Run {log.runId}</span> : null}
          </div>
          <p className="widget-log-message">{log.message}</p>
        </li>
      ))}
    </ol>
  );
}

function formatLogTime(value: string) {
  const date = parseLogDate(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function logDateTimeValue(value: string) {
  return parseLogDate(value)?.toISOString() ?? value;
}

function parseLogDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numericTimestamp = Number(trimmedValue);
  const date = Number.isFinite(numericTimestamp)
    ? new Date(numericTimestamp * 1000)
    : new Date(trimmedValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Widget logs could not be loaded.";
}
