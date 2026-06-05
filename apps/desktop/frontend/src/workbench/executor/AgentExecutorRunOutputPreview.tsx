import { useState, type ReactNode } from "react";
import type { WidgetLogEntry } from "../../workspace/types";
import {
  RENDER_MEMORY_CAPS,
  capArrayToLast,
  cappedPreviewText,
  cappedRawDetailsText,
} from "../../renderMemoryGuards";
import { AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT } from "./agentExecutorRunHistoryTypes";
import {
  formatTimestamp,
} from "./agentExecutorRunHistoryFormatters";

export function AgentExecutorRunOutputBlock({
  action,
  label,
  value,
}: {
  action?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="codex-direct-work-final-message">
      <div className="codex-direct-work-output-header">
        <span className="codex-direct-work-result-label">{label}</span>
        {action}
      </div>
      <pre className="codex-direct-work-output">
        <code>
          {cappedPreviewText(
            value,
            AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT,
            "Preview capped",
          )}
        </code>
      </pre>
    </div>
  );
}

export function AgentExecutorRunOutputDetails({
  action,
  label,
  value,
}: {
  action?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <LazyDetails
      className="codex-direct-work-output-details"
      summary={
        <span>{label}</span>
      }
      summaryAction={action}
    >
      <pre className="codex-direct-work-output">
        <code>
          {cappedPreviewText(
            value,
            AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT,
            label.toLowerCase().includes("raw")
              ? "Raw details capped"
              : "Preview capped",
          )}
        </code>
      </pre>
    </LazyDetails>
  );
}

export function AgentExecutorRunLogs({
  logs,
  totalCount,
}: {
  logs: WidgetLogEntry[];
  totalCount: number;
}) {
  const cappedLogs = capArrayToLast(logs, RENDER_MEMORY_CAPS.widgetLogRows);

  return (
    <LazyDetails
      className="codex-direct-work-output-details"
      summary={
        <>
          Logs{" "}
          {totalCount > cappedLogs.items.length
            ? `last ${cappedLogs.items.length} of ${totalCount}`
            : totalCount}
        </>
      }
    >
      {cappedLogs.hiddenCount > 0 ? (
        <p className="codex-direct-work-review-note">
          Showing last {cappedLogs.items.length.toString()} events. Preview
          capped.
        </p>
      ) : null}
      {logs.length === 0 ? (
        <p className="codex-direct-work-review-note">No logs captured.</p>
      ) : (
        <div className="agent-executor-history-log-list" role="list">
          {cappedLogs.items.map((log) => (
            <div
              className="agent-executor-history-log"
              key={log.id}
              role="listitem"
            >
              <div className="agent-executor-history-log-line">
                <span className="codex-direct-work-live-log-time">
                  {formatTimestamp(log.createdAt)}
                </span>
                <span className="codex-direct-work-result-label">
                  {log.level}
                </span>
                <span className="codex-direct-work-result-value">
                  {cappedPreviewText(
                    log.message,
                    RENDER_MEMORY_CAPS.widgetLogMessageChars,
                  )}
                </span>
              </div>
              {log.payload ? (
                <LazyDetails
                  className="codex-direct-work-live-log-raw"
                  summary="payload"
                >
                  <pre className="codex-direct-work-output">
                    <code>
                      {cappedRawDetailsText(
                        log.payload,
                        RENDER_MEMORY_CAPS.rawJsonPreviewChars,
                      )}
                    </code>
                  </pre>
                </LazyDetails>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </LazyDetails>
  );
}

function LazyDetails({
  children,
  className,
  summary,
  summaryAction,
}: {
  children: ReactNode;
  className: string;
  summary: ReactNode;
  summaryAction?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="codex-direct-work-output-summary">
        {summary}
        {summaryAction}
      </summary>
      {isOpen ? children : null}
    </details>
  );
}
