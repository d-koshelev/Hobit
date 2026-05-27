import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import { TerminalPtySessionPanel } from "./TerminalPtySessionPanel";
import { type TerminalFrameStatusView } from "./TerminalRunCommandPanel";
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
        onCloseTerminalPtySession={onCloseTerminalPtySession}
        onCreateTerminalPtySession={onCreateTerminalPtySession}
        onFrameStatusChange={setFrameStatus}
        onGetTerminalPtySession={onGetTerminalPtySession}
        onKillTerminalPtySession={onKillTerminalPtySession}
        onResizeTerminalPtySession={onResizeTerminalPtySession}
        onRunTerminalCommand={onRunTerminalCommand}
        onStopTerminalPtySession={onStopTerminalPtySession}
        onWriteTerminalPtySession={onWriteTerminalPtySession}
      />
    </WidgetFrame>
  );
}
