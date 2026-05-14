import { useEffect, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentExecutorRunSummary,
  WidgetLogEntry,
} from "../workspace/types";
import { formatDirectWorkDuration } from "./CodexDirectWorkTiming";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetInstanceId } from "./types";

const HISTORY_LIMIT = 20;
const OUTPUT_PREVIEW_LIMIT = 3000;
const LOG_PREVIEW_LIMIT = 50;

type HistoryState =
  | {
      message: string;
      status: "failed";
    }
  | {
      status: "loading";
    }
  | {
      runs: AgentExecutorRunSummary[];
      status: "ready";
    };

type DetailState =
  | {
      status: "idle";
    }
  | {
      runId: string;
      status: "loading";
    }
  | {
      detail: AgentExecutorRunDetail;
      status: "ready";
    }
  | {
      message: string;
      runId: string;
      status: "failed";
    };

export type GetAgentExecutorRunDetailHandler = (
  widgetInstanceId: WidgetInstanceId,
  runId: string,
) => Promise<AgentExecutorRunDetail | null>;

export type ListAgentExecutorRunsHandler = (
  widgetInstanceId: WidgetInstanceId,
  limit?: number,
) => Promise<AgentExecutorRunHistory | null>;

type AgentExecutorRunHistoryPanelProps = {
  onGetAgentExecutorRunDetail?: GetAgentExecutorRunDetailHandler;
  onListAgentExecutorRuns?: ListAgentExecutorRunsHandler;
  refreshToken: number;
  widgetInstanceId: WidgetInstanceId;
};

export function AgentExecutorRunHistoryPanel({
  onGetAgentExecutorRunDetail,
  onListAgentExecutorRuns,
  refreshToken,
  widgetInstanceId,
}: AgentExecutorRunHistoryPanelProps) {
  const [historyState, setHistoryState] = useState<HistoryState>({
    status: "loading",
  });
  const [detailState, setDetailState] = useState<DetailState>({
    status: "idle",
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadRuns() {
      if (!onListAgentExecutorRuns) {
        setHistoryState({
          message: "Agent Executor run history is unavailable in this runtime.",
          status: "failed",
        });
        return;
      }

      setHistoryState({ status: "loading" });

      try {
        const history = await onListAgentExecutorRuns(
          widgetInstanceId,
          HISTORY_LIMIT,
        );

        if (!isCurrent) {
          return;
        }

        const runs = history?.runs ?? [];
        setHistoryState({ runs, status: "ready" });
        setSelectedRunId((currentRunId) =>
          currentRunId && runs.some((run) => run.runId === currentRunId)
            ? currentRunId
            : null,
        );
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setHistoryState({
          message: errorToMessage(error, "Unable to load Agent Executor runs."),
          status: "failed",
        });
      }
    }

    void loadRuns();

    return () => {
      isCurrent = false;
    };
  }, [onListAgentExecutorRuns, refreshToken, widgetInstanceId]);

  async function loadRunDetail(runId: string) {
    setSelectedRunId(runId);

    if (!onGetAgentExecutorRunDetail) {
      setDetailState({
        message: "Agent Executor run detail is unavailable in this runtime.",
        runId,
        status: "failed",
      });
      return;
    }

    setDetailState({ runId, status: "loading" });

    try {
      const detail = await onGetAgentExecutorRunDetail(widgetInstanceId, runId);

      if (!detail) {
        setDetailState({
          message: "Agent Executor run detail was not returned.",
          runId,
          status: "failed",
        });
        return;
      }

      setDetailState({ detail, status: "ready" });
    } catch (error) {
      setDetailState({
        message: errorToMessage(error, "Unable to load Agent Executor detail."),
        runId,
        status: "failed",
      });
    }
  }

  return (
    <section
      aria-label="Agent Executor run history"
      className="agent-executor-history"
    >
      <div className="agent-executor-history-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Recent runs</h3>
          <p className="codex-direct-work-text">
            Read-only stored Direct Work and validation artifacts for this
            Agent Executor widget.
          </p>
        </div>
        <div className="agent-executor-history-actions">
          <Badge variant="neutral">Read-only</Badge>
          <Button
            disabled={historyState.status === "loading"}
            onClick={() => {
              setHistoryState({ status: "loading" });
              void reloadHistory(
                onListAgentExecutorRuns,
                widgetInstanceId,
                setHistoryState,
                setSelectedRunId,
              );
            }}
            variant="ghost"
          >
            {historyState.status === "loading" ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {historyState.status === "loading" ? (
        <p className="codex-direct-work-review-note">
          Loading recent Agent Executor runs...
        </p>
      ) : null}

      {historyState.status === "failed" ? (
        <div className="codex-direct-work-error-message" role="status">
          <span className="codex-direct-work-result-label">
            History unavailable
          </span>
          <span className="codex-direct-work-result-value">
            {historyState.message}
          </span>
        </div>
      ) : null}

      {historyState.status === "ready" && historyState.runs.length === 0 ? (
        <p className="codex-direct-work-review-note">
          No stored Agent Executor runs yet.
        </p>
      ) : null}

      {historyState.status === "ready" && historyState.runs.length > 0 ? (
        <div className="agent-executor-history-layout">
          <div className="agent-executor-history-list" role="list">
            {historyState.runs.map((run) => (
              <button
                className={`agent-executor-history-item${
                  selectedRunId === run.runId
                    ? " agent-executor-history-item-selected"
                    : ""
                }`}
                key={run.runId}
                onClick={() => void loadRunDetail(run.runId)}
                type="button"
              >
                <span className="agent-executor-history-item-head">
                  <span className="codex-direct-work-result-label">
                    {run.title || runModeLabel(run)}
                  </span>
                  <Badge variant={statusBadgeVariant(run.status)}>
                    {statusLabel(run.status)}
                  </Badge>
                </span>
                <span className="codex-direct-work-result-value">
                  {runModeLabel(run)}
                </span>
                <span className="codex-direct-work-review-note">
                  Started {formatTimestamp(run.startedAt)}
                </span>
                <span className="codex-direct-work-review-note">
                  Completed {formatTimestamp(run.finishedAt)}
                </span>
                <span className="codex-direct-work-review-note">
                  Duration {formatRunDuration(run)}
                </span>
                {run.repoRoot ? (
                  <span className="codex-direct-work-review-note">
                    Repo {run.repoRoot}
                  </span>
                ) : null}
                {run.validationProfile || run.validationStatus ? (
                  <span className="codex-direct-work-review-note">
                    Validation {run.validationProfile ?? "unknown"} /{" "}
                    {run.validationStatus ?? "unknown"}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <RunHistoryDetail detailState={detailState} />
        </div>
      ) : null}
    </section>
  );
}

async function reloadHistory(
  onListAgentExecutorRuns:
    | AgentExecutorRunHistoryPanelProps["onListAgentExecutorRuns"]
    | undefined,
  widgetInstanceId: WidgetInstanceId,
  setHistoryState: (state: HistoryState) => void,
  setSelectedRunId: (updater: (currentRunId: string | null) => string | null) => void,
) {
  if (!onListAgentExecutorRuns) {
    setHistoryState({
      message: "Agent Executor run history is unavailable in this runtime.",
      status: "failed",
    });
    return;
  }

  try {
    const history = await onListAgentExecutorRuns(widgetInstanceId, HISTORY_LIMIT);
    const runs = history?.runs ?? [];
    setHistoryState({ runs, status: "ready" });
    setSelectedRunId((currentRunId) =>
      currentRunId && runs.some((run) => run.runId === currentRunId)
        ? currentRunId
        : null,
    );
  } catch (error) {
    setHistoryState({
      message: errorToMessage(error, "Unable to load Agent Executor runs."),
      status: "failed",
    });
  }
}

function RunHistoryDetail({ detailState }: { detailState: DetailState }) {
  if (detailState.status === "idle") {
    return (
      <div className="agent-executor-history-detail">
        <p className="codex-direct-work-review-note">
          Select a stored run to inspect its result, captured output, and logs.
        </p>
      </div>
    );
  }

  if (detailState.status === "loading") {
    return (
      <div className="agent-executor-history-detail">
        <p className="codex-direct-work-review-note">
          Loading run detail...
        </p>
      </div>
    );
  }

  if (detailState.status === "failed") {
    return (
      <div className="agent-executor-history-detail">
        <div className="codex-direct-work-error-message" role="status">
          <span className="codex-direct-work-result-label">
            Detail unavailable
          </span>
          <span className="codex-direct-work-result-value">
            {detailState.message}
          </span>
        </div>
      </div>
    );
  }

  return <RunHistoryDetailContent detail={detailState.detail} />;
}

function RunHistoryDetailContent({
  detail,
}: {
  detail: AgentExecutorRunDetail;
}) {
  const summary = detail.summary;
  const finalText =
    detail.finalMessage ?? detail.resultContent ?? detail.resultSummary;
  const logs = detail.logs.slice(0, LOG_PREVIEW_LIMIT);

  return (
    <div className="agent-executor-history-detail">
      <div className="agent-executor-history-detail-header">
        <div className="codex-direct-work-copy">
          <p className="codex-direct-work-title">{summary.title}</p>
          <p className="codex-direct-work-text">{runModeLabel(summary)}</p>
        </div>
        <Badge variant={statusBadgeVariant(summary.status)}>
          {statusLabel(summary.status)}
        </Badge>
      </div>

      <StaticPreviewFieldList
        className="codex-direct-work-result-grid"
        fieldClassName="codex-direct-work-result-field"
        fields={[
          { label: "Started", value: formatTimestamp(summary.startedAt) },
          { label: "Completed", value: formatTimestamp(summary.finishedAt) },
          { label: "Duration", value: formatRunDuration(summary) },
          { label: "Result type", value: valueOrNone(summary.resultType) },
          { label: "Result status", value: valueOrNone(detail.resultStatus) },
          { label: "Repo root", value: valueOrNone(summary.repoRoot) },
          {
            label: "Validation profile",
            value: valueOrNone(detail.validationProfile),
          },
          {
            label: "Validation status",
            value: valueOrNone(detail.validationStatus),
          },
          {
            label: "Logs",
            value:
              summary.logCount === null
                ? String(detail.logs.length)
                : String(summary.logCount),
          },
        ]}
        labelClassName="codex-direct-work-result-label"
        valueClassName="codex-direct-work-result-value"
      />

      <details className="codex-direct-work-output-details codex-direct-work-validation-meta-details">
        <summary className="codex-direct-work-output-summary">
          Run artifact ids
        </summary>
        <StaticPreviewFieldList
          className="codex-direct-work-result-grid"
          fieldClassName="codex-direct-work-result-field"
          fields={[
            { label: "Run id", value: summary.runId },
            { label: "Result id", value: valueOrNone(detail.resultId) },
          ]}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      </details>

      {detail.errorMessage ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Error message</span>
          <span className="codex-direct-work-result-value">
            {detail.errorMessage}
          </span>
        </div>
      ) : null}

      {finalText ? (
        <OutputBlock label="Final response preview" value={finalText} />
      ) : null}

      {detail.stdoutPreview ? (
        <OutputDetails label="stdout preview" value={detail.stdoutPreview} />
      ) : null}

      {detail.stderrPreview ? (
        <OutputDetails label="stderr preview" value={detail.stderrPreview} />
      ) : null}

      {detail.changedFilesSummary ? (
        <OutputDetails
          label="Changed-files summary"
          value={detail.changedFilesSummary}
        />
      ) : null}

      <RunLogs logs={logs} totalCount={detail.logs.length} />

      {detail.resultPayload ? (
        <OutputDetails
          label="Raw payload"
          value={formatRawPayload(detail.resultPayload)}
        />
      ) : null}
    </div>
  );
}

function OutputBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="codex-direct-work-final-message">
      <div className="codex-direct-work-output-header">
        <span className="codex-direct-work-result-label">{label}</span>
      </div>
      <pre className="codex-direct-work-output">
        <code>{previewOutput(value)}</code>
      </pre>
    </div>
  );
}

function OutputDetails({ label, value }: { label: string; value: string }) {
  return (
    <details className="codex-direct-work-output-details">
      <summary className="codex-direct-work-output-summary">{label}</summary>
      <pre className="codex-direct-work-output">
        <code>{previewOutput(value)}</code>
      </pre>
    </details>
  );
}

function RunLogs({
  logs,
  totalCount,
}: {
  logs: WidgetLogEntry[];
  totalCount: number;
}) {
  return (
    <details className="codex-direct-work-output-details">
      <summary className="codex-direct-work-output-summary">
        Logs {totalCount > logs.length ? `first ${logs.length} of ${totalCount}` : totalCount}
      </summary>
      {logs.length === 0 ? (
        <p className="codex-direct-work-review-note">No logs captured.</p>
      ) : (
        <div className="agent-executor-history-log-list" role="list">
          {logs.map((log) => (
            <div className="agent-executor-history-log" key={log.id} role="listitem">
              <div className="agent-executor-history-log-meta">
                <span className="codex-direct-work-result-label">
                  {log.level}
                </span>
                <span className="codex-direct-work-review-note">
                  {formatTimestamp(log.createdAt)}
                </span>
              </div>
              <p className="codex-direct-work-result-value">{log.message}</p>
              {log.payload ? (
                <details className="codex-direct-work-live-log-raw">
                  <summary className="codex-direct-work-live-log-detail">
                    payload
                  </summary>
                  <pre className="codex-direct-work-output">
                    <code>{previewOutput(formatRawPayload(log.payload))}</code>
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

function runModeLabel(run: AgentExecutorRunSummary) {
  if (run.validationProfile) {
    return `Validation ${run.validationProfile}`;
  }

  return run.mode ?? run.commandKind ?? run.resultType ?? "Direct Work";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusBadgeVariant(
  status: string,
): "neutral" | "info" | "success" | "warning" | "error" {
  if (
    status === "completed" ||
    status === "succeeded" ||
    status === "passed"
  ) {
    return "success";
  }

  if (status === "running" || status === "started") {
    return "info";
  }

  if (status === "cancelled" || status === "timed_out") {
    return "warning";
  }

  if (status === "failed" || status === "failed_to_start") {
    return "error";
  }

  return "neutral";
}

function formatRunDuration(run: AgentExecutorRunSummary) {
  if (run.durationMs !== null) {
    return formatDirectWorkDuration(run.durationMs);
  }

  const startedAt = timestampToMs(run.startedAt);
  const finishedAt = timestampToMs(run.finishedAt);

  if (startedAt !== null && finishedAt !== null && finishedAt >= startedAt) {
    return formatDirectWorkDuration(finishedAt - startedAt);
  }

  return "Unknown";
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not completed";
  }

  const timestamp = timestampToMs(value);

  if (timestamp === null) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function timestampToMs(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);

  if (Number.isFinite(numericValue)) {
    return numericValue > 10_000_000_000 ? numericValue : numericValue * 1000;
  }

  const parsedValue = Date.parse(trimmedValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function valueOrNone(value: string | null) {
  return value && value.trim() ? value : "None";
}

function previewOutput(value: string) {
  if (value.length <= OUTPUT_PREVIEW_LIMIT) {
    return value;
  }

  return `${value.slice(0, OUTPUT_PREVIEW_LIMIT)}\n[Preview truncated in UI.]`;
}

function formatRawPayload(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function errorToMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallbackMessage;
}
