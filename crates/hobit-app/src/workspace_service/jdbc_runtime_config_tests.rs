use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use hobit_storage_sqlite::JdbcConnectorRow;

use super::jdbc_query_types::JdbcReadOnlySqlValidationSummary;
use super::jdbc_runtime::{
    JdbcReadOnlyAdapterRequest, STATUS_COMPLETED, STATUS_NOT_CONFIGURED, STATUS_VALIDATION_FAILED,
};
use super::jdbc_runtime_config::{
    JdbcRuntimeConfig, ENV_JDBC_RUNTIME_MODE, ENV_JDBC_SIDECAR_CLASSPATH,
    ENV_JDBC_SIDECAR_CONNECTOR_ID, ENV_JDBC_SIDECAR_DRIVER_KIND, ENV_JDBC_SIDECAR_ENABLED,
    ENV_JDBC_SIDECAR_JAVA_PROGRAM, ENV_JDBC_SIDECAR_JDBC_URL_PRESENT, ENV_JDBC_SIDECAR_MAIN_CLASS,
    ENV_JDBC_SIDECAR_PASSWORD_PRESENT, ENV_JDBC_SIDECAR_RUNTIME_KIND,
    ENV_JDBC_SIDECAR_USERNAME_PRESENT, ENV_JDBC_SIDECAR_WORKING_DIR,
};
use super::jdbc_sidecar_protocol::build_sidecar_request_json;
use super::{
    CreateJdbcConnectorInput, ExecuteJdbcReadOnlyQueryInput, WorkspaceService,
    JDBC_WIDGET_DEFINITION_ID,
};
use hobit_storage_sqlite::SqliteStore;

const SECRET_SENTINEL: &str = "jdbc-runtime-config-secret";
const SIDECAR_MAIN_CLASS: &str = "com.hobit.jdbc.JdbcReadOnlySidecar";

#[test]
fn default_runtime_config_selects_mock_path() {
    let config = JdbcRuntimeConfig::from_env_values(&BTreeMap::new());

    assert_eq!(config.status().adapter, "mock");
    assert_eq!(config.status().status, "mock_active");

    let request = adapter_request(config.runtime_connector(connector_row("jdbc-default", "jdbc")));
    let result = config.execute_read_only_query(request);

    assert_eq!(result.status, STATUS_COMPLETED);
    assert!(result.mock_execution);
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
}

#[test]
fn explicit_sidecar_config_selects_sidecar_adapter_path() {
    let config = JdbcRuntimeConfig::from_env_values(&sidecar_values("jdbc-sidecar"));

    assert_eq!(config.status().adapter, "sidecar");
    assert_eq!(config.status().status, "sidecar_configured");

    let request = adapter_request(config.runtime_connector(connector_row("jdbc-sidecar", "jdbc")));
    let request_json = build_sidecar_request_json(&request);

    assert!(request_json.contains("\"runtime_kind\":\"mock_read_only\""));
    let result = config.execute_read_only_query(request);

    assert_eq!(result.status, STATUS_NOT_CONFIGURED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC sidecar process is unavailable or not configured.")
    );
    assert!(!result.mock_execution);
}

#[test]
fn missing_sidecar_launch_config_returns_not_configured() {
    let mut values = BTreeMap::new();
    values.insert(ENV_JDBC_RUNTIME_MODE.to_owned(), "sidecar".to_owned());
    values.insert(ENV_JDBC_SIDECAR_ENABLED.to_owned(), "true".to_owned());
    values.insert(
        ENV_JDBC_SIDECAR_CONNECTOR_ID.to_owned(),
        "jdbc-sidecar".to_owned(),
    );

    let config = JdbcRuntimeConfig::from_env_values(&values);
    assert_eq!(config.status().status, "sidecar_not_configured");
    assert_eq!(
        config.status().message,
        "JDBC sidecar classpath or jar is not configured."
    );

    let result = config.execute_read_only_query(adapter_request(
        config.runtime_connector(connector_row("jdbc-sidecar", "jdbc")),
    ));

    assert_eq!(result.status, STATUS_NOT_CONFIGURED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC sidecar classpath or jar is not configured.")
    );
}

#[test]
fn missing_sidecar_executable_returns_sanitized_unavailable_result() {
    let mut values = sidecar_values("jdbc-sidecar");
    values.insert(
        ENV_JDBC_SIDECAR_JAVA_PROGRAM.to_owned(),
        "hobit-missing-jdbc-sidecar-java".to_owned(),
    );
    values.insert(
        ENV_JDBC_SIDECAR_CLASSPATH.to_owned(),
        format!("target/{SECRET_SENTINEL}/classes"),
    );

    let config = JdbcRuntimeConfig::from_env_values(&values);
    let request = adapter_request(config.runtime_connector(connector_row("jdbc-sidecar", "jdbc")));
    let result = config.execute_read_only_query(request);
    let debug = format!("{config:?} {result:?}");

    assert_eq!(result.status, STATUS_NOT_CONFIGURED);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("JDBC sidecar process is unavailable or not configured.")
    );
    assert!(!debug.contains(SECRET_SENTINEL));
    assert!(!debug.contains("target/"));
}

#[test]
fn invalid_sql_is_rejected_before_sidecar_process_launch() {
    let config = JdbcRuntimeConfig::from_env_values(&sidecar_values("jdbc-sidecar"));
    let request = JdbcReadOnlyAdapterRequest {
        connector: config.runtime_connector(connector_row("jdbc-sidecar", "jdbc")),
        sql: "drop table accounts".to_owned(),
        row_limit: 100,
        timeout_ms: 10_000,
        max_columns: 50,
        max_cell_chars: 2_000,
        max_result_bytes: 256 * 1024,
        validation: invalid_validation(),
    };

    let result = config.execute_read_only_query(request);

    assert_eq!(result.status, "query_rejected");
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("SQL did not pass the read-only validator.")
    );
}

#[test]
fn unsupported_sidecar_driver_is_rejected_before_process_launch() {
    let config = JdbcRuntimeConfig::from_env_values(&sidecar_values("jdbc-sidecar"));
    let request =
        adapter_request(config.runtime_connector(connector_row("jdbc-sidecar", "oracle_jdbc")));

    let result = config.execute_read_only_query(request);

    assert_eq!(result.status, "unsupported_driver");
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("unsupported JDBC driver kind: oracle_jdbc")
    );
}

#[test]
fn unsupported_runtime_mode_surfaces_safe_status() {
    let values = BTreeMap::from([(ENV_JDBC_RUNTIME_MODE.to_owned(), "real_db".to_owned())]);
    let config = JdbcRuntimeConfig::from_env_values(&values);
    let debug = format!("{config:?}");

    assert_eq!(config.status().adapter, "sidecar");
    assert_eq!(config.status().status, "unsupported_runtime");
    assert_eq!(config.status().message, "JDBC runtime mode is unsupported.");
    assert!(!debug.contains("real_db"));
}

#[test]
fn secret_looking_config_values_do_not_enter_status_or_protocol() {
    let mut values = sidecar_values("jdbc-sidecar");
    values.insert(
        ENV_JDBC_SIDECAR_USERNAME_PRESENT.to_owned(),
        "true".to_owned(),
    );
    values.insert(
        ENV_JDBC_SIDECAR_PASSWORD_PRESENT.to_owned(),
        "true".to_owned(),
    );
    values.insert(
        "HOBIT_JDBC_SIDECAR_JDBC_URL".to_owned(),
        format!("jdbc:postgresql://private-host/app?password={SECRET_SENTINEL}"),
    );

    let config = JdbcRuntimeConfig::from_env_values(&values);
    let request = adapter_request(config.runtime_connector(connector_row("jdbc-sidecar", "jdbc")));
    let request_json = build_sidecar_request_json(&request);
    let debug = format!("{config:?} {request:?} {request_json}");

    assert!(config.status().credential_presence.username);
    assert!(config.status().credential_presence.password);
    assert!(!debug.contains(SECRET_SENTINEL));
    assert!(!debug.contains("private-host"));
    assert!(!debug.contains("readonly-user"));
}

#[test]
fn sidecar_remains_opt_in_for_workspace_service_default() {
    let service = initialized_service_with_config(JdbcRuntimeConfig::default());
    let workspace = service
        .create_empty_workspace("JDBC runtime default", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .clone()
        .expect("workspace has workbench");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            JDBC_WIDGET_DEFINITION_ID,
            "Database / JDBC",
            "tool",
        )
        .expect("add JDBC widget")
        .expect("workbench state");
    let widget_id = state.widget_instances.last().expect("widget").id.clone();
    let connector = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace.id.clone(),
            display_name: "Default mock connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: Some(true),
            status: Some("configured".to_owned()),
            notes: "metadata only".to_owned(),
        })
        .expect("create connector");

    let result = service
        .execute_jdbc_read_only_query(ExecuteJdbcReadOnlyQueryInput {
            workspace_id: workspace.id,
            workbench_id,
            widget_instance_id: widget_id,
            connector_id: connector.connector_id,
            sql: "select 1".to_owned(),
            row_limit: None,
            timeout_ms: None,
            max_columns: None,
            max_cell_chars: None,
            max_result_bytes: None,
            experimental_sidecar: None,
        })
        .expect("execute query");

    assert_eq!(result.status, STATUS_COMPLETED);
    assert!(result.mock_execution);
}

#[test]
fn sidecar_config_executes_java_mock_runtime_when_jdk_available() {
    let Some((repo_root, build_dir)) = compile_java_sidecar_if_jdk_available() else {
        return;
    };

    let mut service = initialized_service_with_config(JdbcRuntimeConfig::default());
    let (workspace_id, workbench_id, widget_id) =
        add_jdbc_widget(&service, "JDBC sidecar activation");
    let connector = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace_id.clone(),
            display_name: "Java sidecar mock connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: Some(true),
            status: Some("configured".to_owned()),
            notes: "metadata only".to_owned(),
        })
        .expect("create connector");

    let mut values = sidecar_values(&connector.connector_id);
    values.insert(ENV_JDBC_SIDECAR_JAVA_PROGRAM.to_owned(), "java".to_owned());
    values.insert(
        ENV_JDBC_SIDECAR_CLASSPATH.to_owned(),
        build_dir.to_string_lossy().into_owned(),
    );
    values.insert(
        ENV_JDBC_SIDECAR_MAIN_CLASS.to_owned(),
        SIDECAR_MAIN_CLASS.to_owned(),
    );
    values.insert(
        ENV_JDBC_SIDECAR_WORKING_DIR.to_owned(),
        repo_root.to_string_lossy().into_owned(),
    );

    let config = JdbcRuntimeConfig::from_env_values(&values);
    assert_eq!(config.status().adapter, "sidecar");
    assert_eq!(config.status().status, "sidecar_configured");
    service.set_jdbc_runtime_config_for_tests(config.clone());

    let result = service
        .execute_jdbc_read_only_query(ExecuteJdbcReadOnlyQueryInput {
            workspace_id: workspace_id.clone(),
            workbench_id: workbench_id.clone(),
            widget_instance_id: widget_id.clone(),
            connector_id: connector.connector_id.clone(),
            sql: "select 1".to_owned(),
            row_limit: None,
            timeout_ms: None,
            max_columns: None,
            max_cell_chars: None,
            max_result_bytes: None,
            experimental_sidecar: None,
        })
        .expect("execute sidecar mock query");
    let debug = format!("{config:?} {result:?}");

    assert_eq!(result.status, STATUS_COMPLETED);
    assert_eq!(result.returned_row_count, 3);
    assert!(result
        .columns
        .iter()
        .any(|column| column.name == "runtime_note"));
    assert!(result
        .rows
        .iter()
        .flatten()
        .any(|cell| cell.contains("Java sidecar scaffold")));
    assert!(result.mock_execution);
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(!debug.contains(SECRET_SENTINEL));
    assert!(!debug.contains("password="));
    assert!(!debug.contains("token="));

    let invalid = service
        .execute_jdbc_read_only_query(ExecuteJdbcReadOnlyQueryInput {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            connector_id: connector.connector_id,
            sql: "drop table accounts".to_owned(),
            row_limit: None,
            timeout_ms: None,
            max_columns: None,
            max_cell_chars: None,
            max_result_bytes: None,
            experimental_sidecar: None,
        })
        .expect("reject invalid SQL before sidecar launch");

    assert_eq!(invalid.status, STATUS_VALIDATION_FAILED);
    assert_eq!(
        invalid.sanitized_error.as_deref(),
        Some("SQL did not pass the read-only validator.")
    );
    assert!(invalid.rows.is_empty());
}

fn sidecar_values(connector_id: &str) -> BTreeMap<String, String> {
    BTreeMap::from([
        (ENV_JDBC_RUNTIME_MODE.to_owned(), "sidecar".to_owned()),
        (ENV_JDBC_SIDECAR_ENABLED.to_owned(), "true".to_owned()),
        (
            ENV_JDBC_SIDECAR_CONNECTOR_ID.to_owned(),
            connector_id.to_owned(),
        ),
        (ENV_JDBC_SIDECAR_DRIVER_KIND.to_owned(), "jdbc".to_owned()),
        (
            ENV_JDBC_SIDECAR_RUNTIME_KIND.to_owned(),
            "mock_read_only".to_owned(),
        ),
        (
            ENV_JDBC_SIDECAR_JAVA_PROGRAM.to_owned(),
            "hobit-missing-jdbc-sidecar-java".to_owned(),
        ),
        (
            ENV_JDBC_SIDECAR_CLASSPATH.to_owned(),
            "target/hobit-jdbc-sidecar/classes".to_owned(),
        ),
        (
            ENV_JDBC_SIDECAR_JDBC_URL_PRESENT.to_owned(),
            "true".to_owned(),
        ),
    ])
}

fn adapter_request(
    connector: super::jdbc_runtime::JdbcReadOnlyRuntimeConnector,
) -> JdbcReadOnlyAdapterRequest {
    JdbcReadOnlyAdapterRequest {
        connector,
        sql: "select 1".to_owned(),
        row_limit: 100,
        timeout_ms: 10_000,
        max_columns: 50,
        max_cell_chars: 2_000,
        max_result_bytes: 256 * 1024,
        validation: valid_validation(),
    }
}

fn connector_row(connector_id: &str, driver_kind: &str) -> JdbcConnectorRow {
    JdbcConnectorRow {
        connector_id: connector_id.to_owned(),
        workspace_id: "workspace".to_owned(),
        display_name: "Runtime connector".to_owned(),
        database_kind: "postgres".to_owned(),
        driver_kind: driver_kind.to_owned(),
        jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
        environment: "dev".to_owned(),
        read_only_default: true,
        status: "configured".to_owned(),
        notes: "metadata only".to_owned(),
        created_at: "0".to_owned(),
        updated_at: "0".to_owned(),
        last_used_at: None,
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

fn add_jdbc_widget(service: &WorkspaceService, workspace_name: &str) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace(workspace_name, None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .clone()
        .expect("workspace has workbench");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            JDBC_WIDGET_DEFINITION_ID,
            "Database / JDBC",
            "tool",
        )
        .expect("add JDBC widget")
        .expect("workbench state");
    let widget_id = state.widget_instances.last().expect("widget").id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn initialized_service_with_config(config: JdbcRuntimeConfig) -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new_with_jdbc_runtime_config(store, config)
}

fn compile_java_sidecar_if_jdk_available() -> Option<(PathBuf, PathBuf)> {
    if !command_succeeds("java", &["-version"]) || !command_succeeds("javac", &["-version"]) {
        return None;
    }

    let repo_root = repo_root();
    let source = repo_root
        .join("sidecars")
        .join("jdbc-readonly-sidecar")
        .join("src")
        .join("main")
        .join("java")
        .join("com")
        .join("hobit")
        .join("jdbc")
        .join("JdbcReadOnlySidecar.java");
    let build_dir = repo_root
        .join("target")
        .join("hobit-jdbc-sidecar-rust-activation")
        .join("classes");

    assert!(source.is_file(), "sidecar source must exist");
    fs::create_dir_all(&build_dir).expect("create sidecar activation build directory");
    let output = Command::new("javac")
        .arg("-d")
        .arg(&build_dir)
        .arg(&source)
        .current_dir(&repo_root)
        .output()
        .expect("run javac");

    assert!(
        output.status.success(),
        "javac failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    Some((repo_root, build_dir))
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("hobit-app has parent")
        .parent()
        .expect("crates has parent")
        .to_path_buf()
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
