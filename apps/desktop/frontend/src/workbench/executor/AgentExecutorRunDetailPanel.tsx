import { Badge } from "../../design-system/Badge";
import type { AgentExecutorRunDetail } from "../../workspace/types";
import { StaticPreviewFieldList } from "../StaticPreviewPrimitives";
import {
  formatRawPayload,
  formatRunDuration,
  formatTimestamp,
  runModeLabel,
  statusBadgeVariant,
  statusLabel,
  valueOrNone,
} from "./agentExecutorRunHistoryFormatters";
import {
  AGENT_EXECUTOR_LOG_PREVIEW_LIMIT,
  type AgentExecutorRunDetailState,
} from "./agentExecutorRunHistoryTypes";
import {
  AgentExecutorRunLogs,
  AgentExecutorRunOutputBlock,
  AgentExecutorRunOutputDetails,
} from "./AgentExecutorRunOutputPreview";

type AgentExecutorRunDetailPanelProps = {
  detailState: AgentExecutorRunDetailState;
};

export function AgentExecutorRunDetailPanel({
  detailState,
}: AgentExecutorRunDetailPanelProps) {
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
        <p className="codex-direct-work-review-note">Loading run detail...</p>
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

  return <AgentExecutorRunDetailContent detail={detailState.detail} />;
}

function AgentExecutorRunDetailContent({
  detail,
}: {
  detail: AgentExecutorRunDetail;
}) {
  const summary = detail.summary;
  const finalText =
    detail.finalMessage ?? detail.resultContent ?? detail.resultSummary;
  const logs = detail.logs.slice(0, AGENT_EXECUTOR_LOG_PREVIEW_LIMIT);

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
          { label: "Execution workspace", value: valueOrNone(summary.repoRoot) },
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
        <AgentExecutorRunOutputBlock
          label="Final response preview"
          value={finalText}
        />
      ) : null}

      {detail.stdoutPreview ? (
        <AgentExecutorRunOutputDetails
          label="stdout preview"
          value={detail.stdoutPreview}
        />
      ) : null}

      {detail.stderrPreview ? (
        <AgentExecutorRunOutputDetails
          label="stderr preview"
          value={detail.stderrPreview}
        />
      ) : null}

      {detail.changedFilesSummary ? (
        <AgentExecutorRunOutputDetails
          label="Changed-files summary"
          value={detail.changedFilesSummary}
        />
      ) : null}

      <AgentExecutorRunLogs logs={logs} totalCount={detail.logs.length} />

      {detail.resultPayload ? (
        <AgentExecutorRunOutputDetails
          label="Raw payload"
          value={formatRawPayload(detail.resultPayload)}
        />
      ) : null}
    </div>
  );
}
