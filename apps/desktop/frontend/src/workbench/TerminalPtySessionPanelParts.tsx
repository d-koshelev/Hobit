import type { RefObject } from "react";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type { TerminalPtySession } from "../workspace/types";
import type { WidgetInstance } from "./types";
import {
  TerminalXtermSurface,
  type TerminalXtermSurfaceHandle,
} from "./TerminalXtermSurface";
import {
  TerminalNotice,
  TerminalNumberField,
  TerminalRunCommandPanel,
} from "./TerminalRunCommandPanel";
import type { TerminalPtySessionPanelProps } from "./TerminalPtySessionTypes";
import { TerminalPtyKillControl } from "./TerminalPtyKillControl";
import {
  isTerminalPtyActive,
  TerminalPtySessionSummary,
} from "./TerminalPtySessionView";

export function TerminalShellHeader({
  activeSession,
  canClose,
  canClear,
  canCopy,
  canKill,
  canRemovePane,
  canRefresh,
  canSplitPane,
  canStart,
  canStop,
  exitCodeLabel,
  hasOpenSession,
  isActivePane,
  isClosing,
  isKilling,
  isRefreshing,
  isStarting,
  isStopping,
  killConfirmOpen,
  onActivatePane,
  onCancelKill,
  onClear,
  onClose,
  onClosePane,
  onCopy,
  onKill,
  onOpenKillConfirm,
  onRefresh,
  onRestart,
  onSplitDown,
  onSplitRight,
  onStop,
  onToggleSettings,
  paneLabel,
  settingsOpen,
  sessionStateLabel,
  shellLabel,
  workingDirectoryLabel,
}: {
  activeSession: boolean;
  canClose: boolean;
  canClear: boolean;
  canCopy: boolean;
  canKill: boolean;
  canRemovePane: boolean;
  canRefresh: boolean;
  canSplitPane: boolean;
  canStart: boolean;
  canStop: boolean;
  exitCodeLabel: string;
  hasOpenSession: boolean;
  isActivePane: boolean;
  isClosing: boolean;
  isKilling: boolean;
  isRefreshing: boolean;
  isStarting: boolean;
  isStopping: boolean;
  killConfirmOpen: boolean;
  onActivatePane: () => void;
  onCancelKill: () => void;
  onClear: () => void;
  onClose: () => void;
  onClosePane: () => void;
  onCopy: () => void;
  onKill: () => void;
  onOpenKillConfirm: () => void;
  onRefresh: () => void;
  onRestart: () => void;
  onSplitDown: () => void;
  onSplitRight: () => void;
  onStop: () => void;
  onToggleSettings: () => void;
  paneLabel: string;
  settingsOpen: boolean;
  sessionStateLabel: string;
  shellLabel: string;
  workingDirectoryLabel: string;
}) {
  return (
    <div className="terminal-shell-header">
      <div className="terminal-shell-context" aria-label="Terminal context">
        <button
          aria-pressed={isActivePane}
          className="terminal-pane-title"
          onClick={onActivatePane}
          type="button"
        >
          <span className="terminal-pane-title-text">{paneLabel}</span>
          {isActivePane ? (
            <span className="terminal-pane-active-indicator">Active</span>
          ) : null}
        </button>
        <span className="terminal-shell-context-value" title={shellLabel}>
          {shellLabel}
        </span>
        <span
          className="terminal-shell-context-value terminal-shell-context-path"
          title={workingDirectoryLabel}
        >
          {workingDirectoryLabel}
        </span>
        <span
          className="terminal-shell-context-status"
          title={
            exitCodeLabel === "none"
              ? sessionStateLabel
              : `${sessionStateLabel}; exit code ${exitCodeLabel}`
          }
        >
          {sessionStateLabel}
        </span>
      </div>
      <div className="terminal-shell-actions">
        {!hasOpenSession ? (
          <Button disabled={!canStart} onClick={onRestart} variant="secondary">
            {isStarting ? "Starting..." : "Restart"}
          </Button>
        ) : null}
        {hasOpenSession ? (
          <Button
            className="terminal-shell-action-secondary"
            disabled={!canRefresh}
            onClick={onRefresh}
            variant="secondary"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        ) : null}
        {hasOpenSession ? (
          <Button
            className="terminal-shell-action-secondary"
            disabled={!canCopy}
            onClick={onCopy}
            variant="secondary"
          >
            Copy
          </Button>
        ) : null}
        {hasOpenSession ? (
          <Button
            className="terminal-shell-action-secondary"
            disabled={!canClear}
            onClick={onClear}
            variant="secondary"
          >
            Clear
          </Button>
        ) : null}
        {activeSession ? (
          <Button disabled={!canStop} onClick={onStop} variant="secondary">
            {isStopping ? "Stopping..." : "Stop"}
          </Button>
        ) : null}
        {canClose ? (
          <Button disabled={!canClose} onClick={onClose} variant="secondary">
            {isClosing ? "Closing..." : "Close"}
          </Button>
        ) : null}
        <details className="terminal-pane-more">
          <summary aria-label={`${paneLabel} more actions`}>More</summary>
          <div className="terminal-pane-more-menu">
            {hasOpenSession ? (
              <Button
                className="terminal-pane-compact-action"
                disabled={!canRefresh}
                onClick={onRefresh}
                variant="secondary"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            ) : null}
            {hasOpenSession ? (
              <Button
                className="terminal-pane-compact-action"
                disabled={!canCopy}
                onClick={onCopy}
                variant="secondary"
              >
                Copy
              </Button>
            ) : null}
            {hasOpenSession ? (
              <Button
                className="terminal-pane-compact-action"
                disabled={!canClear}
                onClick={onClear}
                variant="secondary"
              >
                Clear
              </Button>
            ) : null}
            <Button
              aria-label="Split pane right"
              disabled={!canSplitPane}
              onClick={onSplitRight}
              title="Split this pane to the right"
              variant="secondary"
            >
              Split right
            </Button>
            <Button
              aria-label="Split pane down"
              disabled={!canSplitPane}
              onClick={onSplitDown}
              title="Split this pane below"
              variant="secondary"
            >
              Split down
            </Button>
            <Button
              aria-label="Terminal pane settings"
              aria-expanded={settingsOpen}
              onClick={onToggleSettings}
              title="Terminal settings"
              variant="secondary"
            >
              Settings
            </Button>
            {activeSession ? (
              <TerminalPtyKillControl
                canKill={canKill}
                isKilling={isKilling}
                killConfirmOpen={killConfirmOpen}
                onCancelKill={onCancelKill}
                onKill={onKill}
                onOpenKillConfirm={onOpenKillConfirm}
              />
            ) : null}
            <Button
              aria-label="Close pane"
              disabled={!canRemovePane}
              onClick={onClosePane}
              title={
                hasOpenSession
                  ? "Close the session before removing this pane."
                  : "Close pane"
              }
              variant="secondary"
            >
              Close pane
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}

export function TerminalShellOutputPanel({
  activeSession,
  clearedThroughSequence,
  copyStatus,
  onFitDimensions,
  onInputData,
  onResize,
  session,
  terminalSurfaceRef,
}: {
  activeSession: boolean;
  clearedThroughSequence: number;
  copyStatus: string | null;
  onFitDimensions: (cols: number, rows: number) => void;
  onInputData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  session: TerminalPtySession | null;
  terminalSurfaceRef: RefObject<TerminalXtermSurfaceHandle | null>;
}) {
  return (
    <div className="terminal-shell-output-panel">
      {copyStatus ? (
        <p className="terminal-command-note" role="status">
          {copyStatus}
        </p>
      ) : null}
      {session?.output.droppedBytes ? (
        <p className="terminal-command-validation">
          {session.output.droppedBytes} output bytes were dropped by the
          bounded backend buffer.
        </p>
      ) : null}
      <TerminalSessionLifecycleNote session={session} />
      <TerminalXtermSurface
        clearedThroughSequence={clearedThroughSequence}
        isInputEnabled={activeSession}
        onFitDimensions={onFitDimensions}
        onInputData={onInputData}
        onResize={onResize}
        outputChunks={session?.output.chunks ?? []}
        ref={terminalSurfaceRef}
        sessionId={session?.sessionId ?? null}
      />
    </div>
  );
}

export function TerminalPtySettingsBody({
  activeSession,
  canResize,
  colsDraft,
  colsError,
  colsInputId,
  instance,
  isResizing,
  isStarting,
  legacyFallbackOpen,
  onLegacyFallbackOpenChange,
  onResize,
  onRunTerminalCommand,
  outputCapDraft,
  outputCapError,
  outputCapInputId,
  rowsDraft,
  rowsError,
  rowsInputId,
  session,
  shellArgsDraft,
  shellArgsInputId,
  shellDraft,
  shellInputId,
  shellLabel,
  workingDirectoryDraft,
  workingDirectoryInputId,
  onColsDraftChange,
  onOutputCapDraftChange,
  onRowsDraftChange,
  onShellArgsDraftChange,
  onShellDraftChange,
  onWorkingDirectoryDraftChange,
}: {
  activeSession: boolean;
  canResize: boolean;
  colsDraft: string;
  colsError: string | null;
  colsInputId: string;
  instance: WidgetInstance;
  isResizing: boolean;
  isStarting: boolean;
  legacyFallbackOpen: boolean;
  onLegacyFallbackOpenChange: (isOpen: boolean) => void;
  onResize: () => void;
  onRunTerminalCommand: TerminalPtySessionPanelProps["onRunTerminalCommand"];
  outputCapDraft: string;
  outputCapError: string | null;
  outputCapInputId: string;
  rowsDraft: string;
  rowsError: string | null;
  rowsInputId: string;
  session: TerminalPtySession | null;
  shellArgsDraft: string;
  shellArgsInputId: string;
  shellDraft: string;
  shellInputId: string;
  shellLabel: string;
  workingDirectoryDraft: string;
  workingDirectoryInputId: string;
  onColsDraftChange: (value: string) => void;
  onOutputCapDraftChange: (value: string) => void;
  onRowsDraftChange: (value: string) => void;
  onShellArgsDraftChange: (value: string) => void;
  onShellDraftChange: (value: string) => void;
  onWorkingDirectoryDraftChange: (value: string) => void;
}) {
  return (
    <div className="terminal-settings-body">
      <p className="terminal-command-note">
        No persistent sessions yet. Configure shell and PTY settings here.
      </p>

      <div className="terminal-command-main-grid">
        <TerminalWorkingDirectoryField
          activeSession={activeSession}
          inputId={workingDirectoryInputId}
          isStarting={isStarting}
          onChange={onWorkingDirectoryDraftChange}
          value={workingDirectoryDraft}
        />
        <TerminalShellField
          activeSession={activeSession}
          inputId={shellInputId}
          isStarting={isStarting}
          onChange={onShellDraftChange}
          shellLabel={shellLabel}
          value={shellDraft}
        />
        <div className="terminal-command-field">
          <TerminalNumberField
            error={outputCapError}
            id={outputCapInputId}
            label="Output cap bytes"
            onChange={onOutputCapDraftChange}
            value={outputCapDraft}
          />
        </div>
        <TerminalShellArgsField
          activeSession={activeSession}
          inputId={shellArgsInputId}
          isStarting={isStarting}
          onChange={onShellArgsDraftChange}
          value={shellArgsDraft}
        />
        <div className="terminal-command-controls terminal-command-field-wide">
          <TerminalNumberField
            error={colsError}
            id={colsInputId}
            label="Columns"
            onChange={onColsDraftChange}
            value={colsDraft}
          />
          <TerminalNumberField
            error={rowsError}
            id={rowsInputId}
            label="Rows"
            onChange={onRowsDraftChange}
            value={rowsDraft}
          />
          <div className="terminal-command-field">
            <span className="terminal-command-label">Session size</span>
            <Button disabled={!canResize} onClick={onResize} variant="secondary">
              {isResizing ? "Resizing..." : "Apply size"}
            </Button>
          </div>
        </div>
      </div>

      <TerminalPtySessionSummary session={session} />
      <TerminalSettingsSafety />
      <TerminalLegacyFallback
        activeSession={activeSession}
        instance={instance}
        isOpen={legacyFallbackOpen}
        onOpenChange={onLegacyFallbackOpenChange}
        onRunTerminalCommand={onRunTerminalCommand}
      />
    </div>
  );
}

function TerminalWorkingDirectoryField({
  activeSession,
  inputId,
  isStarting,
  onChange,
  value,
}: {
  activeSession: boolean;
  inputId: string;
  isStarting: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="terminal-command-field terminal-command-field-wide">
      <label className="terminal-command-label" htmlFor={inputId}>
        Working directory
      </label>
      <Input
        autoComplete="off"
        disabled={activeSession || isStarting}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        placeholder="~"
        spellCheck={false}
        type="text"
        value={value}
      />
      <p className="terminal-command-note">
        Default `~` uses your user home in desktop sessions.
      </p>
    </div>
  );
}

function TerminalShellField({
  activeSession,
  inputId,
  isStarting,
  onChange,
  shellLabel,
  value,
}: {
  activeSession: boolean;
  inputId: string;
  isStarting: boolean;
  onChange: (value: string) => void;
  shellLabel: string;
  value: string;
}) {
  return (
    <div className="terminal-command-field">
      <label className="terminal-command-label" htmlFor={inputId}>
        Shell executable
      </label>
      <Input
        autoCapitalize="off"
        autoComplete="off"
        disabled={activeSession || isStarting}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={shellLabel}
        spellCheck={false}
        type="text"
        value={value}
      />
      <p className="terminal-command-note">
        Leave blank to use the platform default shell.
      </p>
    </div>
  );
}

function TerminalShellArgsField({
  activeSession,
  inputId,
  isStarting,
  onChange,
  value,
}: {
  activeSession: boolean;
  inputId: string;
  isStarting: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="terminal-command-field terminal-command-field-wide">
      <label className="terminal-command-label" htmlFor={inputId}>
        Shell args
      </label>
      <textarea
        autoCapitalize="off"
        autoComplete="off"
        className="input terminal-command-args-textarea"
        disabled={activeSession || isStarting}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        placeholder="-NoLogo"
        spellCheck={false}
        value={value}
      />
      <p className="terminal-command-note">
        Optional. One argument per line. Typed commands are interpreted by the
        selected shell.
      </p>
    </div>
  );
}

function TerminalSettingsSafety() {
  return (
    <div className="terminal-settings-safety">
      <p className="terminal-command-note">
        Output is a bounded runtime-only buffer and is not persisted. Keyboard
        input is sent directly to the active PTY session.
      </p>
    </div>
  );
}

function TerminalLegacyFallback({
  activeSession,
  instance,
  isOpen,
  onOpenChange,
  onRunTerminalCommand,
}: {
  activeSession: boolean;
  instance: WidgetInstance;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRunTerminalCommand: TerminalPtySessionPanelProps["onRunTerminalCommand"];
}) {
  return (
    <details
      className="terminal-legacy-runner"
      onToggle={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        onOpenChange(event.currentTarget.open);
      }}
    >
      <summary className="terminal-legacy-runner-summary">
        Legacy one-shot command fallback
      </summary>
      <p className="terminal-legacy-runner-copy">
        Compatibility path for one bounded program/argv run. PTY sessions are
        the normal Terminal surface.
      </p>
      {isOpen ? (
        activeSession ? (
          <TerminalNotice
            message="Stop or kill the active terminal session before using the legacy one-shot command fallback."
            title="Terminal session active"
            variant="info"
          />
        ) : (
          <TerminalRunCommandPanel
            instance={instance}
            onRunTerminalCommand={onRunTerminalCommand}
          />
        )
      ) : null}
    </details>
  );
}

function TerminalSessionLifecycleNote({
  session,
}: {
  session: TerminalPtySession | null;
}) {
  if (!session || isTerminalPtyActive(session)) {
    return null;
  }

  const message = terminalSessionLifecycleMessage(session);
  if (!message) {
    return null;
  }

  return (
    <p className="terminal-session-state" role="status">
      {message}
    </p>
  );
}

function terminalSessionLifecycleMessage(session: TerminalPtySession) {
  switch (session.status) {
    case "exited": {
      const exitCode =
        session.exitCode === null
          ? "without an exit code"
          : `with code ${session.exitCode}`;
      return `Session exited ${exitCode}. Close it before starting a new session.`;
    }
    case "stopped":
      return "Session stopped. Close it before starting a new session.";
    case "killed":
      return "Session killed. Close it before starting a new session.";
    case "closed":
      return "Session closed. Restart creates a new explicit session.";
    default:
      return session.errorMessage;
  }
}
