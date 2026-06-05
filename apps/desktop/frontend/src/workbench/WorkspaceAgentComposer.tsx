import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useState,
} from "react";
import { Button } from "../design-system/Button";
import type { DirectWorkSandbox } from "../workspace/types";
import type { AgentActivityEvent } from "./agentActivityModel";
import {
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
  type WorkspaceAgentActivitySummary,
  type WorkspaceKnowledgeLookup,
  shortCodexThreadId,
} from "./workspaceAgentDirectWorkModel";
import { WorkspaceAgentDirectModePanel } from "./WorkspaceAgentDirectModePanel";
import { WorkspaceAgentVisibleContextPanel } from "./WorkspaceAgentVisibleContextPanel";
import type { WorkspaceAgentVisibleContext } from "./workspaceAgentVisibleContext";

type WorkspaceAgentComposerDirectMode = {
  agentActivityEvents: AgentActivityEvent[];
  activitySummary: WorkspaceAgentActivitySummary;
  canStartDirectWork: boolean;
  canStopDirectWork: boolean;
  directWorkDirectory: string;
  directWorkSandbox: DirectWorkSandbox;
  error: string | null;
  finalResult: string | null;
  isStopPending: boolean;
  knowledgeLookup: WorkspaceKnowledgeLookup;
  logs: CoordinatorDirectWorkLogEntry[];
  onDirectoryChange: (value: string) => void;
  onSandboxChange: (value: DirectWorkSandbox) => void;
  onSelectWorkspaceDirectory?: () => Promise<string | null>;
  onStopDirectWork: () => void;
  runId: string | null;
  status: CoordinatorDirectWorkStatus;
  threadId: string | null;
  threadNotice: string | null;
  warning: string | null;
};

export function WorkspaceAgentComposer({
  canSend,
  directMode,
  draft,
  isProviderPending,
  onMessageChange,
  onRemoveVisibleContext,
  onRunWithCodex,
  onSend,
  textareaRef,
  visibleAttachedContext,
}: {
  canSend: boolean;
  directMode: WorkspaceAgentComposerDirectMode | null;
  draft: string;
  isProviderPending: boolean;
  onMessageChange: (value: string) => void;
  onRemoveVisibleContext: () => void;
  onRunWithCodex: (
    options?: { startNewThread?: boolean },
  ) => void | Promise<void>;
  onSend: () => void | Promise<void>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  visibleAttachedContext: WorkspaceAgentVisibleContext | null;
}) {
  const textareaId = useId();
  const newThreadInputId = useId();
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startNewThreadOnNextRun, setStartNewThreadOnNextRun] =
    useState(false);
  const isDirectModeEnabled = Boolean(directMode);
  const isDirectWorkRunning = directMode?.status === "running";
  const hasActiveThread = Boolean(directMode?.threadId);
  const currentThreadText =
    directMode?.threadId && isDirectModeEnabled
      ? `Thread: ${shortCodexThreadId(directMode.threadId)}`
      : "Thread: none";
  const currentThreadTitle = directMode?.threadId
    ? `Codex thread id: ${directMode.threadId}`
    : "No active Codex thread.";
  const workingLabel = isDirectWorkRunning
    ? "Working"
    : isProviderPending
      ? "Waiting"
      : null;

  useEffect(() => {
    if (!hasActiveThread) {
      setStartNewThreadOnNextRun(false);
    }
  }, [hasActiveThread]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (directMode) {
      const startNewThread = startNewThreadOnNextRun && hasActiveThread;
      try {
        await onRunWithCodex({ startNewThread });
      } finally {
        if (startNewThread) {
          setStartNewThreadOnNextRun(false);
        }
      }
      return;
    }

    await onSend();
  }

  return (
    <form className="interactive-agent-composer" onSubmit={handleSubmit}>
      <WorkspaceAgentVisibleContextPanel
        context={visibleAttachedContext}
        onRemove={onRemoveVisibleContext}
      />
      <label
        className="interactive-agent-label interactive-agent-label-hidden"
        htmlFor={textareaId}
      >
        Message
      </label>
      <textarea
        className="input interactive-agent-input"
        id={textareaId}
        onChange={(event) => onMessageChange(event.currentTarget.value)}
        placeholder="Plan work, draft Queue tasks, review pasted results, or ask what to do next."
        ref={textareaRef}
        rows={3}
        value={draft}
      />
      <div className="interactive-agent-action-row">
        <p className="interactive-agent-note">
          {isDirectModeEnabled
            ? "Runs with Codex from the selected working directory."
            : "Send uses visible chat only. No tools run."}
        </p>
        <div className="interactive-agent-composer-actions">
          {directMode?.canStopDirectWork ? (
            <Button
              disabled={directMode.isStopPending}
              onClick={directMode.onStopDirectWork}
              type="button"
              variant="secondary"
            >
              {directMode.isStopPending ? "Stopping" : "Stop"}
            </Button>
          ) : null}
          {workingLabel ? (
            <span
              aria-live="polite"
              className="interactive-agent-working-indicator"
              role="status"
            >
              <span aria-hidden="true" className="interactive-agent-working-dot" />
              <span aria-hidden="true" className="interactive-agent-working-dot" />
              <span aria-hidden="true" className="interactive-agent-working-dot" />
              <span>{workingLabel}</span>
            </span>
          ) : null}
          {directMode ? (
            <div
              aria-label="Current Codex thread"
              className="interactive-agent-run-thread-state"
              title={currentThreadTitle}
            >
              {currentThreadText}
            </div>
          ) : null}
          {directMode ? (
            <label
              className="interactive-agent-run-new-thread"
              htmlFor={newThreadInputId}
              title={
                hasActiveThread
                  ? "Start the next Run with Codex in a new thread."
                  : "No active thread. The next Run with Codex already starts a new thread."
              }
            >
              <input
                aria-label="New Thread"
                checked={startNewThreadOnNextRun}
                disabled={!hasActiveThread || directMode.status === "running"}
                id={newThreadInputId}
                onChange={(event) =>
                  setStartNewThreadOnNextRun(event.currentTarget.checked)
                }
                type="checkbox"
              />
              <span>New Thread</span>
            </label>
          ) : null}
          <Button
            disabled={
              directMode ? !directMode.canStartDirectWork : !canSend
            }
            type="submit"
            variant="primary"
          >
            {directMode
              ? directMode.status === "running"
                ? "Running with Codex"
                : "Run with Codex"
              : isProviderPending
                ? "Drafting"
                : "Send"}
          </Button>
          {directMode ? (
            <Button
              aria-expanded={isSettingsOpen}
              aria-label="Toggle Codex settings"
              className="interactive-agent-settings-button"
              onClick={() => setIsSettingsOpen((current) => !current)}
              title="Codex settings"
              type="button"
              variant="ghost"
            >
              ⚙
            </Button>
          ) : null}
          {directMode ? (
            <Button
              aria-expanded={isActivityOpen}
              aria-label="Show Agent Activity"
              onClick={() => setIsActivityOpen((current) => !current)}
              type="button"
              variant="ghost"
            >
              {isActivityOpen ? "Hide Agent Activity" : "Show Agent Activity"}
            </Button>
          ) : null}
        </div>
      </div>
      {directMode ? (
        <WorkspaceAgentDirectModePanel
          agentActivityEvents={directMode.agentActivityEvents}
          activitySummary={directMode.activitySummary}
          directWorkDirectory={directMode.directWorkDirectory}
          directWorkSandbox={directMode.directWorkSandbox}
          error={directMode.error}
          finalResult={directMode.finalResult}
          isActivityOpen={isActivityOpen}
          isSettingsOpen={isSettingsOpen}
          knowledgeLookup={directMode.knowledgeLookup}
          logs={directMode.logs}
          onDirectoryChange={directMode.onDirectoryChange}
          onSandboxChange={directMode.onSandboxChange}
          onSelectWorkspaceDirectory={directMode.onSelectWorkspaceDirectory}
          runId={directMode.runId}
          threadNotice={directMode.threadNotice}
          warning={directMode.warning}
        />
      ) : null}
    </form>
  );
}
