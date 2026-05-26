import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  compactDirectWorkText,
  directWorkDirectoryResolutionText,
  directWorkScratchWorkspaceSuggestion,
  shortCodexThreadId,
  workspaceKnowledgeSummaryText,
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
  type WorkspaceKnowledgeLookup,
} from "./workspaceAgentDirectWorkModel";

export function CoordinatorAgentHeaderStatus({
  status,
}: {
  status: CoordinatorDirectWorkStatus;
}) {
  return (
    <div className="interactive-agent-frame-status">
      <label className="interactive-agent-agent-picker">
        <span>Agent</span>
        <select
          aria-label="Workspace Agent picker"
          className="input interactive-agent-agent-select"
          defaultValue="codex"
          disabled
        >
          <option value="codex">Codex</option>
        </select>
      </label>
      <span className="interactive-agent-frame-status-label">Status</span>
      <Badge variant={coordinatorHeaderStatusVariant(status)}>
        {coordinatorHeaderStatusLabel(status)}
      </Badge>
    </div>
  );
}

function coordinatorHeaderStatusLabel(
  status: CoordinatorDirectWorkStatus,
): string {
  if (status === "running") {
    return "Running";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Ready";
}

function coordinatorHeaderStatusVariant(
  status: CoordinatorDirectWorkStatus,
): "success" | "info" | "error" {
  if (status === "running") {
    return "info";
  }

  if (status === "failed") {
    return "error";
  }

  return "success";
}

export function WorkspaceAgentDirectModePanel({
  directWorkDirectory,
  error,
  finalResult,
  knowledgeLookup,
  logs,
  onDirectoryChange,
  onResetThread,
  runId,
  status,
  threadId,
  threadNotice,
  warning,
}: {
  directWorkDirectory: string;
  error: string | null;
  finalResult: string | null;
  knowledgeLookup: WorkspaceKnowledgeLookup;
  logs: CoordinatorDirectWorkLogEntry[];
  onDirectoryChange: (value: string) => void;
  onResetThread: () => void;
  runId: string | null;
  status: CoordinatorDirectWorkStatus;
  threadId: string | null;
  threadNotice: string | null;
  warning: string | null;
}) {
  const workingDirectoryInputId = useId();
  const latestLog = logs[logs.length - 1]?.text ?? null;
  const resolutionText = directWorkDirectoryResolutionText(directWorkDirectory);
  const scratchSuggestion =
    directWorkScratchWorkspaceSuggestion(directWorkDirectory);
  const compactResult = finalResult
    ? compactDirectWorkText(finalResult)
    : null;
  const threadStatusText = threadId
    ? `Thread active ${shortCodexThreadId(threadId)}`
    : "No active thread";

  return (
    <section
      aria-label="Workspace Agent Codex controls"
      className="interactive-agent-direct-mode"
    >
      <div className="interactive-agent-direct-mode-bar">
        <label className="interactive-agent-direct-mode-field">
          <span className="interactive-agent-direct-mode-label">
            Working dir
          </span>
          <input
            aria-label="Working directory"
            autoComplete="off"
            className="input interactive-agent-direct-mode-input"
            id={workingDirectoryInputId}
            onChange={(event) => onDirectoryChange(event.currentTarget.value)}
            spellCheck={false}
            type="text"
            value={directWorkDirectory}
          />
        </label>
        <span
          aria-label="Codex thread controls"
          className="interactive-agent-direct-mode-thread-controls"
        >
          <Badge variant={threadId ? "info" : "neutral"}>
            {threadStatusText}
          </Badge>
          <Button
            disabled={status === "running" || !threadId}
            onClick={onResetThread}
            type="button"
            variant="ghost"
          >
            New thread
          </Button>
        </span>
      </div>

      <div className="interactive-agent-direct-mode-body">
        <div className="interactive-agent-direct-mode-status" role="status">
          {runId ? <span>Run {runId}</span> : null}
          {threadNotice ? (
            <span className="interactive-agent-direct-mode-thread-note">
              {threadNotice}
            </span>
          ) : null}
          {error ? (
            <span className="interactive-agent-direct-mode-error">
              {error}
            </span>
          ) : null}
          {warning ? (
            <span className="interactive-agent-direct-mode-warning">
              {warning}
            </span>
          ) : null}
          {compactResult ? (
            <span className="interactive-agent-direct-mode-result-line">
              Final: {compactResult}
            </span>
          ) : null}
          {!error && !compactResult && latestLog ? (
            <span>Latest: {compactDirectWorkText(latestLog)}</span>
          ) : null}
        </div>
        <div className="interactive-agent-direct-mode-disclosures">
          <details className="interactive-agent-direct-mode-details">
            <summary>Direct Work details</summary>
            <div className="interactive-agent-direct-mode-detail-body">
              <p className="interactive-agent-direct-mode-help">
                <span>{resolutionText}</span>
                {scratchSuggestion ? (
                  <span>Try: {scratchSuggestion}</span>
                ) : null}
              </p>
              {logs.length > 0 ? (
                <ul className="interactive-agent-direct-mode-log">
                  {logs.map((entry) => (
                    <li key={entry.id}>{entry.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="interactive-agent-direct-mode-help">
                  No run details yet.
                </p>
              )}
              {finalResult ? (
                <div className="interactive-agent-direct-mode-result">
                  <p className="interactive-agent-status-label">
                    Final result
                  </p>
                  <pre>{finalResult}</pre>
                </div>
              ) : null}
            </div>
          </details>
          <details className="interactive-agent-direct-mode-details">
            <summary>{workspaceKnowledgeSummaryText(knowledgeLookup)}</summary>
            <div className="interactive-agent-direct-mode-detail-body">
              <WorkspaceKnowledgeLookupDetails lookup={knowledgeLookup} />
            </div>
          </details>
          <details className="interactive-agent-direct-mode-details">
            <summary>Safety/context details</summary>
            <div className="interactive-agent-direct-mode-detail-body">
              <p className="interactive-agent-direct-mode-help">
                ~ resolves to your user home. If access is denied, choose a
                project folder or scratch workspace.
              </p>
              <p className="interactive-agent-direct-mode-help">
                Provider requests use visible context only with tools disabled.
              </p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function WorkspaceKnowledgeLookupDetails({
  lookup,
}: {
  lookup: WorkspaceKnowledgeLookup;
}) {
  if (lookup.status === "idle") {
    return (
      <p className="interactive-agent-direct-mode-help">
        Workspace knowledge will be checked before Run with Codex.
      </p>
    );
  }

  if (lookup.status === "unavailable") {
    return (
      <p className="interactive-agent-direct-mode-help">
        Workspace knowledge search is not available in this runtime.
      </p>
    );
  }

  if (lookup.status === "failed") {
    return (
      <p className="interactive-agent-direct-mode-warning">
        Workspace knowledge search failed: {lookup.error}
      </p>
    );
  }

  if (lookup.results.length === 0) {
    return (
      <p className="interactive-agent-direct-mode-help">
        Workspace knowledge checked: no matches.
      </p>
    );
  }

  return (
    <div className="interactive-agent-workspace-knowledge-list">
      {lookup.results.slice(0, 5).map((result) => (
        <section
          className="interactive-agent-workspace-knowledge-item"
          key={result.chunkId}
        >
          <p className="interactive-agent-status-label">
            {result.documentTitle}, chunk {result.chunkIndex + 1}
          </p>
          <p className="interactive-agent-direct-mode-help">
            {result.sourceLabel}
            {result.tags ? ` - ${result.tags}` : ""}
          </p>
          <pre>{result.snippet}</pre>
        </section>
      ))}
    </div>
  );
}
