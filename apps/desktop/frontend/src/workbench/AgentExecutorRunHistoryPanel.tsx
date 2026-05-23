import { useEffect, useState } from "react";

import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { AgentExecutorRunDetailPanel } from "./executor/AgentExecutorRunDetailPanel";
import { AgentExecutorRunHistoryList } from "./executor/AgentExecutorRunHistoryList";
import { errorToMessage } from "./executor/agentExecutorRunHistoryFormatters";
import {
  AGENT_EXECUTOR_HISTORY_LIMIT,
  type AgentExecutorHistoryState,
  type AgentExecutorRunDetailState,
  type AgentExecutorRunHistoryPanelProps,
  type GetAgentExecutorRunDetailHandler,
  type ListAgentExecutorRunsHandler,
} from "./executor/agentExecutorRunHistoryTypes";

export type { GetAgentExecutorRunDetailHandler, ListAgentExecutorRunsHandler };

export function AgentExecutorRunHistoryPanel({
  openRunDetailRequest,
  onGetAgentExecutorRunDetail,
  onListAgentExecutorRuns,
  refreshToken,
  widgetInstanceId,
}: AgentExecutorRunHistoryPanelProps) {
  const [historyState, setHistoryState] =
    useState<AgentExecutorHistoryState>({
      status: "loading",
    });
  const [detailState, setDetailState] = useState<AgentExecutorRunDetailState>({
    status: "idle",
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (
      !openRunDetailRequest ||
      openRunDetailRequest.executorWidgetInstanceId !== widgetInstanceId
    ) {
      return;
    }

    void loadRunDetail(openRunDetailRequest.runId);
  }, [openRunDetailRequest?.id, widgetInstanceId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadRuns() {
      if (!onListAgentExecutorRuns) {
        setHistoryState({
          message: "Agent Executor run history is unavailable in this runtime.",
          status: "failed",
        });
        return;
      }

      setHistoryState({ status: "loading" });

      try {
        const history = await onListAgentExecutorRuns(
          widgetInstanceId,
          AGENT_EXECUTOR_HISTORY_LIMIT,
        );

        if (!isCurrent) {
          return;
        }

        const runs = history?.runs ?? [];
        setHistoryState({ runs, status: "ready" });
        setSelectedRunId((currentRunId) =>
          currentRunId && runs.some((run) => run.runId === currentRunId)
            ? currentRunId
            : null,
        );
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setHistoryState({
          message: errorToMessage(error, "Unable to load Agent Executor runs."),
          status: "failed",
        });
      }
    }

    void loadRuns();

    return () => {
      isCurrent = false;
    };
  }, [onListAgentExecutorRuns, refreshToken, widgetInstanceId]);

  async function loadRunDetail(runId: string) {
    setSelectedRunId(runId);

    if (!onGetAgentExecutorRunDetail) {
      setDetailState({
        message: "Agent Executor run detail is unavailable in this runtime.",
        runId,
        status: "failed",
      });
      return;
    }

    setDetailState({ runId, status: "loading" });

    try {
      const detail = await onGetAgentExecutorRunDetail(widgetInstanceId, runId);

      if (!detail) {
        setDetailState({
          message: "Agent Executor run detail was not returned.",
          runId,
          status: "failed",
        });
        return;
      }

      setDetailState({ detail, status: "ready" });
    } catch (error) {
      setDetailState({
        message: errorToMessage(error, "Unable to load Agent Executor detail."),
        runId,
        status: "failed",
      });
    }
  }

  return (
    <section
      aria-label="Agent Executor run history"
      className="agent-executor-history"
    >
      <div className="agent-executor-history-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">Recent runs</h3>
          <p className="codex-direct-work-text">
            Read-only stored Direct Work and validation artifacts for this Agent
            Executor widget.
          </p>
        </div>
        <div className="agent-executor-history-actions">
          <Badge variant="neutral">Read-only</Badge>
          <Button
            disabled={historyState.status === "loading"}
            onClick={() => {
              setHistoryState({ status: "loading" });
              void reloadHistory(
                onListAgentExecutorRuns,
                widgetInstanceId,
                setHistoryState,
                setSelectedRunId,
              );
            }}
            variant="ghost"
          >
            {historyState.status === "loading" ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {historyState.status === "loading" ? (
        <p className="codex-direct-work-review-note">
          Loading recent Agent Executor runs...
        </p>
      ) : null}

      {historyState.status === "failed" ? (
        <div className="codex-direct-work-error-message" role="status">
          <span className="codex-direct-work-result-label">
            History unavailable
          </span>
          <span className="codex-direct-work-result-value">
            {historyState.message}
          </span>
        </div>
      ) : null}

      {historyState.status === "ready" && historyState.runs.length === 0 ? (
        <p className="codex-direct-work-review-note">
          No stored Agent Executor runs yet.
        </p>
      ) : null}

      {historyState.status === "ready" && historyState.runs.length > 0 ? (
        <div className="agent-executor-history-layout">
          <AgentExecutorRunHistoryList
            onSelectRun={(runId) => void loadRunDetail(runId)}
            runs={historyState.runs}
            selectedRunId={selectedRunId}
          />

          <AgentExecutorRunDetailPanel detailState={detailState} />
        </div>
      ) : null}
    </section>
  );
}

async function reloadHistory(
  onListAgentExecutorRuns: ListAgentExecutorRunsHandler | undefined,
  widgetInstanceId: AgentExecutorRunHistoryPanelProps["widgetInstanceId"],
  setHistoryState: (state: AgentExecutorHistoryState) => void,
  setSelectedRunId: (
    updater: (currentRunId: string | null) => string | null,
  ) => void,
) {
  if (!onListAgentExecutorRuns) {
    setHistoryState({
      message: "Agent Executor run history is unavailable in this runtime.",
      status: "failed",
    });
    return;
  }

  try {
    const history = await onListAgentExecutorRuns(
      widgetInstanceId,
      AGENT_EXECUTOR_HISTORY_LIMIT,
    );
    const runs = history?.runs ?? [];
    setHistoryState({ runs, status: "ready" });
    setSelectedRunId((currentRunId) =>
      currentRunId && runs.some((run) => run.runId === currentRunId)
        ? currentRunId
        : null,
    );
  } catch (error) {
    setHistoryState({
      message: errorToMessage(error, "Unable to load Agent Executor runs."),
      status: "failed",
    });
  }
}
