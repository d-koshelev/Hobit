import type { ReactNode } from "react";
import type { WidgetLogEntry } from "../../workspace/types";
import { AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT } from "./agentExecutorRunHistoryTypes";
import {
  formatRawPayload,
  formatTimestamp,
  previewOutput,
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
        <code>{previewOutput(value, AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT)}</code>
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
    <details className="codex-direct-work-output-details">
      <summary className="codex-direct-work-output-summary">
        <span>{label}</span>
        {action}
      </summary>
      <pre className="codex-direct-work-output">
        <code>{previewOutput(value, AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT)}</code>
      </pre>
    </details>
  );
}

export function AgentExecutorRunLogs({
  logs,
  totalCount,
}: {
  logs: WidgetLogEntry[];
  totalCount: number;
}) {
  return (
    <details className="codex-direct-work-output-details">
      <summary className="codex-direct-work-output-summary">
        Logs{" "}
        {totalCount > logs.length
          ? `first ${logs.length} of ${totalCount}`
          : totalCount}
      </summary>
      {logs.length === 0 ? (
        <p className="codex-direct-work-review-note">No logs captured.</p>
      ) : (
        <div className="agent-executor-history-log-list" role="list">
          {logs.map((log) => (
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
                  {log.message}
                </span>
              </div>
              {log.payload ? (
                <details className="codex-direct-work-live-log-raw">
                  <summary className="codex-direct-work-live-log-detail">
                    payload
                  </summary>
                  <pre className="codex-direct-work-output">
                    <code>{previewOutput(
                      formatRawPayload(log.payload),
                      AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT,
                    )}</code>
                  </pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
