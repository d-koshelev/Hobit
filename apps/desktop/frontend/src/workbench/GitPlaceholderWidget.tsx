import { useId, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { isTauriRuntime } from "../workspace/tauriEnvironment";
import type {
  GitBranchStatus,
  GitFileChange,
  GitLastCommit,
  GitRepositoryStatus,
} from "../workspace/types";
import type { WidgetRenderProps } from "./types";

const CHANGED_FILE_DISPLAY_LIMIT = 20;
const ERROR_DETAIL_DISPLAY_LIMIT = 360;

const plannedReviewCards = [
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

export function GitPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onGetGitRepositoryStatus,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const repositoryRootInputId = useId();
  const repositoryRootTitleId = useId();
  const [repositoryRootDraft, setRepositoryRootDraft] = useState("");
  const [gitStatus, setGitStatus] = useState<GitRepositoryStatus | null>(null);
  const [statusRepositoryRoot, setStatusRepositoryRoot] = useState<
    string | null
  >(null);
  const [statusError, setStatusError] = useState<GitStatusErrorView | null>(
    null,
  );
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const supportsDesktopGitReads = isTauriRuntime();
  const canReadGitStatus =
    supportsDesktopGitReads && Boolean(onGetGitRepositoryStatus);
  const repositoryRoot = repositoryRootDraft.trim();
  const hasRepositoryRootDraft = repositoryRoot.length > 0;
  const canRefreshStatus =
    canReadGitStatus && hasRepositoryRootDraft && !isRefreshingStatus;

  async function refreshStatus() {
    if (isRefreshingStatus) {
      return;
    }

    if (!hasRepositoryRootDraft) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError(gitStatusErrorViewFromCategory("not-configured"));
      return;
    }

    if (!supportsDesktopGitReads) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError(gitStatusErrorViewFromCategory("unsupported-browser"));
      return;
    }

    if (!onGetGitRepositoryStatus) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError(gitStatusErrorViewFromCategory("unavailable"));
      return;
    }

    setIsRefreshingStatus(true);
    setStatusError(null);
    setGitStatus(null);
    setStatusRepositoryRoot(null);

    try {
      const status = await onGetGitRepositoryStatus(instance.id, repositoryRoot);

      if (!status) {
        throw new Error("Git status was not returned for this widget.");
      }

      setGitStatus(status);
      setStatusRepositoryRoot(repositoryRoot);
    } catch (error) {
      setStatusError(gitStatusErrorViewFromUnknown(error));
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  function updateRepositoryRootDraft(value: string) {
    setRepositoryRootDraft(value);
    setStatusError(null);
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={gitFrameStatus(gitStatus, statusError, isRefreshingStatus)}
      title={title}
    >
      <section
        aria-labelledby={repositoryRootTitleId}
        className="git-repository-root-panel"
      >
        <div className="git-repository-root-header">
          <div className="git-repository-root-copy">
            <h3
              className="git-repository-root-title"
              id={repositoryRootTitleId}
            >
              Repository root
            </h3>
            <p className="git-repository-root-text">
              {repositoryRootHelpText(
                hasRepositoryRootDraft,
                supportsDesktopGitReads,
              )}
            </p>
          </div>
          <Badge variant={supportsDesktopGitReads ? "neutral" : "info"}>
            {supportsDesktopGitReads ? "Transient" : "Desktop required"}
          </Badge>
        </div>

        <div className="git-repository-root-controls">
          <div className="git-repository-root-field">
            <label
              className="git-repository-root-label"
              htmlFor={repositoryRootInputId}
            >
              Explicit local path
            </label>
            <input
              autoComplete="off"
              className="input"
              id={repositoryRootInputId}
              onChange={(event) =>
                updateRepositoryRootDraft(event.target.value)
              }
              placeholder="C:\\path\\to\\repository"
              spellCheck={false}
              type="text"
              value={repositoryRootDraft}
            />
          </div>
          <Button
            disabled={!canRefreshStatus}
            onClick={refreshStatus}
            variant="primary"
          >
            {isRefreshingStatus ? "Refreshing..." : "Refresh snapshot"}
          </Button>
        </div>

        <p className="git-repository-root-note">
          Manual refresh reads a desktop-only, read-only status snapshot. The
          repository root and status are not persisted, polled, watched, or used
          for Git mutations.
        </p>
      </section>

      {!supportsDesktopGitReads ? (
        <GitStatusNotice
          message="Browser/Vite fallback keeps the widget insertable, but real Git status reads require the Tauri desktop shell."
          title="Desktop Git reads unavailable"
          variant="info"
        />
      ) : null}

      {isRefreshingStatus ? (
        <GitStatusNotice
          ariaLive
          message="Reading a read-only Git status snapshot from the explicit repository root."
          title="Refreshing snapshot"
          variant="info"
        />
      ) : null}

      {statusError ? (
        <GitStatusErrorNotice error={statusError} />
      ) : null}

      {gitStatus && statusRepositoryRoot ? (
        <GitStatusCard
          repositoryRoot={statusRepositoryRoot}
          status={gitStatus}
        />
      ) : null}

      {supportsDesktopGitReads && !gitStatus && !statusError && !isRefreshingStatus ? (
        <GitStatusNotice
          message={
            hasRepositoryRootDraft
              ? "Ready to read one manual snapshot. Hobit will not poll, watch, persist, or mutate this repository."
              : "Enter an explicit local repository path before reading Git status."
          }
          title={
            hasRepositoryRootDraft
              ? "No status snapshot loaded"
              : "Repository root not configured"
          }
          variant="neutral"
        />
      ) : null}

      <div aria-label="Planned Git review areas" className="git-review-grid">
        {plannedReviewCards.map((card) => (
          <section className="git-review-card" key={card.title}>
            <div className="git-review-card-header">
              <h3 className="git-review-card-title">{card.title}</h3>
              <Badge variant="neutral">Planned</Badge>
            </div>
            <p className="git-review-card-text">{card.description}</p>
          </section>
        ))}
      </div>

      <div aria-label="Planned Git actions" className="git-action-row">
        <Button disabled variant="secondary">
          Diff review planned
        </Button>
        <Button disabled variant="secondary">
          Push planned
        </Button>
        <Button disabled variant="secondary">
          Follow-up planned
        </Button>
      </div>
    </WidgetFrame>
  );
}

function GitStatusNotice({
  ariaLive = false,
  message,
  title,
  variant,
}: {
  ariaLive?: boolean;
  message: string;
  title: string;
  variant: "neutral" | "info";
}) {
  return (
    <div
      aria-live={ariaLive ? "polite" : undefined}
      className={`git-status-feedback git-status-feedback-${variant}`}
      role={ariaLive ? "status" : undefined}
    >
      <p className="git-status-feedback-title">{title}</p>
      <p className="git-status-feedback-text">{message}</p>
    </div>
  );
}

function GitStatusErrorNotice({ error }: { error: GitStatusErrorView }) {
  return (
    <div
      aria-live="polite"
      className="git-status-feedback git-status-feedback-error"
      role="status"
    >
      <div className="git-status-feedback-heading-row">
        <p className="git-status-feedback-title">{error.title}</p>
        <Badge variant="error">{error.badgeLabel}</Badge>
      </div>
      <p className="git-status-feedback-text">{error.message}</p>
      {error.detail ? (
        <p className="git-status-feedback-detail">{error.detail}</p>
      ) : null}
    </div>
  );
}

function GitStatusCard({
  repositoryRoot,
  status,
}: {
  repositoryRoot: string;
  status: GitRepositoryStatus;
}) {
  const stateBadgeVariant: "success" | "warning" | "neutral" = status
    .workingTree.isClean
    ? "success"
    : status.workingTree.isDirty
      ? "warning"
      : "neutral";
  const stateLabel = status.workingTree.isClean ? "Clean" : "Dirty";
  const stateTone = status.workingTree.isClean ? "clean" : "dirty";

  return (
    <section aria-label="Git repository status result" className="git-status-card">
      <div className="git-status-card-header">
        <div className="git-status-title-copy">
          <h3 className="git-status-card-title">Repository status</h3>
          <p className="git-status-card-subtitle">
            Manual read-only snapshot; not persisted or watched
          </p>
        </div>
        <div className="git-status-badge-row">
          <Badge variant={stateBadgeVariant}>{stateLabel}</Badge>
          <Badge variant="neutral">Read-only</Badge>
        </div>
      </div>

      <div className="git-status-root">
        <span className="git-status-root-label">Root used</span>
        <code className="git-status-root-value">{repositoryRoot}</code>
      </div>

      <div className={`git-status-state git-status-state-${stateTone}`}>
        <p className="git-status-state-title">
          {status.workingTree.isClean
            ? "Working tree clean"
            : "Uncommitted changes detected"}
        </p>
        <p className="git-status-state-text">
          {status.workingTree.isClean
            ? "No changed files were reported in this manual snapshot."
            : "This snapshot is read-only. Review groups below show current changes, but no Git action is available here."}
        </p>
      </div>

      <div className="git-status-metric-grid">
        <GitStatusMetric label="Branch" value={branchLabel(status.branch)} />
        <GitStatusMetric
          label="Working tree"
          value={stateLabel}
        />
        <GitStatusMetric
          label="Changed files"
          value={String(status.changedFiles.length)}
        />
        <GitStatusMetric
          label="Staged"
          value={String(status.workingTree.stagedCount)}
        />
        <GitStatusMetric
          label="Unstaged"
          value={String(status.workingTree.unstagedCount)}
        />
        <GitStatusMetric
          label="Untracked"
          value={String(status.workingTree.untrackedCount)}
        />
        <GitStatusMetric
          label="Ahead / behind"
          value={aheadBehindLabel(status.branch)}
        />
      </div>

      {status.lastCommit ? (
        <GitLastCommitSummary commit={status.lastCommit} />
      ) : null}

      {status.warnings.length > 0 ? (
        <div className="git-status-warnings">
          <p className="git-status-warning-title">Warnings</p>
          <ul className="git-status-warning-list">
            {status.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <GitChangedFilesSummary changedFiles={status.changedFiles} />
    </section>
  );
}

function GitChangedFilesSummary({
  changedFiles,
}: {
  changedFiles: GitFileChange[];
}) {
  const groups = gitChangedFileGroups(changedFiles);

  return (
    <section className="git-changed-files" aria-label="Changed files summary">
      <div className="git-changed-files-header">
        <div className="git-status-title-copy">
          <h3 className="git-status-card-title">Changed files</h3>
          <p className="git-status-card-subtitle">
            Read-only grouping from the latest manual status refresh
          </p>
        </div>
        <Badge variant={changedFiles.length > 0 ? "warning" : "success"}>
          {changedFiles.length} files
        </Badge>
      </div>

      {changedFiles.length === 0 ? (
        <div className="git-changed-files-empty">
          No changed files in this manual snapshot.
        </div>
      ) : (
        <div className="git-changed-file-groups">
          {groups
            .filter((group) => group.files.length > 0)
            .map((group) => (
              <GitChangedFileGroup key={group.key} group={group} />
            ))}
        </div>
      )}
    </section>
  );
}

function GitChangedFileGroup({ group }: { group: GitChangedFileGroupView }) {
  const visibleFiles = group.files.slice(0, CHANGED_FILE_DISPLAY_LIMIT);
  const hiddenCount = group.files.length - visibleFiles.length;

  return (
    <section className="git-changed-file-group">
      <div className="git-changed-file-group-header">
        <h4 className="git-changed-file-group-title">{group.title}</h4>
        <Badge variant={group.badgeVariant}>{group.files.length}</Badge>
      </div>

      <div className="git-changed-file-list">
        {visibleFiles.map((file, index) => (
          <GitChangedFileRow
            file={file}
            key={`${group.key}-${file.area}-${file.kind}-${file.path}-${index}`}
            showArea={group.key === "conflicted" || group.key === "unknown"}
          />
        ))}
      </div>

      {hiddenCount > 0 ? (
        <p className="git-changed-file-more">
          {hiddenCount} more files not shown
        </p>
      ) : null}
    </section>
  );
}

function GitChangedFileRow({
  file,
  showArea,
}: {
  file: GitFileChange;
  showArea: boolean;
}) {
  const hints = gitFileRiskHints(file.path);

  return (
    <div className="git-changed-file-row">
      <div className="git-changed-file-main">
        <code className="git-changed-file-path">
          {file.originalPath ? `${file.originalPath} -> ${file.path}` : file.path}
        </code>
        <div className="git-changed-file-badges">
          <Badge variant={gitChangeKindBadgeVariant(file.kind)}>
            {gitChangeKindLabel(file.kind)}
          </Badge>
          {showArea ? (
            <Badge variant="neutral">{gitChangeAreaLabel(file.area)}</Badge>
          ) : null}
          {hints.map((hint) => (
            <Badge key={hint} variant="info">
              {hint}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function GitStatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="git-status-metric">
      <span className="git-status-metric-label">{label}</span>
      <span className="git-status-metric-value">{value}</span>
    </div>
  );
}

function GitLastCommitSummary({ commit }: { commit: GitLastCommit }) {
  return (
    <div className="git-status-commit">
      <span className="git-status-commit-label">Last commit</span>
      <div className="git-status-commit-copy">
        <span className="git-status-commit-title">{commit.title}</span>
        <span className="git-status-commit-meta">
          {shortCommitHash(commit.hash)}
          {commit.author ? ` by ${commit.author}` : ""}
          {commit.committedAt ? ` at ${commit.committedAt}` : ""}
        </span>
      </div>
    </div>
  );
}

function gitFrameStatus(
  status: GitRepositoryStatus | null,
  errorMessage: GitStatusErrorView | null,
  isRefreshing: boolean,
) {
  if (isRefreshing) {
    return <Badge variant="info">Reading</Badge>;
  }

  if (errorMessage) {
    return <Badge variant="error">Error</Badge>;
  }

  if (!status) {
    return <Badge variant="neutral">Ready</Badge>;
  }

  return status.workingTree.isClean ? (
    <Badge variant="success">Clean</Badge>
  ) : (
    <Badge variant="warning">Dirty</Badge>
  );
}

function repositoryRootHelpText(
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

function branchLabel(branch: GitBranchStatus | null) {
  if (!branch) {
    return "Not reported";
  }

  const branchName = branch.name ?? "Unnamed branch";
  const branchSuffix = branch.isDetached ? " (detached)" : "";

  return branch.upstream
    ? `${branchName}${branchSuffix} -> ${branch.upstream}`
    : `${branchName}${branchSuffix}`;
}

function aheadBehindLabel(branch: GitBranchStatus | null) {
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

type GitStatusErrorCategory =
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

type GitStatusErrorView = {
  badgeLabel: string;
  category: GitStatusErrorCategory;
  detail?: string;
  message: string;
  title: string;
};

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

type GitChangedFileGroupKey =
  | "staged"
  | "unstaged"
  | "untracked"
  | "conflicted"
  | "unknown";

type GitChangedFileGroupView = {
  badgeVariant: BadgeVariant;
  files: GitFileChange[];
  key: GitChangedFileGroupKey;
  title: string;
};

function gitChangedFileGroups(
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

function gitChangeKindLabel(kind: string) {
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

function gitChangeKindBadgeVariant(kind: string): BadgeVariant {
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

function gitChangeAreaLabel(area: string) {
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

function gitFileRiskHints(path: string) {
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

function pathSegmentLooksGenerated(path: string, segment: string) {
  return (
    path === segment ||
    path.startsWith(`${segment}/`) ||
    path.includes(`/${segment}/`)
  );
}

function shortCommitHash(hash: string) {
  return hash.length > 7 ? hash.slice(0, 7) : hash;
}

function gitStatusErrorViewFromUnknown(error: unknown): GitStatusErrorView {
  if (error instanceof Error) {
    return gitStatusErrorViewFromMessage(error.message);
  }

  if (typeof error === "string") {
    return gitStatusErrorViewFromMessage(error);
  }

  return gitStatusErrorViewFromCategory("unknown");
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

function gitStatusErrorViewFromCategory(
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
