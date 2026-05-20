use std::path::PathBuf;

use hobit_tools::process::{run_process_once, ProcessRunRequest, ProcessRunStatus};
use serde_json::{json, Value};

use super::jdbc_query_types::{JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary};
use super::jdbc_runtime::{
    cap_string, failed_query_result, sanitize_error, JdbcReadOnlyAdapterRequest, STATUS_COMPLETED,
    STATUS_EXECUTION_FAILED, STATUS_NOT_CONFIGURED, STATUS_QUERY_REJECTED, STATUS_TIMEOUT,
    STATUS_UNSUPPORTED_DRIVER,
};

const SIDECAR_PROTOCOL_VERSION: u64 = 1;
const SIDECAR_STDERR_CAP_BYTES: usize = 16 * 1024;
const SIDECAR_RESPONSE_OVERHEAD_BYTES: usize = 16 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JdbcSidecarProcessRunner {
    program: String,
    args: Vec<String>,
    working_directory: PathBuf,
    timeout_ms: u64,
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
            ProcessRunStatus::FailedToStart => failed_query_result(
                request.connector.connector_id,
                Some(request.connector.display_name),
                request.validation,
                request.row_limit,
                STATUS_EXECUTION_FAILED,
                "JDBC sidecar process failed to start.",
                false,
            ),
            ProcessRunStatus::TimedOut => failed_query_result(
                request.connector.connector_id,
                Some(request.connector.display_name),
                request.validation,
                request.row_limit,
                STATUS_TIMEOUT,
                "JDBC sidecar process timed out.",
                false,
            ),
            ProcessRunStatus::Completed if process_output.exit_code != Some(0) => {
                let error = if process_output.stderr.trim().is_empty() {
                    "JDBC sidecar process exited with failure.".to_owned()
                } else {
                    sanitize_error(&process_output.stderr)
                };
                failed_query_result(
                    request.connector.connector_id,
                    Some(request.connector.display_name),
                    request.validation,
                    request.row_limit,
                    STATUS_EXECUTION_FAILED,
                    &error,
                    false,
                )
            }
            ProcessRunStatus::Completed if process_output.stdout_truncated => failed_query_result(
                request.connector.connector_id,
                Some(request.connector.display_name),
                request.validation,
                request.row_limit,
                STATUS_EXECUTION_FAILED,
                "JDBC sidecar response exceeded the backend output cap.",
                false,
            ),
            ProcessRunStatus::Completed => map_sidecar_response(&request, &process_output.stdout),
        }
    }
}

pub(super) fn build_sidecar_request_json(request: &JdbcReadOnlyAdapterRequest) -> String {
    json!({
        "protocol_version": SIDECAR_PROTOCOL_VERSION,
        "request_id": request.connector.connector_id,
        "runtime_kind": "mock_read_only",
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
    })
    .to_string()
}

pub(super) fn map_sidecar_response(
    request: &JdbcReadOnlyAdapterRequest,
    raw_response: &str,
) -> JdbcReadOnlyQueryResultSummary {
    let parsed = match serde_json::from_str::<Value>(raw_response) {
        Ok(parsed) => parsed,
        Err(_) => {
            return failed_query_result(
                request.connector.connector_id.clone(),
                Some(request.connector.display_name.clone()),
                request.validation.clone(),
                request.row_limit,
                STATUS_EXECUTION_FAILED,
                "JDBC sidecar returned invalid JSON.",
                false,
            )
        }
    };

    let status = string_field(&parsed, "status").unwrap_or(STATUS_EXECUTION_FAILED);
    if status != STATUS_COMPLETED {
        return failed_query_result(
            request.connector.connector_id.clone(),
            Some(request.connector.display_name.clone()),
            request.validation.clone(),
            request.row_limit,
            normalized_error_status(status),
            string_field(&parsed, "sanitized_error")
                .unwrap_or("JDBC sidecar returned a sanitized failure."),
            bool_field(&parsed, "mock_execution").unwrap_or(false),
        );
    }

    if bool_field(&parsed, "no_secrets_returned") == Some(false)
        || bool_field(&parsed, "no_ai_context_shared") == Some(false)
    {
        return failed_query_result(
            request.connector.connector_id.clone(),
            Some(request.connector.display_name.clone()),
            request.validation.clone(),
            request.row_limit,
            STATUS_EXECUTION_FAILED,
            "JDBC sidecar response violated safety flags.",
            false,
        );
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
    JdbcReadOnlyQueryResultSummary {
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
    }
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
