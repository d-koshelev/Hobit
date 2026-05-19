use hobit_storage_sqlite::{JdbcConnectorUpdate, NewJdbcConnector};

use crate::WorkspaceServiceError;

use super::{
    mapping::jdbc_connector_summary, placeholder_id, placeholder_timestamp,
    validation::required_input, CreateJdbcConnectorInput, JdbcConnectorSummary,
    UpdateJdbcConnectorInput, WorkspaceService,
};

const JDBC_DATABASE_KIND_VERTICA: &str = "vertica";
const JDBC_DATABASE_KIND_POSTGRES: &str = "postgres";
const JDBC_DATABASE_KIND_TRINO: &str = "trino";
const JDBC_DATABASE_KIND_MYSQL: &str = "mysql";
const JDBC_DATABASE_KIND_GENERIC: &str = "generic_jdbc";
const JDBC_DRIVER_KIND_JDBC: &str = "jdbc";
const JDBC_DRIVER_KIND_GENERIC: &str = "generic_jdbc";
const JDBC_STATUS_NOT_CONFIGURED: &str = "not_configured";
const JDBC_STATUS_CONFIGURED: &str = "configured";
const JDBC_STATUS_DISABLED: &str = "disabled";
const JDBC_STATUS_ERROR: &str = "error";
const JDBC_SECRET_METADATA_ERROR: &str = "JDBC connector metadata must not include secrets. Store credentials through a future secret/session mechanism.";
const SECRET_PARAMETER_PATTERNS: &[&str] = &[
    "password=",
    "passwd=",
    "pwd=",
    "token=",
    "access_token=",
    "secret=",
    "api_key=",
    "apikey=",
    "private_key=",
];

impl WorkspaceService {
    pub fn create_jdbc_connector(
        &self,
        input: CreateJdbcConnectorInput,
    ) -> Result<JdbcConnectorSummary, WorkspaceServiceError> {
        let input = normalize_create_jdbc_connector_input(input)?;
        let connector_id = placeholder_id("jdbc_connector_");
        let created_at = placeholder_timestamp();

        let connector = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("workspace not found: {}", input.workspace_id),
                    ));
                }

                let connector = store.create_jdbc_connector(NewJdbcConnector {
                    connector_id: &connector_id,
                    workspace_id: &input.workspace_id,
                    display_name: &input.display_name,
                    database_kind: &input.database_kind,
                    driver_kind: &input.driver_kind,
                    jdbc_url_masked: &input.jdbc_url_masked,
                    environment: &input.environment,
                    read_only_default: input.read_only_default,
                    status: &input.status,
                    notes: &input.notes,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                    last_used_at: None,
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(connector)
            })
            .map_err(map_storage_jdbc_connector_error)?;

        Ok(jdbc_connector_summary(connector))
    }

    pub fn list_jdbc_connectors(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<JdbcConnectorSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        Ok(self
            .store
            .list_jdbc_connectors(workspace_id)?
            .into_iter()
            .map(jdbc_connector_summary)
            .collect())
    }

    pub fn get_jdbc_connector(
        &self,
        workspace_id: &str,
        connector_id: &str,
    ) -> Result<Option<JdbcConnectorSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let connector_id = required_input(connector_id, "JDBC connector id")?;

        self.validate_jdbc_connector_workspace_access(workspace_id, connector_id)?;
        Ok(self
            .store
            .get_jdbc_connector(workspace_id, connector_id)?
            .map(jdbc_connector_summary))
    }

    pub fn update_jdbc_connector(
        &self,
        input: UpdateJdbcConnectorInput,
    ) -> Result<Option<JdbcConnectorSummary>, WorkspaceServiceError> {
        let input = normalize_update_jdbc_connector_input(input)?;
        self.validate_jdbc_connector_workspace_access(&input.workspace_id, &input.connector_id)?;

        let updated_at = placeholder_timestamp();
        let connector = self.store.with_immediate_transaction(|store| {
            let connector = store.update_jdbc_connector(
                &input.workspace_id,
                &input.connector_id,
                JdbcConnectorUpdate {
                    display_name: &input.display_name,
                    database_kind: &input.database_kind,
                    driver_kind: &input.driver_kind,
                    jdbc_url_masked: &input.jdbc_url_masked,
                    environment: &input.environment,
                    read_only_default: input.read_only_default,
                    status: &input.status,
                    notes: &input.notes,
                    updated_at: Some(&updated_at),
                },
            )?;
            if connector.is_some() {
                store.touch_workspace(&input.workspace_id)?;
            }
            Ok(connector)
        })?;

        Ok(connector.map(jdbc_connector_summary))
    }

    fn validate_jdbc_connector_workspace_access(
        &self,
        workspace_id: &str,
        connector_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(connector) = self.store.get_jdbc_connector_by_id(connector_id)? else {
            return Ok(());
        };

        if connector.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "JDBC connector does not belong to workspace: {connector_id}"
            )));
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedCreateJdbcConnectorInput {
    workspace_id: String,
    display_name: String,
    database_kind: String,
    driver_kind: String,
    jdbc_url_masked: String,
    environment: String,
    read_only_default: bool,
    status: String,
    notes: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedUpdateJdbcConnectorInput {
    workspace_id: String,
    connector_id: String,
    display_name: String,
    database_kind: String,
    driver_kind: String,
    jdbc_url_masked: String,
    environment: String,
    read_only_default: bool,
    status: String,
    notes: String,
}

fn normalize_create_jdbc_connector_input(
    input: CreateJdbcConnectorInput,
) -> Result<NormalizedCreateJdbcConnectorInput, WorkspaceServiceError> {
    Ok(NormalizedCreateJdbcConnectorInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        display_name: required_owned(input.display_name, "JDBC connector display name")?,
        database_kind: normalize_database_kind(input.database_kind)?,
        driver_kind: normalize_driver_kind(input.driver_kind)?,
        jdbc_url_masked: normalize_jdbc_url_masked(input.jdbc_url_masked)?,
        environment: input.environment.trim().to_owned(),
        read_only_default: input.read_only_default.unwrap_or(true),
        status: normalize_optional_status(input.status)?,
        notes: input.notes.trim().to_owned(),
    })
}

fn normalize_update_jdbc_connector_input(
    input: UpdateJdbcConnectorInput,
) -> Result<NormalizedUpdateJdbcConnectorInput, WorkspaceServiceError> {
    Ok(NormalizedUpdateJdbcConnectorInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        connector_id: required_owned(input.connector_id, "JDBC connector id")?,
        display_name: required_owned(input.display_name, "JDBC connector display name")?,
        database_kind: normalize_database_kind(input.database_kind)?,
        driver_kind: normalize_driver_kind(input.driver_kind)?,
        jdbc_url_masked: normalize_jdbc_url_masked(input.jdbc_url_masked)?,
        environment: input.environment.trim().to_owned(),
        read_only_default: input.read_only_default,
        status: normalize_status(input.status)?,
        notes: input.notes.trim().to_owned(),
    })
}

fn normalize_database_kind(kind: String) -> Result<String, WorkspaceServiceError> {
    let kind = required_owned(kind, "JDBC database kind")?;
    match kind.as_str() {
        JDBC_DATABASE_KIND_VERTICA
        | JDBC_DATABASE_KIND_POSTGRES
        | JDBC_DATABASE_KIND_TRINO
        | JDBC_DATABASE_KIND_MYSQL
        | JDBC_DATABASE_KIND_GENERIC => Ok(kind),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported JDBC database kind: {kind}"
        ))),
    }
}

fn normalize_driver_kind(kind: String) -> Result<String, WorkspaceServiceError> {
    let kind = required_owned(kind, "JDBC driver kind")?;
    match kind.as_str() {
        JDBC_DRIVER_KIND_JDBC | JDBC_DRIVER_KIND_GENERIC => Ok(kind),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported JDBC driver kind: {kind}"
        ))),
    }
}

fn normalize_optional_status(status: Option<String>) -> Result<String, WorkspaceServiceError> {
    match status {
        Some(status) if !status.trim().is_empty() => normalize_status(status),
        _ => Ok(JDBC_STATUS_NOT_CONFIGURED.to_owned()),
    }
}

fn normalize_status(status: String) -> Result<String, WorkspaceServiceError> {
    let status = required_owned(status, "JDBC connector status")?;
    match status.as_str() {
        JDBC_STATUS_NOT_CONFIGURED
        | JDBC_STATUS_CONFIGURED
        | JDBC_STATUS_DISABLED
        | JDBC_STATUS_ERROR => Ok(status),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported JDBC connector status: {status}"
        ))),
    }
}

fn normalize_jdbc_url_masked(value: String) -> Result<String, WorkspaceServiceError> {
    let value = required_owned(value, "JDBC URL metadata")?;
    reject_secret_bearing_jdbc_url(&value)?;
    Ok(value)
}

fn reject_secret_bearing_jdbc_url(value: &str) -> Result<(), WorkspaceServiceError> {
    let normalized = value.to_ascii_lowercase();
    if SECRET_PARAMETER_PATTERNS
        .iter()
        .any(|pattern| normalized.contains(pattern))
    {
        return Err(WorkspaceServiceError::InvalidInput(
            JDBC_SECRET_METADATA_ERROR.to_owned(),
        ));
    }

    Ok(())
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn map_storage_jdbc_connector_error(
    error: hobit_storage_sqlite::StorageError,
) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
