#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidateJdbcReadOnlySqlInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub connector_id: String,
    pub sql: String,
    pub row_limit: Option<usize>,
    pub timeout_ms: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecuteJdbcReadOnlyQueryInput {
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
    pub experimental_sidecar: Option<JdbcExperimentalSidecarRuntimeInput>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckJdbcSidecarHealthInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub experimental_sidecar: JdbcExperimentalSidecarRuntimeInput,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProbeJdbcDriverInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub experimental_sidecar: JdbcExperimentalSidecarRuntimeInput,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcExperimentalSidecarRuntimeInput {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcSidecarDiagnosticSummary {
    pub action: String,
    pub ok: bool,
    pub status: String,
    pub message: String,
    pub details: Option<String>,
    pub duration_ms: u64,
    pub no_secrets_returned: bool,
    pub no_ai_context_shared: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcReadOnlySqlValidationSummary {
    pub is_valid: bool,
    pub statement_kind: Option<String>,
    pub normalized_preview: String,
    pub rejection_reason: Option<String>,
    pub safety_notes: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcQueryColumnSummary {
    pub name: String,
    pub value_kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcReadOnlyQueryResultSummary {
    pub status: String,
    pub connector_id: String,
    pub connector_display_name: Option<String>,
    pub validation: JdbcReadOnlySqlValidationSummary,
    pub statement_kind: Option<String>,
    pub columns: Vec<JdbcQueryColumnSummary>,
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
