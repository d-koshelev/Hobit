import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  DirectWorkValidationProfile,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import { formatDirectWorkDuration } from "./CodexDirectWorkTiming";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetInstanceId } from "./types";

const OUTPUT_PREVIEW_LIMIT = 3000;
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
          Running {validationState.profile} validation...
        </p>
      ) : null}

      {validationState.status === "failed" ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">
            Validation request failed
          </span>
          <span className="codex-direct-work-result-value">
            {validationState.message}
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

  return (
    <>
      <StaticPreviewFieldList
        className="codex-direct-work-result-grid"
        fieldClassName="codex-direct-work-result-field"
        fields={[
          { label: "Profile", value: result.profile },
          { label: "Status", value: statusView.title },
          { label: "Run id", value: result.runId },
          { label: "Result id", value: result.resultId },
          {
            label: "Duration",
            value: formatDirectWorkDuration(result.durationMs),
          },
          {
            label: "Exit code",
            value:
              result.exitCode === null ? "None" : String(result.exitCode),
          },
          {
            label: "Git mutations",
            value: result.gitMutationsPerformedByHobit ? "Yes" : "No",
          },
          { label: "Commit/push", value: result.noCommitPush ? "No" : "Yes" },
        ]}
        labelClassName="codex-direct-work-result-label"
        valueClassName="codex-direct-work-result-value"
      />

      {result.errorMessage ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Error message</span>
          <span className="codex-direct-work-result-value">
            {result.errorMessage}
          </span>
        </div>
      ) : null}

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
    </>
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

function validationResultStatusView(status: string): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  title: string;
  tone: "neutral" | "success" | "warning" | "error";
} {
  if (status === "passed") {
    return {
      badgeLabel: "Passed",
      badgeVariant: "success",
      title: "Validation passed",
      tone: "success",
    };
  }

  if (status === "failed") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "warning",
      title: "Validation failed",
      tone: "warning",
    };
  }

  if (status === "timed_out") {
    return {
      badgeLabel: "Timed out",
      badgeVariant: "warning",
      title: "Validation timed out",
      tone: "warning",
    };
  }

  if (status === "failed_to_start") {
    return {
      badgeLabel: "Could not start",
      badgeVariant: "error",
      title: "Validation could not start",
      tone: "error",
    };
  }

  return {
    badgeLabel: status,
    badgeVariant: "neutral",
    title: status,
    tone: "neutral",
  };
}

function previewOutput(output: string): string {
  if (output.length <= OUTPUT_PREVIEW_LIMIT) {
    return output;
  }

  return `${output.slice(0, OUTPUT_PREVIEW_LIMIT)}\n[Preview truncated in UI.]`;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to run Direct Work validation.";
}
