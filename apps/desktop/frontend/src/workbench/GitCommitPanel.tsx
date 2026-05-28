import type { GitCommitResponse, GitRepositoryStatus } from "../workspace/types";
import { GitWidgetCommitPanel } from "./GitWidgetCommitPanel";

type GitCommitCreateRequest = {
  commitMessage: string;
  includedFiles: string[];
  repoRoot: string;
};

type GitCommitPanelProps = {
  onCreateGitCommit: (
    request: GitCommitCreateRequest,
  ) => Promise<GitCommitResponse | null>;
  onRefreshStatusAfterCommit: () => Promise<void>;
  repositoryRoot: string | null;
  status: GitRepositoryStatus | null;
};

export function GitCommitPanel({
  onCreateGitCommit,
  onRefreshStatusAfterCommit,
  repositoryRoot,
  status,
}: GitCommitPanelProps) {
  if (!status) {
    return (
      <section className="git-tab-panel" role="tabpanel">
        <GitEmptyState
          text="Load a repository status first."
          title="Commit unavailable"
        />
      </section>
    );
  }

  if (status.changedFiles.length === 0) {
    return (
      <section className="git-tab-panel" role="tabpanel">
        <GitEmptyState text="Nothing to commit." title="No local changes" />
      </section>
    );
  }

  return (
    <GitWidgetCommitPanel
      onCreateGitCommit={onCreateGitCommit}
      onRefreshStatusAfterCommit={onRefreshStatusAfterCommit}
      repositoryRoot={repositoryRoot}
      status={status}
    />
  );
}

function GitEmptyState({
  text,
  title,
}: {
  text: string;
  title: string;
}) {
  return (
    <div className="git-empty-state git-empty-state-neutral">
      <p className="git-empty-title">{title}</p>
      <p className="git-empty-text">{text}</p>
    </div>
  );
}
