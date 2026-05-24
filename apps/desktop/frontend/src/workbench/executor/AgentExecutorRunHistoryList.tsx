import type { AgentExecutorRunSummary } from "../../workspace/types";
import { AgentExecutorRunHistoryListItem } from "./AgentExecutorRunHistoryListItem";

type AgentExecutorRunHistoryListProps = {
  onAttachRunContext?: (run: AgentExecutorRunSummary) => void;
  onSelectRun: (runId: string) => void;
  runs: AgentExecutorRunSummary[];
  selectedRunId: string | null;
};

export function AgentExecutorRunHistoryList({
  onAttachRunContext,
  onSelectRun,
  runs,
  selectedRunId,
}: AgentExecutorRunHistoryListProps) {
  return (
    <div className="agent-executor-history-list" role="list">
      {runs.map((run) => (
        <AgentExecutorRunHistoryListItem
          isSelected={selectedRunId === run.runId}
          key={run.runId}
          onAttachRunContext={onAttachRunContext}
          onSelect={onSelectRun}
          run={run}
        />
      ))}
    </div>
  );
}
