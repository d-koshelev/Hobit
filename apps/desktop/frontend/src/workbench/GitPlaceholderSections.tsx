import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type {
  GitFileChange,
  GitLastCommit,
  GitRepositoryStatus,
} from "../workspace/types";
import {
  gitChangedFileDisplayView,
  gitChangedFileGroups,
  gitChangedFilePathLabel,
  gitChangeAreaLabel,
  gitChangeKindBadgeVariant,
  gitChangeKindLabel,
  gitFileRiskHints,
  gitStatusCompactLine,
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
  supportsDesktopGitReads: boolean;
}) {
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
    </section>
  );
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
  status,
}: {
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
          <h3 className="git-status-card-title">Status</h3>
          <p className="git-status-card-subtitle">
            Read-only snapshot from the explicit path above
          </p>
        </div>
        <div className="git-status-badge-row">
          <Badge variant={statusSummary.stateBadgeVariant}>
            {statusSummary.stateLabel}
          </Badge>
        </div>
      </div>

      <p
        className={`git-status-summary-line git-status-summary-line-${statusSummary.stateTone}`}
      >
        {gitStatusCompactLine(status)}
      </p>

      <p className="git-status-boundary">
        Status refresh is read-only; it does not fetch, poll, watch, or mutate
        Git.
      </p>

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
