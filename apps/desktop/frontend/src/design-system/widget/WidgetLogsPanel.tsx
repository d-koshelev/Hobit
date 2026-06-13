import { useEffect, useRef, useState, type RefObject } from "react";
import {
  RENDER_MEMORY_CAPS,
  capArrayToLast,
  cappedPreviewText,
} from "../../renderMemoryGuards";
import { WidgetPopupShell } from "../overlays/WidgetPopupShell";

export type WidgetLogsPanelLogEntry = {
  id: string;
  createdAt: string;
  level: string;
  message: string;
  runId?: string | null;
};

type WidgetLogsPanelProps = {
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  isOpen: boolean;
  logRefreshToken?: number;
  onClose: () => void;
  onLoadLogs?: () => Promise<WidgetLogsPanelLogEntry[]>;
  titleId: string;
};

export function WidgetLogsPanel({
  anchorRef,
  id,
  isOpen,
  logRefreshToken,
  onClose,
  onLoadLogs,
  titleId,
}: WidgetLogsPanelProps) {
  const [logEntries, setLogEntries] = useState<WidgetLogsPanelLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logErrorMessage, setLogErrorMessage] = useState<string | null>(null);
  const loadLogsRef = useRef(onLoadLogs);

  useEffect(() => {
    loadLogsRef.current = onLoadLogs;
  }, [onLoadLogs]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let shouldUpdate = true;

    async function loadLogs() {
      setIsLoadingLogs(true);
      setLogErrorMessage(null);

      try {
        const logs = loadLogsRef.current ? await loadLogsRef.current() : [];

        if (shouldUpdate) {
          setLogEntries(capArrayToLast(logs, RENDER_MEMORY_CAPS.widgetLogRows).items);
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
  }, [isOpen, logRefreshToken]);

  return (
    <WidgetPopupShell
      anchorRef={anchorRef}
      footer={
        <button className="button button-secondary" onClick={onClose} type="button">
          Close
        </button>
      }
      id={id}
      isOpen={isOpen}
      onRequestClose={onClose}
      returnFocusRef={anchorRef}
      title="Logs"
      titleId={titleId}
    >
      <WidgetLogPanelBody
        errorMessage={logErrorMessage}
        isLoading={isLoadingLogs}
        logs={logEntries}
      />
    </WidgetPopupShell>
  );
}

type WidgetLogPanelBodyProps = {
  errorMessage: string | null;
  isLoading: boolean;
  logs: WidgetLogsPanelLogEntry[];
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
      {logs.length >= RENDER_MEMORY_CAPS.widgetLogRows ? (
        <li className="widget-log-item">
          <p className="widget-log-message">
            Showing last {logs.length.toString()} events. Preview capped.
          </p>
        </li>
      ) : null}
      {logs.map((log) => (
        <li className="widget-log-item" key={log.id}>
          <div className="widget-log-meta">
            <time dateTime={logDateTimeValue(log.createdAt)}>
              {formatLogTime(log.createdAt)}
            </time>
            <span>{log.level}</span>
            {log.runId ? <span>Run {log.runId}</span> : null}
          </div>
          <p className="widget-log-message">
            {cappedPreviewText(
              log.message,
              RENDER_MEMORY_CAPS.widgetLogMessageChars,
            )}
          </p>
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
