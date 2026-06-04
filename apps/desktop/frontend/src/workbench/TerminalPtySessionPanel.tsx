import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_TERMINAL_WORKING_DIRECTORY,
  type TerminalPtySession,
} from "../workspace/types";
import {
  TerminalPtySettingsBody,
  TerminalShellHeader,
  TerminalShellOutputPanel,
} from "./TerminalPtySessionPanelParts";
import type { TerminalPtySessionPanelProps } from "./TerminalPtySessionTypes";
import type { TerminalXtermSurfaceHandle } from "./TerminalXtermSurface";
import {
  errorToMessage,
  parsePositiveIntegerInput,
  positiveIntegerInputError,
  TerminalNotice,
} from "./TerminalRunCommandPanel";
import {
  isTerminalPtyActive,
  isUnsupportedError,
  maxOutputSequence,
  terminalArgumentLines,
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
  const sessionStateLabel = session?.status ?? statusView.label.toLowerCase();
  const exitCodeLabel = session
    ? session.exitCode === null
      ? "none"
      : String(session.exitCode)
    : "none";
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
        <TerminalShellHeader
          activeSession={activeSession}
          canClose={canClose}
          canStart={canStart}
          canStop={canStop}
          exitCodeLabel={exitCodeLabel}
          hasOpenSession={hasOpenSession}
          isClosing={isClosing}
          isStarting={isStarting}
          isStopping={isStopping}
          onClose={() => void closeSession()}
          onStart={() => void startSession()}
          onStop={() => void stopSession()}
          sessionStateLabel={sessionStateLabel}
          shellLabel={shellLabel}
          workingDirectoryLabel={workingDirectoryLabel}
        />

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

        <TerminalShellOutputPanel
          activeSession={activeSession}
          clearedThroughSequence={clearedThroughSequence}
          copyStatus={copyStatus}
          isRefreshing={isRefreshing}
          onClear={clearVisibleOutput}
          onCopy={() => void copyVisibleOutput()}
          onFitDimensions={handleXtermFitDimensions}
          onGetTerminalPtySession={onGetTerminalPtySession}
          onInputData={(data) => void sendRawStdin(data)}
          onRefresh={() => void refreshSession(false)}
          onResize={(cols, rows) => void resizeSessionToXterm(cols, rows)}
          session={session}
          terminalSurfaceRef={terminalSurfaceRef}
          workingDirectoryLabel={workingDirectoryLabel}
        />
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
          <TerminalPtySettingsBody
            activeSession={activeSession}
            canKill={canKill}
            canResize={canResize}
            colsDraft={colsDraft}
            colsError={colsError}
            colsInputId={colsInputId}
            instance={instance}
            isKilling={isKilling}
            isResizing={isResizing}
            isStarting={isStarting}
            killConfirmOpen={killConfirmOpen}
            legacyFallbackOpen={legacyFallbackOpen}
            onCancelKill={() => setKillConfirmOpen(false)}
            onColsDraftChange={setColsDraft}
            onKill={() => void killSession()}
            onLegacyFallbackOpenChange={setLegacyFallbackOpen}
            onOpenKillConfirm={() => setKillConfirmOpen(true)}
            onOutputCapDraftChange={setOutputCapDraft}
            onResize={() => void resizeSession()}
            onRowsDraftChange={setRowsDraft}
            onRunTerminalCommand={onRunTerminalCommand}
            onShellArgsDraftChange={setShellArgsDraft}
            onShellDraftChange={setShellDraft}
            onWorkingDirectoryDraftChange={setWorkingDirectoryDraft}
            outputCapDraft={outputCapDraft}
            outputCapError={outputCapError}
            outputCapInputId={outputCapInputId}
            rowsDraft={rowsDraft}
            rowsError={rowsError}
            rowsInputId={rowsInputId}
            session={session}
            shellArgsDraft={shellArgsDraft}
            shellArgsInputId={shellArgsInputId}
            shellDraft={shellDraft}
            shellInputId={shellInputId}
            shellLabel={DEFAULT_SHELL_LABEL}
            workingDirectoryDraft={workingDirectoryDraft}
            workingDirectoryInputId={workingDirectoryInputId}
          />
        ) : null}
      </details>
    </section>
  );
}
