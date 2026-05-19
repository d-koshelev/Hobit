use super::{CoordinatorProviderAdapter, CoordinatorProviderOutcome, CoordinatorProviderRequest};

pub const EXTERNAL_COORDINATOR_PROVIDER_KIND: &str = "external-provider";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExternalCoordinatorProviderConfig {
    pub provider_kind: String,
    pub endpoint_configured: bool,
    pub credential_configured: bool,
}

impl ExternalCoordinatorProviderConfig {
    pub fn new(
        provider_kind: impl Into<String>,
        endpoint_configured: bool,
        credential_configured: bool,
    ) -> Self {
        Self {
            provider_kind: normalize_provider_kind(provider_kind.into()),
            endpoint_configured,
            credential_configured,
        }
    }

    fn is_configured(&self) -> bool {
        self.endpoint_configured && self.credential_configured
    }
}

pub struct ExternalCoordinatorProviderAdapter {
    config: ExternalCoordinatorProviderConfig,
}

impl ExternalCoordinatorProviderAdapter {
    pub fn new(config: ExternalCoordinatorProviderConfig) -> Self {
        Self { config }
    }
}

impl CoordinatorProviderAdapter for ExternalCoordinatorProviderAdapter {
    fn provider_kind(&self) -> &str {
        &self.config.provider_kind
    }

    fn request_coordinator_response(
        &self,
        _request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome {
        if !self.config.is_configured() {
            return CoordinatorProviderOutcome::NotConfigured {
                message: "Coordinator external provider is not configured. Configure backend endpoint and credential before selecting external provider.".to_owned(),
            };
        }

        CoordinatorProviderOutcome::Unsupported {
            message: "Coordinator external provider configuration is present, but external network calls are not implemented in this build.".to_owned(),
        }
    }
}

fn normalize_provider_kind(value: String) -> String {
    let normalized = value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        .take(64)
        .collect::<String>();

    if normalized.is_empty() {
        EXTERNAL_COORDINATOR_PROVIDER_KIND.to_owned()
    } else {
        normalized
    }
}
