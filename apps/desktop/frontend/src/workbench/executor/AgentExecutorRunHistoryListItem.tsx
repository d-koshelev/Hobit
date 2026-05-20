import { Badge } from "../../design-system/Badge";
import type { AgentExecutorRunSummary } from "../../workspace/types";
import {
  historyRunMetaLine,
  runModeLabel,
  statusBadgeVariant,
  statusLabel,
} from "./agentExecutorRunHistoryFormatters";

type AgentExecutorRunHistoryListItemProps = {
  isSelected: boolean;
  onSelect: (runId: string) => void;
  run: AgentExecutorRunSummary;
};

export function AgentExecutorRunHistoryListItem({
  isSelected,
  onSelect,
  run,
}: AgentExecutorRunHistoryListItemProps) {
  return (
    <button
      className={`agent-executor-history-item${
        isSelected ? " agent-executor-history-item-selected" : ""
      }`}
      onClick={() => onSelect(run.runId)}
      type="button"
    >
      <span className="agent-executor-history-item-head">
        <span className="codex-direct-work-result-label">
          {run.title || runModeLabel(run)}
        </span>
        <Badge variant={statusBadgeVariant(run.status)}>
          {statusLabel(run.status)}
        </Badge>
      </span>
      <span className="codex-direct-work-result-value">
        {runModeLabel(run)}
      </span>
      <span className="agent-executor-history-item-meta-line">
        {historyRunMetaLine(run)}
      </span>
      {run.repoRoot ? (
        <span className="codex-direct-work-review-note">
          Execution workspace {run.repoRoot}
        </span>
      ) : null}
      {run.validationProfile || run.validationStatus ? (
        <span className="codex-direct-work-review-note">
          Validation {run.validationProfile ?? "unknown"} /{" "}
          {run.validationStatus ?? "unknown"}
        </span>
      ) : null}
    </button>
  );
}
