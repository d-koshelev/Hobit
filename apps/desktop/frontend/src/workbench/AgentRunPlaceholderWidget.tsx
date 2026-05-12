import { useEffect, useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type {
  AgentMonitoringProposalAction,
  AgentMonitoringProposalResult,
  AgentMonitoringSnapshot,
} from "../workspace/types";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { WidgetRenderProps } from "./types";

type MonitoringLoadState =
  | {
      status: "idle" | "loading";
    }
  | {
      message: string;
      status: "failed";
    }
  | {
      snapshot: AgentMonitoringSnapshot | null;
      status: "ready";
    };

export function AgentRunPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onGetAgentMonitoringSnapshot,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const [loadState, setLoadState] = useState<MonitoringLoadState>({
    status: "idle",
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const proposalResults =
    loadState.status === "ready"
      ? (loadState.snapshot?.proposalResults ?? [])
      : [];
  const selectedResult = useMemo(
    () =>
      proposalResults.find((result) => result.runId === selectedRunId) ??
      proposalResults[0] ??
      null,
    [proposalResults, selectedRunId],
  );

  async function refreshSnapshot() {
    if (!onGetAgentMonitoringSnapshot) {
      setLoadState({
        message:
          "Agent Monitoring result reads are unavailable in this runtime.",
        status: "failed",
      });
      return;
    }

    setLoadState({ status: "loading" });

    try {
      const snapshot = await onGetAgentMonitoringSnapshot();
      setLoadState({
        snapshot,
        status: "ready",
      });
    } catch (error) {
      setLoadState({
        message: errorToMessage(error),
        status: "failed",
      });
    }
  }

  useEffect(() => {
    void refreshSnapshot();
  }, [onGetAgentMonitoringSnapshot]);

  useEffect(() => {
    if (proposalResults.length === 0) {
      if (selectedRunId !== null) {
        setSelectedRunId(null);
      }
      return;
    }

    if (
      !selectedRunId ||
      !proposalResults.some((result) => result.runId === selectedRunId)
    ) {
      setSelectedRunId(proposalResults[0].runId);
    }
  }, [proposalResults, selectedRunId]);

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Read-only</Badge>}
      title={title}
    >
      <div className="agent-run-placeholder">
        <section className="agent-run-summary">
          <div className="agent-run-summary-copy">
            <p className="agent-run-summary-title">Agent Monitoring</p>
            <p className="agent-run-summary-text">
              Read-only viewer for persisted Agent Chat proposal-only mock
              results. No LLM, tools, Terminal commands, Queue actions, or
              proposal actions run from this surface.
            </p>
          </div>
          <div className="agent-run-summary-actions">
            <Badge variant="neutral">Proposal artifacts</Badge>
            <Button
              disabled={loadState.status === "loading"}
              onClick={() => void refreshSnapshot()}
              variant="secondary"
            >
              {loadState.status === "loading" ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </section>

        {loadState.status === "failed" ? (
          <AgentMonitoringEmptyState
            badgeLabel="Unavailable"
            text={loadState.message}
            title="Monitoring read path unavailable"
          />
        ) : selectedResult ? (
          <>
            <RecentProposalRuns
              onSelectRun={setSelectedRunId}
              results={proposalResults}
              selectedRunId={selectedResult.runId}
            />
            <div
              aria-label="Agent Monitoring read-only proposal result"
              className="agent-run-view-grid"
            >
              <AgentMonitoringOverview result={selectedResult} />
              <AgentMonitoringResult result={selectedResult} />
              <AgentMonitoringRaw result={selectedResult} />
            </div>
          </>
        ) : (
          <AgentMonitoringEmptyState
            badgeLabel={
              loadState.status === "loading" ? "Loading" : "No results"
            }
            text={
              loadState.status === "loading"
                ? "Reading persisted Agent Chat proposal-only results for this Workbench."
                : "No persisted Agent Chat proposal-only mock results exist in this Workspace Workbench yet."
            }
            title="No proposal result selected"
          />
        )}
      </div>
    </WidgetFrame>
  );
}

function RecentProposalRuns({
  onSelectRun,
  results,
  selectedRunId,
}: {
  onSelectRun: (runId: string) => void;
  results: readonly AgentMonitoringProposalResult[];
  selectedRunId: string;
}) {
  return (
    <section className="agent-run-view agent-monitoring-run-list">
      <div className="agent-run-view-header">
        <div className="agent-run-view-copy">
          <h3 className="agent-run-view-title">Recent proposal runs</h3>
          <p className="agent-run-view-text">
            Read-only list of persisted Agent Chat proposal mock artifacts.
          </p>
        </div>
        <Badge variant="neutral">{results.length} stored</Badge>
      </div>
      <div className="agent-monitoring-run-buttons">
        {results.map((result) => (
          <Button
            className={
              result.runId === selectedRunId
                ? "agent-monitoring-run-button-selected"
                : undefined
            }
            key={result.runId}
            onClick={() => onSelectRun(result.runId)}
            variant={result.runId === selectedRunId ? "primary" : "secondary"}
          >
            {shortId(result.runId)}
          </Button>
        ))}
      </div>
    </section>
  );
}

function AgentMonitoringOverview({
  result,
}: {
  result: AgentMonitoringProposalResult;
}) {
  return (
    <section className="agent-run-view agent-run-overview">
      <AgentMonitoringViewHeader
        badgeLabel="Read-only"
        text="Stored run/result metadata and proposal-only safety flags."
        title="Overview"
      />
      <StaticPreviewFieldList
        className="agent-run-result-grid"
        fieldClassName="agent-run-result-field"
        fields={[
          { label: "Run id", value: result.runId },
          { label: "Result id", value: result.resultId },
          { label: "Status", value: result.status },
          { label: "Source widget", value: result.sourceWidgetTitle },
          { label: "Started", value: formatTimestamp(result.runStartedAt) },
          { label: "Finished", value: formatTimestamp(result.runFinishedAt) },
          { label: "Runtime status", value: result.runtimeStatus },
          { label: "No LLM called", value: formatBoolean(result.noLlmCalled) },
          {
            label: "No tools executed",
            value: formatBoolean(result.noToolsExecuted),
          },
          {
            label: "No mutations performed",
            value: formatBoolean(result.noMutationsPerformed),
          },
        ]}
        labelClassName="agent-run-result-label"
        valueClassName="agent-run-result-value"
      />
    </section>
  );
}

function AgentMonitoringResult({
  result,
}: {
  result: AgentMonitoringProposalResult;
}) {
  return (
    <section className="agent-run-view agent-run-result">
      <AgentMonitoringViewHeader
        badgeLabel="Proposal only"
        text="Structured mock proposal result. Actions are not executable here."
        title="Result"
      />
      <div className="agent-monitoring-result-body">
        <AgentMonitoringTextBlock
          label="Operator prompt"
          value={result.operatorPrompt}
        />
        <AgentMonitoringTextBlock
          label="Proposal summary"
          value={result.proposalSummary}
        />
        <AgentMonitoringList
          title="Proposed plan"
          values={result.proposedPlan}
        />
        <AgentMonitoringList
          title="Context needed"
          values={result.contextNeeded}
        />
        <AgentMonitoringContext result={result} />
        <AgentMonitoringActions actions={result.proposedActions} />
        <AgentMonitoringList title="Safety notes" values={result.safetyNotes} />
      </div>
    </section>
  );
}

function AgentMonitoringRaw({
  result,
}: {
  result: AgentMonitoringProposalResult;
}) {
  return (
    <section className="agent-run-view agent-run-raw">
      <AgentMonitoringViewHeader
        badgeLabel="Raw"
        text="Stored result content and JSON payload. Read-only."
        title="Raw"
      />
      <div
        aria-label="Stored proposal result raw payload"
        className="agent-run-raw-log"
      >
        {result.resultContent ? (
          <p className="agent-run-raw-placeholder">{result.resultContent}</p>
        ) : null}
        <pre className="agent-run-raw-sample">
          <code>{prettyJson(result.rawPayload)}</code>
        </pre>
      </div>
    </section>
  );
}

function AgentMonitoringContext({
  result,
}: {
  result: AgentMonitoringProposalResult;
}) {
  return (
    <div className="agent-monitoring-result-section">
      <p className="agent-run-result-label">Approved context snapshot</p>
      <p className="agent-run-result-value">{result.approvedContextSummary}</p>
      <p className="agent-run-view-text">
        Status: {result.approvedContextStatus}
        {result.approvedContextSourceLabels.length > 0
          ? `; sources: ${result.approvedContextSourceLabels.join(", ")}`
          : ""}
      </p>
    </div>
  );
}

function AgentMonitoringActions({
  actions,
}: {
  actions: readonly AgentMonitoringProposalAction[];
}) {
  return (
    <div className="agent-monitoring-result-section">
      <p className="agent-run-result-label">Proposed tool/action items</p>
      <div className="agent-monitoring-action-list">
        {actions.map((action) => (
          <div className="agent-monitoring-action" key={action.title}>
            <div className="agent-monitoring-action-header">
              <p className="agent-run-result-value">{action.title}</p>
              <Badge variant="neutral">
                {formatActionStatus(action.status)}
              </Badge>
            </div>
            <p className="agent-run-view-text">{action.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentMonitoringList({
  title,
  values,
}: {
  title: string;
  values: readonly string[];
}) {
  return (
    <div className="agent-monitoring-result-section">
      <p className="agent-run-result-label">{title}</p>
      <ul className="agent-run-overview-list">
        {values.map((value) => (
          <li className="agent-run-overview-step" key={value}>
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentMonitoringTextBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="agent-monitoring-result-section">
      <p className="agent-run-result-label">{label}</p>
      <p className="agent-run-result-value">{value}</p>
    </div>
  );
}

function AgentMonitoringEmptyState({
  badgeLabel,
  text,
  title,
}: {
  badgeLabel: string;
  text: string;
  title: string;
}) {
  return (
    <section className="agent-run-view">
      <AgentMonitoringViewHeader
        badgeLabel={badgeLabel}
        text={text}
        title={title}
      />
    </section>
  );
}

function AgentMonitoringViewHeader({
  badgeLabel,
  text,
  title,
}: {
  badgeLabel: string;
  text: string;
  title: string;
}) {
  return (
    <div className="agent-run-view-header">
      <div className="agent-run-view-copy">
        <h3 className="agent-run-view-title">{title}</h3>
        <p className="agent-run-view-text">{text}</p>
      </div>
      <Badge variant="neutral">{badgeLabel}</Badge>
    </div>
  );
}

function formatActionStatus(status: string) {
  return status === "not_executed" ? "Not executed" : status;
}

function formatBoolean(value: boolean) {
  return value ? "true" : "false";
}

function formatTimestamp(value: string | null) {
  return value ?? "Not recorded";
}

function prettyJson(payload: string) {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to read Agent Monitoring proposal results.";
}
