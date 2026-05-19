import {
  createJdbcConnector,
  getJdbcConnector,
  listJdbcConnectors,
  updateJdbcConnector,
} from "../workspace/workspaceApi";
import type {
  CreateJdbcConnectorRequest,
  JdbcConnector,
  UpdateJdbcConnectorRequest,
} from "../workspace/jdbcConnectorTypes";
import type { WorkbenchViewState } from "./types";

export type JdbcConnectorCreateRequest = Omit<
  CreateJdbcConnectorRequest,
  "workspaceId"
>;

export type JdbcConnectorUpdateRequest = Omit<
  UpdateJdbcConnectorRequest,
  "workspaceId"
>;

export type JdbcConnectorWidgetActions = {
  createJdbcConnector: (
    request: JdbcConnectorCreateRequest,
  ) => Promise<JdbcConnector>;
  listJdbcConnectors: () => Promise<JdbcConnector[]>;
  getJdbcConnector: (connectorId: string) => Promise<JdbcConnector | null>;
  updateJdbcConnector: (
    request: JdbcConnectorUpdateRequest,
  ) => Promise<JdbcConnector | null>;
};

export function createJdbcConnectorActions(
  viewState: WorkbenchViewState,
): JdbcConnectorWidgetActions {
  return {
    createJdbcConnector: (request) => {
      requireOpenWorkbench(viewState, "create JDBC connectors");
      return createJdbcConnector({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
    getJdbcConnector: (connectorId) => {
      requireOpenWorkbench(viewState, "read JDBC connectors");
      return getJdbcConnector({
        workspaceId: viewState.workspace.id,
        connectorId,
      });
    },
    listJdbcConnectors: () => {
      requireOpenWorkbench(viewState, "read JDBC connectors");
      return listJdbcConnectors({
        workspaceId: viewState.workspace.id,
      });
    },
    updateJdbcConnector: (request) => {
      requireOpenWorkbench(viewState, "update JDBC connectors");
      return updateJdbcConnector({
        workspaceId: viewState.workspace.id,
        ...request,
      });
    },
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }
}
