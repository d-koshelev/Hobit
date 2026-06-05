import { useState, type ReactNode } from "react";
import { Badge } from "../design-system/Badge";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { RunCodexDirectWorkResponse } from "../workspace/types";
import { CodexDirectWorkChangedFilesSummary } from "./CodexDirectWorkChangedFilesSummary";
import {
  directWorkGitReviewHint,
  directWorkGitWidgetAvailability,
} from "./CodexDirectWorkReviewHint";
import {
  formatDirectWorkClockTime,
  formatDirectWorkDuration,
} from "./CodexDirectWorkTiming";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { DirectWorkGitReviewStatus } from "./types";

const OUTPUT_PREVIEW_LIMIT = RENDER_MEMORY_CAPS.stdoutStderrPreviewChars;

type CodexDirectWorkResultSummaryProps = {
  gitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
  result: RunCodexDirectWorkResponse;
  timing?: {
    completedAtMs: number;
    startedAtMs: number;
  } | null;
};

export function CodexDirectWorkResultSummary({
  gitReviewStatus,
  hasGitWidget,
  result,
  timing,
}: CodexDirectWorkResultSummaryProps) {
  const statusView = codexResultStatusView(result);
  const reviewHint = directWorkGitReviewHint(
    result.status,
    directWorkGitWidgetAvailability(hasGitWidget),
    gitReviewStatus,
  );

  return (
    <section
      aria-label="Codex Direct Work result"
      className={`codex-direct-work-result codex-direct-work-result-${statusView.tone}`}
    >
      <div className="codex-direct-work-result-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">{statusView.title}</h3>
          <p className="codex-direct-work-text">
            Immediate result from the one-shot Direct Work command.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      <StaticPreviewFieldList
        className="codex-direct-work-result-grid"
        fieldClassName="codex-direct-work-result-field"
        fields={[
          { label: "Status", value: result.status },
          timing
            ? {
                label: "Started at",
                value: formatDirectWorkClockTime(timing.startedAtMs),
              }
            : null,
          timing
            ? {
                label: "Completed at",
                value: formatDirectWorkClockTime(timing.completedAtMs),
              }
            : null,
          {
            label: "Exit code",
            value: result.exitCode === null ? "None" : String(result.exitCode),
          },
          {
            label: "Total duration",
            value: formatDirectWorkDuration(result.durationMs),
          },
          { label: "Sandbox", value: result.sandbox },
          { label: "Approval policy", value: result.approvalPolicy },
        ].filter(
          (
            field,
          ): field is {
            label: string;
            value: string;
          } => Boolean(field),
        )}
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
            { label: "Run id", value: result.runId },
            { label: "Result id", value: result.resultId },
          ]}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      </details>

      <details className="codex-direct-work-output-details codex-direct-work-validation-meta-details">
        <summary className="codex-direct-work-output-summary">
          Execution safety flags
        </summary>
        <StaticPreviewFieldList
          className="codex-direct-work-result-grid"
          fieldClassName="codex-direct-work-result-field"
          fields={[
            { label: "Auto commit", value: yesNo(!result.noAutoCommit) },
            { label: "Auto push", value: yesNo(!result.noAutoPush) },
            {
              label: "Git mutations by Hobit",
              value: yesNo(result.gitMutationsPerformedByHobit),
            },
          ]}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      </details>

      {result.errorMessage ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Error message</span>
          <span className="codex-direct-work-result-value">
            {previewOutput(result.errorMessage)}
          </span>
        </div>
      ) : null}

      <div className="codex-direct-work-final-message">
        <div className="codex-direct-work-output-header">
          <span className="codex-direct-work-result-label">Final response preview</span>
        </div>
        <pre className="codex-direct-work-output">
          <code>
            {previewOutput(result.finalMessage ?? "No final response captured.")}
          </code>
        </pre>
      </div>

      <CodexDirectWorkChangedFilesSummary
        gitReviewStatus={gitReviewStatus}
        hasGitWidget={hasGitWidget}
      />

      <LazyDetails
        className="codex-direct-work-output-details"
        summary={
          <>
          stdout preview
          {result.stdoutTruncated ? (
            <Badge variant="warning">Backend truncated</Badge>
          ) : null}
          </>
        }
      >
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.stdout || "No stdout captured.")}</code>
        </pre>
      </LazyDetails>

      <LazyDetails
        className="codex-direct-work-output-details"
        summary={
          <>
          stderr preview
          {result.stderrTruncated ? (
            <Badge variant="warning">Backend truncated</Badge>
          ) : null}
          </>
        }
      >
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.stderr || "No stderr captured.")}</code>
        </pre>
      </LazyDetails>

      <LazyDetails
        className="codex-direct-work-output-details"
        summary="Command summary"
      >
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.commandSummary.join("\n") || "No command summary.")}</code>
        </pre>
      </LazyDetails>

      <p className="codex-direct-work-review-note">
        {reviewHint}
      </p>
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
  summary: ReactNode;
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

function codexResultStatusView(result: RunCodexDirectWorkResponse): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  title: string;
  tone: "neutral" | "success" | "warning" | "error";
} {
  if (result.status === "completed" && result.exitCode === 0) {
    return {
      badgeLabel: "Completed",
      badgeVariant: "success",
      title: "Completed successfully",
      tone: "success",
    };
  }

  if (result.status === "completed") {
    return {
      badgeLabel: "Completed",
      badgeVariant: "warning",
      title: "Completed with nonzero exit",
      tone: "warning",
    };
  }

  if (result.status === "timed_out") {
    return {
      badgeLabel: "Timed out",
      badgeVariant: "warning",
      title: "Direct Work timed out",
      tone: "warning",
    };
  }

  if (result.status === "failed") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "error",
      title: "Direct Work failed",
      tone: "error",
    };
  }

  return {
    badgeLabel: result.status,
    badgeVariant: "neutral",
    title: "Direct Work result",
    tone: "neutral",
  };
}

function previewOutput(output: string): string {
  if (output.length <= OUTPUT_PREVIEW_LIMIT) {
    return output;
  }

  return cappedPreviewText(output, OUTPUT_PREVIEW_LIMIT, "Preview capped");
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
