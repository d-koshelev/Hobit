import { Button } from "../design-system/Button";
import type { GitLog } from "../workspace/types";

type GitHistoryPanelProps = {
  error: string | null;
  historyEntries: GitLog["entries"] | null;
  isLoadingHistory: boolean;
  onRefreshHistory: () => void;
};

export function GitHistoryPanel({
  error,
  historyEntries,
  isLoadingHistory,
  onRefreshHistory,
}: GitHistoryPanelProps) {
  return (
    <section className="git-tab-panel" role="tabpanel">
      <div className="git-panel-header">
        <h3 className="git-panel-title">History</h3>
        <Button
          disabled={isLoadingHistory}
          onClick={onRefreshHistory}
          variant="secondary"
        >
          {isLoadingHistory ? "Loading..." : "Refresh history"}
        </Button>
      </div>
      {error ? (
        <GitEmptyState text={error} title="History unavailable" tone="error" />
      ) : isLoadingHistory ? (
        <GitEmptyState text="Reading recent commits." title="Loading history" />
      ) : !historyEntries ? (
        <GitEmptyState
          text="Open History to load recent commits."
          title="History not loaded"
        />
      ) : historyEntries.length === 0 ? (
        <GitEmptyState text="Git returned no recent commits." title="No commits" />
      ) : (
        <div className="git-history-list">
          {historyEntries.map((entry) => (
            <article className="git-history-row" key={entry.hash}>
              <code className="git-history-hash">{entry.shortHash}</code>
              <div className="git-history-main">
                <h4 className="git-history-subject">{entry.subject}</h4>
                <p className="git-history-meta">
                  {entry.author}
                  {" \u00b7 "}
                  {entry.date}
                </p>
              </div>
            </article>
          ))}
        </div>
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
