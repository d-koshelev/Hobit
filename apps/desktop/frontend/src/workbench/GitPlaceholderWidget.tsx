import { useId, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { isTauriRuntime } from "../workspace/tauriEnvironment";
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
  gitFrameStatusView,
  gitStatusErrorViewFromCategory,
  gitStatusErrorViewFromUnknown,
  gitStatusSummary,
  plannedGitReviewCards,
  repositoryRootHelpText,
  shortCommitHash,
  type GitChangedFileGroupView,
  type GitStatusErrorView,
} from "./gitStatusViewModel";
import type { WidgetRenderProps } from "./types";

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
        {plannedGitReviewCards.map((card) => (
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
  const statusSummary = gitStatusSummary(status);

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
        <p className="git-status-state-title">
          {statusSummary.stateTitle}
        </p>
        <p className="git-status-state-text">
          {statusSummary.stateText}
        </p>
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
  const { hiddenCount, visibleFiles } = gitChangedFileDisplayView(group.files);

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

function gitFrameStatus(
  status: GitRepositoryStatus | null,
  errorMessage: GitStatusErrorView | null,
  isRefreshing: boolean,
) {
  const frameStatus = gitFrameStatusView(status, errorMessage, isRefreshing);

  return <Badge variant={frameStatus.variant}>{frameStatus.label}</Badge>;
}
