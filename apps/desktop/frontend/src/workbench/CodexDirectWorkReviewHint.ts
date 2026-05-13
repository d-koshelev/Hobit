import type { DirectWorkGitReviewStatus } from "./types";

export type DirectWorkGitWidgetAvailability = "available" | "missing" | "unknown";

export function directWorkGitReviewHint(
  status: string,
  gitWidgetAvailability: DirectWorkGitWidgetAvailability,
  gitReviewStatus?: DirectWorkGitReviewStatus | null,
) {
  const needsLogReview =
    status === "failed" || status === "timed_out" || status === "cancelled";

  if (gitReviewStatus?.state === "completed") {
    return "Git widget is available; refreshed read-only status for this repo root.";
  }

  if (gitReviewStatus?.state === "failed") {
    return `Git widget auto-refresh failed: ${
      gitReviewStatus.errorMessage ?? "unknown error"
    }. You can refresh it manually.`;
  }

  if (gitReviewStatus?.state === "pending") {
    return "Git widget is available; refreshing read-only status for this repo root.";
  }

  if (needsLogReview) {
    if (gitWidgetAvailability === "missing") {
      return "Manual next step: inspect the live log, then add the Git widget if files may have changed.";
    }

    return "Manual next step: inspect the live log, then refresh the Git widget if files may have changed.";
  }

  if (gitWidgetAvailability === "available") {
    return "Manual next step: Git widget is available; refresh it to review changed files.";
  }

  if (gitWidgetAvailability === "missing") {
    return "Manual next step: Add the Git widget to review repository changes.";
  }

  return "Manual next step: refresh the Git widget to review changed files.";
}

export function directWorkGitWidgetAvailability(hasGitWidget?: boolean) {
  if (hasGitWidget === true) {
    return "available";
  }

  if (hasGitWidget === false) {
    return "missing";
  }

  return "unknown";
}
