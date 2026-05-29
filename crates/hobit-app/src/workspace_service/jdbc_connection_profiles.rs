use hobit_storage_sqlite::{JdbcConnectionProfileUpdate, NewJdbcConnectionProfile};

use crate::WorkspaceServiceError;

use super::{
    jdbc_connection_profile_types::{
        CreateJdbcConnectionProfileInput, DeleteJdbcConnectionProfileInput,
        JdbcConnectionProfileSummary, UpdateJdbcConnectionProfileInput,
    },
    mapping::jdbc_connection_profile_summary,
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    WorkspaceService,
};

const DEFAULT_MAX_ROWS: usize = 100;
const MAX_ROWS: usize = 100;
const DEFAULT_TIMEOUT_MS: u64 = 10_000;
const MAX_TIMEOUT_MS: u64 = 10_000;
const DEFAULT_MAX_RESULT_BYTES: usize = 256 * 1024;
const MAX_RESULT_BYTES: usize = 256 * 1024;
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

impl WorkspaceService {
    pub fn create_jdbc_connection_profile(
        &self,
        input: CreateJdbcConnectionProfileInput,
    ) -> Result<JdbcConnectionProfileSummary, WorkspaceServiceError> {
        let input = normalize_create_profile_input(input)?;
        let profile_id = placeholder_id("jdbc_profile_");
        let created_at = placeholder_timestamp();

        let profile = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("workspace not found: {}", input.workspace_id),
                    ));
                }

                let profile = store.create_jdbc_connection_profile(NewJdbcConnectionProfile {
                    profile_id: &profile_id,
                    workspace_id: &input.workspace_id,
                    name: &input.name,
                    driver_jar_path: &input.driver_jar_path,
                    driver_class_name: &input.driver_class_name,
                    jdbc_url: &input.jdbc_url,
                    username: input.username.as_deref(),
                    password_env_var_name: input.password_env_var_name.as_deref(),
                    max_rows: usize_to_i64(input.max_rows),
                    timeout_ms: u64_to_i64(input.timeout_ms),
                    max_result_bytes: usize_to_i64(input.max_result_bytes),
                    read_only: true,
                    description: &input.description,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(profile)
            })
            .map_err(map_storage_profile_error)?;

        Ok(jdbc_connection_profile_summary(profile))
    }

    pub fn list_jdbc_connection_profiles(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<JdbcConnectionProfileSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        self.store
            .list_jdbc_connection_profiles(workspace_id)?
            .into_iter()
            .map(|profile| Ok(jdbc_connection_profile_summary(profile)))
            .collect()
    }

    pub fn get_jdbc_connection_profile(
        &self,
        workspace_id: &str,
        profile_id: &str,
    ) -> Result<Option<JdbcConnectionProfileSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let profile_id = required_input(profile_id, "JDBC connection profile id")?;

        self.validate_jdbc_connection_profile_workspace_access(workspace_id, profile_id)?;
        Ok(self
            .store
            .get_jdbc_connection_profile(workspace_id, profile_id)?
            .map(jdbc_connection_profile_summary))
    }

    pub fn update_jdbc_connection_profile(
        &self,
        input: UpdateJdbcConnectionProfileInput,
    ) -> Result<Option<JdbcConnectionProfileSummary>, WorkspaceServiceError> {
        let input = normalize_update_profile_input(input)?;
        self.validate_jdbc_connection_profile_workspace_access(
            &input.workspace_id,
            &input.profile_id,
        )?;

        let updated_at = placeholder_timestamp();
        let profile = self.store.with_immediate_transaction(|store| {
            let profile = store.update_jdbc_connection_profile(
                &input.workspace_id,
                &input.profile_id,
                JdbcConnectionProfileUpdate {
                    name: &input.name,
                    driver_jar_path: &input.driver_jar_path,
                    driver_class_name: &input.driver_class_name,
                    jdbc_url: &input.jdbc_url,
                    username: input.username.as_deref(),
                    password_env_var_name: input.password_env_var_name.as_deref(),
                    max_rows: usize_to_i64(input.max_rows),
                    timeout_ms: u64_to_i64(input.timeout_ms),
                    max_result_bytes: usize_to_i64(input.max_result_bytes),
                    read_only: true,
                    description: &input.description,
                    updated_at: Some(&updated_at),
                },
            )?;
            if profile.is_some() {
                store.touch_workspace(&input.workspace_id)?;
            }
            Ok(profile)
        })?;

        Ok(profile.map(jdbc_connection_profile_summary))
    }

    pub fn delete_jdbc_connection_profile(
        &self,
        input: DeleteJdbcConnectionProfileInput,
    ) -> Result<bool, WorkspaceServiceError> {
        let workspace_id = required_owned(input.workspace_id, "workspace id")?;
        let profile_id = required_owned(input.profile_id, "JDBC connection profile id")?;
        self.validate_jdbc_connection_profile_workspace_access(&workspace_id, &profile_id)?;

        let deleted = self.store.with_immediate_transaction(|store| {
            let deleted = store.delete_jdbc_connection_profile(&workspace_id, &profile_id)?;
            if deleted {
                store.touch_workspace(&workspace_id)?;
            }
            Ok(deleted)
        })?;

        Ok(deleted)
    }

    fn validate_jdbc_connection_profile_workspace_access(
        &self,
        workspace_id: &str,
        profile_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(profile) = self.store.get_jdbc_connection_profile_by_id(profile_id)? else {
            return Ok(());
        };

        if profile.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "JDBC connection profile does not belong to workspace: {profile_id}"
            )));
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedJdbcConnectionProfileInput {
    workspace_id: String,
    profile_id: String,
    name: String,
    driver_jar_path: String,
    driver_class_name: String,
    jdbc_url: String,
    username: Option<String>,
    password_env_var_name: Option<String>,
    max_rows: usize,
    timeout_ms: u64,
    max_result_bytes: usize,
    description: String,
}

fn normalize_create_profile_input(
    input: CreateJdbcConnectionProfileInput,
) -> Result<NormalizedJdbcConnectionProfileInput, WorkspaceServiceError> {
    normalize_profile_input(
        input.workspace_id,
        String::new(),
        input.name,
        input.driver_jar_path,
        input.driver_class_name,
        input.jdbc_url,
        input.username,
        input.password_env_var_name,
        input.max_rows,
        input.timeout_ms,
        input.max_result_bytes,
        input.read_only.unwrap_or(true),
        input.description,
    )
}

fn normalize_update_profile_input(
    input: UpdateJdbcConnectionProfileInput,
) -> Result<NormalizedJdbcConnectionProfileInput, WorkspaceServiceError> {
    normalize_profile_input(
        input.workspace_id,
        input.profile_id,
        input.name,
        input.driver_jar_path,
        input.driver_class_name,
        input.jdbc_url,
        input.username,
        input.password_env_var_name,
        input.max_rows,
        input.timeout_ms,
        input.max_result_bytes,
        input.read_only,
        input.description,
    )
}

#[allow(clippy::too_many_arguments)]
fn normalize_profile_input(
    workspace_id: String,
    profile_id: String,
    name: String,
    driver_jar_path: String,
    driver_class_name: String,
    jdbc_url: String,
    username: Option<String>,
    password_env_var_name: Option<String>,
    max_rows: usize,
    timeout_ms: u64,
    max_result_bytes: usize,
    read_only: bool,
    description: Option<String>,
) -> Result<NormalizedJdbcConnectionProfileInput, WorkspaceServiceError> {
    if !read_only {
        return Err(WorkspaceServiceError::InvalidInput(
            "JDBC connection profiles must remain read-only.".to_owned(),
        ));
    }

    let jdbc_url = required_owned(jdbc_url, "JDBC URL")?;
    reject_secret_bearing_jdbc_url(&jdbc_url)?;
    let password_env_var_name = optional_trimmed(password_env_var_name);
    if let Some(value) = password_env_var_name.as_deref() {
        validate_password_env_var_name(value)?;
    }

    Ok(NormalizedJdbcConnectionProfileInput {
        workspace_id: required_owned(workspace_id, "workspace id")?,
        profile_id: profile_id.trim().to_owned(),
        name: required_owned(name, "JDBC profile name")?,
        driver_jar_path: required_owned(driver_jar_path, "JDBC driver JAR path")?,
        driver_class_name: required_owned(driver_class_name, "JDBC driver class")?,
        jdbc_url,
        username: optional_trimmed(username),
        password_env_var_name,
        max_rows: bounded_profile_usize(max_rows, "max rows", DEFAULT_MAX_ROWS, MAX_ROWS)?,
        timeout_ms: bounded_profile_u64(
            timeout_ms,
            "timeout ms",
            DEFAULT_TIMEOUT_MS,
            MAX_TIMEOUT_MS,
        )?,
        max_result_bytes: bounded_profile_usize(
            max_result_bytes,
            "max result bytes",
            DEFAULT_MAX_RESULT_BYTES,
            MAX_RESULT_BYTES,
        )?,
        description: description
            .map(|value| value.trim().to_owned())
            .unwrap_or_default(),
    })
}

fn reject_secret_bearing_jdbc_url(value: &str) -> Result<(), WorkspaceServiceError> {
    for segment in value.split(['?', '&', ';']) {
        let Some((key, secret_value)) = segment.split_once('=') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        if SECRET_PARAMETER_KEYS.contains(&key.as_str()) && !secret_value.trim().is_empty() {
            return Err(WorkspaceServiceError::InvalidInput(
                JDBC_SECRET_PROFILE_ERROR.to_owned(),
            ));
        }
    }

    Ok(())
}

fn validate_password_env_var_name(value: &str) -> Result<(), WorkspaceServiceError> {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return Ok(());
    };

    if !(first == '_' || first.is_ascii_alphabetic())
        || !chars.all(|character| character == '_' || character.is_ascii_alphanumeric())
    {
        return Err(WorkspaceServiceError::InvalidInput(
            JDBC_PASSWORD_ENV_ERROR.to_owned(),
        ));
    }

    Ok(())
}

fn bounded_profile_usize(
    value: usize,
    label: &str,
    _default_value: usize,
    max_value: usize,
) -> Result<usize, WorkspaceServiceError> {
    if value == 0 || value > max_value {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "JDBC profile {label} must be between 1 and {max_value}."
        )));
    }

    Ok(value)
}

fn bounded_profile_u64(
    value: u64,
    label: &str,
    _default_value: u64,
    max_value: u64,
) -> Result<u64, WorkspaceServiceError> {
    if value == 0 || value > max_value {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "JDBC profile {label} must be between 1 and {max_value}."
        )));
    }

    Ok(value)
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn usize_to_i64(value: usize) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn u64_to_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn map_storage_profile_error(error: hobit_storage_sqlite::StorageError) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
