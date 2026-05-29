use hobit_app::{
    JdbcQueryColumnSummary, JdbcReadOnlyQueryResultSummary, JdbcReadOnlySqlValidationSummary,
};

use crate::jdbc_query_dto::{
    ExecuteJdbcReadOnlyQueryRequest, JdbcExperimentalSidecarRuntimeRequest,
    JdbcReadOnlyQueryResultDto, ValidateJdbcReadOnlySqlRequest,
};

#[test]
fn maps_validate_jdbc_read_only_sql_request_to_app_input() {
    let request = ValidateJdbcReadOnlySqlRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        connector_id: "jdbc_1".to_owned(),
        sql: "select 1".to_owned(),
        row_limit: Some(25),
        timeout_ms: Some(5_000),
    };

    let input: hobit_app::ValidateJdbcReadOnlySqlInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.connector_id, "jdbc_1");
    assert_eq!(input.sql, "select 1");
    assert_eq!(input.row_limit, Some(25));
    assert_eq!(input.timeout_ms, Some(5_000));
}

#[test]
fn maps_execute_jdbc_read_only_query_request_to_app_input() {
    let request = ExecuteJdbcReadOnlyQueryRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        connector_id: "jdbc_1".to_owned(),
        sql: "select 1".to_owned(),
        row_limit: Some(25),
        timeout_ms: Some(5_000),
        max_columns: Some(10),
        max_cell_chars: Some(200),
        max_result_bytes: Some(1024),
        experimental_sidecar: Some(JdbcExperimentalSidecarRuntimeRequest {
            enabled: true,
            java_program: Some("java".to_owned()),
            sidecar_jar_path: None,
            sidecar_classpath: Some("target/hobit-jdbc-sidecar/classes".to_owned()),
            sidecar_main_class: Some("com.hobit.jdbc.JdbcReadOnlySidecar".to_owned()),
            driver_jar_path: "target/test-driver.jar".to_owned(),
            driver_class_name: Some("org.example.Driver".to_owned()),
            jdbc_url: "jdbc:example://localhost/app".to_owned(),
            username: Some("readonly".to_owned()),
            credential_env_var_name: Some("HOBIT_TEST_DB_CREDENTIAL".to_owned()),
            max_rows: Some(25),
            timeout_ms: Some(5_000),
            max_result_bytes: Some(1024),
        }),
    };

    let input: hobit_app::ExecuteJdbcReadOnlyQueryInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.connector_id, "jdbc_1");
    assert_eq!(input.sql, "select 1");
    assert_eq!(input.row_limit, Some(25));
    assert_eq!(input.timeout_ms, Some(5_000));
    assert_eq!(input.max_columns, Some(10));
    assert_eq!(input.max_cell_chars, Some(200));
    assert_eq!(input.max_result_bytes, Some(1024));
    let experimental_sidecar = input
        .experimental_sidecar
        .expect("experimental sidecar mapped");
    assert!(experimental_sidecar.enabled);
    assert_eq!(
        experimental_sidecar.driver_jar_path,
        "target/test-driver.jar"
    );
    assert_eq!(
        experimental_sidecar.credential_env_var_name.as_deref(),
        Some("HOBIT_TEST_DB_CREDENTIAL")
    );
}

#[test]
fn maps_jdbc_read_only_query_result_to_dto() {
    let summary = JdbcReadOnlyQueryResultSummary {
        status: "completed".to_owned(),
        connector_id: "jdbc_1".to_owned(),
        connector_display_name: Some("Analytics".to_owned()),
        validation: JdbcReadOnlySqlValidationSummary {
            is_valid: true,
            statement_kind: Some("SELECT".to_owned()),
            normalized_preview: "select 1".to_owned(),
            rejection_reason: None,
            safety_notes: vec!["Read-only.".to_owned()],
        },
        statement_kind: Some("SELECT".to_owned()),
        columns: vec![JdbcQueryColumnSummary {
            name: "answer".to_owned(),
            value_kind: "text".to_owned(),
        }],
        rows: vec![vec!["1".to_owned()]],
        row_count: 1,
        returned_row_count: 1,
        row_limit: 100,
        truncated: false,
        truncated_rows: false,
        truncated_columns: false,
        truncated_cells: false,
        truncated_bytes: false,
        duration_ms: 0,
        sanitized_error: None,
        no_secrets_returned: true,
        no_ai_context_shared: true,
        mock_execution: true,
    };

    let dto = JdbcReadOnlyQueryResultDto::from(summary);

    assert_eq!(dto.status, "completed");
    assert_eq!(dto.connector_id, "jdbc_1");
    assert_eq!(dto.connector_display_name.as_deref(), Some("Analytics"));
    assert!(dto.validation.is_valid);
    assert_eq!(dto.validation.statement_kind.as_deref(), Some("SELECT"));
    assert_eq!(dto.columns[0].name, "answer");
    assert_eq!(dto.rows, vec![vec!["1".to_owned()]]);
    assert!(dto.no_secrets_returned);
    assert!(dto.no_ai_context_shared);
    assert!(dto.mock_execution);
}
