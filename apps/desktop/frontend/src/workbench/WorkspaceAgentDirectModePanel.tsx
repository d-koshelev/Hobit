import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  compactDirectWorkText,
  directWorkDirectoryResolutionText,
  directWorkScratchWorkspaceSuggestion,
  knowledgeScopeLabel,
  shortCodexThreadId,
  workspaceKnowledgeSummaryText,
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
  type WorkspaceAgentActivitySummary,
  type WorkspaceKnowledgeLookup,
} from "./workspaceAgentDirectWorkModel";

export function WorkspaceAgentDirectModePanel({
  activitySummary,
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
  activitySummary: WorkspaceAgentActivitySummary;
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
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const latestLog = logs[logs.length - 1]?.text ?? null;
  const resolutionText = directWorkDirectoryResolutionText(directWorkDirectory);
  const scratchSuggestion =
    directWorkScratchWorkspaceSuggestion(directWorkDirectory);
  const compactResult = finalResult
    ? compactDirectWorkText(finalResult)
    : null;
  const activityLabel = workspaceAgentActivityLabel(activitySummary.status);
  const activityText =
    activitySummary.status === "completed"
      ? `${activitySummary.stepCount} ${pluralizeStep(activitySummary.stepCount)}`
      : activitySummary.shortText;
  const threadStatusText = threadId
    ? `Thread active ${shortCodexThreadId(threadId)}`
    : "No active thread";
  const threadTitle = threadId
    ? `Codex thread id: ${threadId}`
    : "No active Codex thread.";

  async function copyValue(value: string, successMessage: string) {
    setCopyStatus(null);

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyStatus("Clipboard unavailable.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(successMessage);
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  return (
    <section
      aria-label="Workspace Agent Codex controls"
      className="interactive-agent-direct-mode"
    >
      <div className="interactive-agent-direct-mode-bar">
        <div className="interactive-agent-direct-mode-working-row">
          <label
            className="interactive-agent-direct-mode-field"
            htmlFor={workingDirectoryInputId}
          >
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
              title={directWorkDirectory || "Working directory"}
              type="text"
              value={directWorkDirectory}
            />
          </label>
          <Button
            aria-label="Copy working directory"
            className="interactive-agent-direct-mode-copy-button"
            disabled={!directWorkDirectory}
            onClick={() =>
              void copyValue(
                directWorkDirectory,
                "Copied working directory.",
              )
            }
            title="Copy working directory"
            type="button"
            variant="ghost"
          >
            Copy
          </Button>
        </div>
        <div
          aria-label="Codex thread controls"
          className="interactive-agent-direct-mode-thread-controls"
        >
          <Badge
            className="interactive-agent-direct-mode-thread-badge"
            title={threadTitle}
            variant={threadId ? "info" : "neutral"}
          >
            {threadStatusText}
          </Badge>
          {threadId ? (
            <Button
              aria-label="Copy Codex thread id"
              className="interactive-agent-direct-mode-copy-button"
              onClick={() =>
                void copyValue(threadId, "Copied Codex thread id.")
              }
              title="Copy Codex thread id"
              type="button"
              variant="ghost"
            >
              Copy
            </Button>
          ) : null}
          <Button
            disabled={status === "running" || !threadId}
            onClick={onResetThread}
            title={threadId ? "Start a new Codex thread" : "No active thread"}
            type="button"
            variant="ghost"
          >
            New thread
          </Button>
        </div>
      </div>

      <div className="interactive-agent-direct-mode-body">
        {activityLabel && activityText ? (
          <div
            aria-label="Workspace Agent activity summary"
            className={`interactive-agent-activity-line interactive-agent-activity-line-${activitySummary.severity}`}
          >
            <span className="interactive-agent-activity-label">
              {activityLabel}
            </span>
            <span className="interactive-agent-activity-text">
              {activityText}
            </span>
          </div>
        ) : null}
        <div className="interactive-agent-direct-mode-status" role="status">
          {copyStatus ? (
            <span className="interactive-agent-direct-mode-copy-status">
              {copyStatus}
            </span>
          ) : null}
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

function workspaceAgentActivityLabel(
  status: WorkspaceAgentActivitySummary["status"],
) {
  if (status === "running") {
    return "Codex is running";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "failed") {
    return "Failed";
  }

  return null;
}

function pluralizeStep(count: number) {
  return count === 1 ? "step" : "steps";
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
            {knowledgeScopeLabel(result.scope)} {result.documentTitle}, chunk{" "}
            {result.chunkIndex + 1}
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
