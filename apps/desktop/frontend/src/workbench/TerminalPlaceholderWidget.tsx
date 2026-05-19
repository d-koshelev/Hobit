import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { TerminalPtySessionPanel } from "./TerminalPtySessionPanel";
import {
  TerminalNotice,
  TerminalRunCommandPanel,
  type TerminalFrameStatusView,
} from "./TerminalRunCommandPanel";
import type { WidgetRenderProps } from "./types";

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
  const [ptyActive, setPtyActive] = useState(false);
  const [legacyFallbackOpen, setLegacyFallbackOpen] = useState(false);
  const [frameStatus, setFrameStatus] =
    useState<TerminalFrameStatusView>(DEFAULT_FRAME_STATUS);

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
          Compatibility path for one bounded program/argv run. PTY sessions are
          the normal Terminal surface.
        </p>
        {legacyFallbackOpen ? (
          ptyActive ? (
            <TerminalNotice
              message="Stop or kill the active PTY session before using the legacy one-shot command fallback."
              title="PTY session active"
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
    </WidgetFrame>
  );
}
