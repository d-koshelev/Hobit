use super::jdbc_query_types::JdbcReadOnlySqlValidationSummary;
use super::jdbc_runtime::{
    sanitize_error, JdbcConnectorRuntimeConfig, JdbcReadOnlyAdapterRequest,
    JdbcReadOnlyRuntimeConnector, JdbcRuntimeSecret, JdbcSidecarRuntimeConfig,
    MockReadOnlyJdbcAdapter, ReadOnlyJdbcAdapter, SidecarReadOnlyJdbcAdapter,
    STATUS_NOT_CONFIGURED, STATUS_QUERY_REJECTED, STATUS_UNSUPPORTED_DRIVER,
};

const SECRET_SENTINEL: &str = "jdbc-runtime-secret-sentinel";

#[test]
fn sidecar_stub_returns_not_configured_without_exposing_backend_secrets() {
    let request = adapter_request(sidecar_connector(), valid_validation());
    let request_debug = format!("{request:?}");

    assert!(!request_debug.contains(SECRET_SENTINEL));
    assert!(!request_debug.contains("jdbc:postgresql://private-host"));
    assert!(!request_debug.contains("readonly-user"));

    let result = SidecarReadOnlyJdbcAdapter.execute_read_only_query(request);
    let result_debug = format!("{result:?}");

    assert_eq!(result.status, STATUS_NOT_CONFIGURED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC real runtime is not configured for read-only execution.")
    );
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(!result.mock_execution);
    assert!(!result_debug.contains(SECRET_SENTINEL));
    assert!(!result_debug.contains("jdbc:postgresql://private-host"));
    assert!(!result_debug.contains("readonly-user"));
}

#[test]
fn sidecar_stub_rejects_invalid_validation_before_runtime_configuration() {
    let request = adapter_request(sidecar_connector(), invalid_validation());
    let result = SidecarReadOnlyJdbcAdapter.execute_read_only_query(request);

    assert_eq!(result.status, STATUS_QUERY_REJECTED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("SQL did not pass the read-only validator.")
    );
    assert!(result.rows.is_empty());
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(!format!("{result:?}").contains(SECRET_SENTINEL));
}

#[test]
fn sidecar_stub_reports_unsupported_driver_as_sanitized_runtime_status() {
    let request = adapter_request(
        JdbcReadOnlyRuntimeConnector {
            connector_id: "jdbc-unsupported".to_owned(),
            display_name: "Unsupported connector".to_owned(),
            database_kind: "generic_jdbc".to_owned(),
            driver_kind: "oracle_jdbc".to_owned(),
            environment: "dev".to_owned(),
            runtime_config: JdbcConnectorRuntimeConfig::UnsupportedDriver {
                driver_kind: "oracle_jdbc".to_owned(),
            },
        },
        valid_validation(),
    );

    let result = SidecarReadOnlyJdbcAdapter.execute_read_only_query(request);

    assert_eq!(result.status, STATUS_UNSUPPORTED_DRIVER);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("unsupported JDBC driver kind: oracle_jdbc")
    );
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(!result.mock_execution);
}

#[test]
fn mock_adapter_remains_the_default_success_adapter_shape() {
    let request = adapter_request(
        JdbcReadOnlyRuntimeConnector {
            connector_id: "jdbc-mock".to_owned(),
            display_name: "Mock connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            environment: "dev".to_owned(),
            runtime_config: JdbcConnectorRuntimeConfig::MockOnly,
        },
        valid_validation(),
    );

    let result = MockReadOnlyJdbcAdapter.execute_read_only_query(request);

    assert_eq!(result.status, "completed");
    assert_eq!(result.returned_row_count, 3);
    assert!(result.mock_execution);
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
}

#[test]
fn runtime_sanitizer_redacts_secret_assignment_values() {
    let sanitized = sanitize_error(
        "driver failed username=readonly-user password=jdbc-runtime-secret-sentinel token=abc",
    );

    assert_eq!(
        sanitized,
        "driver failed username=<redacted> password=<redacted> token=<redacted>"
    );
    assert!(!sanitized.contains(SECRET_SENTINEL));
    assert!(!sanitized.contains("readonly-user"));
}

fn adapter_request(
    connector: JdbcReadOnlyRuntimeConnector,
    validation: JdbcReadOnlySqlValidationSummary,
) -> JdbcReadOnlyAdapterRequest {
    JdbcReadOnlyAdapterRequest {
        connector,
        sql: format!("select '{SECRET_SENTINEL}' as diagnostic_token"),
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
        normalized_preview: "select as diagnostic_token".to_owned(),
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
