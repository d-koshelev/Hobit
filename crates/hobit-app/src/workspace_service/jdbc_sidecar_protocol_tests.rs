use std::env;
use std::num::{NonZeroU64, NonZeroUsize};

use serde_json::{json, Value};

use super::jdbc_query_types::JdbcReadOnlySqlValidationSummary;
use super::jdbc_runtime::{
    JdbcConnectorRuntimeConfig, JdbcReadOnlyAdapterRequest, JdbcReadOnlyRuntimeConnector,
    JdbcRuntimeSecret, JdbcSidecarRuntimeConfig, ReadOnlyJdbcAdapter, SidecarReadOnlyJdbcAdapter,
    STATUS_COMPLETED, STATUS_NOT_CONFIGURED, STATUS_QUERY_REJECTED,
};
use super::jdbc_sidecar_protocol::{
    build_sidecar_request_json, map_sidecar_response, JdbcReadOnlyExecutionPolicy,
    JdbcSecretReference, JdbcSecretReferenceKind, JdbcSidecarCellValue, JdbcSidecarColumn,
    JdbcSidecarDriverProbeResult, JdbcSidecarDriverReference, JdbcSidecarError,
    JdbcSidecarErrorKind, JdbcSidecarHealthCheckResult, JdbcSidecarProcessRunner,
    JdbcSidecarProfileReference, JdbcSidecarReadOnlyQueryResult, JdbcSidecarRequest,
    JdbcSidecarRequestKind, JdbcSidecarResponse, JdbcSidecarResult, JdbcSidecarSafetyFlags,
    JdbcSidecarTruncation,
};

const SECRET_SENTINEL: &str = "jdbc-sidecar-protocol-secret";

#[test]
fn typed_health_check_request_response_json_shape() {
    let request = JdbcSidecarRequest::new("health-1", JdbcSidecarRequestKind::HealthCheck);
    let request_json = serde_json::to_value(request).expect("typed request json");

    assert_eq!(request_json["protocolVersion"], 1);
    assert_eq!(request_json["requestId"], "health-1");
    assert_eq!(request_json["request"], "healthCheck");

    let response = JdbcSidecarResponse::ok(
        "health-1",
        JdbcSidecarResult::HealthCheck(JdbcSidecarHealthCheckResult {
            healthy: true,
            sidecar_label: "jdbc-readonly-sidecar".to_owned(),
        }),
    );
    let response_json = serde_json::to_value(response).expect("typed response json");

    assert_eq!(response_json["protocolVersion"], 1);
    assert_eq!(response_json["requestId"], "health-1");
    assert_eq!(response_json["status"], "ok");
    assert_eq!(response_json["result"]["kind"], "healthCheck");
    assert_eq!(response_json["result"]["data"]["healthy"], true);
}

#[test]
fn typed_driver_probe_request_uses_references_without_secret_values() {
    let request = JdbcSidecarRequest::new(
        "driver-probe-1",
        JdbcSidecarRequestKind::DriverProbe {
            profile: protocol_profile(),
        },
    );
    let value = serde_json::to_value(request).expect("driver probe request");
    let raw = value.to_string();

    assert_eq!(value["request"], "driverProbe");
    assert_eq!(value["profile"]["profileId"], "profile-1");
    assert_eq!(
        value["profile"]["credentialReferences"][0]["kind"],
        "connectionCredential"
    );
    assert!(!raw.contains(SECRET_SENTINEL));
    assert!(!raw.contains("jdbc:postgresql://private-host"));
    assert_no_forbidden_secret_keys(&value);
}

#[test]
fn typed_execute_request_includes_read_only_policy_caps() {
    let request = JdbcSidecarRequest::new(
        "execute-1",
        JdbcSidecarRequestKind::ExecuteReadOnlyQuery {
            profile: protocol_profile(),
            sql: "select 1".to_owned(),
            statement_kind: "SELECT".to_owned(),
            policy: read_only_policy(),
            prepared_query_id: Some("prepared-1".to_owned()),
        },
    );
    let value = serde_json::to_value(request).expect("execute request");

    assert_eq!(value["request"], "executeReadOnlyQuery");
    assert_eq!(value["policy"]["readOnly"], true);
    assert_eq!(value["policy"]["maxRows"], 100);
    assert_eq!(value["policy"]["timeoutMs"], 10_000);
    assert_eq!(value["policy"]["maxResultBytes"], 262_144);
    assert_eq!(value["policy"]["allowMultiStatement"], false);
    assert_eq!(value["policy"]["allowStoredProcedures"], false);
    assert_no_forbidden_secret_keys(&value);
}

#[test]
fn typed_result_response_includes_truncation_and_safety_flags() {
    let response = JdbcSidecarResponse::ok(
        "execute-1",
        JdbcSidecarResult::ReadOnlyQuery(JdbcSidecarReadOnlyQueryResult {
            columns: vec![JdbcSidecarColumn {
                name: "answer".to_owned(),
                value_kind: "number".to_owned(),
            }],
            rows: vec![vec![JdbcSidecarCellValue::Number("42".to_owned())]],
            row_count: 1,
            truncated: JdbcSidecarTruncation {
                truncated: true,
                rows: true,
                columns: false,
                cells: false,
                bytes: false,
            },
            elapsed_ms: 7,
            warnings: vec!["Result capped by maxRows.".to_owned()],
            safety_flags: JdbcSidecarSafetyFlags {
                validated_read_only: true,
                read_only_connection_requested: true,
                no_secrets_returned: true,
                no_ai_context_shared: true,
            },
            redacted_error: None,
        }),
    );
    let value = serde_json::to_value(response).expect("result response");

    assert_eq!(value["status"], "ok");
    assert_eq!(value["result"]["kind"], "readOnlyQuery");
    assert_eq!(value["result"]["data"]["rowCount"], 1);
    assert_eq!(value["result"]["data"]["truncated"]["truncated"], true);
    assert_eq!(value["result"]["data"]["truncated"]["rows"], true);
    assert_eq!(
        value["result"]["data"]["safetyFlags"]["validatedReadOnly"],
        true
    );
    assert_eq!(
        value["result"]["data"]["safetyFlags"]["noAiContextShared"],
        true
    );
}

#[test]
fn typed_error_response_is_redacted_by_shape() {
    let response = JdbcSidecarResponse::error(
        "execute-1",
        JdbcSidecarError::redacted(
            JdbcSidecarErrorKind::AuthenticationFailed,
            "JDBC authentication failed. Credential details were redacted.",
        ),
    );
    let value = serde_json::to_value(response).expect("error response");

    assert_eq!(value["status"], "error");
    assert_eq!(value["error"]["kind"], "authentication_failed");
    assert_eq!(value["error"]["redacted"], true);
    assert_eq!(
        value["error"]["message"],
        "JDBC authentication failed. Credential details were redacted."
    );
    assert_no_forbidden_secret_keys(&value);
}

#[test]
fn typed_protocol_serialization_has_no_forbidden_secret_field_names() {
    let values = vec![
        serde_json::to_value(JdbcSidecarRequest::new(
            "prepare-1",
            JdbcSidecarRequestKind::PrepareReadOnlyQuery {
                profile: protocol_profile(),
                sql: "select current_date".to_owned(),
                statement_kind: "SELECT".to_owned(),
                policy: read_only_policy(),
            },
        ))
        .expect("prepare request"),
        serde_json::to_value(JdbcSidecarResponse::ok(
            "driver-probe-1",
            JdbcSidecarResult::DriverProbe(JdbcSidecarDriverProbeResult {
                driver_id: "driver-1".to_owned(),
                supported: true,
                warnings: Vec::new(),
            }),
        ))
        .expect("driver probe response"),
    ];

    for value in values {
        assert_no_forbidden_secret_keys(&value);
    }
}

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
fn real_sidecar_request_json_uses_env_reference_without_password_value_field() {
    let request = adapter_request(real_sidecar_connector(), valid_validation(), "select 1");
    let json = build_sidecar_request_json(&request);
    let value: Value = serde_json::from_str(&json).expect("request json");

    assert_eq!(value["runtime_kind"], "real_jdbc");
    assert_eq!(value["request"], "executeReadOnlyQuery");
    assert_eq!(value["read_only"], true);
    assert_eq!(value["allow_multi_statement"], false);
    assert_eq!(value["allow_stored_procedures"], false);
    assert_eq!(value["driver_jar_path"], "target/test-driver.jar");
    assert_eq!(value["driver_class_name"], "org.example.Driver");
    assert_eq!(value["jdbc_url"], "jdbc:example://localhost/app");
    assert_eq!(value["credential_env_var_name"], "HOBIT_TEST_DB_CREDENTIAL");
    assert_no_forbidden_secret_keys(&value);
    assert!(!json.contains(SECRET_SENTINEL));
    assert!(!json.contains("secretValue"));
    assert!(!json.contains("\"password\""));
    assert!(!json.contains("\"token\""));
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

    assert_eq!(result.status, STATUS_NOT_CONFIGURED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC sidecar process is unavailable or not configured.")
    );
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
}

fn read_only_policy() -> JdbcReadOnlyExecutionPolicy {
    JdbcReadOnlyExecutionPolicy::new(
        NonZeroUsize::new(100).expect("nonzero rows"),
        NonZeroU64::new(10_000).expect("nonzero timeout"),
        NonZeroUsize::new(256 * 1024).expect("nonzero bytes"),
    )
}

fn protocol_profile() -> JdbcSidecarProfileReference {
    JdbcSidecarProfileReference {
        profile_id: "profile-1".to_owned(),
        profile_name: "Reporting readonly".to_owned(),
        database_kind: "postgres".to_owned(),
        driver: JdbcSidecarDriverReference {
            driver_id: "driver-1".to_owned(),
            kind_label: "jdbc".to_owned(),
            jar_path_reference: Some("configured-driver-ref".to_owned()),
        },
        jdbc_url_label: Some("postgres://reporting.example/<redacted>".to_owned()),
        username: Some("readonly_user".to_owned()),
        default_database: Some("analytics".to_owned()),
        default_schema: Some("public".to_owned()),
        default_catalog: None,
        credential_references: vec![JdbcSecretReference {
            id: "credential-ref-1".to_owned(),
            kind: JdbcSecretReferenceKind::ConnectionCredential,
        }],
    }
}

fn assert_no_forbidden_secret_keys(value: &Value) {
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                assert_ne!(key, "password");
                assert_ne!(key, "token");
                assert_ne!(key, "secretValue");
                assert_no_forbidden_secret_keys(child);
            }
        }
        Value::Array(values) => {
            for child in values {
                assert_no_forbidden_secret_keys(child);
            }
        }
        _ => {}
    }
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
            runtime_kind: "mock_read_only".to_owned(),
            driver_jar_path: None,
            driver_class_name: None,
            jdbc_url: Some(JdbcRuntimeSecret::new(format!(
                "jdbc:postgresql://private-host/app?password={SECRET_SENTINEL}"
            ))),
            username: Some("readonly-user".to_owned()),
            credential_env_var_name: Some("HOBIT_TEST_PASSWORD".to_owned()),
        }),
    }
}

fn real_sidecar_connector() -> JdbcReadOnlyRuntimeConnector {
    JdbcReadOnlyRuntimeConnector {
        connector_id: "jdbc-sidecar".to_owned(),
        display_name: "Sidecar connector".to_owned(),
        database_kind: "postgres".to_owned(),
        driver_kind: "jdbc".to_owned(),
        environment: "dev".to_owned(),
        runtime_config: JdbcConnectorRuntimeConfig::Sidecar(JdbcSidecarRuntimeConfig {
            driver_kind: "jdbc".to_owned(),
            runtime_kind: "real_jdbc".to_owned(),
            driver_jar_path: Some("target/test-driver.jar".to_owned()),
            driver_class_name: Some("org.example.Driver".to_owned()),
            jdbc_url: Some(JdbcRuntimeSecret::new("jdbc:example://localhost/app")),
            username: Some("readonly_user".to_owned()),
            credential_env_var_name: Some("HOBIT_TEST_DB_CREDENTIAL".to_owned()),
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
