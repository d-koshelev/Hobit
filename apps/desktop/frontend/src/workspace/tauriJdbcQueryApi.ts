import { invoke } from "@tauri-apps/api/core";
import type {
  ExecuteJdbcReadOnlyQueryRequest,
  JdbcQueryColumn,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
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
          ? {
              enabled: request.experimentalSidecar.enabled,
              java_program: request.experimentalSidecar.javaProgram ?? null,
              sidecar_jar_path:
                request.experimentalSidecar.sidecarJarPath ?? null,
              sidecar_classpath:
                request.experimentalSidecar.sidecarClasspath ?? null,
              sidecar_main_class:
                request.experimentalSidecar.sidecarMainClass ?? null,
              driver_jar_path: request.experimentalSidecar.driverJarPath,
              driver_class_name:
                request.experimentalSidecar.driverClassName ?? null,
              jdbc_url: request.experimentalSidecar.jdbcUrl,
              username: request.experimentalSidecar.username ?? null,
              credential_env_var_name:
                request.experimentalSidecar.credentialEnvVarName ?? null,
              max_rows: request.experimentalSidecar.maxRows ?? null,
              timeout_ms: request.experimentalSidecar.timeoutMs ?? null,
              max_result_bytes:
                request.experimentalSidecar.maxResultBytes ?? null,
            }
          : null,
      },
    },
  );

  return normalizeJdbcReadOnlyQueryResult(result);
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
