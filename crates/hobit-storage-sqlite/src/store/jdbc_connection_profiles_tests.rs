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

fn profile_input<'a>(
    workspace_id: &'a str,
    profile_id: &'a str,
    name: &'a str,
) -> NewJdbcConnectionProfile<'a> {
    NewJdbcConnectionProfile {
        profile_id,
        workspace_id,
        name,
        driver_jar_path: "C:\\drivers\\postgres.jar",
        driver_class_name: "org.postgresql.Driver",
        jdbc_url: "jdbc:postgresql://db.example.test/app",
        username: Some("readonly_user"),
        password_env_var_name: Some("HOBIT_READONLY_DB_PASSWORD"),
        max_rows: 100,
        timeout_ms: 10_000,
        max_result_bytes: 262_144,
        read_only: true,
        description: "Non-secret experimental sidecar profile.",
        created_at: Some("1"),
        updated_at: Some("1"),
    }
}

#[test]
fn create_list_update_and_delete_jdbc_connection_profile() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let profile = store
        .create_jdbc_connection_profile(profile_input(
            "workspace-1",
            "profile-1",
            "Analytics readonly",
        ))
        .expect("create JDBC profile");

    assert_eq!(profile.profile_id, "profile-1");
    assert_eq!(profile.workspace_id, "workspace-1");
    assert_eq!(profile.name, "Analytics readonly");
    assert_eq!(profile.driver_jar_path, "C:\\drivers\\postgres.jar");
    assert_eq!(profile.driver_class_name, "org.postgresql.Driver");
    assert_eq!(profile.jdbc_url, "jdbc:postgresql://db.example.test/app");
    assert_eq!(profile.username.as_deref(), Some("readonly_user"));
    assert_eq!(
        profile.password_env_var_name.as_deref(),
        Some("HOBIT_READONLY_DB_PASSWORD")
    );
    assert!(profile.read_only);

    let listed = store
        .list_jdbc_connection_profiles("workspace-1")
        .expect("list profiles");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].profile_id, "profile-1");

    let updated = store
        .update_jdbc_connection_profile(
            "workspace-1",
            "profile-1",
            JdbcConnectionProfileUpdate {
                name: "Updated",
                driver_jar_path: "C:\\drivers\\trino.jar",
                driver_class_name: "io.trino.jdbc.TrinoDriver",
                jdbc_url: "jdbc:trino://db.example.test:8443/hive",
                username: None,
                password_env_var_name: None,
                max_rows: 50,
                timeout_ms: 5_000,
                max_result_bytes: 131_072,
                read_only: true,
                description: "Updated profile",
                updated_at: Some("2"),
            },
        )
        .expect("update profile")
        .expect("updated profile");

    assert_eq!(updated.name, "Updated");
    assert_eq!(updated.max_rows, 50);
    assert_eq!(updated.username, None);
    assert_eq!(updated.updated_at, "2");

    assert!(store
        .delete_jdbc_connection_profile("workspace-1", "profile-1")
        .expect("delete profile"));
    assert!(store
        .get_jdbc_connection_profile("workspace-1", "profile-1")
        .expect("get deleted profile")
        .is_none());
}

#[test]
fn list_jdbc_connection_profiles_is_workspace_scoped() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");

    store
        .create_jdbc_connection_profile(profile_input("workspace-1", "profile-1", "One"))
        .expect("create first profile");
    store
        .create_jdbc_connection_profile(profile_input("workspace-2", "profile-2", "Two"))
        .expect("create second profile");

    let profiles = store
        .list_jdbc_connection_profiles("workspace-1")
        .expect("list workspace profiles");

    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].profile_id, "profile-1");
}

#[test]
fn secret_bearing_jdbc_profile_url_and_password_value_names_are_rejected() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let mut secret_url = profile_input("workspace-1", "profile-secret", "Secret");
    secret_url.jdbc_url = "jdbc:postgresql://db.example.test/app?password=secret";
    let error = store
        .create_jdbc_connection_profile(secret_url)
        .expect_err("secret URL rejected");
    assert!(error
        .to_string()
        .contains("JDBC connection profiles must not include password"));

    let mut password_value = profile_input("workspace-1", "profile-password", "Password");
    password_value.password_env_var_name = Some("not an env var value");
    let error = store
        .create_jdbc_connection_profile(password_value)
        .expect_err("password value rejected");
    assert!(error
        .to_string()
        .contains("password environment variable must be an environment variable name"));
}

#[test]
fn delete_workspace_deletes_jdbc_connection_profiles() {
    let store = initialized_store();
    create_workspace(&store, "workspace-delete");
    create_workspace(&store, "workspace-keep");
    store
        .create_jdbc_connection_profile(profile_input(
            "workspace-delete",
            "profile-delete",
            "Delete",
        ))
        .expect("create deleted profile");
    store
        .create_jdbc_connection_profile(profile_input("workspace-keep", "profile-keep", "Keep"))
        .expect("create kept profile");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_jdbc_connection_profile_by_id("profile-delete")
        .expect("get deleted profile")
        .is_none());
    assert!(store
        .get_jdbc_connection_profile_by_id("profile-keep")
        .expect("get kept profile")
        .is_some());
}
