import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import type { AgentExecutorRunSummary } from "../../workspace/types";
import {
  historyRunMetaLine,
  runModeLabel,
  statusBadgeVariant,
  statusLabel,
} from "./agentExecutorRunHistoryFormatters";

type AgentExecutorRunHistoryListItemProps = {
  isSelected: boolean;
  onAttachRunContext?: (run: AgentExecutorRunSummary) => void;
  onSelect: (runId: string) => void;
  run: AgentExecutorRunSummary;
};

export function AgentExecutorRunHistoryListItem({
  isSelected,
  onAttachRunContext,
  onSelect,
  run,
}: AgentExecutorRunHistoryListItemProps) {
  return (
    <div
      className={`agent-executor-history-item${
        isSelected ? " agent-executor-history-item-selected" : ""
      }`}
      role="listitem"
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
      <span className="agent-executor-history-item-actions">
        <Button onClick={() => onSelect(run.runId)} variant="ghost">
          Select
        </Button>
        <Button
          disabled={!onAttachRunContext}
          onClick={() => onAttachRunContext?.(run)}
          title={
            onAttachRunContext
              ? "Attach this safe run metadata to Coordinator Chat."
              : "Coordinator Chat is not visible on this Workbench."
          }
          variant="ghost"
        >
          Attach to Coordinator
        </Button>
      </span>
    </div>
  );
}
