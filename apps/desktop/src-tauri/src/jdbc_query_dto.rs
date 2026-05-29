use hobit_app::{
    CheckJdbcSidecarHealthInput, ExecuteJdbcReadOnlyQueryInput,
    JdbcExperimentalSidecarRuntimeInput, JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary,
    JdbcReadOnlySqlValidationSummary, JdbcSidecarDiagnosticSummary, ProbeJdbcDriverInput,
    ValidateJdbcReadOnlySqlInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ValidateJdbcReadOnlySqlRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub connector_id: String,
    pub sql: String,
    pub row_limit: Option<usize>,
    pub timeout_ms: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ExecuteJdbcReadOnlyQueryRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub connector_id: String,
    pub sql: String,
    pub row_limit: Option<usize>,
    pub timeout_ms: Option<u64>,
    pub max_columns: Option<usize>,
    pub max_cell_chars: Option<usize>,
    pub max_result_bytes: Option<usize>,
    pub experimental_sidecar: Option<JdbcExperimentalSidecarRuntimeRequest>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CheckJdbcSidecarHealthRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub experimental_sidecar: JdbcExperimentalSidecarRuntimeRequest,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ProbeJdbcDriverRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub experimental_sidecar: JdbcExperimentalSidecarRuntimeRequest,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct JdbcExperimentalSidecarRuntimeRequest {
    pub enabled: bool,
    pub java_program: Option<String>,
    pub sidecar_jar_path: Option<String>,
    pub sidecar_classpath: Option<String>,
    pub sidecar_main_class: Option<String>,
    pub driver_jar_path: String,
    pub driver_class_name: Option<String>,
    pub jdbc_url: String,
    pub username: Option<String>,
    pub credential_env_var_name: Option<String>,
    pub max_rows: Option<usize>,
    pub timeout_ms: Option<u64>,
    pub max_result_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct JdbcReadOnlySqlValidationDto {
    pub is_valid: bool,
    pub statement_kind: Option<String>,
    pub normalized_preview: String,
    pub rejection_reason: Option<String>,
    pub safety_notes: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct JdbcQueryColumnDto {
    pub name: String,
    pub value_kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct JdbcReadOnlyQueryResultDto {
    pub status: String,
    pub connector_id: String,
    pub connector_display_name: Option<String>,
    pub validation: JdbcReadOnlySqlValidationDto,
    pub statement_kind: Option<String>,
    pub columns: Vec<JdbcQueryColumnDto>,
    pub rows: Vec<Vec<String>>,
    pub row_count: usize,
    pub returned_row_count: usize,
    pub row_limit: usize,
    pub truncated: bool,
    pub truncated_rows: bool,
    pub truncated_columns: bool,
    pub truncated_cells: bool,
    pub truncated_bytes: bool,
    pub duration_ms: u64,
    pub sanitized_error: Option<String>,
    pub no_secrets_returned: bool,
    pub no_ai_context_shared: bool,
    pub mock_execution: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct JdbcSidecarDiagnosticDto {
    pub action: String,
    pub ok: bool,
    pub status: String,
    pub message: String,
    pub details: Option<String>,
    pub duration_ms: u64,
    pub no_secrets_returned: bool,
    pub no_ai_context_shared: bool,
}

impl From<ValidateJdbcReadOnlySqlRequest> for ValidateJdbcReadOnlySqlInput {
    fn from(request: ValidateJdbcReadOnlySqlRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            connector_id: request.connector_id,
            sql: request.sql,
            row_limit: request.row_limit,
            timeout_ms: request.timeout_ms,
        }
    }
}

impl From<CheckJdbcSidecarHealthRequest> for CheckJdbcSidecarHealthInput {
    fn from(request: CheckJdbcSidecarHealthRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            experimental_sidecar: request.experimental_sidecar.into(),
        }
    }
}

impl From<ProbeJdbcDriverRequest> for ProbeJdbcDriverInput {
    fn from(request: ProbeJdbcDriverRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            experimental_sidecar: request.experimental_sidecar.into(),
        }
    }
}

impl From<ExecuteJdbcReadOnlyQueryRequest> for ExecuteJdbcReadOnlyQueryInput {
    fn from(request: ExecuteJdbcReadOnlyQueryRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            connector_id: request.connector_id,
            sql: request.sql,
            row_limit: request.row_limit,
            timeout_ms: request.timeout_ms,
            max_columns: request.max_columns,
            max_cell_chars: request.max_cell_chars,
            max_result_bytes: request.max_result_bytes,
            experimental_sidecar: request.experimental_sidecar.map(Into::into),
        }
    }
}

impl From<JdbcExperimentalSidecarRuntimeRequest> for JdbcExperimentalSidecarRuntimeInput {
    fn from(request: JdbcExperimentalSidecarRuntimeRequest) -> Self {
        Self {
            enabled: request.enabled,
            java_program: request.java_program,
            sidecar_jar_path: request.sidecar_jar_path,
            sidecar_classpath: request.sidecar_classpath,
            sidecar_main_class: request.sidecar_main_class,
            driver_jar_path: request.driver_jar_path,
            driver_class_name: request.driver_class_name,
            jdbc_url: request.jdbc_url,
            username: request.username,
            credential_env_var_name: request.credential_env_var_name,
            max_rows: request.max_rows,
            timeout_ms: request.timeout_ms,
            max_result_bytes: request.max_result_bytes,
        }
    }
}

impl From<JdbcSidecarDiagnosticSummary> for JdbcSidecarDiagnosticDto {
    fn from(summary: JdbcSidecarDiagnosticSummary) -> Self {
        Self {
            action: summary.action,
            ok: summary.ok,
            status: summary.status,
            message: summary.message,
            details: summary.details,
            duration_ms: summary.duration_ms,
            no_secrets_returned: summary.no_secrets_returned,
            no_ai_context_shared: summary.no_ai_context_shared,
        }
    }
}

impl From<JdbcReadOnlySqlValidationSummary> for JdbcReadOnlySqlValidationDto {
    fn from(summary: JdbcReadOnlySqlValidationSummary) -> Self {
        Self {
            is_valid: summary.is_valid,
            statement_kind: summary.statement_kind,
            normalized_preview: summary.normalized_preview,
            rejection_reason: summary.rejection_reason,
            safety_notes: summary.safety_notes,
        }
    }
}

impl From<JdbcQueryColumnSummary> for JdbcQueryColumnDto {
    fn from(summary: JdbcQueryColumnSummary) -> Self {
        Self {
            name: summary.name,
            value_kind: summary.value_kind,
        }
    }
}

impl From<JdbcReadOnlyQueryResultSummary> for JdbcReadOnlyQueryResultDto {
    fn from(summary: JdbcReadOnlyQueryResultSummary) -> Self {
        Self {
            status: summary.status,
            connector_id: summary.connector_id,
            connector_display_name: summary.connector_display_name,
            validation: summary.validation.into(),
            statement_kind: summary.statement_kind,
            columns: summary.columns.into_iter().map(Into::into).collect(),
            rows: summary.rows,
            row_count: summary.row_count,
            returned_row_count: summary.returned_row_count,
            row_limit: summary.row_limit,
            truncated: summary.truncated,
            truncated_rows: summary.truncated_rows,
            truncated_columns: summary.truncated_columns,
            truncated_cells: summary.truncated_cells,
            truncated_bytes: summary.truncated_bytes,
            duration_ms: summary.duration_ms,
            sanitized_error: summary.sanitized_error,
            no_secrets_returned: summary.no_secrets_returned,
            no_ai_context_shared: summary.no_ai_context_shared,
            mock_execution: summary.mock_execution,
        }
    }
}
