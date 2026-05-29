use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::CreateJdbcConnectorInput;

use crate::jdbc_query_dto::JdbcExperimentalSidecarRuntimeRequest;

const JDBC_WIDGET_DEFINITION_ID: &str = "database-jdbc";
const TERMINAL_WIDGET_DEFINITION_ID: &str = "terminal";

#[test]
fn jdbc_query_command_helpers_validate_and_execute_mock_read_only_sql() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) =
        create_widget_in_test_db(&db_path, JDBC_WIDGET_DEFINITION_ID);
    let connector_id = create_connector_in_test_db(&db_path, &workspace_id);

    let validation = validate_jdbc_read_only_sql_blocking(
        ValidateJdbcReadOnlySqlRequest {
            workspace_id: workspace_id.clone(),
            workbench_id: workbench_id.clone(),
            widget_instance_id: widget_id.clone(),
            connector_id: connector_id.clone(),
            sql: "select 1".to_owned(),
            row_limit: None,
            timeout_ms: None,
        },
        db_path.clone(),
    )
    .expect("validate SQL");

    assert!(validation.is_valid);
    assert_eq!(validation.statement_kind.as_deref(), Some("SELECT"));

    let result = execute_jdbc_read_only_query_blocking(
        ExecuteJdbcReadOnlyQueryRequest {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            connector_id,
            sql: "select 1".to_owned(),
            row_limit: None,
            timeout_ms: None,
            max_columns: None,
            max_cell_chars: None,
            max_result_bytes: None,
            experimental_sidecar: None,
        },
        db_path.clone(),
    )
    .expect("execute mock query");

    assert_eq!(result.status, "completed");
    assert_eq!(result.statement_kind.as_deref(), Some("SELECT"));
    assert_eq!(result.returned_row_count, 3);
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(result.mock_execution);
    remove_test_db_files(&db_path);
}

#[test]
fn jdbc_query_command_helper_returns_failed_result_for_invalid_sql() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) =
        create_widget_in_test_db(&db_path, JDBC_WIDGET_DEFINITION_ID);
    let connector_id = create_connector_in_test_db(&db_path, &workspace_id);

    let result = execute_jdbc_read_only_query_blocking(
        ExecuteJdbcReadOnlyQueryRequest {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            connector_id,
            sql: "delete from orders".to_owned(),
            row_limit: None,
            timeout_ms: None,
            max_columns: None,
            max_cell_chars: None,
            max_result_bytes: None,
            experimental_sidecar: None,
        },
        db_path.clone(),
    )
    .expect("invalid SQL response");

    assert_eq!(result.status, "validation_failed");
    assert!(!result.validation.is_valid);
    assert!(result.rows.is_empty());
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("SQL did not pass the read-only validator.")
    );
    remove_test_db_files(&db_path);
}

#[test]
fn jdbc_query_command_helpers_run_explicit_diagnostics() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) =
        create_widget_in_test_db(&db_path, JDBC_WIDGET_DEFINITION_ID);

    let health = check_jdbc_sidecar_health_blocking(
        CheckJdbcSidecarHealthRequest {
            workspace_id: workspace_id.clone(),
            workbench_id: workbench_id.clone(),
            widget_instance_id: widget_id.clone(),
            experimental_sidecar: diagnostic_runtime(),
        },
        db_path.clone(),
    )
    .expect("health diagnostic");
    assert_eq!(health.action, "health_check");
    assert_eq!(health.status, "not_configured");
    assert!(!health.ok);

    let mut probe_runtime = diagnostic_runtime();
    probe_runtime.driver_jar_path.clear();
    let probe = probe_jdbc_driver_blocking(
        ProbeJdbcDriverRequest {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            experimental_sidecar: probe_runtime,
        },
        db_path.clone(),
    )
    .expect("driver diagnostic");
    assert_eq!(probe.action, "driver_probe");
    assert_eq!(probe.status, "not_configured");
    assert!(probe.message.contains("driver JAR path"));
    remove_test_db_files(&db_path);
}

#[test]
fn jdbc_query_command_helper_rejects_non_jdbc_widget_owner() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) =
        create_widget_in_test_db(&db_path, TERMINAL_WIDGET_DEFINITION_ID);
    let connector_id = create_connector_in_test_db(&db_path, &workspace_id);

    let error = execute_jdbc_read_only_query_blocking(
        ExecuteJdbcReadOnlyQueryRequest {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            connector_id,
            sql: "select 1".to_owned(),
            row_limit: None,
            timeout_ms: None,
            max_columns: None,
            max_cell_chars: None,
            max_result_bytes: None,
            experimental_sidecar: None,
        },
        db_path.clone(),
    )
    .expect_err("non-JDBC widget rejected");

    assert!(error.contains("requires a Database / JDBC widget owner"));
    remove_test_db_files(&db_path);
}

fn diagnostic_runtime() -> JdbcExperimentalSidecarRuntimeRequest {
    JdbcExperimentalSidecarRuntimeRequest {
        enabled: true,
        java_program: Some("hobit-missing-jdbc-diagnostic-java".to_owned()),
        sidecar_jar_path: None,
        sidecar_classpath: Some("target/hobit-jdbc-sidecar/classes".to_owned()),
        sidecar_main_class: Some("com.hobit.jdbc.JdbcReadOnlySidecar".to_owned()),
        driver_jar_path: "target/test-driver.jar".to_owned(),
        driver_class_name: Some("org.example.Driver".to_owned()),
        jdbc_url: "jdbc:example://localhost/app".to_owned(),
        username: None,
        credential_env_var_name: None,
        max_rows: Some(100),
        timeout_ms: Some(100),
        max_result_bytes: Some(262_144),
    }
}

fn create_widget_in_test_db(db_path: &Path, definition_id: &str) -> (String, String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("JDBC query command test", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.clone().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            definition_id,
            "Widget",
            "tool",
        )
        .expect("add widget")
        .expect("workbench state");
    let widget_id = state.widget_instances.last().expect("widget").id.clone();
    let workspace_id = workspace.id;
    drop(service);

    (workspace_id, workbench_id, widget_id)
}

fn create_connector_in_test_db(db_path: &Path, workspace_id: &str) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    let service = WorkspaceService::new(store);
    let connector = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace_id.to_owned(),
            display_name: "Analytics".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: Some(true),
            status: Some("configured".to_owned()),
            notes: "".to_owned(),
        })
        .expect("create connector");
    let connector_id = connector.connector_id;
    drop(service);

    connector_id
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-jdbc-query-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
