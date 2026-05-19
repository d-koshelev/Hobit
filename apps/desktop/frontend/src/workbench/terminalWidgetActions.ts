import {
  closeTerminalPtySession,
  createTerminalPtySession,
  getTerminalPtySession,
  killTerminalPtySession,
  listTerminalPtySessions,
  resizeTerminalPtySession,
  runTerminalCommand,
  stopTerminalPtySession,
  writeTerminalPtySession,
} from "../workspace/workspaceApi";
import type {
  CreateTerminalPtySessionRequest,
  ListTerminalPtySessionsRequest,
  ResizeTerminalPtySessionRequest,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  WriteTerminalPtySessionRequest,
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

export type TerminalPtyCreateRequest = Omit<
  CreateTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type TerminalPtyActionRequest = Omit<
  TerminalPtySessionActionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type TerminalPtyWriteRequest = Omit<
  WriteTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type TerminalPtyResizeRequest = Omit<
  ResizeTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type TerminalPtyListRequest = Omit<
  ListTerminalPtySessionsRequest,
  "workspaceId" | "workbenchId"
>;

export type TerminalWidgetActions = {
  runTerminalCommand: (
    widgetInstanceId: WidgetInstanceId,
    command: TerminalCommandRunRequest,
  ) => Promise<RunTerminalCommandResponse | null>;
  createTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyCreateRequest,
  ) => Promise<TerminalPtySession | null>;
  writeTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyWriteRequest,
  ) => Promise<TerminalPtySession | null>;
  resizeTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyResizeRequest,
  ) => Promise<TerminalPtySession | null>;
  stopTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) => Promise<TerminalPtySession | null>;
  killTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) => Promise<TerminalPtySession | null>;
  closeTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) => Promise<TerminalPtySession | null>;
  getTerminalPtySession: (
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) => Promise<TerminalPtySession | null>;
  listTerminalPtySessions: (
    request?: TerminalPtyListRequest,
  ) => Promise<TerminalPtySession[]>;
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

  async function createTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyCreateRequest,
  ) {
    const workbenchId = requireTerminalWidget(
      widgetInstanceId,
      "create a Terminal PTY session",
    );

    return createTerminalPtySession({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      ...request,
    });
  }

  async function writeTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyWriteRequest,
  ) {
    const workbenchId = requireTerminalWidget(
      widgetInstanceId,
      "write to a Terminal PTY session",
    );

    return writeTerminalPtySession({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      ...request,
    });
  }

  async function resizeTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyResizeRequest,
  ) {
    const workbenchId = requireTerminalWidget(
      widgetInstanceId,
      "resize a Terminal PTY session",
    );

    return resizeTerminalPtySession({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      ...request,
    });
  }

  async function stopTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) {
    return runTerminalPtyScopedAction(
      widgetInstanceId,
      request,
      "stop a Terminal PTY session",
      stopTerminalPtySession,
    );
  }

  async function killTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) {
    return runTerminalPtyScopedAction(
      widgetInstanceId,
      request,
      "kill a Terminal PTY session",
      killTerminalPtySession,
    );
  }

  async function closeTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) {
    return runTerminalPtyScopedAction(
      widgetInstanceId,
      request,
      "close a Terminal PTY session",
      closeTerminalPtySession,
    );
  }

  async function getTerminalWidgetPtySession(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
  ) {
    return runTerminalPtyScopedAction(
      widgetInstanceId,
      request,
      "inspect a Terminal PTY session",
      getTerminalPtySession,
    );
  }

  async function listTerminalWidgetPtySessions(
    request: TerminalPtyListRequest = {},
  ) {
    const workbenchId = requireOpenWorkbench(
      viewState,
      "list Terminal PTY sessions",
    );

    return listTerminalPtySessions({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId: request.widgetInstanceId ?? null,
    });
  }

  function requireTerminalWidget(
    widgetInstanceId: WidgetInstanceId,
    actionLabel: string,
  ) {
    const workbenchId = requireOpenWorkbench(viewState, actionLabel);
    requireWidget(
      viewState,
      widgetInstanceId,
      "Terminal PTY session could not be controlled for this widget.",
    );

    return workbenchId;
  }

  async function runTerminalPtyScopedAction(
    widgetInstanceId: WidgetInstanceId,
    request: TerminalPtyActionRequest,
    actionLabel: string,
    action: (
      request: TerminalPtySessionActionRequest,
    ) => Promise<TerminalPtySession | null>,
  ) {
    const workbenchId = requireTerminalWidget(widgetInstanceId, actionLabel);

    return action({
      workspaceId: viewState.workspace.id,
      workbenchId,
      widgetInstanceId,
      ...request,
    });
  }

  return {
    runTerminalCommand: runTerminalWidgetCommand,
    createTerminalPtySession: createTerminalWidgetPtySession,
    writeTerminalPtySession: writeTerminalWidgetPtySession,
    resizeTerminalPtySession: resizeTerminalWidgetPtySession,
    stopTerminalPtySession: stopTerminalWidgetPtySession,
    killTerminalPtySession: killTerminalWidgetPtySession,
    closeTerminalPtySession: closeTerminalWidgetPtySession,
    getTerminalPtySession: getTerminalWidgetPtySession,
    listTerminalPtySessions: listTerminalWidgetPtySessions,
  };
}
