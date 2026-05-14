import type { RunDirectWorkValidationResponse } from "../workspace/types";

const OUTPUT_PREVIEW_LIMIT = 3000;
const FAILURE_PREVIEW_LINE_LIMIT = 4;
const FAILURE_PREVIEW_CHAR_LIMIT = 700;

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";
type Tone = "neutral" | "success" | "warning" | "error";

export type ValidationResultStatusView = {
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  description: string;
  title: string;
  tone: Tone;
};

export type ValidationFailurePreview = {
  sourceLabel: string;
  text: string;
};

export function validationResultStatusView(
  status: string,
): ValidationResultStatusView {
  if (status === "passed") {
    return {
      badgeLabel: "Passed",
      badgeVariant: "success",
      description: "Validation completed without reported failures.",
      title: "Validation passed",
      tone: "success",
    };
  }

  if (status === "failed") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "warning",
      description: "Validation completed with failures.",
      title: "Validation failed",
      tone: "warning",
    };
  }

  if (status === "timed_out") {
    return {
      badgeLabel: "Timed out",
      badgeVariant: "warning",
      description: "Validation did not finish before the timeout.",
      title: "Validation timed out",
      tone: "warning",
    };
  }

  if (status === "failed_to_start") {
    return {
      badgeLabel: "Could not start",
      badgeVariant: "error",
      description: "Validation command could not be started.",
      title: "Validation could not start",
      tone: "error",
    };
  }

  return {
    badgeLabel: "Unknown",
    badgeVariant: "neutral",
    description: "The validation result did not include a recognized status.",
    title: "Validation status unknown",
    tone: "neutral",
  };
}

export function validationFailurePreview(
  result: RunDirectWorkValidationResponse,
): ValidationFailurePreview | null {
  if (
    result.status !== "failed" &&
    result.status !== "timed_out" &&
    result.status !== "failed_to_start"
  ) {
    return null;
  }

  const errorMessage = firstMeaningfulLines(result.errorMessage ?? "");
  if (errorMessage) {
    return { sourceLabel: "From error message", text: errorMessage };
  }

  const stderr = firstMeaningfulLines(result.stderr);
  if (stderr) {
    return { sourceLabel: "From stderr", text: stderr };
  }

  const stdout = firstMeaningfulLines(result.stdout);
  if (stdout) {
    return { sourceLabel: "From stdout", text: stdout };
  }

  return {
    sourceLabel: "Summary",
    text: fallbackFailureCopy(result.status),
  };
}

export function validationOutputPreview(output: string): string {
  if (output.length <= OUTPUT_PREVIEW_LIMIT) {
    return output;
  }

  return `${output.slice(0, OUTPUT_PREVIEW_LIMIT)}\n[Preview truncated in UI.]`;
}

function firstMeaningfulLines(output: string): string | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, FAILURE_PREVIEW_LINE_LIMIT);

  if (lines.length === 0) {
    return null;
  }

  return truncatePreview(lines.join("\n"), FAILURE_PREVIEW_CHAR_LIMIT);
}

function truncatePreview(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n[Failure preview truncated.]`;
}

function fallbackFailureCopy(status: string): string {
  if (status === "timed_out") {
    return "Validation timed out before reporting details.";
  }

  if (status === "failed_to_start") {
    return "Validation could not start.";
  }

  return "Validation completed with failures. Review stdout and stderr for details.";
}
