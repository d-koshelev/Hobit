export type DirectWorkGitWidgetAvailability = "available" | "missing" | "unknown";

export function directWorkGitReviewHint(
  status: string,
  gitWidgetAvailability: DirectWorkGitWidgetAvailability,
) {
  const needsLogReview = status === "failed" || status === "timed_out";

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
