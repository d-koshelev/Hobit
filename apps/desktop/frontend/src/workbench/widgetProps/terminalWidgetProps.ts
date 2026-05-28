import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type TerminalActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "closeTerminalPtySession"
  | "createTerminalPtySession"
  | "getTerminalPtySession"
  | "killTerminalPtySession"
  | "listTerminalPtySessions"
  | "resizeTerminalPtySession"
  | "runTerminalCommand"
  | "stopTerminalPtySession"
  | "writeTerminalPtySession"
>;

export function terminalWidgetProps(
  actions: TerminalActions,
): Partial<WidgetRenderProps> {
  return {
    onCloseTerminalPtySession: actions.closeTerminalPtySession,
    onCreateTerminalPtySession: actions.createTerminalPtySession,
    onGetTerminalPtySession: actions.getTerminalPtySession,
    onKillTerminalPtySession: actions.killTerminalPtySession,
    onListTerminalPtySessions: actions.listTerminalPtySessions,
    onResizeTerminalPtySession: actions.resizeTerminalPtySession,
    onRunTerminalCommand: actions.runTerminalCommand,
    onStopTerminalPtySession: actions.stopTerminalPtySession,
    onWriteTerminalPtySession: actions.writeTerminalPtySession,
  };
}
