import type {
  CreateJdbcConnectorRequest,
  GetJdbcConnectorRequest,
  JdbcConnector,
  ListJdbcConnectorsRequest,
  UpdateJdbcConnectorRequest,
} from "./jdbcConnectorTypes";
import { getWorkspaceApi } from "./workspaceApiRuntime";

export function createJdbcConnector(
  request: CreateJdbcConnectorRequest,
): Promise<JdbcConnector> {
  return getWorkspaceApi().createJdbcConnector(request);
}

export function listJdbcConnectors(
  request: ListJdbcConnectorsRequest,
): Promise<JdbcConnector[]> {
  return getWorkspaceApi().listJdbcConnectors(request);
}

export function getJdbcConnector(
  request: GetJdbcConnectorRequest,
): Promise<JdbcConnector | null> {
  return getWorkspaceApi().getJdbcConnector(request);
}

export function updateJdbcConnector(
  request: UpdateJdbcConnectorRequest,
): Promise<JdbcConnector | null> {
  return getWorkspaceApi().updateJdbcConnector(request);
}
