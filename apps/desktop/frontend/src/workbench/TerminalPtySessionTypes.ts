import type {
  CreateTerminalPtySessionRequest,
  ResizeTerminalPtySessionRequest,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  WriteTerminalPtySessionRequest,
} from "../workspace/types";
import type { WidgetInstance, WidgetInstanceId } from "./types";
import type { TerminalFrameStatusView } from "./TerminalRunCommandPanel";

export type TerminalPtyAction = (
  widgetInstanceId: WidgetInstanceId,
  request: Omit<
    TerminalPtySessionActionRequest,
    "workspaceId" | "workbenchId" | "widgetInstanceId"
  >,
) => Promise<TerminalPtySession | null>;

export type TerminalPtySessionPanelProps = {
  instance: WidgetInstance;
  onCloseTerminalPtySession?: TerminalPtyAction;
  onCreateTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      CreateTerminalPtySessionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onActiveSessionChange?: (isActive: boolean) => void;
  onFrameStatusChange?: (status: TerminalFrameStatusView) => void;
  onGetTerminalPtySession?: TerminalPtyAction;
  onKillTerminalPtySession?: TerminalPtyAction;
  onResizeTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      ResizeTerminalPtySessionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onRunTerminalCommand?: (
    widgetInstanceId: WidgetInstanceId,
    command: Omit<
      RunTerminalCommandRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<RunTerminalCommandResponse | null>;
  onStopTerminalPtySession?: TerminalPtyAction;
  onWriteTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      WriteTerminalPtySessionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
};
