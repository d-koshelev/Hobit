use std::fmt;
use std::num::{NonZeroU64, NonZeroUsize};
use std::path::PathBuf;

use hobit_tools::process::{run_process_once, ProcessRunRequest, ProcessRunStatus};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::jdbc_artifacts::JdbcRuntimeBoundarySummary;
use super::jdbc_query_types::{JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary};
use super::jdbc_runtime::{
    cap_string, failed_query_result, sanitize_error, JdbcConnectorRuntimeConfig,
    JdbcReadOnlyAdapterRequest, STATUS_COMPLETED, STATUS_EXECUTION_FAILED, STATUS_NOT_CONFIGURED,
    STATUS_QUERY_REJECTED, STATUS_TIMEOUT, STATUS_UNSUPPORTED_DRIVER,
};

const SIDECAR_PROTOCOL_VERSION: u64 = 1;
const SIDECAR_STDERR_CAP_BYTES: usize = 16 * 1024;
const SIDECAR_RESPONSE_OVERHEAD_BYTES: usize = 16 * 1024;

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(transparent)]
pub(super) struct JdbcSidecarProtocolVersion(u16);

#[allow(dead_code)]
impl JdbcSidecarProtocolVersion {
    pub(super) const CURRENT: Self = Self(SIDECAR_PROTOCOL_VERSION as u16);
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(transparent)]
pub(super) struct JdbcSidecarRequestId(String);

#[allow(dead_code)]
impl JdbcSidecarRequestId {
    pub(super) fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarRequest {
    pub(super) protocol_version: JdbcSidecarProtocolVersion,
    pub(super) request_id: JdbcSidecarRequestId,
    #[serde(flatten)]
    pub(super) request: JdbcSidecarRequestKind,
}

#[allow(dead_code)]
impl JdbcSidecarRequest {
    pub(super) fn new(request_id: impl Into<String>, request: JdbcSidecarRequestKind) -> Self {
        Self {
            protocol_version: JdbcSidecarProtocolVersion::CURRENT,
            request_id: JdbcSidecarRequestId::new(request_id),
            request,
        }
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "request")]
pub(super) enum JdbcSidecarRequestKind {
    HealthCheck,
    DriverProbe {
        profile: JdbcSidecarProfileReference,
    },
    PrepareReadOnlyQuery {
        profile: JdbcSidecarProfileReference,
        sql: String,
        statement_kind: String,
        policy: JdbcReadOnlyExecutionPolicy,
    },
    ExecuteReadOnlyQuery {
        profile: JdbcSidecarProfileReference,
        sql: String,
        statement_kind: String,
        policy: JdbcReadOnlyExecutionPolicy,
        prepared_query_id: Option<String>,
    },
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarProfileReference {
    pub(super) profile_id: String,
    pub(super) profile_name: String,
    pub(super) database_kind: String,
    pub(super) driver: JdbcSidecarDriverReference,
    pub(super) jdbc_url_label: Option<String>,
    pub(super) username: Option<String>,
    pub(super) default_database: Option<String>,
    pub(super) default_schema: Option<String>,
    pub(super) default_catalog: Option<String>,
    pub(super) credential_references: Vec<JdbcSecretReference>,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarDriverReference {
    pub(super) driver_id: String,
    pub(super) kind_label: String,
    pub(super) jar_path_reference: Option<String>,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSecretReference {
    pub(super) id: String,
    pub(super) kind: JdbcSecretReferenceKind,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum JdbcSecretReferenceKind {
    ConnectionCredential,
    KerberosMaterial,
    TlsMaterial,
    Other,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcReadOnlyExecutionPolicy {
    read_only: bool,
    max_rows: NonZeroUsize,
    timeout_ms: NonZeroU64,
    max_result_bytes: NonZeroUsize,
    allow_multi_statement: bool,
    allow_stored_procedures: bool,
}

#[allow(dead_code)]
impl JdbcReadOnlyExecutionPolicy {
    pub(super) fn new(
        max_rows: NonZeroUsize,
        timeout_ms: NonZeroU64,
        max_result_bytes: NonZeroUsize,
    ) -> Self {
        Self {
            read_only: true,
            max_rows,
            timeout_ms,
            max_result_bytes,
            allow_multi_statement: false,
            allow_stored_procedures: false,
        }
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarResponse {
    pub(super) protocol_version: JdbcSidecarProtocolVersion,
    pub(super) request_id: JdbcSidecarRequestId,
    #[serde(flatten)]
    pub(super) response: JdbcSidecarResponseKind,
}

#[allow(dead_code)]
impl JdbcSidecarResponse {
    pub(super) fn ok(request_id: impl Into<String>, result: JdbcSidecarResult) -> Self {
        Self {
            protocol_version: JdbcSidecarProtocolVersion::CURRENT,
            request_id: JdbcSidecarRequestId::new(request_id),
            response: JdbcSidecarResponseKind::Ok { result },
        }
    }

    pub(super) fn error(request_id: impl Into<String>, error: JdbcSidecarError) -> Self {
        Self {
            protocol_version: JdbcSidecarProtocolVersion::CURRENT,
            request_id: JdbcSidecarRequestId::new(request_id),
            response: JdbcSidecarResponseKind::Error { error },
        }
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub(super) enum JdbcSidecarResponseKind {
    Ok { result: JdbcSidecarResult },
    Error { error: JdbcSidecarError },
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "data")]
pub(super) enum JdbcSidecarResult {
    HealthCheck(JdbcSidecarHealthCheckResult),
    DriverProbe(JdbcSidecarDriverProbeResult),
    PreparedReadOnlyQuery(JdbcSidecarPreparedReadOnlyQuery),
    ReadOnlyQuery(JdbcSidecarReadOnlyQueryResult),
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarHealthCheckResult {
    pub(super) healthy: bool,
    pub(super) sidecar_label: String,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarDriverProbeResult {
    pub(super) driver_id: String,
    pub(super) supported: bool,
    pub(super) warnings: Vec<String>,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarPreparedReadOnlyQuery {
    pub(super) prepared_query_id: String,
    pub(super) statement_kind: String,
    pub(super) policy: JdbcReadOnlyExecutionPolicy,
    pub(super) warnings: Vec<String>,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarReadOnlyQueryResult {
    pub(super) columns: Vec<JdbcSidecarColumn>,
    pub(super) rows: Vec<Vec<JdbcSidecarCellValue>>,
    pub(super) row_count: usize,
    pub(super) truncated: JdbcSidecarTruncation,
    pub(super) elapsed_ms: u64,
    pub(super) warnings: Vec<String>,
    pub(super) safety_flags: JdbcSidecarSafetyFlags,
    pub(super) redacted_error: Option<JdbcSidecarError>,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarColumn {
    pub(super) name: String,
    pub(super) value_kind: String,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "value")]
pub(super) enum JdbcSidecarCellValue {
    Null,
    Boolean(bool),
    Number(String),
    Text(String),
    Redacted(String),
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarTruncation {
    pub(super) truncated: bool,
    pub(super) rows: bool,
    pub(super) columns: bool,
    pub(super) cells: bool,
    pub(super) bytes: bool,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarSafetyFlags {
    pub(super) validated_read_only: bool,
    pub(super) read_only_connection_requested: bool,
    pub(super) no_secrets_returned: bool,
    pub(super) no_ai_context_shared: bool,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct JdbcSidecarError {
    pub(super) kind: JdbcSidecarErrorKind,
    pub(super) message: String,
    redacted: bool,
}

#[allow(dead_code)]
impl JdbcSidecarError {
    pub(super) fn redacted(kind: JdbcSidecarErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            redacted: true,
        }
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum JdbcSidecarErrorKind {
    ProtocolMismatch,
    NotConfigured,
    UnsupportedDriver,
    DriverProbeFailed,
    ConnectionFailed,
    AuthenticationFailed,
    Timeout,
    QueryRejected,
    ExecutionFailed,
    ResultTruncated,
}

#[derive(Clone, Eq, PartialEq)]
pub(super) struct JdbcSidecarProcessRunner {
    program: String,
    args: Vec<String>,
    working_directory: PathBuf,
    timeout_ms: u64,
}

impl fmt::Debug for JdbcSidecarProcessRunner {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("JdbcSidecarProcessRunner")
            .field("program_configured", &!self.program.trim().is_empty())
            .field("arg_count", &self.args.len())
            .field("working_directory_configured", &true)
            .field("timeout_ms", &self.timeout_ms)
            .finish()
    }
}

impl JdbcSidecarProcessRunner {
    #[allow(dead_code)]
    pub(super) fn new(
        program: impl Into<String>,
        args: Vec<String>,
        working_directory: impl Into<PathBuf>,
        timeout_ms: u64,
    ) -> Self {
        Self {
            program: program.into(),
            args,
            working_directory: working_directory.into(),
            timeout_ms,
        }
    }

    pub(super) fn execute_read_only_query(
        &self,
        request: JdbcReadOnlyAdapterRequest,
    ) -> JdbcReadOnlyQueryResultSummary {
        let request_json = build_sidecar_request_json(&request);
        let process_output = run_process_once(ProcessRunRequest {
            program: self.program.clone(),
            args: self.args.clone(),
            stdin: Some(request_json),
            working_directory: self.working_directory.clone(),
            timeout_ms: self.timeout_ms.max(1),
            stdout_cap_bytes: request.max_result_bytes + SIDECAR_RESPONSE_OVERHEAD_BYTES,
            stderr_cap_bytes: SIDECAR_STDERR_CAP_BYTES,
        });

        match process_output.status {
            ProcessRunStatus::FailedToStart => with_runtime_boundary(failed_query_result(
                request.connector.connector_id,
                Some(request.connector.display_name),
                request.validation,
                request.row_limit,
                STATUS_NOT_CONFIGURED,
                "JDBC sidecar process is unavailable or not configured.",
                false,
            )),
            ProcessRunStatus::TimedOut => with_runtime_boundary(failed_query_result(
                request.connector.connector_id,
                Some(request.connector.display_name),
                request.validation,
                request.row_limit,
                STATUS_TIMEOUT,
                "JDBC sidecar process timed out.",
                false,
            )),
            ProcessRunStatus::Completed if process_output.exit_code != Some(0) => {
                with_runtime_boundary(failed_query_result(
                    request.connector.connector_id,
                    Some(request.connector.display_name),
                    request.validation,
                    request.row_limit,
                    STATUS_NOT_CONFIGURED,
                    "JDBC sidecar process failed before returning a safe response.",
                    false,
                ))
            }
            ProcessRunStatus::Completed if process_output.stdout_truncated => {
                with_runtime_boundary(failed_query_result(
                    request.connector.connector_id,
                    Some(request.connector.display_name),
                    request.validation,
                    request.row_limit,
                    STATUS_EXECUTION_FAILED,
                    "JDBC sidecar response exceeded the backend output cap.",
                    false,
                ))
            }
            ProcessRunStatus::Completed => map_sidecar_response(&request, &process_output.stdout),
        }
    }
}

pub(super) fn build_sidecar_request_json(request: &JdbcReadOnlyAdapterRequest) -> String {
    let mut request_json = json!({
        "protocol_version": SIDECAR_PROTOCOL_VERSION,
        "request_id": request.connector.connector_id,
        "runtime_kind": sidecar_runtime_kind(&request.connector.runtime_config),
        "connector_id": request.connector.connector_id,
        "database_kind": request.connector.database_kind,
        "driver_kind": request.connector.driver_kind,
        "statement_kind": request.validation.statement_kind,
        "validated_read_only": request.validation.is_valid,
        "sql": request.sql,
        "row_limit": request.row_limit,
        "timeout_ms": request.timeout_ms,
        "max_columns": request.max_columns,
        "max_cell_chars": request.max_cell_chars,
        "max_result_bytes": request.max_result_bytes,
    });

    if let JdbcConnectorRuntimeConfig::Sidecar(config) = &request.connector.runtime_config {
        if config.runtime_kind == "real_jdbc" {
            if let Some(object) = request_json.as_object_mut() {
                object.insert("request".to_owned(), json!("executeReadOnlyQuery"));
                object.insert("read_only".to_owned(), json!(true));
                object.insert("allow_multi_statement".to_owned(), json!(false));
                object.insert("allow_stored_procedures".to_owned(), json!(false));
                if let Some(driver_jar_path) = &config.driver_jar_path {
                    object.insert("driver_jar_path".to_owned(), json!(driver_jar_path));
                }
                if let Some(driver_class_name) = &config.driver_class_name {
                    object.insert("driver_class_name".to_owned(), json!(driver_class_name));
                }
                if let Some(jdbc_url) = &config.jdbc_url {
                    object.insert("jdbc_url".to_owned(), json!(jdbc_url.as_str()));
                }
                if let Some(username) = &config.username {
                    object.insert("username".to_owned(), json!(username));
                }
                if let Some(credential_env_var_name) = &config.credential_env_var_name {
                    object.insert(
                        "credential_env_var_name".to_owned(),
                        json!(credential_env_var_name),
                    );
                }
            }
        }
    }

    request_json.to_string()
}

fn sidecar_runtime_kind(runtime_config: &JdbcConnectorRuntimeConfig) -> &str {
    match runtime_config {
        JdbcConnectorRuntimeConfig::Sidecar(config) => &config.runtime_kind,
        _ => "mock_read_only",
    }
}

pub(super) fn map_sidecar_response(
    request: &JdbcReadOnlyAdapterRequest,
    raw_response: &str,
) -> JdbcReadOnlyQueryResultSummary {
    let parsed = match serde_json::from_str::<Value>(raw_response) {
        Ok(parsed) => parsed,
        Err(_) => {
            return with_runtime_boundary(failed_query_result(
                request.connector.connector_id.clone(),
                Some(request.connector.display_name.clone()),
                request.validation.clone(),
                request.row_limit,
                STATUS_EXECUTION_FAILED,
                "JDBC sidecar returned invalid JSON.",
                false,
            ));
        }
    };

    let status = string_field(&parsed, "status").unwrap_or(STATUS_EXECUTION_FAILED);
    if status != STATUS_COMPLETED {
        return with_runtime_boundary(failed_query_result(
            request.connector.connector_id.clone(),
            Some(request.connector.display_name.clone()),
            request.validation.clone(),
            request.row_limit,
            normalized_error_status(status),
            string_field(&parsed, "sanitized_error")
                .unwrap_or("JDBC sidecar returned a sanitized failure."),
            bool_field(&parsed, "mock_execution").unwrap_or(false),
        ));
    }

    if bool_field(&parsed, "no_secrets_returned") == Some(false)
        || bool_field(&parsed, "no_ai_context_shared") == Some(false)
    {
        return with_runtime_boundary(failed_query_result(
            request.connector.connector_id.clone(),
            Some(request.connector.display_name.clone()),
            request.validation.clone(),
            request.row_limit,
            STATUS_EXECUTION_FAILED,
            "JDBC sidecar response violated safety flags.",
            false,
        ));
    }

    let mut columns = columns_field(&parsed, request.max_columns);
    let mut rows = rows_field(
        &parsed,
        request.row_limit,
        request.max_columns,
        request.max_cell_chars,
    );
    let mut truncated_rows = bool_field(&parsed, "truncated_rows").unwrap_or(false);
    let mut truncated_columns = bool_field(&parsed, "truncated_columns").unwrap_or(false);
    let truncated_cells = bool_field(&parsed, "truncated_cells").unwrap_or(false);
    let mut truncated_bytes = bool_field(&parsed, "truncated_bytes").unwrap_or(false);

    if columns.len() > request.max_columns {
        columns.truncate(request.max_columns);
        truncated_columns = true;
    }
    for row in &mut rows {
        if row.len() > columns.len() {
            row.truncate(columns.len());
            truncated_columns = true;
        }
    }
    while result_size_bytes(&columns, &rows) > request.max_result_bytes && !rows.is_empty() {
        rows.pop();
        truncated_rows = true;
        truncated_bytes = true;
    }

    let returned_row_count = rows.len();
    let row_count = usize_field(&parsed, "row_count").unwrap_or(returned_row_count);
    let result = JdbcReadOnlyQueryResultSummary {
        status: STATUS_COMPLETED.to_owned(),
        connector_id: request.connector.connector_id.clone(),
        connector_display_name: Some(request.connector.display_name.clone()),
        validation: request.validation.clone(),
        statement_kind: request.validation.statement_kind.clone(),
        columns,
        rows,
        row_count,
        returned_row_count,
        row_limit: request.row_limit,
        truncated: truncated_rows || truncated_columns || truncated_cells || truncated_bytes,
        truncated_rows,
        truncated_columns,
        truncated_cells,
        truncated_bytes,
        duration_ms: u64_field(&parsed, "duration_ms").unwrap_or(0),
        sanitized_error: None,
        no_secrets_returned: true,
        no_ai_context_shared: true,
        mock_execution: bool_field(&parsed, "mock_execution").unwrap_or(false),
    };
    with_runtime_boundary(result)
}

fn with_runtime_boundary(result: JdbcReadOnlyQueryResultSummary) -> JdbcReadOnlyQueryResultSummary {
    let _runtime_boundary = JdbcRuntimeBoundarySummary::from_result(&result);
    result
}

fn normalized_error_status(status: &str) -> &str {
    match status {
        STATUS_NOT_CONFIGURED
        | STATUS_UNSUPPORTED_DRIVER
        | STATUS_QUERY_REJECTED
        | STATUS_EXECUTION_FAILED
        | STATUS_TIMEOUT
        | "connection_failed"
        | "authentication_failed"
        | "result_truncated" => status,
        _ => STATUS_EXECUTION_FAILED,
    }
}

fn columns_field(value: &Value, max_columns: usize) -> Vec<JdbcQueryColumnSummary> {
    value
        .get("columns")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(max_columns)
        .filter_map(|column| {
            let name = string_field(column, "name")?;
            let value_kind = string_field(column, "value_kind").unwrap_or("text");
            Some(JdbcQueryColumnSummary {
                name: sanitize_error(name),
                value_kind: sanitize_error(value_kind),
            })
        })
        .collect()
}

fn rows_field(
    value: &Value,
    row_limit: usize,
    max_columns: usize,
    max_cell_chars: usize,
) -> Vec<Vec<String>> {
    value
        .get("rows")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(row_limit)
        .map(|row| {
            row.as_array()
                .into_iter()
                .flatten()
                .take(max_columns)
                .map(|cell| cell.as_str().unwrap_or("<non-text value>"))
                .map(|cell| cap_string(cell, max_cell_chars).0)
                .collect()
        })
        .collect()
}

fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value.get(field).and_then(Value::as_str)
}

fn bool_field(value: &Value, field: &str) -> Option<bool> {
    value.get(field).and_then(Value::as_bool)
}

fn usize_field(value: &Value, field: &str) -> Option<usize> {
    let value = value.get(field)?.as_u64()?;
    usize::try_from(value).ok()
}

fn u64_field(value: &Value, field: &str) -> Option<u64> {
    value.get(field).and_then(Value::as_u64)
}

fn result_size_bytes(columns: &[JdbcQueryColumnSummary], rows: &[Vec<String>]) -> usize {
    let column_bytes: usize = columns
        .iter()
        .map(|column| column.name.len() + column.value_kind.len())
        .sum();
    let row_bytes: usize = rows
        .iter()
        .flat_map(|row| row.iter())
        .map(String::len)
        .sum();
    column_bytes + row_bytes
}
