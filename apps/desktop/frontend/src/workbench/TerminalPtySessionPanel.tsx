import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type { TerminalPtySession } from "../workspace/types";
import type { TerminalPtySessionPanelProps } from "./TerminalPtySessionTypes";
import {
  errorToMessage,
  parsePositiveIntegerInput,
  positiveIntegerInputError,
  TerminalNotice,
  TerminalNumberField,
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

const DEFAULT_SHELL = "powershell.exe";
const DEFAULT_COLS = "80";
const DEFAULT_ROWS = "24";
const DEFAULT_OUTPUT_BUFFER_CAP_BYTES = "65536";
const POLL_INTERVAL_MS = 1250;
const INPUT_NEWLINE = "\r\n";

export function TerminalPtySessionPanel({
  instance,
  onCloseTerminalPtySession,
  onCreateTerminalPtySession,
  onActiveSessionChange,
  onFrameStatusChange,
  onGetTerminalPtySession,
  onKillTerminalPtySession,
  onResizeTerminalPtySession,
  onStopTerminalPtySession,
  onWriteTerminalPtySession,
}: TerminalPtySessionPanelProps) {
  const panelTitleId = useId();
  const shellInputId = useId();
  const shellArgsInputId = useId();
  const workingDirectoryInputId = useId();
  const colsInputId = useId();
  const rowsInputId = useId();
  const outputCapInputId = useId();
  const stdinInputId = useId();
  const [shellDraft, setShellDraft] = useState(DEFAULT_SHELL);
  const [shellArgsDraft, setShellArgsDraft] = useState("");
  const [workingDirectoryDraft, setWorkingDirectoryDraft] = useState("");
  const [colsDraft, setColsDraft] = useState(DEFAULT_COLS);
  const [rowsDraft, setRowsDraft] = useState(DEFAULT_ROWS);
  const [outputCapDraft, setOutputCapDraft] = useState(
    DEFAULT_OUTPUT_BUFFER_CAP_BYTES,
  );
  const [stdinDraft, setStdinDraft] = useState("");
  const [session, setSession] = useState<TerminalPtySession | null>(null);
  const [clearedThroughSequence, setClearedThroughSequence] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const visibleOutput = useMemo(
    () => terminalPtyVisibleOutput(session, clearedThroughSequence),
    [clearedThroughSequence, session],
  );
  const canStart =
    Boolean(onCreateTerminalPtySession) &&
    !hasOpenSession &&
    !isStarting &&
    shell.length > 0 &&
    workingDirectory.length > 0 &&
    !numericInputError;
  const canSend =
    Boolean(onWriteTerminalPtySession) &&
    activeSession &&
    stdinDraft.length > 0 &&
    !isSending;
  const canResize =
    Boolean(onResizeTerminalPtySession) &&
    activeSession &&
    !numericInputError &&
    !isResizing;
  const canStop = Boolean(onStopTerminalPtySession) && activeSession && !isStopping;
  const canKill = Boolean(onKillTerminalPtySession) && activeSession && !isKilling;
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
    if (!shell) {
      setErrorMessage("Shell executable is required.");
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
    } catch (error) {
      setErrorMessage(
        errorToMessage(error, "Unable to create Terminal PTY session."),
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function sendStdinLine() {
    if (!session || !onWriteTerminalPtySession || !canSend) {
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    try {
      const response = await onWriteTerminalPtySession(instance.id, {
        sessionId: session.sessionId,
        data: `${stdinDraft}${INPUT_NEWLINE}`,
      });
      setStdinDraft("");
      applySessionResponse(response);
    } catch (error) {
      setErrorMessage(
        errorToMessage(error, "Unable to send input to Terminal PTY session."),
      );
    } finally {
      setIsSending(false);
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
    setClearedThroughSequence(maxOutputSequence(session));
    setCopyStatus(null);
  }

  async function copyVisibleOutput() {
    if (!visibleOutput) {
      setCopyStatus("No output to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(visibleOutput);
      setCopyStatus("Output copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  function handleStdinKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void sendStdinLine();
  }

  return (
    <section aria-labelledby={panelTitleId} className="terminal-pty-panel">
      <div className="terminal-command-header">
        <div className="terminal-command-copy">
          <h3 className="terminal-command-title" id={panelTitleId}>
            PTY session
          </h3>
          <p className="terminal-command-text">
            Start a visible manual shell inside an explicit execution workspace.
          </p>
          <p className="terminal-command-boundary">
            No command history, tabs, splits, persistence, AI execution, or
            hidden background sessions.
          </p>
        </div>
        <Badge variant={statusView.variant}>{statusView.label}</Badge>
      </div>

      <div className="terminal-command-main-grid">
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
            placeholder="powershell.exe"
            spellCheck={false}
            type="text"
            value={shellDraft}
          />
        </div>

        <div className="terminal-command-field">
          <label
            className="terminal-command-label"
            htmlFor={workingDirectoryInputId}
          >
            Execution workspace
          </label>
          <Input
            autoComplete="off"
            disabled={activeSession || isStarting}
            id={workingDirectoryInputId}
            onChange={(event) => setWorkingDirectoryDraft(event.target.value)}
            placeholder="C:\\path\\to\\workspace"
            spellCheck={false}
            type="text"
            value={workingDirectoryDraft}
          />
        </div>

        <div className="terminal-command-field terminal-command-field-wide">
          <label className="terminal-command-label" htmlFor={shellArgsInputId}>
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
            Optional. One argument per line. Typed commands are interpreted by
            the selected shell.
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
          <TerminalNumberField
            error={outputCapError}
            id={outputCapInputId}
            label="Output cap bytes"
            onChange={setOutputCapDraft}
            value={outputCapDraft}
          />
        </div>

        {numericInputError ? (
          <p className="terminal-command-validation" role="alert">
            {numericInputError}
          </p>
        ) : null}
      </div>

      <div className="terminal-pty-actions">
        <Button disabled={!canStart} onClick={startSession} variant="primary">
          {isStarting
            ? "Starting..."
            : hasOpenSession
              ? "Close session first"
              : "Start session"}
        </Button>
        <Button
          disabled={!canResize}
          onClick={resizeSession}
          variant="secondary"
        >
          {isResizing ? "Resizing..." : "Apply size"}
        </Button>
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
          {isRefreshing ? "Refreshing..." : "Refresh output"}
        </Button>
        <Button disabled={!canStop} onClick={stopSession} variant="secondary">
          {isStopping ? "Stopping..." : "Stop"}
        </Button>
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
                Kill stops only the owned shell process. File changes already
                written by commands are not rolled back.
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
        <Button disabled={!canClose} onClick={closeSession} variant="secondary">
          {isClosing ? "Closing..." : "Close"}
        </Button>
      </div>

      {!workingDirectory && !activeSession ? (
        <TerminalNotice
          message="Provide an explicit execution workspace before starting a PTY session. Hobit does not default Terminal sessions to home, Documents, Downloads, or drive roots."
          title="Not configured"
          variant="info"
        />
      ) : null}

      {activeSession ? (
        <TerminalNotice
          message="Output is read from the bounded backend session buffer by periodic refresh. Event streaming, tabs, splits, command history, and transcript persistence are not implemented."
          title="Session output"
          variant="info"
        />
      ) : null}

      {session && activeSession ? (
        <TerminalNotice
          message="Stop asks the shell to exit gracefully. Kill force terminates the owned shell process and does not roll back written files."
          title="Stop and kill boundary"
          variant="info"
        />
      ) : null}

      {errorMessage ? (
        <TerminalNotice
          message={errorMessage}
          title={isUnsupportedError(errorMessage) ? "Unsupported" : "PTY request failed"}
          variant={isUnsupportedError(errorMessage) ? "info" : "error"}
        />
      ) : null}

      <TerminalPtySessionSummary session={session} />

      <div className="terminal-pty-stdin-row">
        <label className="terminal-command-label" htmlFor={stdinInputId}>
          Stdin
        </label>
        <textarea
          autoCapitalize="off"
          autoComplete="off"
          className="input terminal-pty-stdin"
          disabled={!activeSession || isSending}
          id={stdinInputId}
          onChange={(event) => setStdinDraft(event.target.value)}
          onKeyDown={handleStdinKeyDown}
          placeholder="echo hello"
          spellCheck={false}
          value={stdinDraft}
        />
        <div className="terminal-pty-actions">
          <Button disabled={!canSend} onClick={sendStdinLine} variant="primary">
            {isSending ? "Sending..." : "Send line"}
          </Button>
          <p className="terminal-command-note">
            Enter sends one line. Shift+Enter inserts a newline.
          </p>
        </div>
      </div>

      <div className="terminal-result-card terminal-pty-output-card">
        <div className="terminal-result-header">
          <div className="terminal-result-copy">
            <h3 className="terminal-result-title">Session buffer</h3>
            <p className="terminal-result-text">
              Runtime-only PTY output. The backend buffer is bounded and not
              persisted.
            </p>
          </div>
          <span className="terminal-pty-actions">
            <Button
              disabled={!visibleOutput}
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
        <pre aria-label="Terminal PTY output" className="terminal-pty-output">
          <code>
            {visibleOutput ||
              "Start a session to see shell output. Use Refresh output if the session is idle between automatic refreshes."}
          </code>
        </pre>
      </div>
    </section>
  );
}
