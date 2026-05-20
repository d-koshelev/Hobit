import {
  formatCompactEntryTiming,
  formatEntryTiming,
} from "../CodexDirectWorkLiveLogStatus";
import { liveLogEntryLabel } from "./codexDirectWorkLogFormatters";
import type { CodexDirectWorkLiveLogEntry } from "./codexDirectWorkLogTypes";

type CodexDirectWorkLogEventRowProps = {
  entry: CodexDirectWorkLiveLogEntry;
};

export function CodexDirectWorkLogEventRow({
  entry,
}: CodexDirectWorkLogEventRowProps) {
  return (
    <div
      className={`codex-direct-work-live-log-entry codex-direct-work-live-log-entry-${entry.tone}`}
      role="listitem"
    >
      <div className="codex-direct-work-live-log-entry-line">
        <span className="codex-direct-work-live-log-time">
          {formatCompactEntryTiming(entry)}
        </span>
        <span className="codex-direct-work-live-log-kind">
          {entry.label ?? liveLogEntryLabel(entry)}
        </span>
        <span className="codex-direct-work-live-log-text">{entry.text}</span>
      </div>
      {entry.detail ? (
        <p className="codex-direct-work-live-log-detail">{entry.detail}</p>
      ) : null}
      {entry.rawPreview ? (
        <details className="codex-direct-work-live-log-raw">
          <summary className="codex-direct-work-live-log-detail">
            Raw JSON event
          </summary>
          <p className="codex-direct-work-live-log-detail">
            {formatEntryTiming(entry)} - {entry.rawPreview}
          </p>
        </details>
      ) : null}
    </div>
  );
}
