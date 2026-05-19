import { invoke } from "@tauri-apps/api/core";
import type {
  CreateJdbcConnectorRequest,
  GetJdbcConnectorRequest,
  JdbcConnector,
  JdbcConnectorStatus,
  JdbcDatabaseKind,
  JdbcDriverKind,
  ListJdbcConnectorsRequest,
  UpdateJdbcConnectorRequest,
} from "./jdbcConnectorTypes";

type TauriJdbcConnector = {
  connector_id: string;
  workspace_id: string;
  display_name: string;
  database_kind: JdbcDatabaseKind;
  driver_kind: JdbcDriverKind;
  jdbc_url_masked: string;
  environment: string;
  read_only_default: boolean;
  status: JdbcConnectorStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export async function createJdbcConnector(
  request: CreateJdbcConnectorRequest,
): Promise<JdbcConnector> {
  const connector = await invoke<TauriJdbcConnector>("create_jdbc_connector", {
    request: {
      workspace_id: request.workspaceId,
      display_name: request.displayName,
      database_kind: request.databaseKind,
      driver_kind: request.driverKind,
      jdbc_url_masked: request.jdbcUrlMasked,
      environment: request.environment,
      read_only_default: request.readOnlyDefault ?? null,
      status: request.status ?? null,
      notes: request.notes,
    },
  });

  return normalizeJdbcConnector(connector);
}

export async function listJdbcConnectors(
  request: ListJdbcConnectorsRequest,
): Promise<JdbcConnector[]> {
  const connectors = await invoke<TauriJdbcConnector[]>("list_jdbc_connectors", {
    request: {
      workspace_id: request.workspaceId,
    },
  });

  return connectors.map(normalizeJdbcConnector);
}

export async function getJdbcConnector(
  request: GetJdbcConnectorRequest,
): Promise<JdbcConnector | null> {
  const connector = await invoke<TauriJdbcConnector | null>("get_jdbc_connector", {
    request: {
      workspace_id: request.workspaceId,
      connector_id: request.connectorId,
    },
  });

  return connector ? normalizeJdbcConnector(connector) : null;
}

export async function updateJdbcConnector(
  request: UpdateJdbcConnectorRequest,
): Promise<JdbcConnector | null> {
  const connector = await invoke<TauriJdbcConnector | null>("update_jdbc_connector", {
    request: {
      workspace_id: request.workspaceId,
      connector_id: request.connectorId,
      display_name: request.displayName,
      database_kind: request.databaseKind,
      driver_kind: request.driverKind,
      jdbc_url_masked: request.jdbcUrlMasked,
      environment: request.environment,
      read_only_default: request.readOnlyDefault,
      status: request.status,
      notes: request.notes,
    },
  });

  return connector ? normalizeJdbcConnector(connector) : null;
}

function normalizeJdbcConnector(connector: TauriJdbcConnector): JdbcConnector {
  return {
    connectorId: connector.connector_id,
    workspaceId: connector.workspace_id,
    displayName: connector.display_name,
    databaseKind: connector.database_kind,
    driverKind: connector.driver_kind,
    jdbcUrlMasked: connector.jdbc_url_masked,
    environment: connector.environment,
    readOnlyDefault: connector.read_only_default,
    status: connector.status,
    notes: connector.notes,
    createdAt: connector.created_at,
    updatedAt: connector.updated_at,
    lastUsedAt: connector.last_used_at,
  };
}
