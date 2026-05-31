import {
  type FormEvent,
  type RefObject,
  useId,
} from "react";
import { Button } from "../design-system/Button";
import type { DirectWorkSandbox } from "../workspace/types";
import {
  type CoordinatorDirectWorkLogEntry,
  type CoordinatorDirectWorkStatus,
  type WorkspaceAgentActivitySummary,
  type WorkspaceKnowledgeLookup,
} from "./workspaceAgentDirectWorkModel";
import { WorkspaceAgentDirectModePanel } from "./WorkspaceAgentDirectModePanel";
import { WorkspaceAgentVisibleContextPanel } from "./WorkspaceAgentVisibleContextPanel";
import type { WorkspaceAgentVisibleContext } from "./workspaceAgentVisibleContext";

type WorkspaceAgentComposerDirectMode = {
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
  onResetThread: () => void;
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
  onRunWithCodex: () => void | Promise<void>;
  onSend: () => void | Promise<void>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  visibleAttachedContext: WorkspaceAgentVisibleContext | null;
}) {
  const textareaId = useId();
  const isDirectModeEnabled = Boolean(directMode);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (directMode) {
      await onRunWithCodex();
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
        </div>
      </div>
      {directMode ? (
        <WorkspaceAgentDirectModePanel
          activitySummary={directMode.activitySummary}
          directWorkDirectory={directMode.directWorkDirectory}
          directWorkSandbox={directMode.directWorkSandbox}
          error={directMode.error}
          finalResult={directMode.finalResult}
          knowledgeLookup={directMode.knowledgeLookup}
          logs={directMode.logs}
          onDirectoryChange={directMode.onDirectoryChange}
          onResetThread={directMode.onResetThread}
          onSandboxChange={directMode.onSandboxChange}
          onSelectWorkspaceDirectory={directMode.onSelectWorkspaceDirectory}
          runId={directMode.runId}
          status={directMode.status}
          threadId={directMode.threadId}
          threadNotice={directMode.threadNotice}
          warning={directMode.warning}
        />
      ) : null}
    </form>
  );
}
