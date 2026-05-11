import type {
  GitBranchStatus,
  GitFileChange,
  GitRepositoryStatus,
} from "../workspace/types";

const CHANGED_FILE_DISPLAY_LIMIT = 20;
const ERROR_DETAIL_DISPLAY_LIMIT = 360;

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export type GitFrameStatusView = {
  label: string;
  variant: BadgeVariant;
};

export type GitStatusSummaryView = {
  stateBadgeVariant: "success" | "warning" | "neutral";
  stateLabel: string;
  stateText: string;
  stateTitle: string;
  stateTone: "clean" | "dirty";
};

export type GitStatusErrorCategory =
  | "not-configured"
  | "unsupported-browser"
  | "path-not-found"
  | "not-repository"
  | "git-unavailable"
  | "permission-denied"
  | "timed-out"
  | "output-too-large"
  | "parse-error"
  | "command-failed"
  | "unavailable"
  | "unknown";

export type GitStatusErrorView = {
  badgeLabel: string;
  category: GitStatusErrorCategory;
  detail?: string;
  message: string;
  title: string;
};

export type GitChangedFileGroupKey =
  | "staged"
  | "unstaged"
  | "untracked"
  | "conflicted"
  | "unknown";

export type GitChangedFileGroupView = {
  badgeVariant: BadgeVariant;
  files: GitFileChange[];
  key: GitChangedFileGroupKey;
  title: string;
};

export type GitChangedFileDisplayView = {
  hiddenCount: number;
  visibleFiles: GitFileChange[];
};

export type PlannedGitReviewCardView = {
  description: string;
  title: string;
};

export const plannedGitReviewCards: PlannedGitReviewCardView[] = [
  {
    title: "Validation results",
    description:
      "Planned: passed, failed, skipped, and warning states linked to the current block.",
  },
  {
    title: "Commit / push state",
    description:
      "Planned: reviewed commit message, commit hash when available, and push-needed state.",
  },
  {
    title: "Recovery actions",
    description:
      "Planned: explicit operator-controlled restore, revert, stash, reset, and clean flows.",
  },
];

export function gitFrameStatusView(
  status: GitRepositoryStatus | null,
  errorMessage: GitStatusErrorView | null,
  isRefreshing: boolean,
): GitFrameStatusView {
  if (isRefreshing) {
    return {
      label: "Reading",
      variant: "info",
    };
  }

  if (errorMessage) {
    return {
      label: "Error",
      variant: "error",
    };
  }

  if (!status) {
    return {
      label: "Ready",
      variant: "neutral",
    };
  }

  return status.workingTree.isClean
    ? {
        label: "Clean",
        variant: "success",
      }
    : {
        label: "Dirty",
        variant: "warning",
      };
}

export function repositoryRootHelpText(
  hasRepositoryRootDraft: boolean,
  supportsDesktopGitReads: boolean,
) {
  if (!supportsDesktopGitReads) {
    return "Desktop/Tauri shell is required for real Git reads. The path remains transient and local to this widget.";
  }

  if (hasRepositoryRootDraft) {
    return "This transient path is used only for manual read-only status snapshots.";
  }

  return "Repository root not configured. Enter an explicit local repository path to enable refresh.";
}

export function gitStatusSummary(
  status: GitRepositoryStatus,
): GitStatusSummaryView {
  const isClean = status.workingTree.isClean;

  return {
    stateBadgeVariant: isClean
      ? "success"
      : status.workingTree.isDirty
        ? "warning"
        : "neutral",
    stateLabel: isClean ? "Clean" : "Dirty",
    stateText: isClean
      ? "No changed files were reported in this manual snapshot."
      : "This snapshot is read-only. Review groups below show current changes, but no Git action is available here.",
    stateTitle: isClean
      ? "Working tree clean"
      : "Uncommitted changes detected",
    stateTone: isClean ? "clean" : "dirty",
  };
}

export function branchLabel(branch: GitBranchStatus | null) {
  if (!branch) {
    return "Not reported";
  }

  const branchName = branch.name ?? "Unnamed branch";
  const branchSuffix = branch.isDetached ? " (detached)" : "";

  return branch.upstream
    ? `${branchName}${branchSuffix} -> ${branch.upstream}`
    : `${branchName}${branchSuffix}`;
}

export function aheadBehindLabel(branch: GitBranchStatus | null) {
  if (!branch) {
    return "Not reported";
  }

  const parts: string[] = [];

  if (branch.ahead !== null) {
    parts.push(`ahead ${branch.ahead}`);
  }

  if (branch.behind !== null) {
    parts.push(`behind ${branch.behind}`);
  }

  return parts.length > 0 ? parts.join(" / ") : "Not reported";
}

export function gitChangedFileGroups(
  changedFiles: GitFileChange[],
): GitChangedFileGroupView[] {
  const groups: GitChangedFileGroupView[] = [
    {
      badgeVariant: "info",
      files: [],
      key: "staged",
      title: "Staged",
    },
    {
      badgeVariant: "warning",
      files: [],
      key: "unstaged",
      title: "Unstaged",
    },
    {
      badgeVariant: "warning",
      files: [],
      key: "untracked",
      title: "Untracked",
    },
    {
      badgeVariant: "error",
      files: [],
      key: "conflicted",
      title: "Conflicted",
    },
    {
      badgeVariant: "neutral",
      files: [],
      key: "unknown",
      title: "Unknown",
    },
  ];

  for (const file of changedFiles) {
    const group = groups.find(
      (candidate) => candidate.key === gitChangedFileGroupKey(file),
    );

    (group ?? groups[groups.length - 1]).files.push(file);
  }

  return groups;
}

export function gitChangedFileDisplayView(
  files: GitFileChange[],
): GitChangedFileDisplayView {
  const visibleFiles = files.slice(0, CHANGED_FILE_DISPLAY_LIMIT);

  return {
    hiddenCount: files.length - visibleFiles.length,
    visibleFiles,
  };
}

export function gitChangedFilePathLabel(file: GitFileChange) {
  return file.originalPath ? `${file.originalPath} -> ${file.path}` : file.path;
}

export function gitChangeKindLabel(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "Added";
    case "modified":
      return "Modified";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
    case "copied":
      return "Copied";
    case "untracked":
      return "Untracked";
    case "conflicted":
      return "Conflicted";
    default:
      return "Unknown";
  }
}

export function gitChangeKindBadgeVariant(kind: string): BadgeVariant {
  switch (kind.toLowerCase()) {
    case "added":
      return "success";
    case "modified":
    case "renamed":
    case "copied":
      return "info";
    case "deleted":
    case "untracked":
    case "unknown":
      return "warning";
    case "conflicted":
      return "error";
    default:
      return "warning";
  }
}

export function gitChangeAreaLabel(area: string) {
  switch (area.toLowerCase()) {
    case "staged":
      return "Staged";
    case "unstaged":
      return "Unstaged";
    case "untracked":
      return "Untracked";
    default:
      return "Unknown area";
  }
}

export function gitFileRiskHints(path: string) {
  const normalizedPath = path.split("\\").join("/").toLowerCase();
  const pathParts = normalizedPath.split("/");
  const fileName = pathParts[pathParts.length - 1] ?? normalizedPath;
  const hints: string[] = [];

  if (
    pathSegmentLooksGenerated(normalizedPath, "gen") ||
    pathSegmentLooksGenerated(normalizedPath, "dist") ||
    pathSegmentLooksGenerated(normalizedPath, "target") ||
    pathSegmentLooksGenerated(normalizedPath, "node_modules")
  ) {
    hints.push("Generated-looking");
  }

  if (
    fileName === "package-lock.json" ||
    fileName === "cargo.lock" ||
    fileName === "cargo.toml"
  ) {
    hints.push("Dependency");
  }

  if (
    fileName === "schema.rs" ||
    fileName.endsWith(".sql") ||
    normalizedPath.startsWith("migrations/") ||
    normalizedPath.includes("/migrations/")
  ) {
    hints.push("Schema");
  }

  return hints;
}

export function shortCommitHash(hash: string) {
  return hash.length > 7 ? hash.slice(0, 7) : hash;
}

export function gitStatusErrorViewFromUnknown(
  error: unknown,
): GitStatusErrorView {
  if (error instanceof Error) {
    return gitStatusErrorViewFromMessage(error.message);
  }

  if (typeof error === "string") {
    return gitStatusErrorViewFromMessage(error);
  }

  return gitStatusErrorViewFromCategory("unknown");
}

export function gitStatusErrorViewFromCategory(
  category: GitStatusErrorCategory,
): GitStatusErrorView {
  switch (category) {
    case "not-configured":
      return {
        badgeLabel: "Not configured",
        category,
        message:
          "Enter an explicit local repository root before reading Git status.",
        title: "Repository root not configured",
      };
    case "unsupported-browser":
      return {
        badgeLabel: "Desktop required",
        category,
        message:
          "Git status reads require the Tauri desktop shell. Browser/Vite fallback cannot read local repositories.",
        title: "Git status unavailable in browser mode",
      };
    case "path-not-found":
      return {
        badgeLabel: "Path not found",
        category,
        message:
          "The configured repository root could not be found. Check the local path and refresh again.",
        title: "Repository path not found",
      };
    case "not-repository":
      return {
        badgeLabel: "Not a repo",
        category,
        message:
          "The configured path exists, but Git did not identify it as a repository root.",
        title: "Path is not a Git repository",
      };
    case "git-unavailable":
      return {
        badgeLabel: "Git unavailable",
        category,
        message:
          "The desktop shell could not start Git. Confirm Git is installed and available on PATH.",
        title: "Git executable unavailable",
      };
    case "permission-denied":
      return {
        badgeLabel: "Permission denied",
        category,
        message:
          "Hobit could not read Git status for this path because the operating system denied access.",
        title: "Permission denied",
      };
    case "timed-out":
      return {
        badgeLabel: "Timed out",
        category,
        message:
          "The read-only Git status command did not finish in time. No Git mutation was attempted.",
        title: "Git status timed out",
      };
    case "output-too-large":
      return {
        badgeLabel: "Too large",
        category,
        message:
          "Git returned more status output than Hobit accepts for this read-only snapshot.",
        title: "Git status output too large",
      };
    case "parse-error":
      return {
        badgeLabel: "Parse error",
        category,
        message:
          "Git status returned output that Hobit could not convert into the visual summary.",
        title: "Could not parse Git status",
      };
    case "command-failed":
      return {
        badgeLabel: "Command failed",
        category,
        message:
          "Git returned a status failure for this root. Confirm the path is a readable repository and refresh again.",
        title: "Git status command failed",
      };
    case "unavailable":
      return {
        badgeLabel: "Unavailable",
        category,
        message:
          "This widget is not connected to the desktop Git status reader.",
        title: "Git status reader unavailable",
      };
    case "unknown":
      return {
        badgeLabel: "Unknown",
        category,
        message:
          "Git status could not be refreshed. No repository state was changed.",
        title: "Unknown Git status failure",
      };
  }
}

function gitChangedFileGroupKey(
  file: GitFileChange,
): GitChangedFileGroupKey {
  const kind = file.kind.toLowerCase();
  const area = file.area.toLowerCase();

  if (kind === "conflicted") {
    return "conflicted";
  }

  if (kind === "unknown") {
    return "unknown";
  }

  if (area === "staged" || area === "unstaged" || area === "untracked") {
    return area;
  }

  return "unknown";
}

function pathSegmentLooksGenerated(path: string, segment: string) {
  return (
    path === segment ||
    path.startsWith(`${segment}/`) ||
    path.includes(`/${segment}/`)
  );
}

function gitStatusErrorViewFromMessage(message: string): GitStatusErrorView {
  const normalizedMessage = message.trim();
  const lowerMessage = normalizedMessage.toLowerCase();

  if (
    lowerMessage.includes("browser fallback") ||
    lowerMessage.includes("tauri desktop shell") ||
    lowerMessage.includes("not supported here")
  ) {
    return gitStatusErrorViewFromCategory("unsupported-browser");
  }

  if (
    lowerMessage.includes("repository is not configured") ||
    lowerMessage.includes("repository root must not be empty") ||
    lowerMessage.includes("repository root is not configured")
  ) {
    return gitStatusErrorViewFromCategory("not-configured");
  }

  if (
    lowerMessage.includes("path is not a git repository") ||
    lowerMessage.includes("not a git repository")
  ) {
    return gitStatusErrorViewFromCategory("not-repository");
  }

  if (
    lowerMessage.includes("repository path was not found") ||
    lowerMessage.includes("path not found") ||
    lowerMessage.includes("no such file or directory") ||
    lowerMessage.includes("cannot find the path")
  ) {
    return gitStatusErrorViewFromCategory("path-not-found");
  }

  if (
    lowerMessage.includes("git is not available") ||
    lowerMessage.includes("could not start git status command")
  ) {
    return gitStatusErrorViewFromCategory("git-unavailable");
  }

  if (
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("access is denied")
  ) {
    return gitStatusErrorViewFromCategory("permission-denied");
  }

  if (lowerMessage.includes("timed out")) {
    return gitStatusErrorViewFromCategory("timed-out");
  }

  if (
    lowerMessage.includes("output is too large") ||
    lowerMessage.includes("output too large")
  ) {
    return gitStatusErrorViewFromCategory("output-too-large");
  }

  if (
    lowerMessage.includes("could not parse git status") ||
    lowerMessage.includes("not valid utf-8")
  ) {
    return gitStatusErrorViewFromCategory("parse-error");
  }

  if (lowerMessage.includes("git status command failed")) {
    return {
      ...gitStatusErrorViewFromCategory("command-failed"),
      detail: compactErrorDetail(normalizedMessage),
    };
  }

  return {
    ...gitStatusErrorViewFromCategory("unknown"),
    detail: normalizedMessage
      ? compactErrorDetail(normalizedMessage)
      : undefined,
  };
}

function compactErrorDetail(message: string) {
  if (message.length <= ERROR_DETAIL_DISPLAY_LIMIT) {
    return message;
  }

  return `${message.slice(0, ERROR_DETAIL_DISPLAY_LIMIT)}...`;
}
