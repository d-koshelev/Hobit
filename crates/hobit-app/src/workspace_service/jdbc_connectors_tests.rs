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

fn create_connector(service: &WorkspaceService, workspace_id: &str) -> JdbcConnectorSummary {
    service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace_id.to_owned(),
            display_name: "Analytics readonly".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "metadata only".to_owned(),
        })
        .expect("create JDBC connector")
}

#[test]
fn create_list_get_and_update_jdbc_connector() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");

    let connector = create_connector(&service, &workspace.id);

    assert_eq!(connector.workspace_id, workspace.id);
    assert_eq!(connector.display_name, "Analytics readonly");
    assert_eq!(connector.database_kind, "postgres");
    assert_eq!(connector.driver_kind, "jdbc");
    assert_eq!(
        connector.jdbc_url_masked,
        "jdbc:postgresql://db.example.test/app"
    );
    assert_eq!(connector.environment, "dev");
    assert!(connector.read_only_default);
    assert_eq!(connector.status, "not_configured");
    assert_eq!(connector.notes, "metadata only");
    assert_eq!(connector.created_at, connector.updated_at);
    assert_eq!(connector.last_used_at, None);

    let listed = service
        .list_jdbc_connectors(&workspace.id)
        .expect("list JDBC connectors");
    assert_eq!(listed, vec![connector.clone()]);

    let fetched = service
        .get_jdbc_connector(&workspace.id, &connector.connector_id)
        .expect("get JDBC connector")
        .expect("JDBC connector");
    assert_eq!(fetched, connector);

    std::thread::sleep(std::time::Duration::from_millis(1));

    let updated = service
        .update_jdbc_connector(UpdateJdbcConnectorInput {
            workspace_id: workspace.id,
            connector_id: connector.connector_id,
            display_name: "Warehouse".to_owned(),
            database_kind: "trino".to_owned(),
            driver_kind: "generic_jdbc".to_owned(),
            jdbc_url_masked: "jdbc:trino://db.example.test:8443/hive".to_owned(),
            environment: "stage".to_owned(),
            read_only_default: false,
            status: "disabled".to_owned(),
            notes: "Disabled until reviewed".to_owned(),
        })
        .expect("update JDBC connector")
        .expect("updated JDBC connector");

    assert_eq!(updated.display_name, "Warehouse");
    assert_eq!(updated.database_kind, "trino");
    assert_eq!(updated.driver_kind, "generic_jdbc");
    assert_eq!(
        updated.jdbc_url_masked,
        "jdbc:trino://db.example.test:8443/hive"
    );
    assert_eq!(updated.environment, "stage");
    assert!(!updated.read_only_default);
    assert_eq!(updated.status, "disabled");
    assert_eq!(updated.notes, "Disabled until reviewed");
    assert_ne!(updated.updated_at, fetched.updated_at);
}

#[test]
fn create_jdbc_connector_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: "missing-workspace".to_owned(),
            display_name: "Connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        })
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn list_jdbc_connectors_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .list_jdbc_connectors("missing-workspace")
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn get_and_update_jdbc_connector_reject_cross_workspace_access() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let connector = create_connector(&service, &first.id);

    let get_error = service
        .get_jdbc_connector(&second.id, &connector.connector_id)
        .expect_err("cross-workspace get rejected");
    assert!(get_error
        .to_string()
        .contains("JDBC connector does not belong to workspace"));

    let update_error = service
        .update_jdbc_connector(UpdateJdbcConnectorInput {
            workspace_id: second.id,
            connector_id: connector.connector_id,
            display_name: "Other".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/other".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: true,
            status: "not_configured".to_owned(),
            notes: "".to_owned(),
        })
        .expect_err("cross-workspace update rejected");
    assert!(update_error
        .to_string()
        .contains("JDBC connector does not belong to workspace"));
}

#[test]
fn get_and_update_unknown_jdbc_connector_returns_none() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");

    assert!(service
        .get_jdbc_connector(&workspace.id, "missing-jdbc")
        .expect("get unknown JDBC connector")
        .is_none());
    assert!(service
        .update_jdbc_connector(UpdateJdbcConnectorInput {
            workspace_id: workspace.id,
            connector_id: "missing-jdbc".to_owned(),
            display_name: "Missing".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: true,
            status: "not_configured".to_owned(),
            notes: "".to_owned(),
        })
        .expect("update unknown JDBC connector")
        .is_none());
}

#[test]
fn create_jdbc_connector_rejects_empty_display_name_invalid_kind_and_secret_url() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");

    let empty_name = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace.id.clone(),
            display_name: "  ".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        })
        .expect_err("empty display name rejected");
    assert!(empty_name
        .to_string()
        .contains("JDBC connector display name must not be empty"));

    let invalid_kind = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace.id.clone(),
            display_name: "Connector".to_owned(),
            database_kind: "oracle".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:oracle://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        })
        .expect_err("invalid database kind rejected");
    assert!(invalid_kind
        .to_string()
        .contains("unsupported JDBC database kind: oracle"));

    let secret_url = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace.id,
            display_name: "Connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app;password=secret".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        })
        .expect_err("secret metadata rejected");
    assert!(secret_url.to_string().contains(
        "JDBC connector metadata must not include secrets. Store credentials through a future secret/session mechanism."
    ));
}

#[test]
fn create_jdbc_connector_rejects_invalid_driver_and_status() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "JDBC workspace");

    let invalid_driver = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace.id.clone(),
            display_name: "Connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "native".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        })
        .expect_err("invalid driver kind rejected");
    assert!(invalid_driver
        .to_string()
        .contains("unsupported JDBC driver kind: native"));

    let invalid_status = service
        .create_jdbc_connector(CreateJdbcConnectorInput {
            workspace_id: workspace.id,
            display_name: "Connector".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: Some("connected".to_owned()),
            notes: "".to_owned(),
        })
        .expect_err("invalid status rejected");
    assert!(invalid_status
        .to_string()
        .contains("unsupported JDBC connector status: connected"));
}
