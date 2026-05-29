import type {
  CreateJdbcConnectorRequest,
  GetJdbcConnectorRequest,
  JdbcConnector,
  ListJdbcConnectorsRequest,
  UpdateJdbcConnectorRequest,
} from "./jdbcConnectorTypes";
import type {
  CheckJdbcSidecarHealthRequest,
  ExecuteJdbcReadOnlyQueryRequest,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
  ProbeJdbcDriverRequest,
  ValidateJdbcReadOnlySqlRequest,
} from "./jdbcQueryTypes";
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

export function validateJdbcReadOnlySql(
  request: ValidateJdbcReadOnlySqlRequest,
): Promise<JdbcReadOnlySqlValidation> {
  return getWorkspaceApi().validateJdbcReadOnlySql(request);
}

export function executeJdbcReadOnlyQuery(
  request: ExecuteJdbcReadOnlyQueryRequest,
): Promise<JdbcReadOnlyQueryResult> {
  return getWorkspaceApi().executeJdbcReadOnlyQuery(request);
}

export function checkJdbcSidecarHealth(
  request: CheckJdbcSidecarHealthRequest,
): Promise<JdbcSidecarDiagnostic> {
  return getWorkspaceApi().checkJdbcSidecarHealth(request);
}

export function probeJdbcDriver(
  request: ProbeJdbcDriverRequest,
): Promise<JdbcSidecarDiagnostic> {
  return getWorkspaceApi().probeJdbcDriver(request);
}
