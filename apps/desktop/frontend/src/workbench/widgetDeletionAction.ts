import {
  deleteWidgetInstanceFromWorkbench,
  killTerminalPtySession,
  listTerminalPtySessions,
} from "../workspace/workspaceApi";
import type {
  TerminalPtySession,
  WorkspaceWorkbenchState,
} from "../workspace/types";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";
import { TERMINAL_WIDGET_DEFINITION_ID } from "./widgetRegistry";

export type WidgetRemovalConfirmation = {
  kind: "normal" | "terminal-active-sessions";
};

export type WidgetRemovalOptions = {
  forceKillTerminalSessions?: boolean;
};

const NORMAL_WIDGET_REMOVAL_CONFIRMATION: WidgetRemovalConfirmation = {
  kind: "normal",
};

export async function removeWidgetInstanceFromWorkbenchView(
  viewState: WorkbenchViewState,
  widgetInstanceId: WidgetInstanceId,
  options: WidgetRemovalOptions = {},
): Promise<WorkspaceWorkbenchState> {
  if (!viewState.workbench.id) {
    throw new Error("A workbench must be open to remove a widget.");
  }

  const widget = viewState.widgets.find(
    (candidate) => candidate.id === widgetInstanceId,
  );

  if (!widget) {
    throw new Error("Widget could not be removed from this workbench.");
  }

  if (widget.definitionId === TERMINAL_WIDGET_DEFINITION_ID) {
    const activeSessions = await listActiveTerminalSessionsForWidget(
      viewState,
      widgetInstanceId,
    );

    if (activeSessions.length > 0 && !options.forceKillTerminalSessions) {
      throw new Error(
        "Terminal PTY sessions are still running. Force kill them before removing this widget.",
      );
    }

    if (activeSessions.length > 0) {
      await forceKillTerminalSessionsForWidget(
        viewState,
        widgetInstanceId,
        activeSessions,
      );
    }
  }

  const workbenchState = await deleteWidgetInstanceFromWorkbench({
    workspaceId: viewState.workspace.id,
    workbenchId: viewState.workbench.id,
    widgetInstanceId,
  });

  if (!workbenchState) {
    throw new Error("Widget was not found in this workbench.");
  }

  return workbenchState;
}

export async function getWidgetRemovalConfirmation(
  viewState: WorkbenchViewState,
  widgetInstanceId: WidgetInstanceId,
): Promise<WidgetRemovalConfirmation> {
  const widget = viewState.widgets.find(
    (candidate) => candidate.id === widgetInstanceId,
  );

  if (!widget || widget.definitionId !== TERMINAL_WIDGET_DEFINITION_ID) {
    return NORMAL_WIDGET_REMOVAL_CONFIRMATION;
  }

  const activeSessions = await listActiveTerminalSessionsForWidget(
    viewState,
    widgetInstanceId,
  );

  return activeSessions.length > 0
    ? { kind: "terminal-active-sessions" }
    : NORMAL_WIDGET_REMOVAL_CONFIRMATION;
}

async function listActiveTerminalSessionsForWidget(
  viewState: WorkbenchViewState,
  widgetInstanceId: WidgetInstanceId,
) {
  const workbenchId = viewState.workbench.id;
  if (!workbenchId) {
    throw new Error("A workbench must be open to inspect Terminal sessions.");
  }

  const sessions = await listTerminalPtySessions({
    workspaceId: viewState.workspace.id,
    workbenchId,
    widgetInstanceId,
  });

  return sessions.filter(
    (session) =>
      session.widgetInstanceId === widgetInstanceId &&
      isActiveTerminalPtySession(session),
  );
}

async function forceKillTerminalSessionsForWidget(
  viewState: WorkbenchViewState,
  widgetInstanceId: WidgetInstanceId,
  sessions: TerminalPtySession[],
) {
  const workbenchId = viewState.workbench.id;
  if (!workbenchId) {
    throw new Error("A workbench must be open to force kill Terminal sessions.");
  }

  for (const session of sessions) {
    try {
      const killedSession = await killTerminalPtySession({
        workspaceId: viewState.workspace.id,
        workbenchId,
        widgetInstanceId,
        sessionId: session.sessionId,
      });

      if (killedSession && isActiveTerminalPtySession(killedSession)) {
        throw new Error("Terminal session is still running.");
      }
    } catch (error) {
      throw new Error(
        `Terminal PTY sessions could not be force killed. ${errorToString(error)}`,
      );
    }
  }
}

function isActiveTerminalPtySession(session: TerminalPtySession) {
  return session.status === "running" || session.status === "stopping";
}

function errorToString(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown error.";
}
