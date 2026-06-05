import { useState, type ReactNode } from "react";
import { Badge } from "../design-system/Badge";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import { CodexDirectWorkChangedFilesSummary } from "./CodexDirectWorkChangedFilesSummary";
import {
  directWorkGitReviewHint,
  directWorkGitWidgetAvailability,
} from "./CodexDirectWorkReviewHint";
import { previewLiveOutput } from "./executor/codexDirectWorkLogFormatters";
import { CodexDirectWorkLogEventList } from "./executor/CodexDirectWorkLogEventList";
import {
  isFailureStatus,
  isFinalStatus,
} from "./executor/codexDirectWorkLogViewModel";
import type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveRun,
} from "./executor/codexDirectWorkLogTypes";
import {
  liveRunCompactStatusLine,
  liveRunStatusFields,
  liveRunStatusView,
  localLogStatusView,
} from "./CodexDirectWorkLiveLogStatus";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { DirectWorkGitReviewStatus } from "./types";

export type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveLogEntryKind,
  CodexDirectWorkLiveLogEntryTone,
  CodexDirectWorkLiveRun,
} from "./executor/codexDirectWorkLogTypes";
export {
  cappedLiveLogEntries,
  isFinalStatus,
  liveLogEntryFromEvent,
  liveRunFromEvent,
  syntheticStartedLogEntry,
} from "./executor/codexDirectWorkLogViewModel";

export function CodexDirectWorkLiveLog({
  entries,
  gitReviewStatus,
  hasGitWidget,
  liveRun,
}: {
  entries: CodexDirectWorkLiveLogEntry[];
  gitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
  liveRun: CodexDirectWorkLiveRun | null;
}) {
  const statusView = liveRun
    ? liveRunStatusView(liveRun.status)
    : localLogStatusView(entries);
  const reviewHint =
    liveRun && isFinalStatus(liveRun.status)
      ? directWorkGitReviewHint(
          liveRun.status,
          directWorkGitWidgetAvailability(hasGitWidget),
          gitReviewStatus,
        )
      : null;

  return (
    <section
      aria-label="Direct Work live status entries"
      aria-live="polite"
      className="codex-direct-work-live-log"
    >
      <div className="codex-direct-work-live-log-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">{statusView.title}</h3>
          <p className="codex-direct-work-text">
            Compact Direct Work event stream.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      {liveRun ? (
        <>
          <p className="codex-direct-work-live-log-status-line">
            {liveRunCompactStatusLine(liveRun)}
          </p>
          <details className="codex-direct-work-output-details codex-direct-work-live-log-run-details">
            <summary className="codex-direct-work-output-summary">
              Run details
            </summary>
            <StaticPreviewFieldList
              className="codex-direct-work-result-grid"
              fieldClassName="codex-direct-work-result-field"
              fields={liveRunStatusFields(liveRun)}
              labelClassName="codex-direct-work-result-label"
              valueClassName="codex-direct-work-result-value"
            />
          </details>
        </>
      ) : null}

      {liveRun && isFailureStatus(liveRun.status) ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Failure reason</span>
          <span className="codex-direct-work-result-value">
            {cappedPreviewText(
              liveRun.errorMessage ?? "No failure detail was reported.",
              RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
            )}
          </span>
          <p className="codex-direct-work-review-note">
            More lifecycle details may be available in Logs.
          </p>
        </div>
      ) : null}

      <CodexDirectWorkLogEventList entries={entries} />

      {liveRun?.finalMessage ? (
        <div className="codex-direct-work-final-message">
          <div className="codex-direct-work-output-header">
            <span className="codex-direct-work-result-label">
              Final response preview
            </span>
          </div>
          <pre className="codex-direct-work-output">
            <code>{previewLiveOutput(liveRun.finalMessage)}</code>
          </pre>
        </div>
      ) : null}

      {liveRun && isFinalStatus(liveRun.status) ? (
        <CodexDirectWorkChangedFilesSummary
          gitReviewStatus={gitReviewStatus}
          hasGitWidget={hasGitWidget}
        />
      ) : null}

      {liveRun?.stdoutPreview ? (
        <LazyDetails
          className="codex-direct-work-output-details"
          summary="live stdout preview"
        >
          <pre className="codex-direct-work-output">
            <code>{previewLiveOutput(liveRun.stdoutPreview)}</code>
          </pre>
        </LazyDetails>
      ) : null}

      {liveRun?.stderrPreview ? (
        <LazyDetails
          className="codex-direct-work-output-details"
          summary="live stderr preview"
        >
          <pre className="codex-direct-work-output">
            <code>{previewLiveOutput(liveRun.stderrPreview)}</code>
          </pre>
        </LazyDetails>
      ) : null}

      {reviewHint ? (
        <p className="codex-direct-work-review-note">{reviewHint}</p>
      ) : null}
    </section>
  );
}

function LazyDetails({
  children,
  className,
  summary,
}: {
  children: ReactNode;
  className: string;
  summary: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="codex-direct-work-output-summary">{summary}</summary>
      {isOpen ? children : null}
    </details>
  );
}
