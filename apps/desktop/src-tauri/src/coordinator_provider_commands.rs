use std::path::{Path, PathBuf};

use hobit_app::{
    CoordinatorProviderAdapter, ExternalCoordinatorProviderAdapter,
    ExternalCoordinatorProviderConfig, MockCoordinatorProviderAdapter, WorkspaceService,
    EXTERNAL_COORDINATOR_PROVIDER_KIND,
};
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::coordinator_provider_dto::{
    GenerateCoordinatorProviderResponseDto, GenerateCoordinatorProviderResponseRequest,
};
use crate::coordinator_provider_http::{
    is_supported_coordinator_provider_kind, CoordinatorHttpJsonProviderAdapter,
    CoordinatorHttpJsonProviderConfig,
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
    config: CoordinatorProviderCommandConfig,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    let service = workspace_service(&db_path)?;
    let input = request.into();

    match config {
        CoordinatorProviderCommandConfig::MockLocal => {
            let provider = MockCoordinatorProviderAdapter;
            generate_with_provider(&service, input, &provider)
        }
        CoordinatorProviderCommandConfig::ExternalMissing(config) => {
            let provider = ExternalCoordinatorProviderAdapter::new(config);
            generate_with_provider(&service, input, &provider)
        }
        CoordinatorProviderCommandConfig::ExternalUnsupported(provider_kind) => {
            let provider = UnsupportedCoordinatorProviderAdapter { provider_kind };
            generate_with_provider(&service, input, &provider)
        }
        CoordinatorProviderCommandConfig::HttpJson(config) => {
            let provider = CoordinatorHttpJsonProviderAdapter::new(config);
            generate_with_provider(&service, input, &provider)
        }
    }
}

fn generate_with_provider(
    service: &WorkspaceService,
    input: hobit_app::GenerateCoordinatorProviderResponseInput,
    provider: &dyn CoordinatorProviderAdapter,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    service
        .generate_coordinator_provider_response(input, provider)
        .map(|response| response.map(GenerateCoordinatorProviderResponseDto::from))
        .map_err(command_error)
}

fn coordinator_provider_config_from_env() -> CoordinatorProviderCommandConfig {
    let mode = env_value("HOBIT_COORDINATOR_PROVIDER")
        .or_else(|| env_value("HOBIT_COORDINATOR_PROVIDER_MODE"))
        .unwrap_or_else(|| "mock-local".to_owned());

    if !is_external_provider_mode(&mode) {
        return CoordinatorProviderCommandConfig::MockLocal;
    }

    let endpoint = env_value("HOBIT_COORDINATOR_PROVIDER_ENDPOINT");
    let api_key = env_value("HOBIT_COORDINATOR_PROVIDER_API_KEY");
    let timeout_millis = env_timeout_millis();
    let provider_kind = env_value("HOBIT_COORDINATOR_PROVIDER_KIND")
        .unwrap_or_else(|| EXTERNAL_COORDINATOR_PROVIDER_KIND.to_owned());
    let external_config = ExternalCoordinatorProviderConfig::new(
        provider_kind,
        endpoint.is_some(),
        api_key.is_some(),
    );

    let (Some(endpoint), Some(api_key)) = (endpoint, api_key) else {
        return CoordinatorProviderCommandConfig::ExternalMissing(external_config);
    };

    if !is_supported_coordinator_provider_kind(&external_config.provider_kind) {
        return CoordinatorProviderCommandConfig::ExternalUnsupported(
            external_config.provider_kind,
        );
    }

    CoordinatorProviderCommandConfig::HttpJson(
        CoordinatorHttpJsonProviderConfig::new(external_config.provider_kind, endpoint, api_key)
            .with_timeout_millis(timeout_millis),
    )
}

fn is_external_provider_mode(mode: &str) -> bool {
    matches!(
        mode.trim().to_ascii_lowercase().as_str(),
        "external" | "configured" | "real" | "provider"
    )
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn env_timeout_millis() -> u64 {
    env_value("HOBIT_COORDINATOR_PROVIDER_TIMEOUT_MS")
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(30_000)
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

enum CoordinatorProviderCommandConfig {
    MockLocal,
    ExternalMissing(ExternalCoordinatorProviderConfig),
    ExternalUnsupported(String),
    HttpJson(CoordinatorHttpJsonProviderConfig),
}

struct UnsupportedCoordinatorProviderAdapter {
    provider_kind: String,
}

impl CoordinatorProviderAdapter for UnsupportedCoordinatorProviderAdapter {
    fn provider_kind(&self) -> &str {
        &self.provider_kind
    }

    fn request_coordinator_response(
        &self,
        _request: &hobit_app::CoordinatorProviderRequest,
    ) -> hobit_app::CoordinatorProviderOutcome {
        hobit_app::CoordinatorProviderOutcome::Unsupported {
            message: format!(
                "Coordinator provider kind '{}' is not supported by this build.",
                self.provider_kind
            ),
        }
    }
}

#[cfg(test)]
mod tests;
