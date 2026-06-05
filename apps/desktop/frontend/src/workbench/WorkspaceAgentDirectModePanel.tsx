import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type MutableRefObject,
} from "react";
import { Button } from "../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  capArrayToLast,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { DirectWorkSandbox } from "../workspace/types";
import type { AgentActivityEvent } from "./agentActivityModel";
import { AgentActivityPanel } from "./AgentActivityPanel";
import {
  compactDirectWorkText,
  directWorkDirectoryResolutionText,
  directWorkScratchWorkspaceSuggestion,
  knowledgeScopeLabel,
  workspaceKnowledgeSummaryText,
  type CoordinatorDirectWorkLogEntry,
  type WorkspaceAgentActivitySummary,
  type WorkspaceKnowledgeLookup,
} from "./workspaceAgentDirectWorkModel";

export function WorkspaceAgentDirectModePanel({
  agentActivityEvents,
  activitySummary,
  directWorkDirectory,
  directWorkSandbox,
  error,
  finalResult,
  isActivityOpen,
  isSettingsOpen,
  knowledgeLookup,
  logs,
  onDirectoryChange,
  onSandboxChange,
  onSelectWorkspaceDirectory,
  runId,
  threadNotice,
  warning,
}: {
  agentActivityEvents: AgentActivityEvent[];
  activitySummary: WorkspaceAgentActivitySummary;
  directWorkDirectory: string;
  directWorkSandbox: DirectWorkSandbox;
  error: string | null;
  finalResult: string | null;
  isActivityOpen: boolean;
  isSettingsOpen: boolean;
  knowledgeLookup: WorkspaceKnowledgeLookup;
  logs: CoordinatorDirectWorkLogEntry[];
  onDirectoryChange: (value: string) => void;
  onSandboxChange: (value: DirectWorkSandbox) => void;
  onSelectWorkspaceDirectory?: () => Promise<string | null>;
  runId: string | null;
  threadNotice: string | null;
  warning: string | null;
}) {
  const workingDirectoryInputId = useId();
  const clearDirectoryCopyStatusTimer = useRef<number | null>(null);
  const [directoryCopyStatus, setDirectoryCopyStatus] = useState<string | null>(
    null,
  );
  const [directoryBrowseError, setDirectoryBrowseError] = useState<
    string | null
  >(null);
  const [isDirectoryBrowsePending, setIsDirectoryBrowsePending] =
    useState(false);
  const [threadCopyStatus, setThreadCopyStatus] = useState<string | null>(null);
  const latestLog = logs[logs.length - 1]?.text ?? null;
  const visibleLogs = capArrayToLast(logs, RENDER_MEMORY_CAPS.eventRows);
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

  useEffect(() => {
    return () => {
      if (clearDirectoryCopyStatusTimer.current !== null) {
        window.clearTimeout(clearDirectoryCopyStatusTimer.current);
      }
    };
  }, []);

  async function copyValue(
    value: string,
    successMessage: string,
    setStatus: (value: string | null) => void,
    statusTimer: MutableRefObject<number | null>,
  ) {
    setStatus(null);
    if (statusTimer.current !== null) {
      window.clearTimeout(statusTimer.current);
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatus("Clipboard unavailable.");
      statusTimer.current = window.setTimeout(() => setStatus(null), 2400);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus(successMessage);
    } catch {
      setStatus("Copy failed.");
    }
    statusTimer.current = window.setTimeout(() => setStatus(null), 2400);
  }

  async function browseWorkingDirectory() {
    if (!onSelectWorkspaceDirectory || isDirectoryBrowsePending) {
      return;
    }

    setDirectoryBrowseError(null);
    setIsDirectoryBrowsePending(true);
    try {
      const selectedDirectory = await onSelectWorkspaceDirectory();
      if (selectedDirectory !== null) {
        onDirectoryChange(selectedDirectory);
      }
    } catch (error) {
      setDirectoryBrowseError(
        `Browse failed: ${errorToCompactMessage(error)}`,
      );
    } finally {
      setIsDirectoryBrowsePending(false);
    }
  }

  return (
    <section
      aria-label="Workspace Agent Codex controls"
      className="interactive-agent-direct-mode"
    >
      {isSettingsOpen ? (
        <div
          aria-label="Codex settings"
          className="interactive-agent-direct-mode-settings"
        >
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
                onChange={(event) =>
                  onDirectoryChange(event.currentTarget.value)
                }
                spellCheck={false}
                title={directWorkDirectory || "Working directory"}
                type="text"
                value={directWorkDirectory}
              />
            </label>
            <Button
              aria-label="Browse for working directory"
              className="interactive-agent-direct-mode-browse-button"
              disabled={!onSelectWorkspaceDirectory || isDirectoryBrowsePending}
              onClick={() => void browseWorkingDirectory()}
              title="Select working directory"
              type="button"
              variant="ghost"
            >
              {isDirectoryBrowsePending ? "Browsing" : "Browse"}
            </Button>
            <Button
              aria-label="Copy working directory"
              className="interactive-agent-direct-mode-copy-button"
              disabled={!directWorkDirectory}
              onClick={() =>
                void copyValue(
                  directWorkDirectory,
                  "Copied working directory.",
                  setDirectoryCopyStatus,
                  clearDirectoryCopyStatusTimer,
                )
              }
              title="Copy working directory"
              type="button"
              variant="ghost"
            >
              Copy
            </Button>
          </div>
          <div className="interactive-agent-direct-mode-field">
            <span className="interactive-agent-direct-mode-label">Sandbox</span>
            <div
              aria-label="Codex sandbox"
              className="interactive-agent-sandbox-segments"
              role="radiogroup"
            >
              {SANDBOX_OPTIONS.map((option) => (
                <button
                  aria-checked={directWorkSandbox === option.value}
                  className={
                    directWorkSandbox === option.value
                      ? "interactive-agent-sandbox-segment interactive-agent-sandbox-segment-active"
                      : "interactive-agent-sandbox-segment"
                  }
                  key={option.value}
                  onClick={() => onSandboxChange(option.value)}
                  role="radio"
                  title={option.title}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="interactive-agent-direct-mode-help">
            <span>
              ~ resolves to your user home. If access is denied, choose a
              project folder or scratch workspace.
            </span>
          </p>
        </div>
      ) : null}

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
          {directoryCopyStatus ? (
            <span className={copyStatusClassName(directoryCopyStatus)}>
              {directoryCopyStatus}
            </span>
          ) : null}
          {runId ? <span>Run {runId}</span> : null}
          {threadNotice ? (
            <span className="interactive-agent-direct-mode-thread-note">
              {threadNotice}
            </span>
          ) : null}
          {directoryBrowseError ? (
            <span className="interactive-agent-direct-mode-error">
              {directoryBrowseError}
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
          {directWorkSandbox === "danger_full_access" ? (
            <span className="interactive-agent-direct-mode-warning">
              danger_full_access is unsafe and only for trusted local
              development. It disables Codex sandbox restrictions. Hobit will
              not auto-commit, push, reset, clean, stash, or roll back changes.
              Git mutations remain forbidden unless explicitly requested.
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
          <LazyDetails
            className="interactive-agent-direct-mode-details"
            summary="Direct Work details"
          >
            <div className="interactive-agent-direct-mode-detail-body">
              <p className="interactive-agent-direct-mode-help">
                <span>{resolutionText}</span>
                {scratchSuggestion ? (
                  <span>Try: {scratchSuggestion}</span>
                ) : null}
              </p>
              {visibleLogs.items.length > 0 ? (
                <ul className="interactive-agent-direct-mode-log">
                  {visibleLogs.hiddenCount > 0 ? (
                    <li>
                      Showing last {visibleLogs.items.length.toString()} events.
                      Preview capped.
                    </li>
                  ) : null}
                  {visibleLogs.items.map((entry) => (
                    <li key={entry.id}>
                      {cappedPreviewText(
                        entry.text,
                        RENDER_MEMORY_CAPS.transcriptPayloadChars,
                      )}
                    </li>
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
                  <pre>
                    {cappedPreviewText(
                      finalResult,
                      RENDER_MEMORY_CAPS.transcriptMessageChars,
                    )}
                  </pre>
                </div>
              ) : null}
            </div>
          </LazyDetails>
          <LazyDetails
            className="interactive-agent-direct-mode-details"
            summary={workspaceKnowledgeSummaryText(knowledgeLookup)}
          >
            <div className="interactive-agent-direct-mode-detail-body">
              <WorkspaceKnowledgeLookupDetails lookup={knowledgeLookup} />
            </div>
          </LazyDetails>
        </div>
        {isActivityOpen ? (
          <section
            aria-label="Workspace Agent activity panel"
            className="interactive-agent-activity-panel"
          >
            <AgentActivityPanel
              compact
              emptyText="No Workspace Agent activity for this widget yet."
              events={agentActivityEvents}
            />
          </section>
        ) : null}
      </div>
    </section>
  );
}

const SANDBOX_OPTIONS: ReadonlyArray<{
  label: string;
  title: string;
  value: DirectWorkSandbox;
}> = [
  {
    label: "Read only",
    title: "Codex can inspect but not write.",
    value: "read_only",
  },
  {
    label: "Workspace write",
    title: "Codex can write inside the selected working directory.",
    value: "workspace_write",
  },
  {
    label: "Full access",
    title: "Unsafe local development mode: disables Codex sandbox restrictions.",
    value: "danger_full_access",
  },
];

function LazyDetails({
  children,
  className,
  summary,
}: {
  children: ReactNode;
  className: string;
  summary: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {isOpen ? children : null}
    </details>
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

function copyStatusClassName(message: string) {
  const toneClass =
    message === "Thread copied." || message === "Copied working directory."
      ? "interactive-agent-direct-mode-copy-status-success"
      : "interactive-agent-direct-mode-copy-status-error";
  return `interactive-agent-direct-mode-copy-status ${toneClass}`;
}

function errorToCompactMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Directory picker is unavailable.";
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
          <pre>
            {cappedPreviewText(
              result.snippet,
              RENDER_MEMORY_CAPS.knowledgePreviewChars,
            )}
          </pre>
        </section>
      ))}
    </div>
  );
}
