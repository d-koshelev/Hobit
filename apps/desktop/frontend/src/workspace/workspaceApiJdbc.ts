import type {
  CreateJdbcConnectorRequest,
  GetJdbcConnectorRequest,
  JdbcConnector,
  ListJdbcConnectorsRequest,
  UpdateJdbcConnectorRequest,
} from "./jdbcConnectorTypes";
import type {
  CheckJdbcSidecarHealthRequest,
  CreateJdbcConnectionProfileRequest,
  DeleteJdbcConnectionProfileRequest,
  ExecuteJdbcReadOnlyQueryRequest,
  GetJdbcConnectionProfileRequest,
  JdbcConnectionProfile,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
  ListJdbcConnectionProfilesRequest,
  ProbeJdbcDriverRequest,
  UpdateJdbcConnectionProfileRequest,
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

export function createJdbcConnectionProfile(
  request: CreateJdbcConnectionProfileRequest,
): Promise<JdbcConnectionProfile> {
  return getWorkspaceApi().createJdbcConnectionProfile(request);
}

export function listJdbcConnectionProfiles(
  request: ListJdbcConnectionProfilesRequest,
): Promise<JdbcConnectionProfile[]> {
  return getWorkspaceApi().listJdbcConnectionProfiles(request);
}

export function getJdbcConnectionProfile(
  request: GetJdbcConnectionProfileRequest,
): Promise<JdbcConnectionProfile | null> {
  return getWorkspaceApi().getJdbcConnectionProfile(request);
}

export function updateJdbcConnectionProfile(
  request: UpdateJdbcConnectionProfileRequest,
): Promise<JdbcConnectionProfile | null> {
  return getWorkspaceApi().updateJdbcConnectionProfile(request);
}

export function deleteJdbcConnectionProfile(
  request: DeleteJdbcConnectionProfileRequest,
): Promise<boolean> {
  return getWorkspaceApi().deleteJdbcConnectionProfile(request);
}
