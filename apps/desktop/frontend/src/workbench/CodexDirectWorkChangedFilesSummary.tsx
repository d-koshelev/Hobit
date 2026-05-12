import { Badge } from "../design-system/Badge";
import type { GitFileChange, GitRepositoryStatus } from "../workspace/types";
import {
  gitChangedFileDisplayView,
  gitChangedFileGroups,
  gitChangedFilePathLabel,
  gitChangeAreaLabel,
  gitChangeKindBadgeVariant,
  gitChangeKindLabel,
  type GitChangedFileGroupView,
} from "./gitStatusViewModel";
import type { DirectWorkGitReviewStatus } from "./types";

type CodexDirectWorkChangedFilesSummaryProps = {
  gitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
};

export function CodexDirectWorkChangedFilesSummary({
  gitReviewStatus,
  hasGitWidget,
}: CodexDirectWorkChangedFilesSummaryProps) {
  const view = directWorkChangedFilesSummaryView(
    gitReviewStatus,
    Boolean(hasGitWidget),
  );

  return (
    <section
      aria-label="Direct Work changed files summary"
      className="git-changed-files"
    >
      <div className="git-changed-files-header">
        <div className="git-status-title-copy">
          <h3 className="git-status-card-title">Changed files</h3>
          <p className="git-status-card-subtitle">
            Read-only Git status for the Direct Work repo root
          </p>
        </div>
        <Badge variant={view.badgeVariant}>{view.badgeLabel}</Badge>
      </div>

      {view.repositoryStatus ? (
        <DirectWorkChangedFilesList status={view.repositoryStatus} />
      ) : (
        <div className="git-changed-files-empty">{view.message}</div>
      )}
    </section>
  );
}

function DirectWorkChangedFilesList({
  status,
}: {
  status: GitRepositoryStatus;
}) {
  if (status.changedFiles.length === 0) {
    return (
      <div className="git-changed-files-empty">
        No repository changes detected.
      </div>
    );
  }

  const groups = gitChangedFileGroups(status.changedFiles).filter(
    (group) => group.files.length > 0,
  );

  return (
    <div className="git-changed-file-groups">
      {groups.map((group) => (
        <DirectWorkChangedFileGroup group={group} key={group.key} />
      ))}
    </div>
  );
}

function DirectWorkChangedFileGroup({
  group,
}: {
  group: GitChangedFileGroupView;
}) {
  const { hiddenCount, visibleFiles } = gitChangedFileDisplayView(group.files);
  const hiddenFiles = group.files.slice(visibleFiles.length);

  return (
    <section className="git-changed-file-group">
      <div className="git-changed-file-group-header">
        <h4 className="git-changed-file-group-title">{group.title}</h4>
        <Badge variant={group.badgeVariant}>{group.files.length}</Badge>
      </div>

      <div className="git-changed-file-list">
        {visibleFiles.map((file, index) => (
          <DirectWorkChangedFileRow
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
              <DirectWorkChangedFileRow
                file={file}
                key={`${group.key}-hidden-${file.area}-${file.kind}-${file.path}-${index}`}
                showArea={group.key === "conflicted" || group.key === "unknown"}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function DirectWorkChangedFileRow({
  file,
  showArea,
}: {
  file: GitFileChange;
  showArea: boolean;
}) {
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
        </div>
      </div>
    </div>
  );
}

function directWorkChangedFilesSummaryView(
  gitReviewStatus: DirectWorkGitReviewStatus | null | undefined,
  hasGitWidget: boolean,
): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  message: string;
  repositoryStatus: GitRepositoryStatus | null;
} {
  if (!hasGitWidget || !gitReviewStatus) {
    return {
      badgeLabel: "Unavailable",
      badgeVariant: "neutral",
      message: "Git status is unavailable for this repo root.",
      repositoryStatus: null,
    };
  }

  if (gitReviewStatus.state === "pending") {
    return {
      badgeLabel: "Reading",
      badgeVariant: "info",
      message: "Reading read-only Git status for this repo root.",
      repositoryStatus: null,
    };
  }

  if (gitReviewStatus.state === "failed") {
    return {
      badgeLabel: "Error",
      badgeVariant: "error",
      message: `Could not read Git status: ${
        gitReviewStatus.errorMessage ?? "Unknown error."
      }`,
      repositoryStatus: null,
    };
  }

  const repositoryStatus = gitReviewStatus.repositoryStatus ?? null;

  if (!repositoryStatus) {
    return {
      badgeLabel: "Unavailable",
      badgeVariant: "neutral",
      message: "Git status is unavailable for this repo root.",
      repositoryStatus: null,
    };
  }

  return {
    badgeLabel:
      repositoryStatus.changedFiles.length === 0
        ? "No changes"
        : `${repositoryStatus.changedFiles.length} files`,
    badgeVariant:
      repositoryStatus.changedFiles.length === 0 ? "success" : "warning",
    message: "",
    repositoryStatus,
  };
}
