import { runTerminalCommand } from "../workspace/workspaceApi";
import type {
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
} from "../workspace/types";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";
import type { CurrentSessionActivityEvents } from "./useCurrentSessionActivity";
import {
  requireOpenWorkbench,
  requireWidget,
  type WidgetLogRefreshTokenBumper,
} from "./workbenchWidgetActionContext";

export type TerminalCommandRunRequest = Omit<
  RunTerminalCommandRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type TerminalWidgetActions = {
  runTerminalCommand: (
    widgetInstanceId: WidgetInstanceId,
    command: TerminalCommandRunRequest,
  ) => Promise<RunTerminalCommandResponse | null>;
};

type TerminalWidgetActionOptions = {
  bumpWidgetLogRefreshToken: WidgetLogRefreshTokenBumper;
  currentSessionActivity?: CurrentSessionActivityEvents;
  viewState: WorkbenchViewState;
};

export function createTerminalWidgetActions({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  viewState,
}: TerminalWidgetActionOptions): TerminalWidgetActions {
  async function runTerminalWidgetCommand(
    widgetInstanceId: WidgetInstanceId,
    command: TerminalCommandRunRequest,
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "run a Terminal command",
    );
    requireWidget(
      viewState,
      widgetInstanceId,
      "Terminal command could not be run for this widget.",
    );

    currentSessionActivity?.markTerminalRunStarted(widgetInstanceId);

    try {
      const response = await runTerminalCommand({
        workspaceId: viewState.workspace.id,
        workbenchId,
        widgetInstanceId,
        ...command,
      });

      if (response) {
        bumpWidgetLogRefreshToken(widgetInstanceId);
      }

      currentSessionActivity?.markTerminalRunFinished(
        widgetInstanceId,
        response,
      );
      return response;
    } catch (error) {
      currentSessionActivity?.markTerminalRunFailed(widgetInstanceId, error);
      throw error;
    }
  }

  return {
    runTerminalCommand: runTerminalWidgetCommand,
  };
}
