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
    return "Workspace Git status refreshed for this repo root.";
  }

  if (gitReviewStatus?.state === "failed") {
    return `Workspace Git status refresh failed: ${
      gitReviewStatus.errorMessage ?? "unknown error"
    }.`;
  }

  if (gitReviewStatus?.state === "pending") {
    return "Refreshing Workspace Git status for this repo root.";
  }

  if (needsLogReview) {
    return "Manual next step: inspect the live log, then review Workspace Git status if files may have changed.";
  }

  if (gitWidgetAvailability === "available") {
    return "Manual next step: review Workspace Git status for changed files.";
  }

  if (gitWidgetAvailability === "missing") {
    return "Manual next step: review Workspace Git status for repository changes.";
  }

  return "Manual next step: review Workspace Git status for changed files.";
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
