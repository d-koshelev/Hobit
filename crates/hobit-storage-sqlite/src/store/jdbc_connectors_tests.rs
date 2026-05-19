use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_connector(
    store: &SqliteStore,
    workspace_id: &str,
    connector_id: &str,
    display_name: &str,
    updated_at: &str,
) {
    store
        .create_jdbc_connector(NewJdbcConnector {
            connector_id,
            workspace_id,
            display_name,
            database_kind: "postgres",
            driver_kind: "jdbc",
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app",
            environment: "dev",
            read_only_default: true,
            status: "not_configured",
            notes: "metadata only",
            created_at: Some(updated_at),
            updated_at: Some(updated_at),
            last_used_at: None,
        })
        .expect("create JDBC connector");
}

#[test]
fn create_jdbc_connector_stores_workspace_scoped_metadata() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let connector = store
        .create_jdbc_connector(NewJdbcConnector {
            connector_id: "jdbc-1",
            workspace_id: "workspace-1",
            display_name: "Analytics readonly",
            database_kind: "vertica",
            driver_kind: "jdbc",
            jdbc_url_masked: "jdbc:vertica://db.example.test:5433/analytics",
            environment: "prod",
            read_only_default: true,
            status: "not_configured",
            notes: "No credentials stored",
            created_at: Some("1"),
            updated_at: Some("2"),
            last_used_at: Some("3"),
        })
        .expect("create JDBC connector");

    assert_eq!(connector.connector_id, "jdbc-1");
    assert_eq!(connector.workspace_id, "workspace-1");
    assert_eq!(connector.display_name, "Analytics readonly");
    assert_eq!(connector.database_kind, "vertica");
    assert_eq!(connector.driver_kind, "jdbc");
    assert_eq!(
        connector.jdbc_url_masked,
        "jdbc:vertica://db.example.test:5433/analytics"
    );
    assert_eq!(connector.environment, "prod");
    assert!(connector.read_only_default);
    assert_eq!(connector.status, "not_configured");
    assert_eq!(connector.notes, "No credentials stored");
    assert_eq!(connector.created_at, "1");
    assert_eq!(connector.updated_at, "2");
    assert_eq!(connector.last_used_at.as_deref(), Some("3"));
}

#[test]
fn list_jdbc_connectors_returns_only_requested_workspace() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_connector(&store, "workspace-1", "jdbc-1", "One", "1");
    create_connector(&store, "workspace-2", "jdbc-2", "Two", "2");

    let connectors = store
        .list_jdbc_connectors("workspace-1")
        .expect("list JDBC connectors");

    assert_eq!(connectors.len(), 1);
    assert_eq!(connectors[0].connector_id, "jdbc-1");
}

#[test]
fn get_jdbc_connector_rejects_cross_workspace_access() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_connector(&store, "workspace-1", "jdbc-1", "One", "1");

    assert!(store
        .get_jdbc_connector("workspace-2", "jdbc-1")
        .expect("get cross-workspace JDBC connector")
        .is_none());
}

#[test]
fn update_jdbc_connector_updates_metadata_and_updated_at() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_connector(&store, "workspace-1", "jdbc-1", "Original", "1");

    let connector = store
        .update_jdbc_connector(
            "workspace-1",
            "jdbc-1",
            JdbcConnectorUpdate {
                display_name: "Updated",
                database_kind: "trino",
                driver_kind: "generic_jdbc",
                jdbc_url_masked: "jdbc:trino://db.example.test:8443/hive",
                environment: "stage",
                read_only_default: false,
                status: "disabled",
                notes: "Disabled until reviewed",
                updated_at: Some("2"),
            },
        )
        .expect("update JDBC connector")
        .expect("updated JDBC connector");

    assert_eq!(connector.display_name, "Updated");
    assert_eq!(connector.database_kind, "trino");
    assert_eq!(connector.driver_kind, "generic_jdbc");
    assert_eq!(
        connector.jdbc_url_masked,
        "jdbc:trino://db.example.test:8443/hive"
    );
    assert_eq!(connector.environment, "stage");
    assert!(!connector.read_only_default);
    assert_eq!(connector.status, "disabled");
    assert_eq!(connector.notes, "Disabled until reviewed");
    assert_eq!(connector.updated_at, "2");
}

#[test]
fn unknown_jdbc_connector_returns_none() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    assert!(store
        .get_jdbc_connector("workspace-1", "missing-jdbc")
        .expect("get unknown JDBC connector")
        .is_none());
    assert!(store
        .update_jdbc_connector(
            "workspace-1",
            "missing-jdbc",
            JdbcConnectorUpdate {
                display_name: "Missing",
                database_kind: "postgres",
                driver_kind: "jdbc",
                jdbc_url_masked: "jdbc:postgresql://db.example.test/app",
                environment: "",
                read_only_default: true,
                status: "not_configured",
                notes: "",
                updated_at: Some("2"),
            },
        )
        .expect("update unknown JDBC connector")
        .is_none());
}

#[test]
fn delete_workspace_deletes_jdbc_connectors_and_preserves_other_workspaces() {
    let store = initialized_store();
    create_workspace(&store, "workspace-delete");
    create_workspace(&store, "workspace-keep");
    create_connector(&store, "workspace-delete", "jdbc-delete", "Delete", "1");
    create_connector(&store, "workspace-keep", "jdbc-keep", "Keep", "2");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_jdbc_connector_by_id("jdbc-delete")
        .expect("get deleted JDBC connector")
        .is_none());
    assert!(store
        .get_jdbc_connector_by_id("jdbc-keep")
        .expect("get kept JDBC connector")
        .is_some());
}

#[test]
fn secret_bearing_jdbc_url_metadata_is_rejected() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let error = store
        .create_jdbc_connector(NewJdbcConnector {
            connector_id: "jdbc-secret",
            workspace_id: "workspace-1",
            display_name: "Secret URL",
            database_kind: "postgres",
            driver_kind: "jdbc",
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app?password=secret",
            environment: "dev",
            read_only_default: true,
            status: "not_configured",
            notes: "",
            created_at: Some("1"),
            updated_at: Some("1"),
            last_used_at: None,
        })
        .expect_err("secret metadata rejected");

    assert!(error.to_string().contains(
        "JDBC connector metadata must not include secrets. Store credentials through a future secret/session mechanism."
    ));
}
