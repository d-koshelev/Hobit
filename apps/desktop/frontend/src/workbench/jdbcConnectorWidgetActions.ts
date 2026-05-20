import {
  createJdbcConnector,
  executeJdbcReadOnlyQuery,
  getJdbcConnector,
  listJdbcConnectors,
  validateJdbcReadOnlySql,
  updateJdbcConnector,
} from "../workspace/workspaceApi";
import type {
  CreateJdbcConnectorRequest,
  JdbcConnector,
  UpdateJdbcConnectorRequest,
} from "../workspace/jdbcConnectorTypes";
import type {
  ExecuteJdbcReadOnlyQueryRequest,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  ValidateJdbcReadOnlySqlRequest,
} from "../workspace/jdbcQueryTypes";
import type { WidgetInstanceId, WorkbenchViewState } from "./types";

export type JdbcConnectorCreateRequest = Omit<
  CreateJdbcConnectorRequest,
  "workspaceId"
>;

export type JdbcConnectorUpdateRequest = Omit<
  UpdateJdbcConnectorRequest,
  "workspaceId"
>;

export type JdbcReadOnlySqlValidationRequest = Omit<
  ValidateJdbcReadOnlySqlRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type JdbcReadOnlyQueryExecutionRequest = Omit<
  ExecuteJdbcReadOnlyQueryRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type JdbcConnectorWidgetActions = {
  createJdbcConnector: (
    request: JdbcConnectorCreateRequest,
  ) => Promise<JdbcConnector>;
  executeJdbcReadOnlyQuery: (
    widgetInstanceId: WidgetInstanceId,
    request: JdbcReadOnlyQueryExecutionRequest,
  ) => Promise<JdbcReadOnlyQueryResult>;
  listJdbcConnectors: () => Promise<JdbcConnector[]>;
  getJdbcConnector: (connectorId: string) => Promise<JdbcConnector | null>;
  updateJdbcConnector: (
    request: JdbcConnectorUpdateRequest,
  ) => Promise<JdbcConnector | null>;
  validateJdbcReadOnlySql: (
    widgetInstanceId: WidgetInstanceId,
    request: JdbcReadOnlySqlValidationRequest,
  ) => Promise<JdbcReadOnlySqlValidation>;
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
    executeJdbcReadOnlyQuery: (widgetInstanceId, request) => {
      const workbenchId = requireOpenWorkbench(
        viewState,
        "run JDBC read-only queries",
      );
      return executeJdbcReadOnlyQuery({
        workspaceId: viewState.workspace.id,
        workbenchId,
        widgetInstanceId,
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
    validateJdbcReadOnlySql: (widgetInstanceId, request) => {
      const workbenchId = requireOpenWorkbench(
        viewState,
        "validate JDBC SQL",
      );
      return validateJdbcReadOnlySql({
        workspaceId: viewState.workspace.id,
        workbenchId,
        widgetInstanceId,
        ...request,
      });
    },
  };
}

function requireOpenWorkbench(viewState: WorkbenchViewState, action: string) {
  if (!viewState.workbench.id) {
    throw new Error(`A workbench must be open to ${action}.`);
  }

  return viewState.workbench.id;
}
