use super::{
    CoordinatorProviderAdapter, CoordinatorProviderOutcome, CoordinatorProviderRequest,
    ExternalCoordinatorProviderAdapter, ExternalCoordinatorProviderConfig,
    MockCoordinatorProviderAdapter,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CoordinatorProviderRuntimeConfig {
    MockLocal,
    External(ExternalCoordinatorProviderConfig),
}

pub enum CoordinatorProviderRuntimeAdapter {
    MockLocal(MockCoordinatorProviderAdapter),
    External(ExternalCoordinatorProviderAdapter),
}

impl CoordinatorProviderRuntimeConfig {
    pub fn mock_local() -> Self {
        Self::MockLocal
    }
}

pub fn coordinator_provider_adapter_from_config(
    config: CoordinatorProviderRuntimeConfig,
) -> CoordinatorProviderRuntimeAdapter {
    match config {
        CoordinatorProviderRuntimeConfig::MockLocal => {
            CoordinatorProviderRuntimeAdapter::MockLocal(MockCoordinatorProviderAdapter)
        }
        CoordinatorProviderRuntimeConfig::External(config) => {
            CoordinatorProviderRuntimeAdapter::External(ExternalCoordinatorProviderAdapter::new(
                config,
            ))
        }
    }
}

impl CoordinatorProviderAdapter for CoordinatorProviderRuntimeAdapter {
    fn provider_kind(&self) -> &str {
        match self {
            CoordinatorProviderRuntimeAdapter::MockLocal(provider) => provider.provider_kind(),
            CoordinatorProviderRuntimeAdapter::External(provider) => provider.provider_kind(),
        }
    }

    fn request_coordinator_response(
        &self,
        request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome {
        match self {
            CoordinatorProviderRuntimeAdapter::MockLocal(provider) => {
                provider.request_coordinator_response(request)
            }
            CoordinatorProviderRuntimeAdapter::External(provider) => {
                provider.request_coordinator_response(request)
            }
        }
    }
}
