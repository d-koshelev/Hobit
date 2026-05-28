import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import {
  DEFAULT_TERMINAL_WORKING_DIRECTORY,
  type TerminalPtySession,
} from "../workspace/types";
import type { TerminalPtySessionPanelProps } from "./TerminalPtySessionTypes";
import {
  TerminalXtermSurface,
  type TerminalXtermSurfaceHandle,
} from "./TerminalXtermSurface";
import {
  errorToMessage,
  parsePositiveIntegerInput,
  positiveIntegerInputError,
  TerminalNotice,
  TerminalNumberField,
  TerminalRunCommandPanel,
} from "./TerminalRunCommandPanel";
import {
  isTerminalPtyActive,
  isUnsupportedError,
  maxOutputSequence,
  terminalArgumentLines,
  TerminalPtySessionSummary,
  terminalPtyStatusView,
  terminalPtyVisibleOutput,
} from "./TerminalPtySessionView";

const DEFAULT_SHELL = "";
const DEFAULT_SHELL_LABEL = "Default shell";
const DEFAULT_COLS = "80";
const DEFAULT_ROWS = "24";
const DEFAULT_OUTPUT_BUFFER_CAP_BYTES = "65536";
const POLL_INTERVAL_MS = 1250;

export function TerminalPtySessionPanel({
  instance,
  onCloseTerminalPtySession,
  onCreateTerminalPtySession,
  onActiveSessionChange,
  onFrameStatusChange,
  onGetTerminalPtySession,
  onKillTerminalPtySession,
  onResizeTerminalPtySession,
  onRunTerminalCommand,
  onStopTerminalPtySession,
  onWriteTerminalPtySession,
}: TerminalPtySessionPanelProps) {
  const settingsTitleId = useId();
  const shellInputId = useId();
  const shellArgsInputId = useId();
  const workingDirectoryInputId = useId();
  const colsInputId = useId();
  const rowsInputId = useId();
  const outputCapInputId = useId();
  const terminalSurfaceRef = useRef<TerminalXtermSurfaceHandle | null>(null);
  const [shellDraft, setShellDraft] = useState(DEFAULT_SHELL);
  const [shellArgsDraft, setShellArgsDraft] = useState("");
  const [workingDirectoryDraft, setWorkingDirectoryDraft] = useState(
    DEFAULT_TERMINAL_WORKING_DIRECTORY,
  );
  const [colsDraft, setColsDraft] = useState(DEFAULT_COLS);
  const [rowsDraft, setRowsDraft] = useState(DEFAULT_ROWS);
  const [outputCapDraft, setOutputCapDraft] = useState(
    DEFAULT_OUTPUT_BUFFER_CAP_BYTES,
  );
  const [session, setSession] = useState<TerminalPtySession | null>(null);
  const [clearedThroughSequence, setClearedThroughSequence] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legacyFallbackOpen, setLegacyFallbackOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clearedThroughSequenceRef = useRef(0);

  const shell = shellDraft.trim();
  const workingDirectory = workingDirectoryDraft.trim();
  const shellArgs = terminalArgumentLines(shellArgsDraft);
  const colsError = positiveIntegerInputError(colsDraft, "Columns");
  const rowsError = positiveIntegerInputError(rowsDraft, "Rows");
  const outputCapError = positiveIntegerInputError(
    outputCapDraft,
    "Output buffer cap bytes",
  );
  const numericInputError = colsError ?? rowsError ?? outputCapError;
  const activeSession = Boolean(session && isTerminalPtyActive(session));
  const hasOpenSession = Boolean(session && session.status !== "closed");
  const statusView = terminalPtyStatusView(session, errorMessage, isStarting);
  const shellLabel = session?.shell || shell || DEFAULT_SHELL_LABEL;
  const workingDirectoryLabel =
    session?.workingDirectory || workingDirectory || "Not selected";
  const canStart =
    Boolean(onCreateTerminalPtySession) &&
    !hasOpenSession &&
    !isStarting &&
    workingDirectory.length > 0 &&
    !numericInputError;
  const canResize =
    Boolean(onResizeTerminalPtySession) &&
    activeSession &&
    !numericInputError &&
    !isResizing;
  const canStop =
    Boolean(onStopTerminalPtySession) && activeSession && !isStopping;
  const canKill =
    Boolean(onKillTerminalPtySession) && activeSession && !isKilling;
  const canClose =
    Boolean(onCloseTerminalPtySession) &&
    Boolean(session) &&
    !activeSession &&
    session?.status !== "closed" &&
    !isClosing;

  useEffect(() => {
    onFrameStatusChange?.(statusView);
  }, [onFrameStatusChange, statusView.label, statusView.variant]);

  useEffect(() => {
    onActiveSessionChange?.(activeSession);
  }, [activeSession, onActiveSessionChange]);

  useEffect(() => {
    if (!session || !isTerminalPtyActive(session) || !onGetTerminalPtySession) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSession(true);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [onGetTerminalPtySession, session?.sessionId, session?.status]);

  useLayoutEffect(() => {
    terminalSurfaceRef.current?.fit();
  }, [session?.sessionId, session?.status]);

  useEffect(() => {
    clearedThroughSequenceRef.current = clearedThroughSequence;
  }, [clearedThroughSequence]);

  async function startSession() {
    if (!onCreateTerminalPtySession || isStarting) {
      return;
    }

    setErrorMessage(null);
    setCopyStatus(null);

    if (!workingDirectory) {
      setErrorMessage("Execution workspace / working directory is required.");
      return;
    }
    if (numericInputError) {
      setErrorMessage(numericInputError);
      return;
    }

    setIsStarting(true);
    setClearedThroughSequence(0);

    try {
      const cols = parsePositiveIntegerInput(colsDraft, "Columns");
      const rows = parsePositiveIntegerInput(rowsDraft, "Rows");
      const outputBufferCapBytes = parsePositiveIntegerInput(
        outputCapDraft,
        "Output buffer cap bytes",
      );
      const response = await onCreateTerminalPtySession(instance.id, {
        shell,
        shellArgs,
        workingDirectory,
        cols,
        rows,
        outputBufferCapBytes,
      });

      if (!response) {
        throw new Error(
          "Terminal PTY session was not accepted for this widget instance.",
        );
      }

      setSession(response);
      window.setTimeout(() => terminalSurfaceRef.current?.focus(), 0);
    } catch (error) {
      setErrorMessage(
        errorToMessage(error, "Unable to create Terminal PTY session."),
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function sendRawStdin(data: string) {
    if (!session || !onWriteTerminalPtySession || !activeSession) {
      return;
    }

    setErrorMessage(null);

    try {
      const response = await onWriteTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
        data,
      });
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(
        errorToMessage(error, "Unable to send input to Terminal PTY session."),
      );
    } finally {
      terminalSurfaceRef.current?.focus();
    }
  }

  async function resizeSession() {
    if (!session || !onResizeTerminalPtySession || !canResize) {
      return;
    }

    setErrorMessage(null);
    setIsResizing(true);

    try {
      const cols = parsePositiveIntegerInput(colsDraft, "Columns");
      const rows = parsePositiveIntegerInput(rowsDraft, "Rows");
      if (cols === null || rows === null) {
        throw new Error("Columns and rows are required.");
      }
      const response = await onResizeTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
        cols,
        rows,
      });
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(errorToMessage(error, "Unable to resize PTY session."));
    } finally {
      setIsResizing(false);
    }
  }

  async function stopSession() {
    if (!session || !onStopTerminalPtySession || !canStop) {
      return;
    }

    setErrorMessage(null);
    setIsStopping(true);

    try {
      const response = await onStopTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
      });
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(errorToMessage(error, "Unable to stop PTY session."));
    } finally {
      setIsStopping(false);
    }
  }

  async function killSession() {
    if (!session || !onKillTerminalPtySession || !canKill) {
      return;
    }

    setErrorMessage(null);
    setIsKilling(true);

    try {
      const response = await onKillTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
      });
      setKillConfirmOpen(false);
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(
        errorToMessage(error, "Unable to force terminate PTY session."),
      );
    } finally {
      setIsKilling(false);
    }
  }

  async function closeSession() {
    if (!session || !onCloseTerminalPtySession || !canClose) {
      return;
    }

    setErrorMessage(null);
    setIsClosing(true);

    try {
      const response = await onCloseTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
      });
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(errorToMessage(error, "Unable to close PTY session."));
    } finally {
      setIsClosing(false);
    }
  }

  async function refreshSession(quiet = false) {
    if (!session || !onGetTerminalPtySession) {
      return;
    }

    if (!quiet) {
      setIsRefreshing(true);
      setErrorMessage(null);
    }

    try {
      const response = await onGetTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
      });
      applySessionResponse(response);
    } catch (error) {
      if (!quiet) {
        setErrorMessage(errorToMessage(error, "Unable to refresh PTY session."));
      }
    } finally {
      if (!quiet) {
        setIsRefreshing(false);
      }
    }
  }

  function applySessionResponse(response: TerminalPtySession | null) {
    if (!response) {
      setErrorMessage("Terminal PTY session is no longer available.");
      return;
    }

    setSession(response);
    if (response.cols) {
      setColsDraft(String(response.cols));
    }
    if (response.rows) {
      setRowsDraft(String(response.rows));
    }
  }

  function clearVisibleOutput() {
    const nextClearedThroughSequence = maxOutputSequence(session);
    clearedThroughSequenceRef.current = nextClearedThroughSequence;
    setClearedThroughSequence(nextClearedThroughSequence);
    terminalSurfaceRef.current?.clear();
    terminalSurfaceRef.current?.focus();
    setCopyStatus(null);
  }

  async function copyVisibleOutput() {
    const xtermText = terminalSurfaceRef.current?.getCopyText();
    const outputToCopy =
      xtermText === null || xtermText === undefined
        ? terminalPtyVisibleOutput(session, clearedThroughSequenceRef.current)
        : xtermText.trimEnd();

    if (!outputToCopy) {
      setCopyStatus("No output to copy.");
      terminalSurfaceRef.current?.focus();
      return;
    }

    try {
      await navigator.clipboard.writeText(outputToCopy);
      setCopyStatus("Output copied.");
    } catch {
      setCopyStatus("Copy failed.");
    } finally {
      terminalSurfaceRef.current?.focus();
    }
  }

  function handleXtermFitDimensions(cols: number, rows: number) {
    setColsDraft(String(cols));
    setRowsDraft(String(rows));
  }

  async function resizeSessionToXterm(cols: number, rows: number) {
    if (!session || !onResizeTerminalPtySession || !activeSession) {
      return;
    }

    setErrorMessage(null);
    setIsResizing(true);

    try {
      const response = await onResizeTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
        cols,
        rows,
      });
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(errorToMessage(error, "Unable to resize PTY session."));
    } finally {
      setIsResizing(false);
    }
  }

  return (
    <section aria-label="Terminal session" className="terminal-pty-panel">
      <div className="terminal-shell">
        <div className="terminal-shell-header">
          <div className="terminal-shell-meta" aria-label="Terminal context">
            <span className="terminal-shell-meta-item">
              <span className="terminal-shell-meta-label">cwd</span>
              <span
                className="terminal-shell-meta-value"
                title={workingDirectoryLabel}
              >
                {workingDirectoryLabel}
              </span>
            </span>
            <span className="terminal-shell-meta-item">
              <span className="terminal-shell-meta-label">shell</span>
              <span className="terminal-shell-meta-value" title={shellLabel}>
                {shellLabel}
              </span>
            </span>
          </div>
          <div className="terminal-shell-actions">
            {!hasOpenSession ? (
              <Button
                disabled={!canStart}
                onClick={startSession}
                variant="primary"
              >
                {isStarting ? "Starting..." : "Start"}
              </Button>
            ) : null}
            {activeSession ? (
              <Button
                disabled={!canStop}
                onClick={stopSession}
                variant="secondary"
              >
                {isStopping ? "Stopping..." : "Stop"}
              </Button>
            ) : null}
            {canClose ? (
              <Button
                disabled={!canClose}
                onClick={closeSession}
                variant="secondary"
              >
                {isClosing ? "Closing..." : "Close"}
              </Button>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <TerminalNotice
            message={errorMessage}
            title={
              isUnsupportedError(errorMessage) ? "Unsupported" : "Terminal error"
            }
            variant={isUnsupportedError(errorMessage) ? "info" : "error"}
          />
        ) : null}

        {!workingDirectory && !activeSession ? (
          <TerminalNotice
            message="Terminal runs local commands in the selected working directory."
            title="Working directory required"
            variant="info"
          />
        ) : null}

        {numericInputError ? (
          <p className="terminal-command-validation" role="alert">
            {numericInputError}
          </p>
        ) : null}

        <div className="terminal-shell-output-panel">
          <div className="terminal-shell-output-toolbar">
            <span className="terminal-shell-path" title={workingDirectoryLabel}>
              {workingDirectoryLabel}
            </span>
            <span className="terminal-shell-output-actions">
              <Button
                disabled={
                  !session ||
                  session.status === "closed" ||
                  !onGetTerminalPtySession ||
                  isRefreshing
                }
                onClick={() => void refreshSession(false)}
                variant="secondary"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button
                disabled={!session || session.status === "closed"}
                onClick={copyVisibleOutput}
                variant="secondary"
              >
                Copy
              </Button>
              <Button
                disabled={!session || maxOutputSequence(session) === 0}
                onClick={clearVisibleOutput}
                variant="secondary"
              >
                Clear
              </Button>
            </span>
          </div>
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
            onFitDimensions={handleXtermFitDimensions}
            onInputData={(data) => void sendRawStdin(data)}
            onResize={(cols, rows) => void resizeSessionToXterm(cols, rows)}
            outputChunks={session?.output.chunks ?? []}
            ref={terminalSurfaceRef}
            sessionId={session?.sessionId ?? null}
          />
        </div>
      </div>

      <details
        aria-labelledby={settingsTitleId}
        className="terminal-settings"
        onToggle={(event) => {
          if (event.currentTarget !== event.target) {
            return;
          }
          setSettingsOpen(event.currentTarget.open);
        }}
      >
        <summary className="terminal-settings-summary" id={settingsTitleId}>
          Terminal settings
        </summary>
        {settingsOpen ? (
          <div className="terminal-settings-body">
            <p className="terminal-command-note">
              No persistent sessions yet. Configure shell and PTY settings
              here.
            </p>

            <div className="terminal-command-main-grid">
              <div className="terminal-command-field terminal-command-field-wide">
                <label
                  className="terminal-command-label"
                  htmlFor={workingDirectoryInputId}
                >
                  Working directory
                </label>
                <Input
                  autoComplete="off"
                  disabled={activeSession || isStarting}
                  id={workingDirectoryInputId}
                  onChange={(event) =>
                    setWorkingDirectoryDraft(event.target.value)
                  }
                  placeholder="~"
                  spellCheck={false}
                  type="text"
                  value={workingDirectoryDraft}
                />
                <p className="terminal-command-note">
                  Default `~` uses your user home in desktop sessions.
                </p>
              </div>

              <div className="terminal-command-field">
                <label className="terminal-command-label" htmlFor={shellInputId}>
                  Shell executable
                </label>
                <Input
                  autoCapitalize="off"
                  autoComplete="off"
                  disabled={activeSession || isStarting}
                  id={shellInputId}
                  onChange={(event) => setShellDraft(event.target.value)}
                  placeholder={DEFAULT_SHELL_LABEL}
                  spellCheck={false}
                  type="text"
                  value={shellDraft}
                />
                <p className="terminal-command-note">
                  Leave blank to use the platform default shell.
                </p>
              </div>

              <div className="terminal-command-field">
                <TerminalNumberField
                  error={outputCapError}
                  id={outputCapInputId}
                  label="Output cap bytes"
                  onChange={setOutputCapDraft}
                  value={outputCapDraft}
                />
              </div>

              <div className="terminal-command-field terminal-command-field-wide">
                <label
                  className="terminal-command-label"
                  htmlFor={shellArgsInputId}
                >
                  Shell args
                </label>
                <textarea
                  autoCapitalize="off"
                  autoComplete="off"
                  className="input terminal-command-args-textarea"
                  disabled={activeSession || isStarting}
                  id={shellArgsInputId}
                  onChange={(event) => setShellArgsDraft(event.target.value)}
                  placeholder="-NoLogo"
                  spellCheck={false}
                  value={shellArgsDraft}
                />
                <p className="terminal-command-note">
                  Optional. One argument per line. Typed commands are
                  interpreted by the selected shell.
                </p>
              </div>

              <div className="terminal-command-controls terminal-command-field-wide">
                <TerminalNumberField
                  error={colsError}
                  id={colsInputId}
                  label="Columns"
                  onChange={setColsDraft}
                  value={colsDraft}
                />
                <TerminalNumberField
                  error={rowsError}
                  id={rowsInputId}
                  label="Rows"
                  onChange={setRowsDraft}
                  value={rowsDraft}
                />
                <div className="terminal-command-field">
                  <span className="terminal-command-label">Session size</span>
                  <Button
                    disabled={!canResize}
                    onClick={resizeSession}
                    variant="secondary"
                  >
                    {isResizing ? "Resizing..." : "Apply size"}
                  </Button>
                </div>
              </div>
            </div>

            <TerminalPtySessionSummary session={session} />

            <div className="terminal-settings-safety">
              <p className="terminal-command-note">
                Output is a bounded runtime-only buffer and is not persisted.
                Keyboard input is sent directly to the active PTY session.
              </p>
              <div className="terminal-pty-actions">
                <span className="terminal-pty-kill-action">
                  <Button
                    className="terminal-pty-kill-button"
                    disabled={!canKill}
                    onClick={() => setKillConfirmOpen(true)}
                    variant="secondary"
                  >
                    Kill
                  </Button>
                  {killConfirmOpen ? (
                    <span className="terminal-pty-kill-confirm" role="alert">
                      <span className="terminal-run-notice-title">
                        Force terminate session?
                      </span>
                      <span className="terminal-run-notice-text">
                        Kill stops only the owned shell process. File changes
                        already written by commands are not rolled back.
                      </span>
                      <span className="terminal-pty-kill-confirm-actions">
                        <Button
                          className="terminal-pty-kill-button"
                          disabled={isKilling}
                          onClick={killSession}
                          variant="secondary"
                        >
                          {isKilling ? "Killing..." : "Confirm kill"}
                        </Button>
                        <Button
                          disabled={isKilling}
                          onClick={() => setKillConfirmOpen(false)}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </span>
                    </span>
                  ) : null}
                </span>
              </div>
            </div>

            <details
              className="terminal-legacy-runner"
              onToggle={(event) => {
                if (event.currentTarget !== event.target) {
                  return;
                }
                setLegacyFallbackOpen(event.currentTarget.open);
              }}
            >
              <summary className="terminal-legacy-runner-summary">
                Legacy one-shot command fallback
              </summary>
              <p className="terminal-legacy-runner-copy">
                Compatibility path for one bounded program/argv run. PTY
                sessions are the normal Terminal surface.
              </p>
              {legacyFallbackOpen ? (
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
          </div>
        ) : null}
      </details>
    </section>
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
      return "Session closed. Start creates a new explicit session.";
    default:
      return session.errorMessage;
  }
}
