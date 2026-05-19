use std::path::{Path, PathBuf};

use hobit_app::{
    coordinator_provider_adapter_from_config, CoordinatorProviderRuntimeConfig,
    ExternalCoordinatorProviderConfig, WorkspaceService, EXTERNAL_COORDINATOR_PROVIDER_KIND,
};
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::coordinator_provider_dto::{
    GenerateCoordinatorProviderResponseDto, GenerateCoordinatorProviderResponseRequest,
};

#[tauri::command]
pub(crate) fn generate_coordinator_provider_response(
    request: GenerateCoordinatorProviderResponseRequest,
    state: State<'_, AppState>,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    generate_coordinator_provider_response_blocking(request, state.db_path().to_path_buf())
}

fn generate_coordinator_provider_response_blocking(
    request: GenerateCoordinatorProviderResponseRequest,
    db_path: PathBuf,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    generate_coordinator_provider_response_with_config(
        request,
        db_path,
        coordinator_provider_config_from_env(),
    )
}

fn generate_coordinator_provider_response_with_config(
    request: GenerateCoordinatorProviderResponseRequest,
    db_path: PathBuf,
    config: CoordinatorProviderRuntimeConfig,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    let service = workspace_service(&db_path)?;
    let provider = coordinator_provider_adapter_from_config(config);
    service
        .generate_coordinator_provider_response(request.into(), &provider)
        .map(|response| response.map(GenerateCoordinatorProviderResponseDto::from))
        .map_err(command_error)
}

fn coordinator_provider_config_from_env() -> CoordinatorProviderRuntimeConfig {
    let mode = env_value("HOBIT_COORDINATOR_PROVIDER")
        .or_else(|| env_value("HOBIT_COORDINATOR_PROVIDER_MODE"))
        .unwrap_or_else(|| "mock-local".to_owned());

    if !is_external_provider_mode(&mode) {
        return CoordinatorProviderRuntimeConfig::mock_local();
    }

    CoordinatorProviderRuntimeConfig::External(ExternalCoordinatorProviderConfig::new(
        env_value("HOBIT_COORDINATOR_PROVIDER_KIND")
            .unwrap_or_else(|| EXTERNAL_COORDINATOR_PROVIDER_KIND.to_owned()),
        env_present("HOBIT_COORDINATOR_PROVIDER_ENDPOINT"),
        env_present("HOBIT_COORDINATOR_PROVIDER_API_KEY"),
    ))
}

fn is_external_provider_mode(mode: &str) -> bool {
    matches!(
        mode.trim().to_ascii_lowercase().as_str(),
        "external" | "configured" | "real" | "provider"
    )
}

fn env_present(name: &str) -> bool {
    env_value(name).is_some()
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests;
