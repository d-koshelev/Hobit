use std::fmt;

use hobit_storage_sqlite::JdbcConnectorRow;

use super::jdbc_query_types::{
    JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary, JdbcReadOnlySqlValidationSummary,
};
use super::jdbc_sidecar_protocol::JdbcSidecarProcessRunner;

pub(super) const STATUS_COMPLETED: &str = "completed";
pub(super) const STATUS_VALIDATION_FAILED: &str = "validation_failed";
pub(super) const STATUS_NOT_CONFIGURED: &str = "not_configured";
pub(super) const STATUS_UNSUPPORTED_DRIVER: &str = "unsupported_driver";
pub(super) const STATUS_QUERY_REJECTED: &str = "query_rejected";
pub(super) const STATUS_EXECUTION_FAILED: &str = "execution_failed";
pub(super) const STATUS_TIMEOUT: &str = "timeout";

const VALUE_KIND_TEXT: &str = "text";

pub(super) trait ReadOnlyJdbcAdapter {
    fn execute_read_only_query(
        &self,
        request: JdbcReadOnlyAdapterRequest,
    ) -> JdbcReadOnlyQueryResultSummary;
}

#[derive(Clone, Eq, PartialEq)]
pub(super) struct JdbcRuntimeSecret {
    value: String,
}

impl JdbcRuntimeSecret {
    #[allow(dead_code)]
    pub(super) fn new(value: impl Into<String>) -> Self {
        Self {
            value: value.into(),
        }
    }

    pub(super) fn presence_marker(label: &str) -> Self {
        Self {
            value: format!("{label}:present"),
        }
    }
}

impl fmt::Debug for JdbcRuntimeSecret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("JdbcRuntimeSecret(<redacted>)")
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JdbcSidecarRuntimeConfig {
    pub(super) driver_kind: String,
    pub(super) runtime_kind: String,
    pub(super) jdbc_url: JdbcRuntimeSecret,
    pub(super) username: Option<JdbcRuntimeSecret>,
    pub(super) password: Option<JdbcRuntimeSecret>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[allow(dead_code)]
pub(super) enum JdbcConnectorRuntimeConfig {
    MockOnly,
    NotConfigured,
    UnsupportedDriver { driver_kind: String },
    Sidecar(JdbcSidecarRuntimeConfig),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JdbcReadOnlyRuntimeConnector {
    pub(super) connector_id: String,
    pub(super) display_name: String,
    pub(super) database_kind: String,
    pub(super) driver_kind: String,
    pub(super) environment: String,
    pub(super) runtime_config: JdbcConnectorRuntimeConfig,
}

impl JdbcReadOnlyRuntimeConnector {
    pub(super) fn mock_only(row: JdbcConnectorRow) -> Self {
        Self {
            connector_id: row.connector_id,
            display_name: row.display_name,
            database_kind: row.database_kind,
            driver_kind: row.driver_kind,
            environment: row.environment,
            runtime_config: JdbcConnectorRuntimeConfig::MockOnly,
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
pub(super) struct JdbcReadOnlyAdapterRequest {
    pub(super) connector: JdbcReadOnlyRuntimeConnector,
    pub(super) sql: String,
    pub(super) row_limit: usize,
    pub(super) timeout_ms: u64,
    pub(super) max_columns: usize,
    pub(super) max_cell_chars: usize,
    pub(super) max_result_bytes: usize,
    pub(super) validation: JdbcReadOnlySqlValidationSummary,
}

impl fmt::Debug for JdbcReadOnlyAdapterRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("JdbcReadOnlyAdapterRequest")
            .field("connector", &self.connector)
            .field("sql_bytes", &self.sql.len())
            .field("row_limit", &self.row_limit)
            .field("timeout_ms", &self.timeout_ms)
            .field("max_columns", &self.max_columns)
            .field("max_cell_chars", &self.max_cell_chars)
            .field("max_result_bytes", &self.max_result_bytes)
            .field("validation", &self.validation)
            .finish()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[allow(dead_code)]
pub(super) enum JdbcReadOnlyRuntimeErrorKind {
    NotConfigured,
    UnsupportedDriver,
    ConnectionFailed,
    AuthenticationFailed,
    Timeout,
    QueryRejected,
    ExecutionFailed,
    ResultTruncated,
}

impl JdbcReadOnlyRuntimeErrorKind {
    fn status(self) -> &'static str {
        match self {
            Self::NotConfigured => STATUS_NOT_CONFIGURED,
            Self::UnsupportedDriver => STATUS_UNSUPPORTED_DRIVER,
            Self::ConnectionFailed => "connection_failed",
            Self::AuthenticationFailed => "authentication_failed",
            Self::Timeout => STATUS_TIMEOUT,
            Self::QueryRejected => STATUS_QUERY_REJECTED,
            Self::ExecutionFailed => STATUS_EXECUTION_FAILED,
            Self::ResultTruncated => "result_truncated",
        }
    }

    fn default_message(self) -> &'static str {
        match self {
            Self::NotConfigured => "JDBC real runtime is not configured for read-only execution.",
            Self::UnsupportedDriver => {
                "JDBC connector driver is not supported by the real runtime."
            }
            Self::ConnectionFailed => "JDBC connection failed before read-only query execution.",
            Self::AuthenticationFailed => {
                "JDBC authentication failed. Credential details were redacted."
            }
            Self::Timeout => "JDBC read-only query timed out.",
            Self::QueryRejected => "SQL did not pass the read-only validator.",
            Self::ExecutionFailed => "JDBC read-only query execution failed.",
            Self::ResultTruncated => "JDBC read-only result was truncated by runtime limits.",
        }
    }

    fn may_include_sanitized_detail(self) -> bool {
        matches!(
            self,
            Self::UnsupportedDriver | Self::QueryRejected | Self::ResultTruncated
        )
    }
}

pub(super) struct MockReadOnlyJdbcAdapter;

impl ReadOnlyJdbcAdapter for MockReadOnlyJdbcAdapter {
    fn execute_read_only_query(
        &self,
        request: JdbcReadOnlyAdapterRequest,
    ) -> JdbcReadOnlyQueryResultSummary {
        if !request.validation.is_valid {
            return failed_adapter_result(
                request,
                JdbcReadOnlyRuntimeErrorKind::QueryRejected,
                Some("SQL did not pass the read-only validator."),
            );
        }

        mock_read_only_query_result(request)
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(super) struct SidecarReadOnlyJdbcAdapter {
    runner: Option<JdbcSidecarProcessRunner>,
    unavailable_message: Option<String>,
}

impl SidecarReadOnlyJdbcAdapter {
    #[allow(dead_code)]
    pub(super) fn not_configured() -> Self {
        Self {
            runner: None,
            unavailable_message: None,
        }
    }

    pub(super) fn unavailable(message: impl Into<String>) -> Self {
        Self {
            runner: None,
            unavailable_message: Some(message.into()),
        }
    }

    #[allow(dead_code)]
    pub(super) fn with_runner(runner: JdbcSidecarProcessRunner) -> Self {
        Self {
            runner: Some(runner),
            unavailable_message: None,
        }
    }
}

impl ReadOnlyJdbcAdapter for SidecarReadOnlyJdbcAdapter {
    fn execute_read_only_query(
        &self,
        request: JdbcReadOnlyAdapterRequest,
    ) -> JdbcReadOnlyQueryResultSummary {
        if !request.validation.is_valid {
            return failed_adapter_result(
                request,
                JdbcReadOnlyRuntimeErrorKind::QueryRejected,
                Some("SQL did not pass the read-only validator."),
            );
        }

        if let JdbcConnectorRuntimeConfig::UnsupportedDriver { driver_kind } =
            &request.connector.runtime_config
        {
            let message = format!("unsupported JDBC driver kind: {driver_kind}");
            return failed_adapter_result(
                request,
                JdbcReadOnlyRuntimeErrorKind::UnsupportedDriver,
                Some(&message),
            );
        }

        if matches!(
            &request.connector.runtime_config,
            JdbcConnectorRuntimeConfig::Sidecar(_)
        ) {
            if let Some(runner) = &self.runner {
                return runner.execute_read_only_query(request);
            }

            let message = self
                .unavailable_message
                .as_deref()
                .unwrap_or("JDBC real runtime is not configured for read-only execution.");
            return failed_query_result(
                request.connector.connector_id,
                Some(request.connector.display_name),
                request.validation,
                request.row_limit,
                STATUS_NOT_CONFIGURED,
                message,
                false,
            );
        }

        failed_adapter_result(request, JdbcReadOnlyRuntimeErrorKind::NotConfigured, None)
    }
}

pub(super) fn failed_query_result(
    connector_id: String,
    connector_display_name: Option<String>,
    validation: JdbcReadOnlySqlValidationSummary,
    row_limit: usize,
    status: &str,
    error: &str,
    mock_execution: bool,
) -> JdbcReadOnlyQueryResultSummary {
    JdbcReadOnlyQueryResultSummary {
        status: status.to_owned(),
        connector_id,
        connector_display_name,
        statement_kind: validation.statement_kind.clone(),
        validation,
        columns: Vec::new(),
        rows: Vec::new(),
        row_count: 0,
        returned_row_count: 0,
        row_limit,
        truncated: false,
        truncated_rows: false,
        truncated_columns: false,
        truncated_cells: false,
        truncated_bytes: false,
        duration_ms: 0,
        sanitized_error: Some(sanitize_error(error)),
        no_secrets_returned: true,
        no_ai_context_shared: true,
        mock_execution,
    }
}

fn failed_adapter_result(
    request: JdbcReadOnlyAdapterRequest,
    kind: JdbcReadOnlyRuntimeErrorKind,
    detail: Option<&str>,
) -> JdbcReadOnlyQueryResultSummary {
    let mock_execution = matches!(
        &request.connector.runtime_config,
        JdbcConnectorRuntimeConfig::MockOnly
    );
    let error = match detail {
        Some(detail) if kind.may_include_sanitized_detail() => sanitize_error(detail),
        _ => kind.default_message().to_owned(),
    };

    failed_query_result(
        request.connector.connector_id,
        Some(request.connector.display_name),
        request.validation,
        request.row_limit,
        kind.status(),
        &error,
        mock_execution,
    )
}

fn mock_read_only_query_result(
    request: JdbcReadOnlyAdapterRequest,
) -> JdbcReadOnlyQueryResultSummary {
    let statement_kind = request.validation.statement_kind.clone();
    let mut columns = vec![
        text_column("sample_index"),
        text_column("statement_kind"),
        text_column("connector"),
        text_column("sql_preview"),
    ];
    let mut rows = vec![
        vec![
            "1".to_owned(),
            statement_kind
                .clone()
                .unwrap_or_else(|| "unknown".to_owned()),
            request.connector.display_name.clone(),
            request.validation.normalized_preview.clone(),
        ],
        vec![
            "2".to_owned(),
            statement_kind
                .clone()
                .unwrap_or_else(|| "unknown".to_owned()),
            request.connector.database_kind.clone(),
            "Deterministic mock read-only sample.".to_owned(),
        ],
        vec![
            "3".to_owned(),
            statement_kind
                .clone()
                .unwrap_or_else(|| "unknown".to_owned()),
            request.connector.environment.clone(),
            "No real database connection or credential access occurred.".to_owned(),
        ],
    ];

    let row_count = rows.len();
    let mut truncated_rows = false;
    if rows.len() > request.row_limit {
        rows.truncate(request.row_limit);
        truncated_rows = true;
    }

    let mut truncated_columns = false;
    if columns.len() > request.max_columns {
        columns.truncate(request.max_columns);
        rows.iter_mut()
            .for_each(|row| row.truncate(request.max_columns));
        truncated_columns = true;
    }

    let mut truncated_cells = false;
    for row in &mut rows {
        for cell in row {
            let (capped, was_truncated) = cap_string(cell, request.max_cell_chars);
            *cell = capped;
            truncated_cells |= was_truncated;
        }
    }

    let mut truncated_bytes = false;
    while result_size_bytes(&columns, &rows) > request.max_result_bytes && !rows.is_empty() {
        rows.pop();
        truncated_rows = true;
        truncated_bytes = true;
    }

    let returned_row_count = rows.len();
    JdbcReadOnlyQueryResultSummary {
        status: STATUS_COMPLETED.to_owned(),
        connector_id: request.connector.connector_id,
        connector_display_name: Some(request.connector.display_name),
        validation: request.validation,
        statement_kind,
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
        duration_ms: 0,
        sanitized_error: None,
        no_secrets_returned: true,
        no_ai_context_shared: true,
        mock_execution: true,
    }
}

pub(super) fn sanitize_error(message: &str) -> String {
    let sanitized = message
        .replace('\r', " ")
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let redacted = redact_secret_assignments(&sanitized);
    let (capped, _) = cap_string(&redacted, 240);
    capped
}

pub(super) fn cap_string(value: &str, max_chars: usize) -> (String, bool) {
    let max_chars = max_chars.max(1);
    let char_count = value.chars().count();
    if char_count <= max_chars {
        return (value.to_owned(), false);
    }

    (value.chars().take(max_chars).collect(), true)
}

fn redact_secret_assignments(message: &str) -> String {
    message
        .split_whitespace()
        .map(redact_secret_assignment_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn redact_secret_assignment_token(token: &str) -> String {
    const SECRET_KEYS: &[&str] = &[
        "password",
        "passwd",
        "pwd",
        "token",
        "access_token",
        "secret",
        "api_key",
        "apikey",
        "private_key",
        "username",
        "user",
    ];

    let Some(separator_index) = token.find('=') else {
        return token.to_owned();
    };

    let key = &token[..separator_index];
    if SECRET_KEYS
        .iter()
        .any(|secret_key| key.eq_ignore_ascii_case(secret_key))
    {
        format!("{key}=<redacted>")
    } else {
        token.to_owned()
    }
}

fn text_column(name: &str) -> JdbcQueryColumnSummary {
    JdbcQueryColumnSummary {
        name: name.to_owned(),
        value_kind: VALUE_KIND_TEXT.to_owned(),
    }
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
