use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{JdbcConnectorUpdate, NewJdbcConnector};
use crate::mappers::{bool_to_i64, jdbc_connector_row};
use crate::rows::JdbcConnectorRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

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

impl SqliteStore {
    pub fn create_jdbc_connector(&self, input: NewJdbcConnector<'_>) -> Result<JdbcConnectorRow> {
        validate_jdbc_url_masked(input.jdbc_url_masked)?;

        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO jdbc_connectors (
                connector_id, workspace_id, display_name, database_kind, driver_kind,
                jdbc_url_masked, environment, read_only_default, status, notes,
                created_at, updated_at, last_used_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                input.connector_id,
                input.workspace_id,
                input.display_name,
                input.database_kind,
                input.driver_kind,
                input.jdbc_url_masked,
                input.environment,
                bool_to_i64(input.read_only_default),
                input.status,
                input.notes,
                created_at,
                updated_at,
                input.last_used_at,
            ],
        )?;

        self.get_jdbc_connector(input.workspace_id, input.connector_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_jdbc_connectors(&self, workspace_id: &str) -> Result<Vec<JdbcConnectorRow>> {
        let mut statement = self.connection.prepare(
            "SELECT connector_id, workspace_id, display_name, database_kind, driver_kind,
                jdbc_url_masked, environment, read_only_default, status, notes,
                created_at, updated_at, last_used_at
             FROM jdbc_connectors
             WHERE workspace_id = ?1
             ORDER BY updated_at DESC, created_at DESC, display_name ASC, connector_id DESC",
        )?;

        let rows = statement.query_map(params![workspace_id], jdbc_connector_row)?;
        rows.collect()
    }

    pub fn get_jdbc_connector(
        &self,
        workspace_id: &str,
        connector_id: &str,
    ) -> Result<Option<JdbcConnectorRow>> {
        self.connection
            .query_row(
                "SELECT connector_id, workspace_id, display_name, database_kind, driver_kind,
                    jdbc_url_masked, environment, read_only_default, status, notes,
                    created_at, updated_at, last_used_at
                 FROM jdbc_connectors
                 WHERE workspace_id = ?1 AND connector_id = ?2",
                params![workspace_id, connector_id],
                jdbc_connector_row,
            )
            .optional()
    }

    pub fn get_jdbc_connector_by_id(&self, connector_id: &str) -> Result<Option<JdbcConnectorRow>> {
        self.connection
            .query_row(
                "SELECT connector_id, workspace_id, display_name, database_kind, driver_kind,
                    jdbc_url_masked, environment, read_only_default, status, notes,
                    created_at, updated_at, last_used_at
                 FROM jdbc_connectors
                 WHERE connector_id = ?1",
                params![connector_id],
                jdbc_connector_row,
            )
            .optional()
    }

    pub fn update_jdbc_connector(
        &self,
        workspace_id: &str,
        connector_id: &str,
        update: JdbcConnectorUpdate<'_>,
    ) -> Result<Option<JdbcConnectorRow>> {
        validate_jdbc_url_masked(update.jdbc_url_masked)?;

        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE jdbc_connectors
             SET display_name = ?1, database_kind = ?2, driver_kind = ?3,
                jdbc_url_masked = ?4, environment = ?5, read_only_default = ?6,
                status = ?7, notes = ?8, updated_at = ?9
             WHERE workspace_id = ?10 AND connector_id = ?11",
            params![
                update.display_name,
                update.database_kind,
                update.driver_kind,
                update.jdbc_url_masked,
                update.environment,
                bool_to_i64(update.read_only_default),
                update.status,
                update.notes,
                updated_at,
                workspace_id,
                connector_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_jdbc_connector(workspace_id, connector_id)
    }
}

fn validate_jdbc_url_masked(jdbc_url_masked: &str) -> Result<()> {
    let normalized = jdbc_url_masked.to_ascii_lowercase();
    if SECRET_PARAMETER_PATTERNS
        .iter()
        .any(|pattern| normalized.contains(pattern))
    {
        return Err(rusqlite::Error::InvalidParameterName(
            JDBC_SECRET_METADATA_ERROR.to_owned(),
        ));
    }

    Ok(())
}
