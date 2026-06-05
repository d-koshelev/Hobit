import { useRef, useState } from "react";

import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
  cappedRawDetailsText,
} from "../../renderMemoryGuards";
import type { AgentExecutorRunDetail } from "../../workspace/types";
import { StaticPreviewFieldList } from "../StaticPreviewPrimitives";
import {
  previewOutput,
  formatRunDuration,
  formatTimestamp,
  runModeLabel,
  statusBadgeVariant,
  statusLabel,
  valueOrNone,
} from "./agentExecutorRunHistoryFormatters";
import {
  AGENT_EXECUTOR_LOG_PREVIEW_LIMIT,
  AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT,
  type AgentExecutorRunDetailState,
} from "./agentExecutorRunHistoryTypes";
import {
  boundAgentExecutorSelectedExcerpt,
  selectedTextInsideElement,
} from "./agentExecutorSelectedExcerpt";
import {
  AgentExecutorRunLogs,
  AgentExecutorRunOutputBlock,
  AgentExecutorRunOutputDetails,
} from "./AgentExecutorRunOutputPreview";

type AgentExecutorRunDetailPanelProps = {
  detailState: AgentExecutorRunDetailState;
  onAttachRunContext?: () => void;
  onAttachSectionPreview?: (
    sectionName: string,
    visiblePreviewText: string,
  ) => void;
  onAttachSelectedExcerpt?: (excerptText: string) => void;
};

const ATTACH_VISIBLE_PREVIEW_TITLE =
  "Attaches only this visible preview. Does not send automatically.";

export function AgentExecutorRunDetailPanel({
  detailState,
  onAttachRunContext,
  onAttachSectionPreview,
  onAttachSelectedExcerpt,
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

  return (
    <AgentExecutorRunDetailContent
      detail={detailState.detail}
      onAttachRunContext={onAttachRunContext}
      onAttachSectionPreview={onAttachSectionPreview}
      onAttachSelectedExcerpt={onAttachSelectedExcerpt}
    />
  );
}

function AgentExecutorRunDetailContent({
  detail,
  onAttachRunContext,
  onAttachSectionPreview,
  onAttachSelectedExcerpt,
}: {
  detail: AgentExecutorRunDetail;
  onAttachRunContext?: () => void;
  onAttachSectionPreview?: (
    sectionName: string,
    visiblePreviewText: string,
  ) => void;
  onAttachSelectedExcerpt?: (excerptText: string) => void;
}) {
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [selectedExcerptMessage, setSelectedExcerptMessage] =
    useState<string | null>(null);
  const summary = detail.summary;
  const finalText =
    detail.finalMessage ?? detail.resultContent ?? detail.resultSummary;
  const logs = detail.logs.slice(-AGENT_EXECUTOR_LOG_PREVIEW_LIMIT);
  const finalPreview = finalText ? visibleOutputPreview(finalText) : null;
  const stdoutPreview = detail.stdoutPreview
    ? visibleOutputPreview(detail.stdoutPreview)
    : null;
  const stderrPreview = detail.stderrPreview
    ? visibleOutputPreview(detail.stderrPreview)
    : null;
  const isValidationRun = Boolean(
    detail.validationProfile || detail.validationStatus,
  );
  const validationPreview =
    isValidationRun && (stdoutPreview || stderrPreview)
      ? [
          stdoutPreview ? `stdout preview:\n${stdoutPreview}` : null,
          stderrPreview ? `stderr preview:\n${stderrPreview}` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n\n")
      : null;
  const errorSummary = detail.errorMessage
    ? [
        `Status: ${statusLabel(summary.status)}`,
        detail.resultStatus ? `Result status: ${detail.resultStatus}` : null,
        detail.validationStatus
          ? `Validation status: ${detail.validationStatus}`
          : null,
        detail.validationProfile
          ? `Validation profile: ${detail.validationProfile}`
          : null,
        `Error message:\n${cappedPreviewText(
          detail.errorMessage,
          RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
        )}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n")
    : null;

  function attachSelectedExcerpt() {
    if (!onAttachSelectedExcerpt) {
      return;
    }

    const selectedText = selectedTextInsideElement(detailRef.current);
    const excerpt = selectedText
      ? boundAgentExecutorSelectedExcerpt(selectedText)
      : null;

    if (!excerpt) {
      setSelectedExcerptMessage(
        "Select visible text inside this run detail first.",
      );
      return;
    }

    onAttachSelectedExcerpt(excerpt.text);
    setSelectedExcerptMessage(
      excerpt.wasTruncated
        ? "Selected excerpt attached with truncation."
        : "Selected excerpt attached.",
    );
  }

  function sectionAttachAction(sectionName: string, visiblePreviewText: string) {
    if (!visiblePreviewText.trim()) {
      return null;
    }

    return (
      <Button
        className="agent-executor-section-attach-button"
        disabled={!onAttachSectionPreview}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAttachSectionPreview?.(sectionName, visiblePreviewText);
        }}
        title={ATTACH_VISIBLE_PREVIEW_TITLE}
        variant="ghost"
      >
        {sectionAttachButtonLabel(sectionName)}
      </Button>
    );
  }

  return (
    <div className="agent-executor-history-detail" ref={detailRef}>
      <div className="agent-executor-history-detail-header">
        <div className="codex-direct-work-copy">
          <p className="codex-direct-work-title">{summary.title}</p>
          <p className="codex-direct-work-text">{runModeLabel(summary)}</p>
        </div>
        <div className="agent-executor-history-detail-actions">
          <Badge variant={statusBadgeVariant(summary.status)}>
            {statusLabel(summary.status)}
          </Badge>
          <Button
            disabled={!onAttachRunContext}
            onClick={() => onAttachRunContext?.()}
            title={
              onAttachRunContext
                ? "Attach this safe run metadata to Workspace Agent."
                : "Workspace Agent is not visible on this Workbench."
            }
            variant="ghost"
          >
            Attach to Workspace Agent
          </Button>
          <Button
            disabled={!onAttachSelectedExcerpt}
            onClick={attachSelectedExcerpt}
            title={
              onAttachSelectedExcerpt
                ? "Attach only selected visible text to Workspace Agent."
                : "Workspace Agent is not visible on this Workbench."
            }
            variant="ghost"
          >
            Attach selected excerpt
          </Button>
        </div>
      </div>
      <p className="codex-direct-work-review-note">
        Only selected visible text is attached. Does not send automatically.
        Workspace Agent does not read full Executor logs.
      </p>
      {selectedExcerptMessage ? (
        <p className="codex-direct-work-review-note" role="status">
          {selectedExcerptMessage}
        </p>
      ) : null}

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
          <div className="codex-direct-work-output-header">
            <span className="codex-direct-work-result-label">
              Error message
            </span>
            {errorSummary
              ? sectionAttachAction("Error summary", errorSummary)
              : null}
          </div>
          <span className="codex-direct-work-result-value">
            {cappedPreviewText(
              detail.errorMessage,
              RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
            )}
          </span>
        </div>
      ) : null}

      {finalText && finalPreview ? (
        <AgentExecutorRunOutputBlock
          action={sectionAttachAction("Final response preview", finalPreview)}
          label="Final response preview"
          value={finalText}
        />
      ) : null}

      {validationPreview ? (
        <div
          aria-label="Validation output preview attach"
          className="agent-executor-section-attach-row"
        >
          <span className="codex-direct-work-result-label">
            Validation output preview
          </span>
          {sectionAttachAction("Validation output preview", validationPreview)}
        </div>
      ) : null}

      {detail.stdoutPreview && stdoutPreview ? (
        <AgentExecutorRunOutputDetails
          action={sectionAttachAction("stdout preview", stdoutPreview)}
          label="stdout preview"
          value={detail.stdoutPreview}
        />
      ) : null}

      {detail.stderrPreview && stderrPreview ? (
        <AgentExecutorRunOutputDetails
          action={sectionAttachAction("stderr preview", stderrPreview)}
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
          value={cappedRawDetailsText(
            detail.resultPayload,
            RENDER_MEMORY_CAPS.rawJsonPreviewChars,
          )}
        />
      ) : null}
    </div>
  );
}

function visibleOutputPreview(value: string) {
  return previewOutput(value, AGENT_EXECUTOR_OUTPUT_PREVIEW_LIMIT);
}

function sectionAttachButtonLabel(sectionName: string) {
  if (sectionName === "Final response preview") {
    return "Attach response";
  }

  if (sectionName === "stdout preview") {
    return "Attach stdout";
  }

  if (sectionName === "stderr preview") {
    return "Attach stderr";
  }

  if (sectionName === "Validation output preview") {
    return "Attach validation";
  }

  if (sectionName === "Error summary") {
    return "Attach error summary";
  }

  return "Attach preview";
}
