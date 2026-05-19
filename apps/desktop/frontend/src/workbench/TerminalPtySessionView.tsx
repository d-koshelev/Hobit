import type { TerminalPtySession } from "../workspace/types";
import { TerminalResultField, type TerminalFrameStatusView } from "./TerminalRunCommandPanel";

export function TerminalPtySessionSummary({
  session,
}: {
  session: TerminalPtySession | null;
}) {
  if (!session) {
    return (
      <dl className="terminal-result-grid terminal-pty-summary">
        <TerminalResultField label="Status" value="not started" />
        <TerminalResultField label="Session id" value="None" />
        <TerminalResultField label="Shell" value="Not started" />
        <TerminalResultField label="Execution workspace" value="Not selected" />
      </dl>
    );
  }

  return (
    <dl className="terminal-result-grid terminal-pty-summary">
      <TerminalResultField label="Status" value={session.status} />
      <TerminalResultField label="Session id" value={session.sessionId} />
      <TerminalResultField label="Shell" value={session.shell} />
      <TerminalResultField
        label="Execution workspace"
        value={session.workingDirectory}
      />
      <TerminalResultField
        label="Size"
        value={`${session.cols} cols x ${session.rows} rows`}
      />
      <TerminalResultField
        label="Exit code"
        value={session.exitCode === null ? "None" : String(session.exitCode)}
      />
      <TerminalResultField
        label="Buffered"
        value={`${session.output.totalBufferedBytes} / ${session.output.capBytes} bytes`}
      />
      <TerminalResultField
        label="Dropped"
        value={`${session.output.droppedBytes} bytes`}
      />
    </dl>
  );
}

export function terminalPtyVisibleOutput(
  session: TerminalPtySession | null,
  clearedThroughSequence: number,
) {
  if (!session) {
    return "";
  }

  return session.output.chunks
    .filter((chunk) => chunk.sequence > clearedThroughSequence)
    .map((chunk) => chunk.text)
    .join("");
}

export function maxOutputSequence(session: TerminalPtySession | null) {
  return session
    ? session.output.chunks.reduce(
        (maxSequence, chunk) => Math.max(maxSequence, chunk.sequence),
        0,
      )
    : 0;
}

export function isTerminalPtyActive(session: TerminalPtySession) {
  return session.status === "running" || session.status === "stopping";
}

export function terminalPtyStatusView(
  session: TerminalPtySession | null,
  errorMessage: string | null,
  isStarting: boolean,
): TerminalFrameStatusView {
  if (isStarting) {
    return { label: "Starting", variant: "info" };
  }

  if (errorMessage && isUnsupportedError(errorMessage)) {
    return { label: "Unsupported", variant: "warning" };
  }

  if (errorMessage) {
    return { label: "Error", variant: "error" };
  }

  if (!session) {
    return { label: "Not started", variant: "neutral" };
  }

  switch (session.status) {
    case "running":
      return { label: "Running", variant: "info" };
    case "stopping":
      return { label: "Stopping", variant: "warning" };
    case "exited":
      return { label: "Exited", variant: "success" };
    case "stopped":
      return { label: "Stopped", variant: "success" };
    case "killed":
      return { label: "Killed", variant: "warning" };
    case "closed":
      return { label: "Closed", variant: "neutral" };
    default:
      return { label: session.status, variant: "neutral" };
  }
}

export function isUnsupportedError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("unsupported") ||
    normalizedMessage.includes("only available in the tauri desktop shell")
  );
}

export function terminalArgumentLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
