use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{JdbcConnectionProfileUpdate, NewJdbcConnectionProfile};
use crate::mappers::{bool_to_i64, jdbc_connection_profile_row};
use crate::rows::JdbcConnectionProfileRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

const JDBC_SECRET_PROFILE_ERROR: &str = "JDBC connection profiles must not include password, token, secret, or key-bearing URL parameters.";
const JDBC_PASSWORD_ENV_ERROR: &str =
    "JDBC profile password environment variable must be an environment variable name.";
const SECRET_PARAMETER_KEYS: &[&str] = &[
    "password",
    "passwd",
    "pwd",
    "token",
    "access_token",
    "secret",
    "key",
    "api_key",
    "apikey",
    "private_key",
];

impl SqliteStore {
    pub fn create_jdbc_connection_profile(
        &self,
        input: NewJdbcConnectionProfile<'_>,
    ) -> Result<JdbcConnectionProfileRow> {
        validate_profile_secrets(input.jdbc_url, input.password_env_var_name)?;

        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO jdbc_connection_profiles (
                profile_id, workspace_id, name, driver_jar_path, driver_class_name,
                jdbc_url, username, password_env_var_name, max_rows, timeout_ms,
                max_result_bytes, read_only, description, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                input.profile_id,
                input.workspace_id,
                input.name,
                input.driver_jar_path,
                input.driver_class_name,
                input.jdbc_url,
                input.username,
                input.password_env_var_name,
                input.max_rows,
                input.timeout_ms,
                input.max_result_bytes,
                bool_to_i64(input.read_only),
                input.description,
                created_at,
                updated_at,
            ],
        )?;

        self.get_jdbc_connection_profile(input.workspace_id, input.profile_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_jdbc_connection_profiles(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<JdbcConnectionProfileRow>> {
        let mut statement = self.connection.prepare(
            "SELECT profile_id, workspace_id, name, driver_jar_path, driver_class_name,
                jdbc_url, username, password_env_var_name, max_rows, timeout_ms,
                max_result_bytes, read_only, description, created_at, updated_at
             FROM jdbc_connection_profiles
             WHERE workspace_id = ?1
             ORDER BY updated_at DESC, created_at DESC, name ASC, profile_id DESC",
        )?;

        let rows = statement.query_map(params![workspace_id], jdbc_connection_profile_row)?;
        rows.collect()
    }

    pub fn get_jdbc_connection_profile(
        &self,
        workspace_id: &str,
        profile_id: &str,
    ) -> Result<Option<JdbcConnectionProfileRow>> {
        self.connection
            .query_row(
                "SELECT profile_id, workspace_id, name, driver_jar_path, driver_class_name,
                    jdbc_url, username, password_env_var_name, max_rows, timeout_ms,
                    max_result_bytes, read_only, description, created_at, updated_at
                 FROM jdbc_connection_profiles
                 WHERE workspace_id = ?1 AND profile_id = ?2",
                params![workspace_id, profile_id],
                jdbc_connection_profile_row,
            )
            .optional()
    }

    pub fn get_jdbc_connection_profile_by_id(
        &self,
        profile_id: &str,
    ) -> Result<Option<JdbcConnectionProfileRow>> {
        self.connection
            .query_row(
                "SELECT profile_id, workspace_id, name, driver_jar_path, driver_class_name,
                    jdbc_url, username, password_env_var_name, max_rows, timeout_ms,
                    max_result_bytes, read_only, description, created_at, updated_at
                 FROM jdbc_connection_profiles
                 WHERE profile_id = ?1",
                params![profile_id],
                jdbc_connection_profile_row,
            )
            .optional()
    }

    pub fn update_jdbc_connection_profile(
        &self,
        workspace_id: &str,
        profile_id: &str,
        update: JdbcConnectionProfileUpdate<'_>,
    ) -> Result<Option<JdbcConnectionProfileRow>> {
        validate_profile_secrets(update.jdbc_url, update.password_env_var_name)?;

        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE jdbc_connection_profiles
             SET name = ?1, driver_jar_path = ?2, driver_class_name = ?3,
                jdbc_url = ?4, username = ?5, password_env_var_name = ?6,
                max_rows = ?7, timeout_ms = ?8, max_result_bytes = ?9,
                read_only = ?10, description = ?11, updated_at = ?12
             WHERE workspace_id = ?13 AND profile_id = ?14",
            params![
                update.name,
                update.driver_jar_path,
                update.driver_class_name,
                update.jdbc_url,
                update.username,
                update.password_env_var_name,
                update.max_rows,
                update.timeout_ms,
                update.max_result_bytes,
                bool_to_i64(update.read_only),
                update.description,
                updated_at,
                workspace_id,
                profile_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_jdbc_connection_profile(workspace_id, profile_id)
    }

    pub fn delete_jdbc_connection_profile(
        &self,
        workspace_id: &str,
        profile_id: &str,
    ) -> Result<bool> {
        let affected_rows = self.connection.execute(
            "DELETE FROM jdbc_connection_profiles
             WHERE workspace_id = ?1 AND profile_id = ?2",
            params![workspace_id, profile_id],
        )?;

        Ok(affected_rows > 0)
    }
}

fn validate_profile_secrets(jdbc_url: &str, password_env_var_name: Option<&str>) -> Result<()> {
    if contains_secret_bearing_url_param(jdbc_url) {
        return Err(rusqlite::Error::InvalidParameterName(
            JDBC_SECRET_PROFILE_ERROR.to_owned(),
        ));
    }

    if let Some(value) = password_env_var_name {
        let trimmed = value.trim();
        if !trimmed.is_empty() && !is_env_var_name(trimmed) {
            return Err(rusqlite::Error::InvalidParameterName(
                JDBC_PASSWORD_ENV_ERROR.to_owned(),
            ));
        }
    }

    Ok(())
}

fn contains_secret_bearing_url_param(value: &str) -> bool {
    for segment in value.split(['?', '&', ';']) {
        let Some((key, secret_value)) = segment.split_once('=') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        if SECRET_PARAMETER_KEYS.contains(&key.as_str()) && !secret_value.trim().is_empty() {
            return true;
        }
    }

    false
}

fn is_env_var_name(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };

    if !(first == '_' || first.is_ascii_alphabetic()) {
        return false;
    }

    chars.all(|character| character == '_' || character.is_ascii_alphanumeric())
}
