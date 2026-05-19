export type JdbcDatabaseKind =
  | "vertica"
  | "postgres"
  | "trino"
  | "mysql"
  | "generic_jdbc";

export type JdbcDriverKind = "jdbc" | "generic_jdbc";

export type JdbcConnectorStatus =
  | "not_configured"
  | "configured"
  | "disabled"
  | "error";

export type CreateJdbcConnectorRequest = {
  workspaceId: string;
  displayName: string;
  databaseKind: JdbcDatabaseKind;
  driverKind: JdbcDriverKind;
  jdbcUrlMasked: string;
  environment: string;
  readOnlyDefault?: boolean | null;
  status?: JdbcConnectorStatus | null;
  notes: string;
};

export type ListJdbcConnectorsRequest = {
  workspaceId: string;
};

export type GetJdbcConnectorRequest = {
  workspaceId: string;
  connectorId: string;
};

export type UpdateJdbcConnectorRequest = {
  workspaceId: string;
  connectorId: string;
  displayName: string;
  databaseKind: JdbcDatabaseKind;
  driverKind: JdbcDriverKind;
  jdbcUrlMasked: string;
  environment: string;
  readOnlyDefault: boolean;
  status: JdbcConnectorStatus;
  notes: string;
};

export type JdbcConnector = {
  connectorId: string;
  workspaceId: string;
  displayName: string;
  databaseKind: JdbcDatabaseKind;
  driverKind: JdbcDriverKind;
  jdbcUrlMasked: string;
  environment: string;
  readOnlyDefault: boolean;
  status: JdbcConnectorStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};
