use super::*;

fn service() -> WorkspaceService {
    let store = hobit_storage_sqlite::SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("init schema");
    WorkspaceService::new(store)
}

fn workspace(service: &WorkspaceService) -> String {
    service
        .create_empty_workspace("JDBC profile test", None)
        .expect("create workspace")
        .id
}

fn profile_input(workspace_id: &str) -> CreateJdbcConnectionProfileInput {
    CreateJdbcConnectionProfileInput {
        workspace_id: workspace_id.to_owned(),
        name: "Analytics readonly".to_owned(),
        driver_jar_path: "C:\\drivers\\postgres.jar".to_owned(),
        driver_class_name: "org.postgresql.Driver".to_owned(),
        jdbc_url: "jdbc:postgresql://db.example.test/app".to_owned(),
        username: Some("readonly_user".to_owned()),
        password_env_var_name: Some("HOBIT_READONLY_DB_PASSWORD".to_owned()),
        max_rows: 100,
        timeout_ms: 10_000,
        max_result_bytes: 262_144,
        read_only: Some(true),
        description: Some("Non-secret profile.".to_owned()),
    }
}

#[test]
fn create_list_get_update_and_delete_jdbc_connection_profile() {
    let service = service();
    let workspace_id = workspace(&service);

    let profile = service
        .create_jdbc_connection_profile(profile_input(&workspace_id))
        .expect("create profile");

    assert_eq!(profile.workspace_id, workspace_id);
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

    let listed = service
        .list_jdbc_connection_profiles(&workspace_id)
        .expect("list profiles");
    assert_eq!(listed.len(), 1);

    let fetched = service
        .get_jdbc_connection_profile(&workspace_id, &profile.profile_id)
        .expect("get profile")
        .expect("profile");
    assert_eq!(fetched.profile_id, profile.profile_id);

    let updated = service
        .update_jdbc_connection_profile(UpdateJdbcConnectionProfileInput {
            workspace_id: workspace_id.clone(),
            profile_id: profile.profile_id.clone(),
            name: "Reporting readonly".to_owned(),
            driver_jar_path: "C:\\drivers\\trino.jar".to_owned(),
            driver_class_name: "io.trino.jdbc.TrinoDriver".to_owned(),
            jdbc_url: "jdbc:trino://db.example.test:8443/hive".to_owned(),
            username: None,
            password_env_var_name: None,
            max_rows: 50,
            timeout_ms: 5_000,
            max_result_bytes: 131_072,
            read_only: true,
            description: Some("Updated".to_owned()),
        })
        .expect("update profile")
        .expect("updated profile");

    assert_eq!(updated.name, "Reporting readonly");
    assert_eq!(updated.max_rows, 50);
    assert_eq!(updated.username, None);

    assert!(service
        .delete_jdbc_connection_profile(DeleteJdbcConnectionProfileInput {
            workspace_id: workspace_id.clone(),
            profile_id: profile.profile_id.clone(),
        })
        .expect("delete profile"));
    assert!(service
        .get_jdbc_connection_profile(&workspace_id, &profile.profile_id)
        .expect("get deleted")
        .is_none());
}

#[test]
fn profile_rejects_secret_bearing_url_password_values_and_invalid_caps() {
    let service = service();
    let workspace_id = workspace(&service);

    let mut secret_url = profile_input(&workspace_id);
    secret_url.jdbc_url = "jdbc:postgresql://db.example.test/app?token=secret".to_owned();
    let error = service
        .create_jdbc_connection_profile(secret_url)
        .expect_err("secret URL rejected");
    assert!(error
        .to_string()
        .contains("connection profiles must not include password"));

    let mut password_value = profile_input(&workspace_id);
    password_value.password_env_var_name = Some("value with spaces".to_owned());
    let error = service
        .create_jdbc_connection_profile(password_value)
        .expect_err("password value rejected");
    assert!(error
        .to_string()
        .contains("password environment variable must be an environment variable name"));

    let mut invalid_caps = profile_input(&workspace_id);
    invalid_caps.max_rows = 101;
    let error = service
        .create_jdbc_connection_profile(invalid_caps)
        .expect_err("invalid caps rejected");
    assert!(error
        .to_string()
        .contains("max rows must be between 1 and 100"));
}

#[test]
fn profile_scope_rejects_cross_workspace_access() {
    let service = service();
    let first_workspace = workspace(&service);
    let second_workspace = workspace(&service);
    let profile = service
        .create_jdbc_connection_profile(profile_input(&first_workspace))
        .expect("create profile");

    let error = service
        .get_jdbc_connection_profile(&second_workspace, &profile.profile_id)
        .expect_err("cross-workspace profile rejected");

    assert!(error
        .to_string()
        .contains("JDBC connection profile does not belong to workspace"));
}
