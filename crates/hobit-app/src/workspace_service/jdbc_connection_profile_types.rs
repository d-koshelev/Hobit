#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateJdbcConnectionProfileInput {
    pub workspace_id: String,
    pub name: String,
    pub driver_jar_path: String,
    pub driver_class_name: String,
    pub jdbc_url: String,
    pub username: Option<String>,
    pub password_env_var_name: Option<String>,
    pub max_rows: usize,
    pub timeout_ms: u64,
    pub max_result_bytes: usize,
    pub read_only: Option<bool>,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateJdbcConnectionProfileInput {
    pub workspace_id: String,
    pub profile_id: String,
    pub name: String,
    pub driver_jar_path: String,
    pub driver_class_name: String,
    pub jdbc_url: String,
    pub username: Option<String>,
    pub password_env_var_name: Option<String>,
    pub max_rows: usize,
    pub timeout_ms: u64,
    pub max_result_bytes: usize,
    pub read_only: bool,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeleteJdbcConnectionProfileInput {
    pub workspace_id: String,
    pub profile_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcConnectionProfileSummary {
    pub profile_id: String,
    pub workspace_id: String,
    pub name: String,
    pub driver_jar_path: String,
    pub driver_class_name: String,
    pub jdbc_url: String,
    pub username: Option<String>,
    pub password_env_var_name: Option<String>,
    pub max_rows: usize,
    pub timeout_ms: u64,
    pub max_result_bytes: usize,
    pub read_only: bool,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}
