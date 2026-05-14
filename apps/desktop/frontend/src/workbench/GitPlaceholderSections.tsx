import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  GitFileChange,
  GitLastCommit,
  GitRepositoryStatus,
} from "../workspace/types";
import {
  aheadBehindLabel,
  branchLabel,
  gitChangedFileDisplayView,
  gitChangedFileGroups,
  gitChangedFilePathLabel,
  gitChangeAreaLabel,
  gitChangeKindBadgeVariant,
  gitChangeKindLabel,
  gitFileRiskHints,
  gitStatusSummary,
  repositoryRootHelpText,
  shortCommitHash,
  type GitChangedFileGroupView,
  type GitStatusErrorView,
} from "./gitStatusViewModel";

export function GitRepositoryRootPanel({
  canRefreshStatus,
  hasRepositoryRootDraft,
  isRefreshingStatus,
  onRefreshStatus,
  onRepositoryRootDraftChange,
  repositoryRootDraft,
  repositoryRootInputId,
  repositoryRootTitleId,
  status,
  statusError,
  statusRepositoryRoot,
  supportsDesktopGitReads,
}: {
  canRefreshStatus: boolean;
  hasRepositoryRootDraft: boolean;
  isRefreshingStatus: boolean;
  onRefreshStatus: () => void;
  onRepositoryRootDraftChange: (value: string) => void;
  repositoryRootDraft: string;
  repositoryRootInputId: string;
  repositoryRootTitleId: string;
  status: GitRepositoryStatus | null;
  statusError: GitStatusErrorView | null;
  statusRepositoryRoot: string | null;
  supportsDesktopGitReads: boolean;
}) {
  const overviewFields = gitRepositoryOverviewFields({
    isRefreshingStatus,
    repositoryRootDraft,
    status,
    statusError,
    statusRepositoryRoot,
  });

  return (
    <section
      aria-labelledby={repositoryRootTitleId}
      className="git-repository-root-panel"
    >
      <div className="git-repository-root-header">
        <div className="git-repository-root-copy">
          <h3 className="git-repository-root-title" id={repositoryRootTitleId}>
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
              onRepositoryRootDraftChange(event.target.value)
            }
            placeholder="C:\\path\\to\\repository"
            spellCheck={false}
            type="text"
            value={repositoryRootDraft}
          />
        </div>
        <Button
          disabled={!canRefreshStatus}
          onClick={onRefreshStatus}
          variant="primary"
        >
          {isRefreshingStatus ? "Refreshing..." : "Refresh snapshot"}
        </Button>
      </div>

      <p className="git-repository-root-note">
        Manual refresh reads a desktop-only status snapshot. The repository
        root and status are not persisted, polled, or watched. Commit creation
        requires separate explicit confirmation.
      </p>

      <div
        aria-label="Repository snapshot overview"
        className="git-repository-overview-grid"
      >
        {overviewFields.map((field) => (
          <div className="git-repository-overview-field" key={field.label}>
            <span className="git-repository-overview-label">
              {field.label}
            </span>
            <span className="git-repository-overview-value">
              {field.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function gitRepositoryOverviewFields({
  isRefreshingStatus,
  repositoryRootDraft,
  status,
  statusError,
  statusRepositoryRoot,
}: {
  isRefreshingStatus: boolean;
  repositoryRootDraft: string;
  status: GitRepositoryStatus | null;
  statusError: GitStatusErrorView | null;
  statusRepositoryRoot: string | null;
}) {
  const loadedStatus = status ? gitStatusSummary(status) : null;
  const repositoryRoot = statusRepositoryRoot ?? repositoryRootDraft.trim();

  return [
    {
      label: "Repo root",
      value: repositoryRoot || "Not configured",
    },
    {
      label: "Status",
      value: isRefreshingStatus
        ? "Reading"
        : loadedStatus
          ? loadedStatus.stateLabel
          : statusError
            ? statusError.badgeLabel
            : "Not loaded",
    },
    {
      label: "Branch",
      value: status ? branchLabel(status.branch) : "Not reported",
    },
    {
      label: "Last refresh",
      value: isRefreshingStatus
        ? "Refreshing"
        : statusError
          ? "Failed"
          : status
            ? "Loaded"
            : "Not loaded",
    },
  ];
}

export function GitStatusNotice({
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

export function GitStatusErrorNotice({
  error,
}: {
  error: GitStatusErrorView;
}) {
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

export function GitStatusCard({
  repositoryRoot,
  status,
}: {
  repositoryRoot: string;
  status: GitRepositoryStatus;
}) {
  const statusSummary = gitStatusSummary(status);

  return (
    <section
      aria-label="Git repository status result"
      className="git-status-card"
    >
      <div className="git-status-card-header">
        <div className="git-status-title-copy">
          <h3 className="git-status-card-title">Repository</h3>
          <p className="git-status-card-subtitle">
            Latest manual read-only snapshot
          </p>
        </div>
        <div className="git-status-badge-row">
          <Badge variant={statusSummary.stateBadgeVariant}>
            {statusSummary.stateLabel}
          </Badge>
          <Badge variant="neutral">Read-only</Badge>
        </div>
      </div>

      <div className="git-status-root">
        <span className="git-status-root-label">Root used</span>
        <code className="git-status-root-value">{repositoryRoot}</code>
      </div>

      <div
        className={`git-status-state git-status-state-${statusSummary.stateTone}`}
      >
        <p className="git-status-state-title">{statusSummary.stateTitle}</p>
        <p className="git-status-state-text">{statusSummary.stateText}</p>
      </div>

      <div className="git-status-metric-grid">
        <GitStatusMetric label="Branch" value={branchLabel(status.branch)} />
        <GitStatusMetric
          label="Working tree"
          value={statusSummary.stateLabel}
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
          <h3 className="git-status-card-title">Changes</h3>
          <p className="git-status-card-subtitle">
            Grouped files from the latest manual status refresh
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
  const { hiddenCount, visibleFiles } = gitChangedFileDisplayView(group.files);
  const hiddenFiles = group.files.slice(visibleFiles.length);

  return (
    <section
      className={`git-changed-file-group git-changed-file-group-${group.key}`}
    >
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
        <details className="git-changed-file-more">
          <summary>{hiddenCount} more files</summary>
          <div className="git-changed-file-list">
            {hiddenFiles.map((file, index) => (
              <GitChangedFileRow
                file={file}
                key={`${group.key}-hidden-${file.area}-${file.kind}-${file.path}-${index}`}
                showArea={
                  group.key === "conflicted" || group.key === "unknown"
                }
              />
            ))}
          </div>
        </details>
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
          {gitChangedFilePathLabel(file)}
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
