use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use hobit_app::{
    CoordinatorProviderAdapter, CoordinatorProviderOutcome,
    CoordinatorProviderProposalDraftContext, CoordinatorProviderRequest,
    CoordinatorProviderVisibleInput, EXTERNAL_COORDINATOR_PROVIDER_KIND,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub(crate) const COORDINATOR_HTTP_JSON_PROVIDER_KIND: &str = "hobit-http-json";

const DEFAULT_TIMEOUT_SECS: u64 = 60;
const REDACTED_PROVIDER_SECRET: &str = "[redacted-provider-secret]";

pub(crate) struct CoordinatorHttpJsonProviderConfig {
    provider_kind: String,
    endpoint: String,
    api_key: String,
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
        }
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
        let response_body = match self.transport.post_json(
            &self.config.endpoint,
            &self.config.api_key,
            &body,
            Duration::from_secs(DEFAULT_TIMEOUT_SECS),
        ) {
            Ok(response_body) => response_body,
            Err(message) => return CoordinatorProviderOutcome::RequestFailed { message },
        };

        match coordinator_http_response_outcome(
            &response_body,
            &request.request_id,
            &self.config.api_key,
        ) {
            Ok(outcome) => outcome,
            Err(message) => CoordinatorProviderOutcome::RequestFailed { message },
        }
    }
}

pub(crate) fn is_supported_coordinator_provider_kind(provider_kind: &str) -> bool {
    let normalized = provider_kind.trim().to_ascii_lowercase();
    normalized == COORDINATOR_HTTP_JSON_PROVIDER_KIND
        || normalized == EXTERNAL_COORDINATOR_PROVIDER_KIND
}

pub(crate) trait CoordinatorHttpJsonTransport {
    fn post_json(
        &self,
        endpoint: &str,
        api_key: &str,
        body: &str,
        timeout: Duration,
    ) -> Result<String, String>;
}

pub(crate) struct TcpCoordinatorHttpJsonTransport;

impl CoordinatorHttpJsonTransport for TcpCoordinatorHttpJsonTransport {
    fn post_json(
        &self,
        endpoint: &str,
        api_key: &str,
        body: &str,
        timeout: Duration,
    ) -> Result<String, String> {
        post_json(endpoint, api_key, body, timeout)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct HttpEndpoint {
    host: String,
    port: u16,
    path: String,
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
) -> Result<CoordinatorProviderOutcome, String> {
    let payload = provider_payload_value(response_body)?;
    let envelope = serde_json::from_value::<ProviderResponseEnvelope>(payload).map_err(|_| {
        "Coordinator provider response did not match the expected Hobit JSON shape.".to_owned()
    })?;

    if envelope.assistant_text.trim().is_empty() {
        return Err("Coordinator provider response did not include assistant_text.".to_owned());
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

fn provider_payload_value(response_body: &str) -> Result<Value, String> {
    let value = serde_json::from_str::<Value>(response_body)
        .map_err(|_| "Coordinator provider response was not valid JSON.".to_owned())?;

    if value.get("assistant_text").is_some() {
        return Ok(value);
    }

    for pointer in [
        "/choices/0/message/content",
        "/output_text",
        "/output/0/content/0/text",
    ] {
        if let Some(content) = value.pointer(pointer).and_then(Value::as_str) {
            return serde_json::from_str::<Value>(content)
                .or_else(|_| Ok(json!({ "assistant_text": content })));
        }
    }

    Err("Coordinator provider response did not contain assistant text.".to_owned())
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

fn post_json(
    endpoint: &str,
    api_key: &str,
    body: &str,
    timeout: Duration,
) -> Result<String, String> {
    let endpoint = parse_http_endpoint(endpoint)?;
    let mut stream = TcpStream::connect((endpoint.host.as_str(), endpoint.port))
        .map_err(|error| format!("Coordinator provider connection failed: {error}"))?;
    let timeout = Some(timeout);
    stream
        .set_read_timeout(timeout)
        .map_err(|error| format!("Coordinator provider read timeout could not be set: {error}"))?;
    stream
        .set_write_timeout(timeout)
        .map_err(|error| format!("Coordinator provider write timeout could not be set: {error}"))?;

    let request = http_request(&endpoint, api_key, body);
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Coordinator provider request write failed: {error}"))?;

    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|error| format!("Coordinator provider response read failed: {error}"))?;
    parse_http_response(&String::from_utf8_lossy(&response))
}

fn http_request(endpoint: &HttpEndpoint, api_key: &str, body: &str) -> String {
    let headers = [
        format!("POST {} HTTP/1.1", endpoint.path),
        format!("Host: {}", host_header(endpoint)),
        "Content-Type: application/json".to_owned(),
        "Accept: application/json".to_owned(),
        "Connection: close".to_owned(),
        format!("Authorization: Bearer {api_key}"),
        format!("Content-Length: {}", body.len()),
    ];

    format!("{}\r\n\r\n{body}", headers.join("\r\n"))
}

fn parse_http_endpoint(endpoint: &str) -> Result<HttpEndpoint, String> {
    if endpoint.starts_with("https://") {
        return Err(
            "HTTPS Coordinator provider endpoints need a TLS-enabled HTTP adapter. This slice supports explicit http:// endpoints only.".to_owned(),
        );
    }

    let Some(rest) = endpoint.strip_prefix("http://") else {
        return Err("HOBIT_COORDINATOR_PROVIDER_ENDPOINT must start with http://.".to_owned());
    };
    let (authority, path) = rest
        .split_once('/')
        .map(|(authority, path)| (authority, format!("/{path}")))
        .unwrap_or((rest, "/".to_owned()));

    if authority.is_empty() || authority.contains('@') {
        return Err("Coordinator provider endpoint host is invalid.".to_owned());
    }

    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => {
            let port = port
                .parse::<u16>()
                .map_err(|_| "Coordinator provider endpoint port is invalid.".to_owned())?;
            (host.to_owned(), port)
        }
        None => (authority.to_owned(), 80),
    };

    if host.is_empty() {
        return Err("Coordinator provider endpoint host is invalid.".to_owned());
    }

    Ok(HttpEndpoint { host, port, path })
}

fn parse_http_response(response: &str) -> Result<String, String> {
    let Some((header_text, body)) = response.split_once("\r\n\r\n") else {
        return Err("Coordinator provider response was not valid HTTP.".to_owned());
    };
    let mut header_lines = header_text.lines();
    let status_line = header_lines
        .next()
        .ok_or_else(|| "Coordinator provider response status was missing.".to_owned())?;
    let status_code = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "Coordinator provider response status was invalid.".to_owned())?;
    let headers = header_lines.collect::<Vec<_>>();
    let body = if headers.iter().any(|header| {
        header
            .to_ascii_lowercase()
            .starts_with("transfer-encoding: chunked")
    }) {
        decode_chunked_body(body).unwrap_or_else(|| body.to_owned())
    } else {
        body.to_owned()
    };

    if !(200..300).contains(&status_code) {
        return Err(format!(
            "Coordinator provider returned HTTP status {status_code}."
        ));
    }

    Ok(body)
}

fn decode_chunked_body(body: &str) -> Option<String> {
    let mut decoded = String::new();
    let mut remaining = body;

    loop {
        let (size_line, after_size) = remaining.split_once("\r\n")?;
        let size = usize::from_str_radix(size_line.trim(), 16).ok()?;
        if size == 0 {
            return Some(decoded);
        }
        if after_size.len() < size + 2 {
            return None;
        }
        let chunk = after_size.get(..size)?;
        decoded.push_str(chunk);
        remaining = after_size.get(size + 2..)?;
    }
}

fn host_header(endpoint: &HttpEndpoint) -> String {
    if endpoint.port == 80 {
        endpoint.host.clone()
    } else {
        format!("{}:{}", endpoint.host, endpoint.port)
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
