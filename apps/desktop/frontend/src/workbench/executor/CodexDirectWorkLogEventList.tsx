import { CodexDirectWorkLogEmptyState } from "./CodexDirectWorkLogEmptyState";
import { CodexDirectWorkLogEventRow } from "./CodexDirectWorkLogEventRow";
import type { CodexDirectWorkLiveLogEntry } from "./codexDirectWorkLogTypes";

type CodexDirectWorkLogEventListProps = {
  entries: CodexDirectWorkLiveLogEntry[];
};

export function CodexDirectWorkLogEventList({
  entries,
}: CodexDirectWorkLogEventListProps) {
  return (
    <div className="codex-direct-work-live-log-list" role="list">
      {entries.length === 0 ? (
        <CodexDirectWorkLogEmptyState />
      ) : (
        entries.map((entry) => (
          <CodexDirectWorkLogEventRow entry={entry} key={entry.id} />
        ))
      )}
    </div>
  );
}
