use hobit_app::JdbcConnectorSummary;

use crate::jdbc_connector_dto::{
    CreateJdbcConnectorRequest, JdbcConnectorDto, UpdateJdbcConnectorRequest,
};

#[test]
fn maps_create_jdbc_connector_request_to_app_input() {
    let request = CreateJdbcConnectorRequest {
        workspace_id: "ws_1".to_owned(),
        display_name: "Analytics".to_owned(),
        database_kind: "postgres".to_owned(),
        driver_kind: "jdbc".to_owned(),
        jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
        environment: "dev".to_owned(),
        read_only_default: Some(true),
        status: Some("not_configured".to_owned()),
        notes: "metadata only".to_owned(),
    };

    let input: hobit_app::CreateJdbcConnectorInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.display_name, "Analytics");
    assert_eq!(input.database_kind, "postgres");
    assert_eq!(input.driver_kind, "jdbc");
    assert_eq!(
        input.jdbc_url_masked,
        "jdbc:postgresql://db.example.test/app"
    );
    assert_eq!(input.environment, "dev");
    assert_eq!(input.read_only_default, Some(true));
    assert_eq!(input.status.as_deref(), Some("not_configured"));
    assert_eq!(input.notes, "metadata only");
}

#[test]
fn maps_update_jdbc_connector_request_to_app_input() {
    let request = UpdateJdbcConnectorRequest {
        workspace_id: "ws_1".to_owned(),
        connector_id: "jdbc_1".to_owned(),
        display_name: "Updated".to_owned(),
        database_kind: "trino".to_owned(),
        driver_kind: "generic_jdbc".to_owned(),
        jdbc_url_masked: "jdbc:trino://db.example.test:8443/hive".to_owned(),
        environment: "stage".to_owned(),
        read_only_default: false,
        status: "disabled".to_owned(),
        notes: "disabled".to_owned(),
    };

    let input: hobit_app::UpdateJdbcConnectorInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.connector_id, "jdbc_1");
    assert_eq!(input.display_name, "Updated");
    assert_eq!(input.database_kind, "trino");
    assert_eq!(input.driver_kind, "generic_jdbc");
    assert_eq!(
        input.jdbc_url_masked,
        "jdbc:trino://db.example.test:8443/hive"
    );
    assert_eq!(input.environment, "stage");
    assert!(!input.read_only_default);
    assert_eq!(input.status, "disabled");
    assert_eq!(input.notes, "disabled");
}

#[test]
fn maps_jdbc_connector_summary_to_dto() {
    let summary = JdbcConnectorSummary {
        connector_id: "jdbc_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        display_name: "Analytics".to_owned(),
        database_kind: "postgres".to_owned(),
        driver_kind: "jdbc".to_owned(),
        jdbc_url_masked: "jdbc:postgresql://db.example.test/app".to_owned(),
        environment: "dev".to_owned(),
        read_only_default: true,
        status: "not_configured".to_owned(),
        notes: "metadata only".to_owned(),
        created_at: "1".to_owned(),
        updated_at: "2".to_owned(),
        last_used_at: Some("3".to_owned()),
    };

    let dto = JdbcConnectorDto::from(summary);

    assert_eq!(dto.connector_id, "jdbc_1");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.display_name, "Analytics");
    assert_eq!(dto.database_kind, "postgres");
    assert_eq!(dto.driver_kind, "jdbc");
    assert_eq!(dto.jdbc_url_masked, "jdbc:postgresql://db.example.test/app");
    assert_eq!(dto.environment, "dev");
    assert!(dto.read_only_default);
    assert_eq!(dto.status, "not_configured");
    assert_eq!(dto.notes, "metadata only");
    assert_eq!(dto.created_at, "1");
    assert_eq!(dto.updated_at, "2");
    assert_eq!(dto.last_used_at.as_deref(), Some("3"));
}
