use hobit_app::{CreateJdbcConnectorInput, JdbcConnectorSummary, UpdateJdbcConnectorInput};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateJdbcConnectorRequest {
    pub workspace_id: String,
    pub display_name: String,
    pub database_kind: String,
    pub driver_kind: String,
    pub jdbc_url_masked: String,
    pub environment: String,
    pub read_only_default: Option<bool>,
    pub status: Option<String>,
    pub notes: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListJdbcConnectorsRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetJdbcConnectorRequest {
    pub workspace_id: String,
    pub connector_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct UpdateJdbcConnectorRequest {
    pub workspace_id: String,
    pub connector_id: String,
    pub display_name: String,
    pub database_kind: String,
    pub driver_kind: String,
    pub jdbc_url_masked: String,
    pub environment: String,
    pub read_only_default: bool,
    pub status: String,
    pub notes: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct JdbcConnectorDto {
    pub connector_id: String,
    pub workspace_id: String,
    pub display_name: String,
    pub database_kind: String,
    pub driver_kind: String,
    pub jdbc_url_masked: String,
    pub environment: String,
    pub read_only_default: bool,
    pub status: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

impl From<CreateJdbcConnectorRequest> for CreateJdbcConnectorInput {
    fn from(request: CreateJdbcConnectorRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            display_name: request.display_name,
            database_kind: request.database_kind,
            driver_kind: request.driver_kind,
            jdbc_url_masked: request.jdbc_url_masked,
            environment: request.environment,
            read_only_default: request.read_only_default,
            status: request.status,
            notes: request.notes,
        }
    }
}

impl From<UpdateJdbcConnectorRequest> for UpdateJdbcConnectorInput {
    fn from(request: UpdateJdbcConnectorRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            connector_id: request.connector_id,
            display_name: request.display_name,
            database_kind: request.database_kind,
            driver_kind: request.driver_kind,
            jdbc_url_masked: request.jdbc_url_masked,
            environment: request.environment,
            read_only_default: request.read_only_default,
            status: request.status,
            notes: request.notes,
        }
    }
}

impl From<JdbcConnectorSummary> for JdbcConnectorDto {
    fn from(summary: JdbcConnectorSummary) -> Self {
        Self {
            connector_id: summary.connector_id,
            workspace_id: summary.workspace_id,
            display_name: summary.display_name,
            database_kind: summary.database_kind,
            driver_kind: summary.driver_kind,
            jdbc_url_masked: summary.jdbc_url_masked,
            environment: summary.environment,
            read_only_default: summary.read_only_default,
            status: summary.status,
            notes: summary.notes,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
            last_used_at: summary.last_used_at,
        }
    }
}
