import { useState, type ReactNode } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type {
  DirectWorkValidationProfile,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import { formatDirectWorkDuration } from "./CodexDirectWorkTiming";
import {
  validationFailurePreview,
  validationOutputPreview,
  validationResultStatusView,
} from "./CodexDirectWorkValidationFormatting";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetInstanceId } from "./types";

const VALIDATION_PROFILES: readonly DirectWorkValidationProfile[] = [
  "fast",
  "changed",
  "full",
];

type ValidationState =
  | {
      status: "idle";
    }
  | {
      profile: DirectWorkValidationProfile;
      status: "running";
    }
  | {
      result: RunDirectWorkValidationResponse;
      status: "ready";
    }
  | {
      message: string;
      profile: DirectWorkValidationProfile;
      status: "failed";
    };

type CodexDirectWorkValidationPanelProps = {
  onRunDirectWorkValidation?: (
    widgetInstanceId: WidgetInstanceId,
    request: {
      repoRoot: string;
      validationProfile: DirectWorkValidationProfile;
    },
  ) => Promise<RunDirectWorkValidationResponse | null>;
  repositoryRoot: string;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkValidationPanel({
  onRunDirectWorkValidation,
  repositoryRoot,
  widgetInstanceId,
}: CodexDirectWorkValidationPanelProps) {
  const [validationState, setValidationState] = useState<ValidationState>({
    status: "idle",
  });
  const isRunning = validationState.status === "running";
  const statusView = validationStatusView(validationState);

  async function runValidation(profile: DirectWorkValidationProfile) {
    if (isRunning) {
      return;
    }

    if (!onRunDirectWorkValidation) {
      setValidationState({
        message:
          "Direct Work validation capture is unavailable in this runtime.",
        profile,
        status: "failed",
      });
      return;
    }

    setValidationState({ profile, status: "running" });

    try {
      const result = await onRunDirectWorkValidation(widgetInstanceId, {
        repoRoot: repositoryRoot,
        validationProfile: profile,
      });

      if (!result) {
        setValidationState({
          message:
            "Direct Work validation was not accepted for this widget instance.",
          profile,
          status: "failed",
        });
        return;
      }

      setValidationState({ result, status: "ready" });
    } catch (error) {
      setValidationState({
        message: errorToMessage(error),
        profile,
        status: "failed",
      });
    }
  }

  return (
    <section
      aria-label="Direct Work validation"
      className={`codex-direct-work-result codex-direct-work-result-${statusView.tone}`}
    >
      <div className="codex-direct-work-result-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Validation</h3>
          <p className="codex-direct-work-text">
            Validation runs local Toolbelt checks for this repo.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      <div className="codex-direct-work-validation-actions">
        {VALIDATION_PROFILES.map((profile) => (
          <Button
            disabled={isRunning}
            key={profile}
            onClick={() => void runValidation(profile)}
            variant={profile === "fast" ? "primary" : "secondary"}
          >
            {isRunning && validationState.profile === profile
              ? `Running ${profile}...`
              : `Run ${profile}`}
          </Button>
        ))}
      </div>

      <p className="codex-direct-work-review-note">
        It does not commit, push, stage, reset, or clean.
      </p>

      {validationState.status === "idle" ? (
        <p className="codex-direct-work-review-note">
          Validation not run yet.
        </p>
      ) : null}

      {validationState.status === "running" ? (
        <p className="codex-direct-work-review-note">
          Validation running... Profile: {validationState.profile}
        </p>
      ) : null}

      {validationState.status === "failed" ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">
            Validation request failed
          </span>
          <span className="codex-direct-work-result-value">
            {cappedPreviewText(
              validationState.message,
              RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
            )}
          </span>
        </div>
      ) : null}

      {validationState.status === "ready" ? (
        <ValidationResult result={validationState.result} />
      ) : null}
    </section>
  );
}

function ValidationResult({
  result,
}: {
  result: RunDirectWorkValidationResponse;
}) {
  const statusView = validationResultStatusView(result.status);
  const failurePreview = validationFailurePreview(result);

  return (
    <>
      <div
        className={`codex-direct-work-validation-summary codex-direct-work-validation-summary-${statusView.tone}`}
      >
        <p className="codex-direct-work-validation-title">
          {statusView.title}
        </p>
        <p className="codex-direct-work-text">{statusView.description}</p>
      </div>

      <StaticPreviewFieldList
        className="codex-direct-work-result-grid"
        fieldClassName="codex-direct-work-result-field"
        fields={[
          { label: "Profile", value: result.profile },
          { label: "Status", value: statusView.title },
          {
            label: "Duration",
            value: formatDirectWorkDuration(result.durationMs),
          },
          {
            label: "Exit code",
            value:
              result.exitCode === null
                ? "Not available"
                : String(result.exitCode),
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
            { label: "Run id", value: result.runId },
            { label: "Result id", value: result.resultId },
            { label: "Run status", value: result.runStatus },
            { label: "Result type", value: result.resultType },
          ]}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      </details>

      <details className="codex-direct-work-output-details codex-direct-work-validation-meta-details">
        <summary className="codex-direct-work-output-summary">
          Validation safety flags
        </summary>
        <StaticPreviewFieldList
          className="codex-direct-work-result-grid"
          fieldClassName="codex-direct-work-result-field"
          fields={[
            {
              label: "No Git mutations",
              value: result.noGitMutations ? "Yes" : "No",
            },
            {
              label: "Git mutations by Hobit",
              value: result.gitMutationsPerformedByHobit ? "Yes" : "No",
            },
            {
              label: "Commit/push",
              value: result.noCommitPush ? "No" : "Yes",
            },
          ]}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      </details>

      {failurePreview ? (
        <div
          className={`codex-direct-work-validation-failure-preview codex-direct-work-validation-failure-preview-${statusView.tone}`}
        >
          <span className="codex-direct-work-result-label">
            Failure preview
          </span>
          <span className="codex-direct-work-result-value">
            {failurePreview.text}
          </span>
          <span className="codex-direct-work-result-hint">
            {failurePreview.sourceLabel}
          </span>
        </div>
      ) : null}

      <LazyDetails
        className="codex-direct-work-output-details"
        summary={
          <>
          stdout preview
          {result.stdoutTruncated ? (
            <Badge variant="warning">Output truncated</Badge>
          ) : null}
          </>
        }
      >
        <pre className="codex-direct-work-output">
          <code>
            {cappedPreviewText(
              validationOutputPreview(result.stdout || "No stdout captured."),
              RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
            )}
          </code>
        </pre>
      </LazyDetails>

      <LazyDetails
        className="codex-direct-work-output-details"
        summary={
          <>
          stderr preview
          {result.stderrTruncated ? (
            <Badge variant="warning">stderr truncated</Badge>
          ) : null}
          </>
        }
      >
        <pre className="codex-direct-work-output">
          <code>
            {cappedPreviewText(
              validationOutputPreview(result.stderr || "No stderr captured."),
              RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
            )}
          </code>
        </pre>
      </LazyDetails>
    </>
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

function validationStatusView(state: ValidationState): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  tone: "neutral" | "success" | "warning" | "error";
} {
  if (state.status === "running") {
    return {
      badgeLabel: `Running ${state.profile}`,
      badgeVariant: "info",
      tone: "neutral",
    };
  }

  if (state.status === "failed") {
    return {
      badgeLabel: "Unavailable",
      badgeVariant: "error",
      tone: "error",
    };
  }

  if (state.status === "ready") {
    const resultView = validationResultStatusView(state.result.status);

    return {
      badgeLabel: resultView.badgeLabel,
      badgeVariant: resultView.badgeVariant,
      tone: resultView.tone,
    };
  }

  return {
    badgeLabel: "Not run",
    badgeVariant: "neutral",
    tone: "neutral",
  };
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to run Direct Work validation.";
}
