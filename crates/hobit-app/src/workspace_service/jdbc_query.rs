use hobit_storage_sqlite::JdbcConnectorRow;

use crate::WorkspaceServiceError;

use super::{
    jdbc_artifacts::JdbcQueryRuntimeArtifacts,
    jdbc_query_types::{
        ExecuteJdbcReadOnlyQueryInput, JdbcReadOnlyQueryResultSummary,
        JdbcReadOnlySqlValidationSummary, ValidateJdbcReadOnlySqlInput,
    },
    jdbc_runtime::{
        cap_string, failed_query_result, sanitize_error, JdbcReadOnlyAdapterRequest,
        STATUS_NOT_CONFIGURED, STATUS_VALIDATION_FAILED,
    },
    jdbc_runtime_config::JdbcRuntimeConfig,
    validation::{required_input, validate_widget_ownership},
    WorkspaceService, JDBC_WIDGET_DEFINITION_ID,
};

const DEFAULT_ROW_LIMIT: usize = 100;
const MAX_ROW_LIMIT: usize = 100;
const DEFAULT_TIMEOUT_MS: u64 = 10_000;
const MAX_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_MAX_COLUMNS: usize = 50;
const MAX_COLUMNS: usize = 50;
const DEFAULT_MAX_CELL_CHARS: usize = 2_000;
const MAX_CELL_CHARS: usize = 2_000;
const DEFAULT_MAX_RESULT_BYTES: usize = 256 * 1024;
const MAX_RESULT_BYTES: usize = 256 * 1024;

const READ_ONLY_STATEMENTS: &[&str] = &["SELECT", "WITH", "SHOW", "DESCRIBE"];
const EXPERIMENTAL_SIDECAR_READ_ONLY_STATEMENTS: &[&str] = &["SELECT", "WITH"];
const UNSAFE_TOKENS: &[&str] = &[
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "MERGE",
    "COPY",
    "GRANT",
    "REVOKE",
    "CALL",
    "EXEC",
    "EXECUTE",
    "SET",
    "USE",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "LOCK",
    "UNLOCK",
    "VACUUM",
    "ANALYZE",
    "PRAGMA",
    "ATTACH",
    "DETACH",
    "LOAD",
    "EXTENSION",
    "IMPORT",
    "EXPORT",
    "OUTFILE",
    "INFILE",
];
const EXPERIMENTAL_SIDECAR_MVP_NOTE: &str =
    "Experimental real JDBC sidecar MVP accepts only SELECT or WITH single statements.";

impl WorkspaceService {
    pub fn validate_jdbc_read_only_sql(
        &self,
        input: ValidateJdbcReadOnlySqlInput,
    ) -> Result<JdbcReadOnlySqlValidationSummary, WorkspaceServiceError> {
        let input = normalize_validate_input(input)?;
        self.validate_jdbc_query_owner(
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
        )?;
        self.validate_jdbc_connector_scope(&input.workspace_id, &input.connector_id)?;

        Ok(validate_read_only_sql(&input.sql))
    }

    pub fn execute_jdbc_read_only_query(
        &self,
        input: ExecuteJdbcReadOnlyQueryInput,
    ) -> Result<JdbcReadOnlyQueryResultSummary, WorkspaceServiceError> {
        let input = normalize_execute_input(input)?;
        self.validate_jdbc_query_owner(
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
        )?;

        let connector = self.jdbc_query_connector(&input.workspace_id, &input.connector_id)?;
        let validation = validate_read_only_sql(&input.sql);
        let artifacts = JdbcQueryRuntimeArtifacts::from_sql_and_validation(&input.sql, &validation);
        let runtime_config = input
            .experimental_sidecar
            .as_ref()
            .filter(|config| config.enabled)
            .map(|config| {
                JdbcRuntimeConfig::from_explicit_sidecar(
                    &input.connector_id,
                    config,
                    input.row_limit,
                    input.timeout_ms,
                    input.max_result_bytes,
                )
            });

        if !validation.is_valid {
            let result = failed_query_result(
                input.connector_id,
                connector
                    .as_ref()
                    .map(|connector| connector.display_name.clone()),
                validation,
                input.row_limit,
                STATUS_VALIDATION_FAILED,
                "SQL did not pass the read-only validator.",
                runtime_config.is_none(),
            );
            let _runtime_artifacts = artifacts.summaries_for_result(&result);
            return Ok(result);
        }

        if runtime_config.is_some() {
            if let Some(rejection) = validate_experimental_sidecar_read_only_sql(&input.sql) {
                let sidecar_validation = invalid_validation(
                    &format!("{EXPERIMENTAL_SIDECAR_MVP_NOTE} {rejection}"),
                    &validation.normalized_preview,
                );
                let result = failed_query_result(
                    input.connector_id,
                    connector
                        .as_ref()
                        .map(|connector| connector.display_name.clone()),
                    sidecar_validation,
                    input.row_limit,
                    STATUS_VALIDATION_FAILED,
                    EXPERIMENTAL_SIDECAR_MVP_NOTE,
                    false,
                );
                let _runtime_artifacts = artifacts.summaries_for_result(&result);
                return Ok(result);
            }
        }

        let Some(connector) = connector else {
            let result = failed_query_result(
                input.connector_id,
                None,
                validation,
                input.row_limit,
                STATUS_NOT_CONFIGURED,
                "JDBC connector is not configured for read-only execution.",
                true,
            );
            let _runtime_artifacts = artifacts.summaries_for_result(&result);
            return Ok(result);
        };

        let adapter_request = JdbcReadOnlyAdapterRequest {
            connector: runtime_config
                .as_ref()
                .unwrap_or(&self.jdbc_runtime_config)
                .runtime_connector(connector),
            sql: input.sql,
            row_limit: input.row_limit,
            timeout_ms: input.timeout_ms,
            max_columns: input.max_columns,
            max_cell_chars: input.max_cell_chars,
            max_result_bytes: input.max_result_bytes,
            validation,
        };

        let result = if let Some(runtime_config) = runtime_config {
            runtime_config.execute_read_only_query(adapter_request)
        } else {
            self.jdbc_runtime_config
                .execute_read_only_query(adapter_request)
        };
        let _runtime_artifacts = artifacts.summaries_for_result(&result);

        Ok(result)
    }

    pub(super) fn validate_jdbc_query_owner(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Err(WorkspaceServiceError::InvalidInput(
                "JDBC query widget owner not found in workspace/workbench scope.".to_owned(),
            ));
        };

        if widget.definition_id != JDBC_WIDGET_DEFINITION_ID {
            return Err(WorkspaceServiceError::InvalidInput(
                "JDBC read-only query execution requires a Database / JDBC widget owner."
                    .to_owned(),
            ));
        }

        Ok(())
    }

    fn validate_jdbc_connector_scope(
        &self,
        workspace_id: &str,
        connector_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        let connector_id = required_input(connector_id, "JDBC connector id")?;
        if let Some(connector) = self.store.get_jdbc_connector_by_id(connector_id)? {
            if connector.workspace_id != workspace_id {
                return Err(WorkspaceServiceError::InvalidInput(format!(
                    "JDBC connector does not belong to workspace: {connector_id}"
                )));
            }
        }

        Ok(())
    }

    fn jdbc_query_connector(
        &self,
        workspace_id: &str,
        connector_id: &str,
    ) -> Result<Option<JdbcConnectorRow>, WorkspaceServiceError> {
        self.validate_jdbc_connector_scope(workspace_id, connector_id)?;
        Ok(self.store.get_jdbc_connector(workspace_id, connector_id)?)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedValidateInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    connector_id: String,
    sql: String,
    row_limit: usize,
    timeout_ms: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedExecuteInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    connector_id: String,
    sql: String,
    row_limit: usize,
    timeout_ms: u64,
    max_columns: usize,
    max_cell_chars: usize,
    max_result_bytes: usize,
    experimental_sidecar: Option<super::jdbc_query_types::JdbcExperimentalSidecarRuntimeInput>,
}

fn normalize_validate_input(
    input: ValidateJdbcReadOnlySqlInput,
) -> Result<NormalizedValidateInput, WorkspaceServiceError> {
    Ok(NormalizedValidateInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        connector_id: required_input(&input.connector_id, "JDBC connector id")?.to_owned(),
        sql: input.sql,
        row_limit: bounded_usize(input.row_limit, DEFAULT_ROW_LIMIT, MAX_ROW_LIMIT),
        timeout_ms: bounded_u64(input.timeout_ms, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS),
    })
}

fn normalize_execute_input(
    input: ExecuteJdbcReadOnlyQueryInput,
) -> Result<NormalizedExecuteInput, WorkspaceServiceError> {
    Ok(NormalizedExecuteInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        connector_id: required_input(&input.connector_id, "JDBC connector id")?.to_owned(),
        sql: input.sql,
        row_limit: bounded_usize(
            input.row_limit.or_else(|| {
                input
                    .experimental_sidecar
                    .as_ref()
                    .and_then(|config| config.max_rows)
            }),
            DEFAULT_ROW_LIMIT,
            MAX_ROW_LIMIT,
        ),
        timeout_ms: bounded_u64(
            input.timeout_ms.or_else(|| {
                input
                    .experimental_sidecar
                    .as_ref()
                    .and_then(|config| config.timeout_ms)
            }),
            DEFAULT_TIMEOUT_MS,
            MAX_TIMEOUT_MS,
        ),
        max_columns: bounded_usize(input.max_columns, DEFAULT_MAX_COLUMNS, MAX_COLUMNS),
        max_cell_chars: bounded_usize(input.max_cell_chars, DEFAULT_MAX_CELL_CHARS, MAX_CELL_CHARS),
        max_result_bytes: bounded_usize(
            input.max_result_bytes.or_else(|| {
                input
                    .experimental_sidecar
                    .as_ref()
                    .and_then(|config| config.max_result_bytes)
            }),
            DEFAULT_MAX_RESULT_BYTES,
            MAX_RESULT_BYTES,
        ),
        experimental_sidecar: input.experimental_sidecar,
    })
}

pub(super) fn validate_read_only_sql(sql: &str) -> JdbcReadOnlySqlValidationSummary {
    let trimmed = sql.trim();
    if trimmed.is_empty() {
        return invalid_validation("SQL must not be empty.", "");
    }

    let scan_sql = match scan_sql_for_classification(trimmed) {
        Ok(scan_sql) => scan_sql,
        Err(reason) => return invalid_validation(reason, ""),
    };
    let statement_sql = trim_single_trailing_semicolon(scan_sql.trim());
    let preview = normalized_preview(statement_sql);

    if statement_sql.is_empty() {
        return invalid_validation(
            "SQL must not be empty after comments are removed.",
            &preview,
        );
    }

    if contains_multiple_statements(&scan_sql) {
        return invalid_validation("Multiple SQL statements are not supported.", &preview);
    }

    let tokens = sql_tokens(statement_sql);
    let Some(first_token) = tokens.first() else {
        return invalid_validation("SQL statement kind is ambiguous.", &preview);
    };

    if let Some(token) = tokens
        .iter()
        .find(|token| UNSAFE_TOKENS.contains(&token.as_str()))
    {
        return invalid_validation(
            &format!("SQL contains unsupported or mutating token: {token}."),
            &preview,
        );
    }

    let statement_kind = match first_token.as_str() {
        "SELECT" | "WITH" | "SHOW" | "DESCRIBE" => first_token.clone(),
        "EXPLAIN" => match tokens.get(1).map(String::as_str) {
            Some(next_token) if READ_ONLY_STATEMENTS.contains(&next_token) => "EXPLAIN".to_owned(),
            _ => {
                return invalid_validation(
                    "EXPLAIN must wrap a supported read-only statement.",
                    &preview,
                );
            }
        },
        _ => {
            return invalid_validation(
                &format!("unsupported SQL statement kind: {first_token}."),
                &preview,
            );
        }
    };

    JdbcReadOnlySqlValidationSummary {
        is_valid: true,
        statement_kind: Some(statement_kind),
        normalized_preview: preview,
        rejection_reason: None,
        safety_notes: vec![
            "Conservative read-only validation passed.".to_owned(),
            "Mock adapter only; no database connection is opened.".to_owned(),
        ],
    }
}

fn invalid_validation(reason: &str, preview: &str) -> JdbcReadOnlySqlValidationSummary {
    JdbcReadOnlySqlValidationSummary {
        is_valid: false,
        statement_kind: None,
        normalized_preview: preview.to_owned(),
        rejection_reason: Some(sanitize_error(reason)),
        safety_notes: vec![
            "SQL was rejected before any execution adapter was reached.".to_owned(),
            "No database connection was opened.".to_owned(),
        ],
    }
}

fn validate_experimental_sidecar_read_only_sql(sql: &str) -> Option<&'static str> {
    let scan_sql = match scan_sql_for_classification(sql.trim()) {
        Ok(scan_sql) => scan_sql,
        Err(reason) => return Some(reason),
    };
    let statement_sql = trim_single_trailing_semicolon(scan_sql.trim());

    if contains_multiple_statements(&scan_sql) {
        return Some("Multiple SQL statements are not supported.");
    }

    let tokens = sql_tokens(statement_sql);
    let Some(first_token) = tokens.first() else {
        return Some("SQL statement kind is ambiguous.");
    };

    if tokens
        .iter()
        .any(|token| UNSAFE_TOKENS.contains(&token.as_str()))
    {
        return Some("SQL contains unsupported or mutating tokens.");
    }

    if !EXPERIMENTAL_SIDECAR_READ_ONLY_STATEMENTS.contains(&first_token.as_str()) {
        return Some("Only SELECT and WITH statements are supported.");
    }

    None
}

fn scan_sql_for_classification(sql: &str) -> Result<String, &'static str> {
    let chars: Vec<char> = sql.chars().collect();
    let mut output = String::with_capacity(sql.len());
    let mut index = 0;

    while index < chars.len() {
        let current = chars[index];
        let next = chars.get(index + 1).copied();

        if current == '-' && next == Some('-') {
            index += 2;
            while index < chars.len() && chars[index] != '\n' {
                index += 1;
            }
            output.push(' ');
            continue;
        }

        if current == '/' && next == Some('*') {
            index += 2;
            let mut closed = false;
            while index + 1 < chars.len() {
                if chars[index] == '*' && chars[index + 1] == '/' {
                    index += 2;
                    closed = true;
                    break;
                }
                index += 1;
            }
            if !closed {
                return Err("SQL contains an unterminated block comment.");
            }
            output.push(' ');
            continue;
        }

        if current == '\'' || current == '"' {
            let quote = current;
            index += 1;
            let mut closed = false;
            while index < chars.len() {
                if chars[index] == quote {
                    if chars.get(index + 1) == Some(&quote) {
                        index += 2;
                        continue;
                    }
                    index += 1;
                    closed = true;
                    break;
                }
                index += 1;
            }
            if !closed {
                return Err("SQL contains an unterminated quoted value or identifier.");
            }
            output.push(' ');
            continue;
        }

        output.push(current);
        index += 1;
    }

    Ok(output)
}

fn contains_multiple_statements(sql: &str) -> bool {
    let mut saw_semicolon = false;
    for current in sql.chars() {
        if current == ';' {
            if saw_semicolon {
                return true;
            }
            saw_semicolon = true;
            continue;
        }

        if saw_semicolon && !current.is_whitespace() {
            return true;
        }
    }

    false
}

fn trim_single_trailing_semicolon(sql: &str) -> &str {
    sql.trim_end().strip_suffix(';').unwrap_or(sql).trim_end()
}

fn sql_tokens(sql: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for character in sql.chars() {
        if character.is_ascii_alphanumeric() || character == '_' {
            current.push(character.to_ascii_uppercase());
        } else if !current.is_empty() {
            tokens.push(std::mem::take(&mut current));
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn normalized_preview(sql: &str) -> String {
    let collapsed = sql.split_whitespace().collect::<Vec<_>>().join(" ");
    let (preview, _) = cap_string(&collapsed, 240);
    preview
}

fn bounded_usize(value: Option<usize>, default_value: usize, max_value: usize) -> usize {
    value.unwrap_or(default_value).clamp(1, max_value)
}

fn bounded_u64(value: Option<u64>, default_value: u64, max_value: u64) -> u64 {
    value.unwrap_or(default_value).clamp(1, max_value)
}
