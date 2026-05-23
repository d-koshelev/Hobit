import { useMemo, useState } from "react";
import type { WorkspaceWorkbenchState } from "../workspace/types";
import {
  createAgentExecutorWidgetActions,
  type AgentExecutorWidgetActions,
} from "./agentExecutorWidgetActions";
import {
  createAgentQueueTaskActions,
  type AgentQueueTaskWidgetActions,
} from "./agentQueueTaskWidgetActions";
import {
  createGitWidgetActions,
  type GitWidgetActions,
} from "./gitWidgetActions";
import {
  createJdbcConnectorActions,
  type JdbcConnectorWidgetActions,
} from "./jdbcConnectorWidgetActions";
import {
  createTerminalWidgetActions,
  type TerminalWidgetActions,
} from "./terminalWidgetActions";
import {
  createCoordinatorProviderActions,
  type CoordinatorProviderWidgetActions,
} from "./coordinatorProviderWidgetActions";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";
import type { CurrentSessionActivityEvents } from "./useCurrentSessionActivity";
import { createWorkbenchViewStateFromWorkspaceState } from "./viewState";
import {
  createWorkspaceNoteActions,
  type WorkspaceNoteWidgetActions,
} from "./workspaceNoteWidgetActions";
import {
  createWorkspaceWidgetActions,
  type WorkspaceWidgetActions,
} from "./workspaceWidgetActions";

type UseWorkbenchWidgetActionsOptions = {
  currentSessionActivity?: CurrentSessionActivityEvents;
  onViewStateChange: (viewState: WorkbenchViewState) => void;
  viewState: WorkbenchViewState;
};

export type WorkbenchWidgetActions = WorkspaceWidgetActions &
  WorkspaceNoteWidgetActions &
  AgentQueueTaskWidgetActions &
  JdbcConnectorWidgetActions &
  CoordinatorProviderWidgetActions &
  AgentExecutorWidgetActions &
  GitWidgetActions &
  TerminalWidgetActions;

export type WorkbenchWidgetInstanceActions = Omit<
  WorkbenchWidgetActions,
  "addWidgetTemplate"
>;

export function useWorkbenchWidgetActions({
  currentSessionActivity,
  onViewStateChange,
  viewState,
}: UseWorkbenchWidgetActionsOptions): WorkbenchWidgetActions {
  const [logRefreshTokens, setLogRefreshTokens] = useState<
    Partial<Record<WidgetInstanceId, number>>
  >({});

  function applyWorkbenchState(workbenchState: WorkspaceWorkbenchState) {
    onViewStateChange(
      createWorkbenchViewStateFromWorkspaceState(workbenchState),
    );
  }

  function bumpWidgetLogRefreshToken(widgetInstanceId: WidgetInstanceId) {
    setLogRefreshTokens((currentTokens) => ({
      ...currentTokens,
      [widgetInstanceId]: (currentTokens[widgetInstanceId] ?? 0) + 1,
    }));
  }
  const agentQueueTaskActions = useMemo(
    () => createAgentQueueTaskActions(viewState),
    [viewState],
  );

  return {
    ...createWorkspaceWidgetActions({
      applyWorkbenchState,
      bumpWidgetLogRefreshToken,
      logRefreshTokens,
      viewState,
    }),
    ...createWorkspaceNoteActions(viewState),
    ...agentQueueTaskActions,
    ...createJdbcConnectorActions(viewState),
    ...createCoordinatorProviderActions(viewState),
    ...createAgentExecutorWidgetActions({
      bumpWidgetLogRefreshToken,
      currentSessionActivity,
      viewState,
    }),
    ...createGitWidgetActions({
      bumpWidgetLogRefreshToken,
      viewState,
    }),
    ...createTerminalWidgetActions({
      bumpWidgetLogRefreshToken,
      currentSessionActivity,
      viewState,
    }),
  };
}
