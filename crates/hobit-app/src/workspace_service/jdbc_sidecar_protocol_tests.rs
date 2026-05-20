use std::env;

use serde_json::{json, Value};

use super::jdbc_query_types::JdbcReadOnlySqlValidationSummary;
use super::jdbc_runtime::{
    JdbcConnectorRuntimeConfig, JdbcReadOnlyAdapterRequest, JdbcReadOnlyRuntimeConnector,
    JdbcRuntimeSecret, JdbcSidecarRuntimeConfig, ReadOnlyJdbcAdapter, SidecarReadOnlyJdbcAdapter,
    STATUS_COMPLETED, STATUS_EXECUTION_FAILED, STATUS_QUERY_REJECTED,
};
use super::jdbc_sidecar_protocol::{
    build_sidecar_request_json, map_sidecar_response, JdbcSidecarProcessRunner,
};

const SECRET_SENTINEL: &str = "jdbc-sidecar-protocol-secret";

#[test]
fn sidecar_request_json_contains_only_safe_runtime_fields() {
    let request = adapter_request(sidecar_connector(), valid_validation(), "select 1");
    let json = build_sidecar_request_json(&request);
    let value: Value = serde_json::from_str(&json).expect("request json");

    assert_eq!(value["protocol_version"], 1);
    assert_eq!(value["runtime_kind"], "mock_read_only");
    assert_eq!(value["connector_id"], "jdbc-sidecar");
    assert_eq!(value["database_kind"], "postgres");
    assert_eq!(value["driver_kind"], "jdbc");
    assert_eq!(value["statement_kind"], "SELECT");
    assert_eq!(value["validated_read_only"], true);
    assert_eq!(value["sql"], "select 1");
    assert_eq!(value["row_limit"], 100);
    assert!(!json.contains(SECRET_SENTINEL));
    assert!(!json.contains("jdbc:postgresql://private-host"));
    assert!(!json.contains("readonly-user"));
}

#[test]
fn maps_completed_sidecar_response_to_bounded_result_model() {
    let request = adapter_request(sidecar_connector(), valid_validation(), "select 1");
    let response = json!({
        "protocol_version": 1,
        "request_id": "jdbc-sidecar",
        "status": STATUS_COMPLETED,
        "columns": [
            { "name": "sample_index", "value_kind": "text" },
            { "name": "statement_kind", "value_kind": "text" }
        ],
        "rows": [
            ["1", "SELECT"],
            ["2", "SELECT"]
        ],
        "row_count": 2,
        "returned_row_count": 2,
        "truncated": false,
        "truncated_rows": false,
        "truncated_columns": false,
        "truncated_cells": false,
        "truncated_bytes": false,
        "duration_ms": 0,
        "sanitized_error": null,
        "no_secrets_returned": true,
        "no_ai_context_shared": true,
        "mock_execution": true
    });

    let result = map_sidecar_response(&request, &response.to_string());

    assert_eq!(result.status, STATUS_COMPLETED);
    assert_eq!(result.connector_id, "jdbc-sidecar");
    assert_eq!(
        result.connector_display_name.as_deref(),
        Some("Sidecar connector")
    );
    assert_eq!(result.statement_kind.as_deref(), Some("SELECT"));
    assert_eq!(result.columns.len(), 2);
    assert_eq!(result.rows.len(), 2);
    assert_eq!(result.row_count, 2);
    assert_eq!(result.returned_row_count, 2);
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(result.mock_execution);
}

#[test]
fn maps_sidecar_sanitized_error_without_leaking_detail() {
    let request = adapter_request(sidecar_connector(), valid_validation(), "select 1");
    let response = json!({
        "protocol_version": 1,
        "request_id": "jdbc-sidecar",
        "status": "authentication_failed",
        "columns": [],
        "rows": [],
        "row_count": 0,
        "returned_row_count": 0,
        "duration_ms": 0,
        "sanitized_error": "JDBC authentication failed. Credential details were redacted.",
        "no_secrets_returned": true,
        "no_ai_context_shared": true,
        "mock_execution": false
    });

    let result = map_sidecar_response(&request, &response.to_string());
    let result_debug = format!("{result:?}");

    assert_eq!(result.status, "authentication_failed");
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC authentication failed. Credential details were redacted.")
    );
    assert!(!result_debug.contains(SECRET_SENTINEL));
    assert!(!result_debug.contains("readonly-user"));
}

#[test]
fn sidecar_adapter_rejects_invalid_validation_before_process_runner() {
    let runner = JdbcSidecarProcessRunner::new(
        "hobit-missing-jdbc-sidecar-process",
        Vec::new(),
        env::current_dir().expect("current dir"),
        100,
    );
    let adapter = SidecarReadOnlyJdbcAdapter::with_runner(runner);
    let result = adapter.execute_read_only_query(adapter_request(
        sidecar_connector(),
        invalid_validation(),
        "drop table accounts",
    ));

    assert_eq!(result.status, STATUS_QUERY_REJECTED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("SQL did not pass the read-only validator.")
    );
}

#[test]
fn sidecar_process_runner_failure_is_sanitized() {
    let runner = JdbcSidecarProcessRunner::new(
        "hobit-missing-jdbc-sidecar-process",
        Vec::new(),
        env::current_dir().expect("current dir"),
        100,
    );
    let adapter = SidecarReadOnlyJdbcAdapter::with_runner(runner);
    let result = adapter.execute_read_only_query(adapter_request(
        sidecar_connector(),
        valid_validation(),
        "select 1",
    ));

    assert_eq!(result.status, STATUS_EXECUTION_FAILED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC sidecar process failed to start.")
    );
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
}

fn adapter_request(
    connector: JdbcReadOnlyRuntimeConnector,
    validation: JdbcReadOnlySqlValidationSummary,
    sql: &str,
) -> JdbcReadOnlyAdapterRequest {
    JdbcReadOnlyAdapterRequest {
        connector,
        sql: sql.to_owned(),
        row_limit: 100,
        timeout_ms: 10_000,
        max_columns: 50,
        max_cell_chars: 2_000,
        max_result_bytes: 256 * 1024,
        validation,
    }
}

fn sidecar_connector() -> JdbcReadOnlyRuntimeConnector {
    JdbcReadOnlyRuntimeConnector {
        connector_id: "jdbc-sidecar".to_owned(),
        display_name: "Sidecar connector".to_owned(),
        database_kind: "postgres".to_owned(),
        driver_kind: "jdbc".to_owned(),
        environment: "dev".to_owned(),
        runtime_config: JdbcConnectorRuntimeConfig::Sidecar(JdbcSidecarRuntimeConfig {
            driver_kind: "jdbc".to_owned(),
            jdbc_url: JdbcRuntimeSecret::new(format!(
                "jdbc:postgresql://private-host/app?password={SECRET_SENTINEL}"
            )),
            username: Some(JdbcRuntimeSecret::new("readonly-user")),
            password: Some(JdbcRuntimeSecret::new(SECRET_SENTINEL)),
        }),
    }
}

fn valid_validation() -> JdbcReadOnlySqlValidationSummary {
    JdbcReadOnlySqlValidationSummary {
        is_valid: true,
        statement_kind: Some("SELECT".to_owned()),
        normalized_preview: "select 1".to_owned(),
        rejection_reason: None,
        safety_notes: vec!["Conservative read-only validation passed.".to_owned()],
    }
}

fn invalid_validation() -> JdbcReadOnlySqlValidationSummary {
    JdbcReadOnlySqlValidationSummary {
        is_valid: false,
        statement_kind: None,
        normalized_preview: "drop table accounts".to_owned(),
        rejection_reason: Some("SQL contains unsupported or mutating token: DROP.".to_owned()),
        safety_notes: vec!["SQL was rejected before any execution adapter was reached.".to_owned()],
    }
}
