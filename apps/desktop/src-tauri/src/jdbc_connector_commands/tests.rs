use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn jdbc_connector_command_helpers_create_list_get_and_update() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);

    let created = create_jdbc_connector_blocking(
        CreateJdbcConnectorRequest {
            workspace_id: workspace_id.clone(),
            display_name: "Analytics".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "metadata only".to_owned(),
        },
        db_path.clone(),
    )
    .expect("create JDBC connector");

    assert_eq!(created.workspace_id, workspace_id);
    assert_eq!(created.display_name, "Analytics");
    assert_eq!(created.status, "not_configured");
    assert!(created.read_only_default);

    let listed = list_jdbc_connectors_blocking(
        ListJdbcConnectorsRequest {
            workspace_id: workspace_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list JDBC connectors");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].connector_id, created.connector_id);

    let fetched = get_jdbc_connector_blocking(
        GetJdbcConnectorRequest {
            workspace_id: workspace_id.clone(),
            connector_id: created.connector_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get JDBC connector")
    .expect("JDBC connector");
    assert_eq!(fetched, created);

    let updated = update_jdbc_connector_blocking(
        UpdateJdbcConnectorRequest {
            workspace_id,
            connector_id: created.connector_id,
            display_name: "Warehouse".to_owned(),
            database_kind: "trino".to_owned(),
            driver_kind: "generic_jdbc".to_owned(),
            jdbc_url_masked: "jdbc:trino://db.example.test:8443/hive".to_owned(),
            environment: "stage".to_owned(),
            read_only_default: false,
            status: "disabled".to_owned(),
            notes: "disabled".to_owned(),
        },
        db_path.clone(),
    )
    .expect("update JDBC connector")
    .expect("updated JDBC connector");

    assert_eq!(updated.display_name, "Warehouse");
    assert_eq!(updated.database_kind, "trino");
    assert_eq!(updated.driver_kind, "generic_jdbc");
    assert_eq!(updated.status, "disabled");
    assert!(!updated.read_only_default);
    remove_test_db_files(&db_path);
}

#[test]
fn create_jdbc_connector_command_helper_rejects_unknown_workspace() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let error = create_jdbc_connector_blocking(
        CreateJdbcConnectorRequest {
            workspace_id: "missing-workspace".to_owned(),
            display_name: "Analytics".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        },
        db_path.clone(),
    )
    .expect_err("unknown workspace rejected");

    assert!(error.contains("workspace not found: missing-workspace"));
    remove_test_db_files(&db_path);
}

#[test]
fn get_jdbc_connector_command_helper_rejects_cross_workspace_access() {
    let db_path = unique_test_db_path();
    let first_workspace_id = create_workspace_in_test_db(&db_path);
    let second_workspace_id = create_workspace_in_test_db(&db_path);
    let created = create_jdbc_connector_blocking(
        CreateJdbcConnectorRequest {
            workspace_id: first_workspace_id,
            display_name: "Analytics".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        },
        db_path.clone(),
    )
    .expect("create JDBC connector");

    let error = get_jdbc_connector_blocking(
        GetJdbcConnectorRequest {
            workspace_id: second_workspace_id,
            connector_id: created.connector_id,
        },
        db_path.clone(),
    )
    .expect_err("cross-workspace access rejected");

    assert!(error.contains("JDBC connector does not belong to workspace"));
    remove_test_db_files(&db_path);
}

#[test]
fn create_jdbc_connector_command_helper_rejects_secret_metadata() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);

    let error = create_jdbc_connector_blocking(
        CreateJdbcConnectorRequest {
            workspace_id,
            display_name: "Analytics".to_owned(),
            database_kind: "postgres".to_owned(),
            driver_kind: "jdbc".to_owned(),
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app?token=secret".to_owned(),
            environment: "dev".to_owned(),
            read_only_default: None,
            status: None,
            notes: "".to_owned(),
        },
        db_path.clone(),
    )
    .expect_err("secret metadata rejected");

    assert!(error.contains(
        "JDBC connector metadata must not include secrets. Store credentials through a future secret/session mechanism."
    ));
    remove_test_db_files(&db_path);
}

fn create_workspace_in_test_db(db_path: &Path) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("JDBC command test", None)
        .expect("create workspace");
    let workspace_id = workspace.id;
    drop(service);

    workspace_id
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-jdbc-connector-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
