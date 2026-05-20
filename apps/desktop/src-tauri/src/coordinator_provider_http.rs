use std::time::Duration;

use hobit_app::{
    CoordinatorProviderAdapter, CoordinatorProviderOutcome,
    CoordinatorProviderProposalDraftContext, CoordinatorProviderRequest,
    CoordinatorProviderVisibleInput, EXTERNAL_COORDINATOR_PROVIDER_KIND,
};
use serde::Deserialize;
use serde_json::{json, Value};

mod transport;
pub(crate) use transport::{
    CoordinatorHttpJsonProviderError, CoordinatorHttpJsonProviderErrorKind,
    CoordinatorHttpJsonTransport, TcpCoordinatorHttpJsonTransport,
};

pub(crate) const COORDINATOR_HTTP_JSON_PROVIDER_KIND: &str = "hobit-http-json";

const DEFAULT_TIMEOUT_MILLIS: u64 = 30_000;
const MIN_TIMEOUT_MILLIS: u64 = 1_000;
const MAX_TIMEOUT_MILLIS: u64 = 120_000;
const MAX_REQUEST_BODY_BYTES: usize = 512 * 1024;
const MAX_RESPONSE_BODY_BYTES: usize = 512 * 1024;
const REDACTED_PROVIDER_SECRET: &str = "[redacted-provider-secret]";

pub(crate) struct CoordinatorHttpJsonProviderConfig {
    provider_kind: String,
    endpoint: String,
    api_key: String,
    timeout: Duration,
    max_request_body_bytes: usize,
    max_response_body_bytes: usize,
}

impl CoordinatorHttpJsonProviderConfig {
    pub(crate) fn new(
        provider_kind: impl Into<String>,
        endpoint: impl Into<String>,
        api_key: impl Into<String>,
    ) -> Self {
        Self {
            provider_kind: normalize_provider_kind(provider_kind.into()),
            endpoint: endpoint.into().trim().to_owned(),
            api_key: api_key.into().trim().to_owned(),
            timeout: Duration::from_millis(DEFAULT_TIMEOUT_MILLIS),
            max_request_body_bytes: MAX_REQUEST_BODY_BYTES,
            max_response_body_bytes: MAX_RESPONSE_BODY_BYTES,
        }
    }

    pub(crate) fn with_timeout_millis(mut self, timeout_millis: u64) -> Self {
        self.timeout =
            Duration::from_millis(timeout_millis.clamp(MIN_TIMEOUT_MILLIS, MAX_TIMEOUT_MILLIS));
        self
    }

    fn is_configured(&self) -> bool {
        !self.endpoint.is_empty() && !self.api_key.is_empty()
    }
}

impl std::fmt::Debug for CoordinatorHttpJsonProviderConfig {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("CoordinatorHttpJsonProviderConfig")
            .field("provider_kind", &self.provider_kind)
            .field("endpoint_configured", &(!self.endpoint.is_empty()))
            .field("api_key_configured", &(!self.api_key.is_empty()))
            .field("timeout_millis", &self.timeout.as_millis())
            .field("max_request_body_bytes", &self.max_request_body_bytes)
            .field("max_response_body_bytes", &self.max_response_body_bytes)
            .finish()
    }
}

pub(crate) struct CoordinatorHttpJsonProviderAdapter<T = TcpCoordinatorHttpJsonTransport> {
    config: CoordinatorHttpJsonProviderConfig,
    transport: T,
}

impl CoordinatorHttpJsonProviderAdapter<TcpCoordinatorHttpJsonTransport> {
    pub(crate) fn new(config: CoordinatorHttpJsonProviderConfig) -> Self {
        Self {
            config,
            transport: TcpCoordinatorHttpJsonTransport,
        }
    }
}

impl<T: CoordinatorHttpJsonTransport> CoordinatorHttpJsonProviderAdapter<T> {
    #[cfg(test)]
    pub(crate) fn new_with_transport(
        config: CoordinatorHttpJsonProviderConfig,
        transport: T,
    ) -> Self {
        Self { config, transport }
    }
}

impl<T: CoordinatorHttpJsonTransport> CoordinatorProviderAdapter
    for CoordinatorHttpJsonProviderAdapter<T>
{
    fn provider_kind(&self) -> &str {
        &self.config.provider_kind
    }

    fn request_coordinator_response(
        &self,
        request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome {
        if !self.config.is_configured() {
            return CoordinatorProviderOutcome::NotConfigured {
                message: "Coordinator external provider is not configured. Configure backend endpoint and credential before selecting external provider.".to_owned(),
            };
        }

        let body = coordinator_http_request_body(request).to_string();
        if body.len() > self.config.max_request_body_bytes {
            return CoordinatorProviderOutcome::RequestTooLarge {
                message: "Coordinator provider request exceeded the configured size limit."
                    .to_owned(),
            };
        }

        let response_body = match self.transport.post_json(
            &self.config.endpoint,
            &self.config.api_key,
            &body,
            self.config.timeout,
            self.config.max_response_body_bytes,
        ) {
            Ok(response_body) => response_body,
            Err(error) => return provider_error_outcome(error),
        };

        if response_body.len() > self.config.max_response_body_bytes {
            return CoordinatorProviderOutcome::InvalidResponse {
                message: "Coordinator provider response exceeded the configured size limit."
                    .to_owned(),
            };
        }

        match coordinator_http_response_outcome(
            &response_body,
            &request.request_id,
            &self.config.api_key,
        ) {
            Ok(outcome) => outcome,
            Err(error) => provider_error_outcome(error),
        }
    }
}

pub(crate) fn is_supported_coordinator_provider_kind(provider_kind: &str) -> bool {
    let normalized = provider_kind.trim().to_ascii_lowercase();
    normalized == COORDINATOR_HTTP_JSON_PROVIDER_KIND
        || normalized == EXTERNAL_COORDINATOR_PROVIDER_KIND
}

fn provider_error_outcome(error: CoordinatorHttpJsonProviderError) -> CoordinatorProviderOutcome {
    match error.kind {
        CoordinatorHttpJsonProviderErrorKind::InvalidResponse => {
            CoordinatorProviderOutcome::InvalidResponse {
                message: error.message,
            }
        }
        CoordinatorHttpJsonProviderErrorKind::NetworkFailure => {
            CoordinatorProviderOutcome::NetworkFailure {
                message: error.message,
            }
        }
        CoordinatorHttpJsonProviderErrorKind::ProviderError => {
            CoordinatorProviderOutcome::ProviderError {
                message: error.message,
            }
        }
        CoordinatorHttpJsonProviderErrorKind::Timeout => CoordinatorProviderOutcome::Timeout {
            message: error.message,
        },
        CoordinatorHttpJsonProviderErrorKind::Unsupported => {
            CoordinatorProviderOutcome::Unsupported {
                message: error.message,
            }
        }
    }
}

#[derive(Deserialize)]
struct ProviderResponseEnvelope {
    #[serde(default)]
    assistant_text: String,
    #[serde(default)]
    proposal_drafts: Vec<ProviderProposalDraft>,
}

#[derive(Deserialize)]
struct ProviderProposalDraft {
    #[serde(default)]
    id: String,
    #[serde(default, alias = "proposal_type")]
    type_id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    target_widget: String,
    #[serde(default)]
    target_capability: String,
    #[serde(default)]
    intent: String,
    #[serde(default, alias = "required_inputs")]
    visible_inputs: Vec<ProviderVisibleInput>,
    #[serde(default, alias = "visible_risk_notes")]
    risk_notes: Vec<String>,
    #[serde(default)]
    expected_result: String,
}

#[derive(Deserialize)]
struct ProviderVisibleInput {
    #[serde(default)]
    label: String,
    #[serde(default)]
    value: String,
}

fn coordinator_http_request_body(request: &CoordinatorProviderRequest) -> Value {
    json!({
        "request_schema": "hobit.coordinator_provider.request.v1",
        "response_schema": "hobit.coordinator_provider.response.v1",
        "request_id": &request.request_id,
        "operator_message": &request.operator_message,
        "visible_conversation": request.visible_conversation.iter().map(|message| {
            json!({
                "id": &message.id,
                "role": &message.role,
                "body": &message.body,
            })
        }).collect::<Vec<_>>(),
        "visible_proposal_drafts": request.visible_proposal_drafts.iter().map(|proposal| {
            proposal_payload(proposal)
        }).collect::<Vec<_>>(),
        "system_instructions": &request.system_instructions,
        "allowed_tools": &request.allowed_tools,
        "safety_constraints": [
            "allowed_tools must remain empty.",
            "Return assistant text and optional review-only proposal drafts.",
            "Do not claim tool execution, Terminal control, Git mutation, JDBC execution, Queue dispatch, Agent Executor launch, file access, or hidden context.",
            "Do not include secrets or credentials in the response."
        ],
        "supported_proposal_types": [
            "create-agent-queue-task",
            "create-note",
            "prepare-jdbc-query-suggestion"
        ],
        "created_at": &request.created_at,
    })
}

fn proposal_payload(proposal: &CoordinatorProviderProposalDraftContext) -> Value {
    json!({
        "id": &proposal.id,
        "type_id": &proposal.type_id,
        "title": &proposal.title,
        "target_widget": &proposal.target_widget,
        "target_capability": &proposal.target_capability,
        "intent": &proposal.intent,
        "visible_inputs": proposal.visible_inputs.iter().map(|input| {
            json!({
                "label": &input.label,
                "value": &input.value,
            })
        }).collect::<Vec<_>>(),
        "risk_notes": &proposal.risk_notes,
        "expected_result": &proposal.expected_result,
    })
}

fn coordinator_http_response_outcome(
    response_body: &str,
    request_id: &str,
    api_key: &str,
) -> Result<CoordinatorProviderOutcome, CoordinatorHttpJsonProviderError> {
    let payload = provider_payload_value(response_body)?;
    let envelope = serde_json::from_value::<ProviderResponseEnvelope>(payload).map_err(|_| {
        CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider response did not match the expected Hobit JSON shape.",
        )
    })?;

    if envelope.assistant_text.trim().is_empty() {
        return Err(CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider response did not include assistant_text.",
        ));
    }

    let assistant_text = redact_provider_secret(envelope.assistant_text, api_key);
    let proposal_drafts = envelope
        .proposal_drafts
        .into_iter()
        .enumerate()
        .map(|(index, draft)| provider_draft_context(draft, request_id, index, api_key))
        .collect::<Vec<_>>();

    if proposal_drafts.is_empty() {
        Ok(CoordinatorProviderOutcome::Response { assistant_text })
    } else {
        Ok(CoordinatorProviderOutcome::ResponseWithDrafts {
            assistant_text,
            proposal_drafts,
        })
    }
}

fn provider_payload_value(response_body: &str) -> Result<Value, CoordinatorHttpJsonProviderError> {
    let value = serde_json::from_str::<Value>(response_body).map_err(|_| {
        CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider response was not valid JSON.",
        )
    })?;

    if value.get("assistant_text").is_some() {
        return Ok(value);
    }

    for pointer in [
        "/choices/0/message/content",
        "/output_text",
        "/output/0/content/0/text",
    ] {
        if let Some(content) = value.pointer(pointer).and_then(Value::as_str) {
            return Ok(serde_json::from_str::<Value>(content)
                .unwrap_or_else(|_| json!({ "assistant_text": content })));
        }
    }

    Err(CoordinatorHttpJsonProviderError::invalid_response(
        "Coordinator provider response did not contain assistant text.",
    ))
}

fn provider_draft_context(
    draft: ProviderProposalDraft,
    request_id: &str,
    index: usize,
    api_key: &str,
) -> CoordinatorProviderProposalDraftContext {
    CoordinatorProviderProposalDraftContext {
        id: draft_id(draft.id, request_id, index),
        type_id: redact_provider_secret(draft.type_id, api_key),
        title: redact_provider_secret(draft.title, api_key),
        target_widget: redact_provider_secret(draft.target_widget, api_key),
        target_capability: redact_provider_secret(draft.target_capability, api_key),
        intent: redact_provider_secret(draft.intent, api_key),
        visible_inputs: draft
            .visible_inputs
            .into_iter()
            .map(|input| CoordinatorProviderVisibleInput {
                label: redact_provider_secret(input.label, api_key),
                value: redact_provider_secret(input.value, api_key),
            })
            .collect(),
        risk_notes: draft
            .risk_notes
            .into_iter()
            .map(|note| redact_provider_secret(note, api_key))
            .collect(),
        expected_result: redact_provider_secret(draft.expected_result, api_key),
    }
}

fn draft_id(id: String, request_id: &str, index: usize) -> String {
    let trimmed = id.trim();

    if trimmed.is_empty() {
        format!("{request_id}-provider-draft-{}", index + 1)
    } else {
        trimmed.to_owned()
    }
}

fn redact_provider_secret(value: String, api_key: &str) -> String {
    if api_key.is_empty() {
        return value;
    }

    value.replace(api_key, REDACTED_PROVIDER_SECRET)
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

#[cfg(test)]
mod tests;
