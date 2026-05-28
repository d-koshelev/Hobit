import { Button } from "../design-system/Button";
import type { GitFileDiff } from "../workspace/types";

type GitDiffPanelProps = {
  diffResult: GitFileDiff | null;
  error: string | null;
  isLoadingDiff: boolean;
  onRefreshDiff: () => void;
  selectedFilePath: string | null;
};

export function GitDiffPanel({
  diffResult,
  error,
  isLoadingDiff,
  onRefreshDiff,
  selectedFilePath,
}: GitDiffPanelProps) {
  return (
    <section className="git-tab-panel git-diff-panel" role="tabpanel">
      <div className="git-panel-header">
        <div className="git-panel-copy">
          <h3 className="git-panel-title">Diff</h3>
          <p className="git-panel-subtitle">
            {selectedFilePath ?? "Select a changed file"}
          </p>
        </div>
        <Button
          disabled={!selectedFilePath || isLoadingDiff}
          onClick={onRefreshDiff}
          variant="secondary"
        >
          {isLoadingDiff ? "Loading..." : "Reload diff"}
        </Button>
      </div>
      {!selectedFilePath ? (
        <GitEmptyState
          text="Choose a changed file to review its diff."
          title="No file selected"
        />
      ) : error ? (
        <GitEmptyState text={error} title="Diff unavailable" tone="error" />
      ) : isLoadingDiff ? (
        <GitEmptyState text="Reading selected-file diff." title="Loading diff" />
      ) : diffResult?.patch ? (
        <>
          {diffResult.errorMessage ? (
            <p className="git-inline-status">{diffResult.errorMessage}</p>
          ) : null}
          <pre className="git-diff-output">
            <code>{diffResult.patch}</code>
          </pre>
        </>
      ) : diffResult ? (
        <GitEmptyState
          text={diffResult.errorMessage ?? "Git returned no patch for this file."}
          title={
            diffResult.status === "untracked"
              ? "Untracked file"
              : "No diff output"
          }
        />
      ) : (
        <GitEmptyState
          text="Select a changed file from Changes."
          title="No diff loaded"
        />
      )}
    </section>
  );
}

function GitEmptyState({
  text,
  title,
  tone = "neutral",
}: {
  text: string;
  title: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className={`git-empty-state git-empty-state-${tone}`}>
      <p className="git-empty-title">{title}</p>
      <p className="git-empty-text">{text}</p>
    </div>
  );
}
