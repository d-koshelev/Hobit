import { invoke } from "@tauri-apps/api/core";
import type {
  CheckJdbcSidecarHealthRequest,
  CreateJdbcConnectionProfileRequest,
  DeleteJdbcConnectionProfileRequest,
  ExecuteJdbcReadOnlyQueryRequest,
  GetJdbcConnectionProfileRequest,
  JdbcConnectionProfile,
  JdbcExperimentalSidecarRuntime,
  JdbcQueryColumn,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
  ListJdbcConnectionProfilesRequest,
  ProbeJdbcDriverRequest,
  UpdateJdbcConnectionProfileRequest,
  ValidateJdbcReadOnlySqlRequest,
} from "./jdbcQueryTypes";

type TauriJdbcReadOnlySqlValidation = {
  is_valid: boolean;
  statement_kind: string | null;
  normalized_preview: string;
  rejection_reason: string | null;
  safety_notes: string[];
};

type TauriJdbcQueryColumn = {
  name: string;
  value_kind: string;
};

type TauriJdbcReadOnlyQueryResult = {
  status: string;
  connector_id: string;
  connector_display_name: string | null;
  validation: TauriJdbcReadOnlySqlValidation;
  statement_kind: string | null;
  columns: TauriJdbcQueryColumn[];
  rows: string[][];
  row_count: number;
  returned_row_count: number;
  row_limit: number;
  truncated: boolean;
  truncated_rows: boolean;
  truncated_columns: boolean;
  truncated_cells: boolean;
  truncated_bytes: boolean;
  duration_ms: number;
  sanitized_error: string | null;
  no_secrets_returned: boolean;
  no_ai_context_shared: boolean;
  mock_execution: boolean;
};

type TauriJdbcSidecarDiagnostic = {
  action: string;
  ok: boolean;
  status: string;
  message: string;
  details: string | null;
  duration_ms: number;
  no_secrets_returned: boolean;
  no_ai_context_shared: boolean;
};

type TauriJdbcConnectionProfile = {
  profile_id: string;
  workspace_id: string;
  name: string;
  driver_jar_path: string;
  driver_class_name: string;
  jdbc_url: string;
  username: string | null;
  password_env_var_name: string | null;
  max_rows: number;
  timeout_ms: number;
  max_result_bytes: number;
  read_only: boolean;
  description: string;
  created_at: string;
  updated_at: string;
};

export async function validateJdbcReadOnlySql(
  request: ValidateJdbcReadOnlySqlRequest,
): Promise<JdbcReadOnlySqlValidation> {
  const validation = await invoke<TauriJdbcReadOnlySqlValidation>(
    "validate_jdbc_read_only_sql",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        connector_id: request.connectorId,
        sql: request.sql,
        row_limit: request.rowLimit ?? null,
        timeout_ms: request.timeoutMs ?? null,
      },
    },
  );

  return normalizeJdbcReadOnlySqlValidation(validation);
}

export async function executeJdbcReadOnlyQuery(
  request: ExecuteJdbcReadOnlyQueryRequest,
): Promise<JdbcReadOnlyQueryResult> {
  const result = await invoke<TauriJdbcReadOnlyQueryResult>(
    "execute_jdbc_read_only_query",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        connector_id: request.connectorId,
        sql: request.sql,
        row_limit: request.rowLimit ?? null,
        timeout_ms: request.timeoutMs ?? null,
        max_columns: request.maxColumns ?? null,
        max_cell_chars: request.maxCellChars ?? null,
        max_result_bytes: request.maxResultBytes ?? null,
        experimental_sidecar: request.experimentalSidecar
          ? serializeExperimentalSidecar(request.experimentalSidecar)
          : null,
      },
    },
  );

  return normalizeJdbcReadOnlyQueryResult(result);
}

export async function checkJdbcSidecarHealth(
  request: CheckJdbcSidecarHealthRequest,
): Promise<JdbcSidecarDiagnostic> {
  const result = await invoke<TauriJdbcSidecarDiagnostic>(
    "check_jdbc_sidecar_health",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        experimental_sidecar: serializeExperimentalSidecar(
          request.experimentalSidecar,
        ),
      },
    },
  );

  return normalizeJdbcSidecarDiagnostic(result);
}

export async function probeJdbcDriver(
  request: ProbeJdbcDriverRequest,
): Promise<JdbcSidecarDiagnostic> {
  const result = await invoke<TauriJdbcSidecarDiagnostic>(
    "probe_jdbc_driver",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        experimental_sidecar: serializeExperimentalSidecar(
          request.experimentalSidecar,
        ),
      },
    },
  );

  return normalizeJdbcSidecarDiagnostic(result);
}

export async function createJdbcConnectionProfile(
  request: CreateJdbcConnectionProfileRequest,
): Promise<JdbcConnectionProfile> {
  const profile = await invoke<TauriJdbcConnectionProfile>(
    "create_jdbc_connection_profile",
    {
      request: serializeJdbcConnectionProfileRequest(request),
    },
  );

  return normalizeJdbcConnectionProfile(profile);
}

export async function listJdbcConnectionProfiles(
  request: ListJdbcConnectionProfilesRequest,
): Promise<JdbcConnectionProfile[]> {
  const profiles = await invoke<TauriJdbcConnectionProfile[]>(
    "list_jdbc_connection_profiles",
    {
      request: {
        workspace_id: request.workspaceId,
      },
    },
  );

  return profiles.map(normalizeJdbcConnectionProfile);
}

export async function getJdbcConnectionProfile(
  request: GetJdbcConnectionProfileRequest,
): Promise<JdbcConnectionProfile | null> {
  const profile = await invoke<TauriJdbcConnectionProfile | null>(
    "get_jdbc_connection_profile",
    {
      request: {
        workspace_id: request.workspaceId,
        profile_id: request.profileId,
      },
    },
  );

  return profile ? normalizeJdbcConnectionProfile(profile) : null;
}

export async function updateJdbcConnectionProfile(
  request: UpdateJdbcConnectionProfileRequest,
): Promise<JdbcConnectionProfile | null> {
  const profile = await invoke<TauriJdbcConnectionProfile | null>(
    "update_jdbc_connection_profile",
    {
      request: {
        ...serializeJdbcConnectionProfileRequest(request),
        profile_id: request.profileId,
        read_only: true,
      },
    },
  );

  return profile ? normalizeJdbcConnectionProfile(profile) : null;
}

export async function deleteJdbcConnectionProfile(
  request: DeleteJdbcConnectionProfileRequest,
): Promise<boolean> {
  return invoke<boolean>("delete_jdbc_connection_profile", {
    request: {
      workspace_id: request.workspaceId,
      profile_id: request.profileId,
    },
  });
}

function normalizeJdbcReadOnlyQueryResult(
  result: TauriJdbcReadOnlyQueryResult,
): JdbcReadOnlyQueryResult {
  return {
    status: result.status,
    connectorId: result.connector_id,
    connectorDisplayName: result.connector_display_name,
    validation: normalizeJdbcReadOnlySqlValidation(result.validation),
    statementKind: result.statement_kind,
    columns: result.columns.map(normalizeJdbcQueryColumn),
    rows: result.rows,
    rowCount: result.row_count,
    returnedRowCount: result.returned_row_count,
    rowLimit: result.row_limit,
    truncated: result.truncated,
    truncatedRows: result.truncated_rows,
    truncatedColumns: result.truncated_columns,
    truncatedCells: result.truncated_cells,
    truncatedBytes: result.truncated_bytes,
    durationMs: result.duration_ms,
    sanitizedError: result.sanitized_error,
    noSecretsReturned: result.no_secrets_returned,
    noAiContextShared: result.no_ai_context_shared,
    mockExecution: result.mock_execution,
  };
}

function normalizeJdbcSidecarDiagnostic(
  result: TauriJdbcSidecarDiagnostic,
): JdbcSidecarDiagnostic {
  return {
    action: result.action,
    ok: result.ok,
    status: result.status,
    message: result.message,
    details: result.details,
    durationMs: result.duration_ms,
    noSecretsReturned: result.no_secrets_returned,
    noAiContextShared: result.no_ai_context_shared,
  };
}

function normalizeJdbcConnectionProfile(
  profile: TauriJdbcConnectionProfile,
): JdbcConnectionProfile {
  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    name: profile.name,
    driverJarPath: profile.driver_jar_path,
    driverClassName: profile.driver_class_name,
    jdbcUrl: profile.jdbc_url,
    username: profile.username,
    passwordEnvVarName: profile.password_env_var_name,
    maxRows: profile.max_rows,
    timeoutMs: profile.timeout_ms,
    maxResultBytes: profile.max_result_bytes,
    readOnly: true,
    description: profile.description,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function normalizeJdbcReadOnlySqlValidation(
  validation: TauriJdbcReadOnlySqlValidation,
): JdbcReadOnlySqlValidation {
  return {
    isValid: validation.is_valid,
    statementKind: validation.statement_kind,
    normalizedPreview: validation.normalized_preview,
    rejectionReason: validation.rejection_reason,
    safetyNotes: validation.safety_notes,
  };
}

function normalizeJdbcQueryColumn(
  column: TauriJdbcQueryColumn,
): JdbcQueryColumn {
  return {
    name: column.name,
    valueKind: column.value_kind,
  };
}

function serializeExperimentalSidecar(
  runtime: JdbcExperimentalSidecarRuntime,
) {
  return {
    enabled: runtime.enabled,
    java_program: runtime.javaProgram ?? null,
    sidecar_jar_path: runtime.sidecarJarPath ?? null,
    sidecar_classpath: runtime.sidecarClasspath ?? null,
    sidecar_main_class: runtime.sidecarMainClass ?? null,
    driver_jar_path: runtime.driverJarPath,
    driver_class_name: runtime.driverClassName ?? null,
    jdbc_url: runtime.jdbcUrl,
    username: runtime.username ?? null,
    credential_env_var_name: runtime.credentialEnvVarName ?? null,
    max_rows: runtime.maxRows ?? null,
    timeout_ms: runtime.timeoutMs ?? null,
    max_result_bytes: runtime.maxResultBytes ?? null,
  };
}

function serializeJdbcConnectionProfileRequest(
  request:
    | CreateJdbcConnectionProfileRequest
    | UpdateJdbcConnectionProfileRequest,
) {
  return {
    workspace_id: request.workspaceId,
    name: request.name,
    driver_jar_path: request.driverJarPath,
    driver_class_name: request.driverClassName,
    jdbc_url: request.jdbcUrl,
    username: request.username ?? null,
    password_env_var_name: request.passwordEnvVarName ?? null,
    max_rows: request.maxRows,
    timeout_ms: request.timeoutMs,
    max_result_bytes: request.maxResultBytes,
    read_only: true,
    description: request.description ?? null,
  };
}
