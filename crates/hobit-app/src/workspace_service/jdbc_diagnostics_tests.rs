use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn add_jdbc_widget(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("JDBC diagnostics", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.clone().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            JDBC_WIDGET_DEFINITION_ID,
            "Database / JDBC",
            "tool",
        )
        .expect("add widget")
        .expect("workbench state");
    let widget_id = state.widget_instances.last().expect("widget").id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn runtime_input() -> JdbcExperimentalSidecarRuntimeInput {
    JdbcExperimentalSidecarRuntimeInput {
        enabled: true,
        java_program: Some("hobit-missing-jdbc-diagnostic-java".to_owned()),
        sidecar_jar_path: None,
        sidecar_classpath: Some("target/hobit-jdbc-sidecar/classes".to_owned()),
        sidecar_main_class: Some("com.hobit.jdbc.JdbcReadOnlySidecar".to_owned()),
        driver_jar_path: "target/test-driver.jar".to_owned(),
        driver_class_name: Some("org.example.Driver".to_owned()),
        jdbc_url: "jdbc:example://localhost/app".to_owned(),
        username: Some("readonly_user".to_owned()),
        credential_env_var_name: Some("HOBIT_TEST_DB_PASSWORD".to_owned()),
        max_rows: Some(100),
        timeout_ms: Some(100),
        max_result_bytes: Some(256 * 1024),
    }
}

#[test]
fn sidecar_health_diagnostic_is_explicit_and_maps_missing_java_to_readable_error() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_jdbc_widget(&service);

    let result = service
        .check_jdbc_sidecar_health(CheckJdbcSidecarHealthInput {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            experimental_sidecar: runtime_input(),
        })
        .expect("health diagnostic");

    assert_eq!(result.action, "health_check");
    assert!(!result.ok);
    assert_eq!(result.status, "not_configured");
    assert!(result.message.contains("Java executable"));
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert_no_secrets(&format!("{result:?}"));
}

#[test]
fn driver_probe_diagnostic_rejects_missing_driver_path_without_sql() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_jdbc_widget(&service);
    let mut runtime = runtime_input();
    runtime.driver_jar_path = "   ".to_owned();

    let result = service
        .probe_jdbc_driver(ProbeJdbcDriverInput {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            experimental_sidecar: runtime,
        })
        .expect("driver probe diagnostic");

    assert_eq!(result.action, "driver_probe");
    assert!(!result.ok);
    assert_eq!(result.status, "not_configured");
    assert!(result.message.contains("driver JAR path"));
    assert_no_secrets(&format!("{result:?}"));
}

#[test]
fn diagnostics_reject_workspace_agent_widget_owner() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("JDBC diagnostics owner", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.clone().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            COORDINATOR_CHAT_WIDGET_DEFINITION_ID,
            "Workspace Agent",
            "core",
        )
        .expect("add widget")
        .expect("workbench state");
    let widget_id = state.widget_instances.last().expect("widget").id.clone();

    let error = service
        .check_jdbc_sidecar_health(CheckJdbcSidecarHealthInput {
            workspace_id: workspace.id,
            workbench_id,
            widget_instance_id: widget_id,
            experimental_sidecar: runtime_input(),
        })
        .expect_err("Workspace Agent cannot run diagnostics");

    assert!(error
        .to_string()
        .contains("requires a Database / JDBC widget owner"));
}

#[test]
fn diagnostics_reject_secret_bearing_jdbc_url_params_without_serializing_them() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_jdbc_widget(&service);
    let mut runtime = runtime_input();
    runtime.jdbc_url = "jdbc:example://localhost/app?password=must-redact".to_owned();

    let result = service
        .check_jdbc_sidecar_health(CheckJdbcSidecarHealthInput {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
            experimental_sidecar: runtime,
        })
        .expect("health diagnostic");

    assert!(!result.ok);
    assert_eq!(result.status, "not_configured");
    assert!(result.message.contains("must not contain password"));
    assert_no_secrets(&format!("{result:?}"));
}

fn assert_no_secrets(value: &str) {
    for secret in [
        "must-redact",
        "password=must-redact",
        "readonly_user",
        "HOBIT_TEST_DB_PASSWORD",
        "secretValue",
        "\"password\"",
        "\"token\"",
    ] {
        assert!(!value.contains(secret), "{secret} leaked in {value}");
    }
}
