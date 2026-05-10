import { useId, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type {
  GitBranchStatus,
  GitLastCommit,
  GitRepositoryStatus,
} from "../workspace/types";
import type { WidgetRenderProps } from "./types";

const plannedReviewCards = [
  {
    title: "Changed files",
    description:
      "Planned: staged, unstaged, and untracked file groups with readable change summaries.",
  },
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
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const repositoryRoot = repositoryRootDraft.trim();
  const hasRepositoryRootDraft = repositoryRoot.length > 0;
  const canRefreshStatus = hasRepositoryRootDraft && !isRefreshingStatus;

  async function refreshStatus() {
    if (!hasRepositoryRootDraft || isRefreshingStatus) {
      return;
    }

    if (!onGetGitRepositoryStatus) {
      setGitStatus(null);
      setStatusRepositoryRoot(null);
      setStatusError("Git status is not connected for this widget.");
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
      setStatusError(errorMessageFromUnknown(error));
    } finally {
      setIsRefreshingStatus(false);
    }
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
      subtitle="Git repository status"
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
              {hasRepositoryRootDraft
                ? "This transient path is used only for the next manual read-only refresh."
                : "Repository root not configured. Enter an explicit local repository path to refresh read-only status."}
            </p>
          </div>
          <Badge variant="neutral">Transient</Badge>
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
              onChange={(event) => setRepositoryRootDraft(event.target.value)}
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
            {isRefreshingStatus ? "Refreshing..." : "Refresh status"}
          </Button>
        </div>

        <p className="git-repository-root-note">
          The repository root and refreshed status are not persisted or watched.
          Hobit does not auto-detect repositories, scan parent directories, or
          run Git mutations here. Browser fallback cannot read Git.
        </p>
      </section>

      {isRefreshingStatus ? (
        <div aria-live="polite" className="git-status-feedback">
          Reading Git status from the explicit repository root.
        </div>
      ) : null}

      {statusError ? (
        <div
          aria-live="polite"
          className="git-status-feedback git-status-feedback-error"
          role="status"
        >
          {statusError}
        </div>
      ) : null}

      {gitStatus && statusRepositoryRoot ? (
        <GitStatusCard
          repositoryRoot={statusRepositoryRoot}
          status={gitStatus}
        />
      ) : null}

      {!gitStatus && !statusError && !isRefreshingStatus ? (
        <div className="empty-state">
          <p className="empty-state-title">No status snapshot loaded</p>
          <p className="empty-state-text">
            Provide an explicit repository root and refresh manually to read the
            current desktop Git status.
          </p>
        </div>
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
          Review diff
        </Button>
        <Button disabled variant="secondary">
          Push
        </Button>
        <Button disabled variant="secondary">
          Create follow-up block
        </Button>
      </div>
    </WidgetFrame>
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

  return (
    <section aria-label="Git repository status result" className="git-status-card">
      <div className="git-status-card-header">
        <div className="git-status-title-copy">
          <h3 className="git-status-card-title">Repository status</h3>
          <p className="git-status-card-subtitle">Manual read-only snapshot</p>
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
    </section>
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
  errorMessage: string | null,
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

function shortCommitHash(hash: string) {
  return hash.length > 7 ? hash.slice(0, 7) : hash;
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Git status could not be refreshed.";
}
