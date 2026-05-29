use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> WorkspaceSummary {
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
}

fn add_widget(
    service: &WorkspaceService,
    workspace: &WorkspaceSummary,
    definition_id: &str,
) -> (String, String, String) {
    let workbench_id = workspace
        .workbench_id
        .clone()
        .expect("created workspace has workbench");
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
    let widget_id = state
        .widget_instances
        .last()
        .expect("added widget")
        .id
        .clone();

    (workspace.id.clone(), workbench_id, widget_id)
}

fn create_connector(service: &WorkspaceService, workspace_id: &str) -> JdbcConnectorSummary {
    service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace_id.to_owned(),
            display_name: "Analytics readonly".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: Some(true),
            status: Some("configured".to_owned()),
            notes: "metadata only".to_owned(),
        })
        .expect("create JDBC connector")
}

fn validate_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
    connector_id: &str,
    sql: &str,
) -> ValidateJdbcReadOnlySqlInput {
    ValidateJdbcReadOnlySqlInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        connector_id: connector_id.to_owned(),
        sql: sql.to_owned(),
        row_limit: None,
        timeout_ms: None,
    }
}

fn execute_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
    connector_id: &str,
    sql: &str,
) -> ExecuteJdbcReadOnlyQueryInput {
    ExecuteJdbcReadOnlyQueryInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        connector_id: connector_id.to_owned(),
        sql: sql.to_owned(),
        row_limit: None,
        timeout_ms: None,
        max_columns: None,
        max_cell_chars: None,
        max_result_bytes: None,
        experimental_sidecar: None,
    }
}

fn experimental_runtime(enabled: bool) -> JdbcExperimentalSidecarRuntimeInput {
    JdbcExperimentalSidecarRuntimeInput {
        enabled,
        java_program: Some("hobit-missing-jdbc-sidecar-java".to_owned()),
        sidecar_jar_path: None,
        sidecar_classpath: Some("target/hobit-jdbc-sidecar/classes".to_owned()),
        sidecar_main_class: Some("com.hobit.jdbc.JdbcReadOnlySidecar".to_owned()),
        driver_jar_path: "target/test-driver.jar".to_owned(),
        driver_class_name: Some("org.example.Driver".to_owned()),
        jdbc_url: "jdbc:example://localhost/app".to_owned(),
        username: Some("readonly_user".to_owned()),
        credential_env_var_name: Some("HOBIT_TEST_DB_CREDENTIAL".to_owned()),
        max_rows: Some(100),
        timeout_ms: Some(10_000),
        max_result_bytes: Some(256 * 1024),
    }
}

#[test]
fn validator_accepts_first_slice_read_only_statements() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let cases = [
        ("select * from orders", "SELECT"),
        (
            "with recent as (select * from orders) select * from recent",
            "WITH",
        ),
        ("show tables", "SHOW"),
        ("describe orders", "DESCRIBE"),
        ("explain select * from orders", "EXPLAIN"),
        ("-- leading comment\nselect 1;", "SELECT"),
    ];

    for (sql, statement_kind) in cases {
        let validation = service
            .validate_jdbc_read_only_sql(validate_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                &connector.connector_id,
                sql,
            ))
            .expect("validate SQL");

        assert!(validation.is_valid, "{sql}");
        assert_eq!(validation.statement_kind.as_deref(), Some(statement_kind));
        assert!(validation.rejection_reason.is_none());
    }
}

#[test]
fn validator_rejects_mutation_session_multi_statement_ambiguous_and_empty_sql() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let rejected = [
        "insert into orders values (1)",
        "update orders set status = 'done'",
        "delete from orders",
        "drop table orders",
        "alter table orders add column x int",
        "create table orders(id int)",
        "truncate table orders",
        "merge into orders using updates on true",
        "copy orders to '/tmp/orders.csv'",
        "grant select on orders to analyst",
        "revoke select on orders from analyst",
        "call refresh_orders()",
        "exec refresh_orders",
        "execute refresh_orders",
        "set search_path = public",
        "use analytics",
        "begin",
        "commit",
        "rollback",
        "vacuum",
        "analyze orders",
        "pragma table_info(orders)",
        "select * from orders; select * from users",
        "explain analyze select * from orders",
        "  ",
    ];

    for sql in rejected {
        let validation = service
            .validate_jdbc_read_only_sql(validate_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                &connector.connector_id,
                sql,
            ))
            .expect("validate SQL");

        assert!(!validation.is_valid, "{sql}");
        assert!(validation.rejection_reason.is_some(), "{sql}");
    }
}

#[test]
fn experimental_sidecar_guard_allows_only_select_and_with_before_process_launch() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC sidecar guard");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    for sql in [
        "select * from orders",
        "with recent as (select * from orders) select * from recent",
    ] {
        let mut request = execute_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            &connector.connector_id,
            sql,
        );
        request.experimental_sidecar = Some(experimental_runtime(true));

        let result = service
            .execute_jdbc_read_only_query(request)
            .expect("execute experimental guarded query");

        assert_eq!(result.status, "not_configured", "{sql}");
        assert!(result.validation.is_valid, "{sql}");
        assert!(!result.mock_execution, "{sql}");
    }

    for sql in [
        "show tables",
        "describe orders",
        "explain select * from orders",
        "insert into orders values (1)",
        "update orders set status = 'done'",
        "delete from orders",
        "merge into orders using updates on true",
        "create table orders(id int)",
        "alter table orders add column x int",
        "drop table orders",
        "truncate table orders",
        "grant select on orders to analyst",
        "revoke select on orders from analyst",
        "call refresh_orders()",
        "exec refresh_orders",
        "copy orders to '/tmp/orders.csv'",
        "load data infile '/tmp/orders.csv'",
        "export table orders",
        "select * from orders; select * from users",
    ] {
        let mut request = execute_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            &connector.connector_id,
            sql,
        );
        request.experimental_sidecar = Some(experimental_runtime(true));

        let result = service
            .execute_jdbc_read_only_query(request)
            .expect("reject experimental guarded query");

        assert_eq!(result.status, "validation_failed", "{sql}");
        assert!(result.sanitized_error.is_some(), "{sql}");
        assert!(result.rows.is_empty(), "{sql}");
    }
}

#[test]
fn disabled_experimental_sidecar_config_keeps_mock_default_path() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC sidecar disabled");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);
    let mut request = execute_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        &connector.connector_id,
        "select 1",
    );
    request.experimental_sidecar = Some(experimental_runtime(false));

    let result = service
        .execute_jdbc_read_only_query(request)
        .expect("execute disabled experimental config");

    assert_eq!(result.status, "completed");
    assert!(result.mock_execution);
}

#[test]
fn mock_execution_returns_bounded_deterministic_result_for_valid_sql() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let result = service
        .execute_jdbc_read_only_query(execute_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            &connector.connector_id,
            "select * from orders",
        ))
        .expect("execute mock query");

    assert_eq!(result.status, "completed");
    assert_eq!(result.connector_id, connector.connector_id);
    assert_eq!(
        result.connector_display_name.as_deref(),
        Some("Analytics readonly")
    );
    assert_eq!(result.statement_kind.as_deref(), Some("SELECT"));
    assert_eq!(result.row_count, 3);
    assert_eq!(result.returned_row_count, 3);
    assert_eq!(result.row_limit, 100);
    assert_eq!(result.columns.len(), 4);
    assert_eq!(result.rows.len(), 3);
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
    assert!(result.mock_execution);
}

#[test]
fn mock_execution_enforces_row_column_cell_and_byte_caps() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);
    let long_sql = format!("select '{}' as long_value", "x".repeat(300));

    let mut request = execute_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        &connector.connector_id,
        &long_sql,
    );
    request.row_limit = Some(1);
    request.max_columns = Some(3);
    request.max_cell_chars = Some(12);
    request.max_result_bytes = Some(64);

    let result = service
        .execute_jdbc_read_only_query(request)
        .expect("execute capped mock query");

    assert_eq!(result.status, "completed");
    assert!(result.returned_row_count <= 1);
    assert!(result.columns.len() <= 3);
    assert!(result
        .rows
        .iter()
        .flatten()
        .all(|cell| cell.chars().count() <= 12));
    assert!(result.truncated);
    assert!(result.truncated_rows);
    assert!(result.truncated_columns);
    assert!(result.truncated_cells || result.truncated_bytes);
}

#[test]
fn invalid_sql_returns_sanitized_failed_result_without_execution_success() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let result = service
        .execute_jdbc_read_only_query(execute_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            &connector.connector_id,
            "drop table orders",
        ))
        .expect("execute invalid SQL");

    assert_eq!(result.status, "validation_failed");
    assert!(!result.validation.is_valid);
    assert_eq!(result.rows.len(), 0);
    assert_eq!(
        result.sanitized_error.as_deref(),
        Some("SQL did not pass the read-only validator.")
    );
}

#[test]
fn execution_rejects_non_jdbc_unknown_and_cross_scope_widget_owners() {
    let service = initialized_service();
    let first = create_workspace(&service, "First");
    let second = create_workspace(&service, "Second");
    let (workspace_id, workbench_id, jdbc_widget_id) =
        add_widget(&service, &first, JDBC_WIDGET_DEFINITION_ID);
    let (_workspace_id, _workbench_id, terminal_widget_id) =
        add_widget(&service, &first, TERMINAL_WIDGET_DEFINITION_ID);
    let (second_workspace_id, second_workbench_id, _second_widget_id) =
        add_widget(&service, &second, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let non_jdbc_error = service
        .execute_jdbc_read_only_query(execute_input(
            &workspace_id,
            &workbench_id,
            &terminal_widget_id,
            &connector.connector_id,
            "select 1",
        ))
        .expect_err("non-JDBC owner rejected");
    assert!(non_jdbc_error
        .to_string()
        .contains("requires a Database / JDBC widget owner"));

    let unknown_error = service
        .execute_jdbc_read_only_query(execute_input(
            &workspace_id,
            &workbench_id,
            "missing-widget",
            &connector.connector_id,
            "select 1",
        ))
        .expect_err("unknown owner rejected");
    assert!(unknown_error
        .to_string()
        .contains("JDBC query widget owner not found"));

    let cross_scope_error = service
        .execute_jdbc_read_only_query(execute_input(
            &second_workspace_id,
            &second_workbench_id,
            &jdbc_widget_id,
            &connector.connector_id,
            "select 1",
        ))
        .expect_err("cross-scope owner rejected");
    assert!(cross_scope_error
        .to_string()
        .contains("JDBC query widget owner not found"));
}

#[test]
fn execution_rejects_cross_workspace_connector_and_reports_unknown_connector() {
    let service = initialized_service();
    let first = create_workspace(&service, "First");
    let second = create_workspace(&service, "Second");
    let (workspace_id, _workbench_id, _widget_id) =
        add_widget(&service, &first, JDBC_WIDGET_DEFINITION_ID);
    let (second_workspace_id, second_workbench_id, second_widget_id) =
        add_widget(&service, &second, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let cross_connector_error = service
        .execute_jdbc_read_only_query(execute_input(
            &second_workspace_id,
            &second_workbench_id,
            &second_widget_id,
            &connector.connector_id,
            "select 1",
        ))
        .expect_err("cross-workspace connector rejected");
    assert!(cross_connector_error
        .to_string()
        .contains("JDBC connector does not belong to workspace"));

    let unknown_connector = service
        .execute_jdbc_read_only_query(execute_input(
            &second_workspace_id,
            &second_workbench_id,
            &second_widget_id,
            "missing-connector",
            "select 1",
        ))
        .expect("unknown connector produces structured status");
    assert_eq!(unknown_connector.status, "not_configured");
    assert!(unknown_connector.rows.is_empty());
    assert_eq!(
        unknown_connector.sanitized_error.as_deref(),
        Some("JDBC connector is not configured for read-only execution.")
    );
}

#[test]
fn coordinator_widget_cannot_execute_sql() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Coordinator boundary");
    let (workspace_id, workbench_id, coordinator_widget_id) =
        add_widget(&service, &workspace, COORDINATOR_CHAT_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);

    let error = service
        .execute_jdbc_read_only_query(execute_input(
            &workspace_id,
            &workbench_id,
            &coordinator_widget_id,
            &connector.connector_id,
            "select 1",
        ))
        .expect_err("Coordinator cannot execute SQL");

    assert!(error
        .to_string()
        .contains("requires a Database / JDBC widget owner"));
}

#[test]
fn secret_looking_values_are_not_returned_in_errors_or_mock_rows() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Secret boundary");
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, &workspace, JDBC_WIDGET_DEFINITION_ID);
    let connector = create_connector(&service, &workspace_id);
    let secret_value = "sk-secret-jdbc-query-test-value";

    let result = service
        .execute_jdbc_read_only_query(execute_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            &connector.connector_id,
            &format!("select '{secret_value}' as token"),
        ))
        .expect("execute mock query");
    let serialized = format!("{result:?}");

    assert!(!serialized.contains(secret_value));
    assert!(result.no_secrets_returned);
    assert!(result.no_ai_context_shared);
}
