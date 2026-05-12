import { useId, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { RunTerminalCommandResponse } from "../workspace/types";
import type { WidgetRenderProps } from "./types";

const DEFAULT_TIMEOUT_MS = "30000";
const DEFAULT_STDOUT_CAP_BYTES = "65536";
const DEFAULT_STDERR_CAP_BYTES = "65536";

export function TerminalPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onRunTerminalCommand,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const commandInputId = useId();
  const workingDirectoryInputId = useId();
  const timeoutInputId = useId();
  const stdoutCapInputId = useId();
  const stderrCapInputId = useId();
  const commandPanelTitleId = useId();
  const [commandDraft, setCommandDraft] = useState("");
  const [workingDirectoryDraft, setWorkingDirectoryDraft] = useState("");
  const [timeoutMsDraft, setTimeoutMsDraft] = useState(DEFAULT_TIMEOUT_MS);
  const [stdoutCapBytesDraft, setStdoutCapBytesDraft] = useState(
    DEFAULT_STDOUT_CAP_BYTES,
  );
  const [stderrCapBytesDraft, setStderrCapBytesDraft] = useState(
    DEFAULT_STDERR_CAP_BYTES,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [runResult, setRunResult] =
    useState<RunTerminalCommandResponse | null>(null);

  const parsedCommand = splitCommandLine(commandDraft);
  const commandInputError = commandDraft.trim() ? parsedCommand.error : null;
  const program = parsedCommand.program;
  const args = parsedCommand.args;
  const workingDirectory = workingDirectoryDraft.trim();
  const timeoutMsError = positiveIntegerInputError(timeoutMsDraft, "Timeout ms");
  const stdoutCapBytesError = positiveIntegerInputError(
    stdoutCapBytesDraft,
    "Stdout cap bytes",
  );
  const stderrCapBytesError = positiveIntegerInputError(
    stderrCapBytesDraft,
    "Stderr cap bytes",
  );
  const numericInputError =
    timeoutMsError ?? stdoutCapBytesError ?? stderrCapBytesError;
  const canRun =
    Boolean(onRunTerminalCommand) &&
    program.length > 0 &&
    workingDirectory.length > 0 &&
    !commandInputError &&
    !numericInputError &&
    !isRunning;

  async function runCommand() {
    if (!onRunTerminalCommand || isRunning) {
      return;
    }

    setRunErrorMessage(null);
    setRunResult(null);

    if (commandInputError) {
      setRunErrorMessage(commandInputError);
      return;
    }

    if (numericInputError) {
      setRunErrorMessage(numericInputError);
      return;
    }

    setIsRunning(true);

    try {
      const timeoutMs = parsePositiveIntegerInput(
        timeoutMsDraft,
        "Timeout ms",
      );
      const stdoutCapBytes = parsePositiveIntegerInput(
        stdoutCapBytesDraft,
        "Stdout cap bytes",
      );
      const stderrCapBytes = parsePositiveIntegerInput(
        stderrCapBytesDraft,
        "Stderr cap bytes",
      );
      const response = await onRunTerminalCommand(instance.id, {
        program,
        args,
        workingDirectory,
        timeoutMs,
        stdoutCapBytes,
        stderrCapBytes,
      });

      if (!response) {
        throw new Error(
          "Terminal command was not accepted for this widget instance.",
        );
      }

      setRunResult(response);
    } catch (error) {
      setRunErrorMessage(errorToMessage(error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={terminalFrameStatus(runResult, runErrorMessage, isRunning)}
      style={frameStyle}
      title={title}
    >
      <section
        aria-labelledby={commandPanelTitleId}
        className="terminal-command-panel"
      >
        <div className="terminal-command-header">
          <div className="terminal-command-copy">
            <h3 className="terminal-command-title" id={commandPanelTitleId}>
              Terminal command
            </h3>
            <p className="terminal-command-text">
              Run one local command. Not interactive yet.
            </p>
          </div>
          <Badge variant="info">One-shot</Badge>
        </div>

        <div className="terminal-command-controls">
          <div className="terminal-command-field">
            <label
              className="terminal-command-label"
              htmlFor={workingDirectoryInputId}
            >
              Working directory
            </label>
            <Input
              autoComplete="off"
              id={workingDirectoryInputId}
              onChange={(event) =>
                setWorkingDirectoryDraft(event.target.value)
              }
              placeholder="C:\\path\\to\\workspace"
              spellCheck={false}
              type="text"
              value={workingDirectoryDraft}
            />
          </div>

          <div className="terminal-command-field terminal-command-field-wide">
            <label
              className="terminal-command-label"
              htmlFor={commandInputId}
            >
              Command
            </label>
            <Input
              aria-invalid={commandInputError ? true : undefined}
              autoComplete="off"
              id={commandInputId}
              onChange={(event) => setCommandDraft(event.target.value)}
              placeholder="git status"
              spellCheck={false}
              type="text"
              value={commandDraft}
            />
          </div>

          {commandInputError ? (
            <p className="terminal-command-validation" role="alert">
              {commandInputError}
            </p>
          ) : null}

          <details className="terminal-command-advanced">
            <summary className="terminal-command-advanced-summary">
              Advanced
            </summary>
            <div className="terminal-command-advanced-body">
              <p className="terminal-command-note">
                The command is split into a program and arguments for the
                existing one-shot backend. Quotes group spaces; shell features
                are not expanded.
              </p>
              <dl className="terminal-command-parsed-grid">
                <TerminalResultField
                  label="Program"
                  value={program || "No command entered"}
                />
                <TerminalResultField
                  label="Arguments"
                  value={args.length > 0 ? args.join(" ") : "None"}
                />
              </dl>
              <div className="terminal-command-controls">
                <TerminalNumberField
                  error={timeoutMsError}
                  id={timeoutInputId}
                  label="Timeout ms"
                  onChange={setTimeoutMsDraft}
                  value={timeoutMsDraft}
                />
                <TerminalNumberField
                  error={stdoutCapBytesError}
                  id={stdoutCapInputId}
                  label="Stdout cap bytes"
                  onChange={setStdoutCapBytesDraft}
                  value={stdoutCapBytesDraft}
                />
                <TerminalNumberField
                  error={stderrCapBytesError}
                  id={stderrCapInputId}
                  label="Stderr cap bytes"
                  onChange={setStderrCapBytesDraft}
                  value={stderrCapBytesDraft}
                />
              </div>
            </div>
          </details>

          {numericInputError ? (
            <p className="terminal-command-validation" role="alert">
              {numericInputError}
            </p>
          ) : null}
        </div>

        <div className="terminal-command-action-row">
          <Button disabled={!canRun} onClick={runCommand} variant="primary">
            {isRunning ? "Running..." : "Run"}
          </Button>
          <p className="terminal-command-note">
            Creates one Terminal widget run, logs, and final result.
          </p>
        </div>
      </section>

      {isRunning ? (
        <TerminalNotice
          message="The one-shot command is running through the desktop backend."
          title="Running..."
          variant="info"
        />
      ) : null}

      {runErrorMessage ? (
        <TerminalNotice
          message={runErrorMessage}
          title="Command request failed"
          variant="error"
        />
      ) : null}

      {runResult ? (
        <TerminalResultCard result={runResult} />
      ) : (
        <TerminalEmptyConsole />
      )}
    </WidgetFrame>
  );
}

function TerminalEmptyConsole() {
  return (
    <section aria-label="Terminal output" className="terminal-result-card">
      <div className="terminal-result-header">
        <div className="terminal-result-copy">
          <h3 className="terminal-result-title">Output</h3>
          <p className="terminal-result-text">
            No command has run in this Terminal widget yet.
          </p>
        </div>
        <Badge variant="neutral">Idle</Badge>
      </div>
      <pre aria-label="Terminal output" className="terminal-placeholder-output">
        <code>Ready.</code>
      </pre>
    </section>
  );
}

function TerminalNumberField({
  error,
  id,
  label,
  onChange,
  value,
}: {
  error?: string | null;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="terminal-command-field">
      <label className="terminal-command-label" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-invalid={error ? true : undefined}
        id={id}
        min={1}
        onChange={(event) => onChange(event.target.value)}
        step={1}
        type="number"
        value={value}
      />
    </div>
  );
}

function TerminalNotice({
  message,
  title,
  variant,
}: {
  message: string;
  title: string;
  variant: "info" | "error";
}) {
  return (
    <div
      aria-live="polite"
      className={`terminal-run-notice terminal-run-notice-${variant}`}
      role="status"
    >
      <p className="terminal-run-notice-title">{title}</p>
      <p className="terminal-run-notice-text">{message}</p>
    </div>
  );
}

function TerminalResultCard({
  result,
}: {
  result: RunTerminalCommandResponse;
}) {
  const statusView = terminalResultStatusView(result);

  return (
    <section
      aria-label="Terminal command result"
      className={`terminal-result-card terminal-result-card-${statusView.tone}`}
    >
      <div className="terminal-result-header">
        <div className="terminal-result-copy">
          <h3 className="terminal-result-title">{statusView.title}</h3>
          <p className="terminal-result-text">
            Last one-shot result for this Terminal widget.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      <dl className="terminal-result-grid">
        <TerminalResultField label="Run id" value={result.runId} />
        <TerminalResultField label="Status" value={result.status} />
        <TerminalResultField
          label="Exit code"
          value={result.exitCode === null ? "None" : String(result.exitCode)}
        />
        <TerminalResultField
          label="Duration"
          value={`${result.durationMs} ms`}
        />
        <TerminalResultField
          label="Stdout truncated"
          value={result.stdoutTruncated ? "Yes" : "No"}
        />
        <TerminalResultField
          label="Stderr truncated"
          value={result.stderrTruncated ? "Yes" : "No"}
        />
      </dl>

      {result.errorMessage ? (
        <div className="terminal-result-error">
          <span className="terminal-result-label">Error message</span>
          <span className="terminal-result-value">{result.errorMessage}</span>
        </div>
      ) : null}

      <TerminalOutputPreview
        label="stdout"
        output={result.stdout}
        truncated={result.stdoutTruncated}
      />
      <TerminalOutputPreview
        label="stderr"
        output={result.stderr}
        truncated={result.stderrTruncated}
      />
    </section>
  );
}

function TerminalResultField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="terminal-result-field">
      <dt className="terminal-result-label">{label}</dt>
      <dd className="terminal-result-value">{value}</dd>
    </div>
  );
}

function TerminalOutputPreview({
  label,
  output,
  truncated,
}: {
  label: string;
  output: string;
  truncated: boolean;
}) {
  return (
    <div className="terminal-output-preview">
      <div className="terminal-output-header">
        <span className="terminal-result-label">{label}</span>
        {truncated ? <Badge variant="warning">Truncated</Badge> : null}
      </div>
      <pre aria-label={label} className="terminal-placeholder-output">
        <code>{output || "No output captured."}</code>
      </pre>
    </div>
  );
}

function terminalFrameStatus(
  result: RunTerminalCommandResponse | null,
  errorMessage: string | null,
  isRunning: boolean,
) {
  if (isRunning) {
    return <Badge variant="info">Running</Badge>;
  }

  if (errorMessage) {
    return <Badge variant="error">Request failed</Badge>;
  }

  if (!result) {
    return <Badge variant="neutral">Ready</Badge>;
  }

  const statusView = terminalResultStatusView(result);

  return <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>;
}

function terminalResultStatusView(result: RunTerminalCommandResponse): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  title: string;
  tone: "neutral" | "success" | "warning" | "error";
} {
  if (result.status === "completed" && result.exitCode === 0) {
    return {
      badgeLabel: "Completed",
      badgeVariant: "success",
      title: "Completed successfully",
      tone: "success",
    };
  }

  if (result.status === "completed") {
    return {
      badgeLabel: "Completed",
      badgeVariant: "warning",
      title: "Completed with nonzero exit",
      tone: "warning",
    };
  }

  if (result.status === "timed_out") {
    return {
      badgeLabel: "Timed out",
      badgeVariant: "warning",
      title: "Command timed out",
      tone: "warning",
    };
  }

  if (result.status === "failed" || result.status === "failed_to_start") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "error",
      title: "Command failed to start",
      tone: "error",
    };
  }

  return {
    badgeLabel: result.status,
    badgeVariant: "neutral",
    title: "Command result",
    tone: "neutral",
  };
}

function splitCommandLine(value: string): {
  args: string[];
  error: string | null;
  program: string;
} {
  const tokens: string[] = [];
  let currentToken = "";
  let activeQuote: '"' | "'" | null = null;
  let tokenStarted = false;

  for (const character of value.trim()) {
    if (character === '"' || character === "'") {
      tokenStarted = true;

      if (activeQuote === character) {
        activeQuote = null;
        continue;
      }

      if (!activeQuote) {
        activeQuote = character;
        continue;
      }
    }

    if (!activeQuote && /\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(currentToken);
        currentToken = "";
        tokenStarted = false;
      }
      continue;
    }

    currentToken += character;
    tokenStarted = true;
  }

  if (activeQuote) {
    return {
      args: [],
      error: "Command has an unclosed quote.",
      program: "",
    };
  }

  if (tokenStarted) {
    tokens.push(currentToken);
  }

  const [nextProgram = "", ...nextArgs] = tokens;

  return {
    args: nextArgs,
    error: null,
    program: nextProgram,
  };
}

function parsePositiveIntegerInput(value: string, label: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const errorMessage = positiveIntegerInputError(value, label);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return Number(trimmedValue);
}

function positiveIntegerInputError(value: string, label: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    return `${label} must be a positive integer.`;
  }

  return null;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to run terminal command.";
}
