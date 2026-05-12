import { Badge } from "../design-system/Badge";
import type { RunCodexDirectWorkResponse } from "../workspace/types";
import {
  directWorkGitReviewHint,
  directWorkGitWidgetAvailability,
} from "./CodexDirectWorkReviewHint";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";

const OUTPUT_PREVIEW_LIMIT = 4000;

type CodexDirectWorkResultSummaryProps = {
  hasGitWidget?: boolean;
  result: RunCodexDirectWorkResponse;
};

export function CodexDirectWorkResultSummary({
  hasGitWidget,
  result,
}: CodexDirectWorkResultSummaryProps) {
  const statusView = codexResultStatusView(result);
  const reviewHint = directWorkGitReviewHint(
    result.status,
    directWorkGitWidgetAvailability(hasGitWidget),
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
          { label: "Run id", value: result.runId },
          { label: "Result id", value: result.resultId },
          { label: "Status", value: result.status },
          {
            label: "Exit code",
            value: result.exitCode === null ? "None" : String(result.exitCode),
          },
          { label: "Duration", value: `${result.durationMs} ms` },
          { label: "Sandbox", value: result.sandbox },
          { label: "Approval policy", value: result.approvalPolicy },
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

      {result.errorMessage ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Error message</span>
          <span className="codex-direct-work-result-value">{result.errorMessage}</span>
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

      <details className="codex-direct-work-output-details">
        <summary className="codex-direct-work-output-summary">
          stdout preview
          {result.stdoutTruncated ? (
            <Badge variant="warning">Backend truncated</Badge>
          ) : null}
        </summary>
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.stdout || "No stdout captured.")}</code>
        </pre>
      </details>

      <details className="codex-direct-work-output-details">
        <summary className="codex-direct-work-output-summary">
          stderr preview
          {result.stderrTruncated ? (
            <Badge variant="warning">Backend truncated</Badge>
          ) : null}
        </summary>
        <pre className="codex-direct-work-output">
          <code>{previewOutput(result.stderr || "No stderr captured.")}</code>
        </pre>
      </details>

      <details className="codex-direct-work-output-details">
        <summary className="codex-direct-work-output-summary">Command summary</summary>
        <pre className="codex-direct-work-output">
          <code>{result.commandSummary.join("\n") || "No command summary."}</code>
        </pre>
      </details>

      <p className="codex-direct-work-review-note">
        {reviewHint}
      </p>
    </section>
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

  return `${output.slice(0, OUTPUT_PREVIEW_LIMIT)}\n[Preview truncated in UI.]`;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
