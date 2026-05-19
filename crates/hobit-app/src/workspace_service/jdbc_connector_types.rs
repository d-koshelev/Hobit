#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateJdbcConnectorInput {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateJdbcConnectorInput {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcConnectorSummary {
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
