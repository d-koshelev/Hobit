import { useEffect, useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { TerminalPtySessionPanel } from "./TerminalPtySessionPanel";
import {
  TerminalRunCommandPanel,
  type TerminalFrameStatusView,
} from "./TerminalRunCommandPanel";
import type { WidgetRenderProps } from "./types";

type TerminalMode = "pty" | "command";

const DEFAULT_FRAME_STATUS: TerminalFrameStatusView = {
  label: "Not started",
  variant: "neutral",
};

export function TerminalPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onCloseTerminalPtySession,
  onCreateTerminalPtySession,
  onGetTerminalPtySession,
  onKillTerminalPtySession,
  onLoadLogs,
  onResizeTerminalPtySession,
  onRunTerminalCommand,
  onStartFrameMove,
  onStopTerminalPtySession,
  onWriteTerminalPtySession,
  title,
}: WidgetRenderProps) {
  const [mode, setMode] = useState<TerminalMode>("pty");
  const [ptyActive, setPtyActive] = useState(false);
  const [frameStatus, setFrameStatus] =
    useState<TerminalFrameStatusView>(DEFAULT_FRAME_STATUS);

  useEffect(() => {
    setFrameStatus(
      mode === "pty"
        ? DEFAULT_FRAME_STATUS
        : { label: "Run command", variant: "neutral" },
    );
  }, [mode]);

  const status = <Badge variant={frameStatus.variant}>{frameStatus.label}</Badge>;

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      status={status}
      style={frameStyle}
      title={title}
    >
      <div aria-label="Terminal mode" className="terminal-mode-switch">
        <Button
          aria-pressed={mode === "pty"}
          className={mode === "pty" ? "terminal-mode-button-active" : undefined}
          onClick={() => setMode("pty")}
          variant={mode === "pty" ? "primary" : "secondary"}
        >
          PTY session
        </Button>
        <Button
          aria-pressed={mode === "command"}
          className={
            mode === "command" ? "terminal-mode-button-active" : undefined
          }
          disabled={ptyActive}
          onClick={() => setMode("command")}
          title={
            ptyActive
              ? "Stop or kill the active PTY session before switching modes."
              : "Show one-shot Run command mode"
          }
          variant={mode === "command" ? "primary" : "secondary"}
        >
          Run command
        </Button>
      </div>

      {mode === "pty" ? (
        <TerminalPtySessionPanel
          instance={instance}
          onActiveSessionChange={setPtyActive}
          onCloseTerminalPtySession={onCloseTerminalPtySession}
          onCreateTerminalPtySession={onCreateTerminalPtySession}
          onFrameStatusChange={setFrameStatus}
          onGetTerminalPtySession={onGetTerminalPtySession}
          onKillTerminalPtySession={onKillTerminalPtySession}
          onResizeTerminalPtySession={onResizeTerminalPtySession}
          onStopTerminalPtySession={onStopTerminalPtySession}
          onWriteTerminalPtySession={onWriteTerminalPtySession}
        />
      ) : (
        <TerminalRunCommandPanel
          instance={instance}
          onFrameStatusChange={setFrameStatus}
          onRunTerminalCommand={onRunTerminalCommand}
        />
      )}
    </WidgetFrame>
  );
}
