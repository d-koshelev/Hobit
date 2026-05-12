use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use hobit_app::{
    AgentChatAiProposalProvider, AgentChatAiProviderOutcome, AgentChatAiRequestArtifact,
};
use serde_json::{json, Value};

const DEFAULT_TIMEOUT_SECS: u64 = 60;
const MAX_ERROR_BODY_CHARS: usize = 1_000;

pub(crate) struct EnvHttpAgentChatAiProvider {
    config: Option<ProviderConfig>,
}

#[derive(Clone, Debug)]
struct ProviderConfig {
    endpoint: String,
    model: String,
    api_key: Option<String>,
}

#[derive(Clone, Debug)]
struct HttpEndpoint {
    host: String,
    port: u16,
    path: String,
}

impl EnvHttpAgentChatAiProvider {
    pub(crate) fn from_env() -> Self {
        let config = match (
            env_var("HOBIT_AI_PROVIDER_ENDPOINT"),
            env_var("HOBIT_AI_PROVIDER_MODEL"),
        ) {
            (Some(endpoint), Some(model)) => Some(ProviderConfig {
                endpoint,
                model,
                api_key: env_var("HOBIT_AI_PROVIDER_API_KEY"),
            }),
            _ => None,
        };

        Self { config }
    }
}

impl AgentChatAiProposalProvider for EnvHttpAgentChatAiProvider {
    fn request_agent_chat_ai_proposal(
        &self,
        artifact: &AgentChatAiRequestArtifact,
    ) -> AgentChatAiProviderOutcome {
        let Some(config) = &self.config else {
            return AgentChatAiProviderOutcome::NotConfigured {
                message: "Set HOBIT_AI_PROVIDER_ENDPOINT and HOBIT_AI_PROVIDER_MODEL to enable the backend AI proposal provider.".to_owned(),
            };
        };

        let body = provider_request_body(config, artifact).to_string();
        let response_body = match post_json(config, &body) {
            Ok(response_body) => response_body,
            Err(message) => return AgentChatAiProviderOutcome::RequestFailed { message },
        };

        match extract_provider_message_content(&response_body) {
            Some(raw_response) => AgentChatAiProviderOutcome::Response { raw_response },
            None => AgentChatAiProviderOutcome::RequestFailed {
                message: "AI provider response did not contain proposal content.".to_owned(),
            },
        }
    }
}

fn post_json(config: &ProviderConfig, body: &str) -> Result<String, String> {
    let endpoint = parse_http_endpoint(&config.endpoint)?;
    let mut stream = TcpStream::connect((endpoint.host.as_str(), endpoint.port))
        .map_err(|error| format!("AI provider connection failed: {error}"))?;
    let timeout = Some(Duration::from_secs(DEFAULT_TIMEOUT_SECS));
    stream
        .set_read_timeout(timeout)
        .map_err(|error| format!("AI provider read timeout could not be set: {error}"))?;
    stream
        .set_write_timeout(timeout)
        .map_err(|error| format!("AI provider write timeout could not be set: {error}"))?;

    let mut headers = vec![
        format!("POST {} HTTP/1.1", endpoint.path),
        format!("Host: {}", host_header(&endpoint)),
        "Content-Type: application/json".to_owned(),
        "Accept: application/json".to_owned(),
        "Connection: close".to_owned(),
        format!("Content-Length: {}", body.as_bytes().len()),
    ];

    if let Some(api_key) = &config.api_key {
        headers.push(format!("Authorization: Bearer {api_key}"));
    }

    let request = format!("{}\r\n\r\n{body}", headers.join("\r\n"));
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("AI provider request write failed: {error}"))?;

    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|error| format!("AI provider response read failed: {error}"))?;
    parse_http_response(&String::from_utf8_lossy(&response))
}

fn parse_http_endpoint(endpoint: &str) -> Result<HttpEndpoint, String> {
    if endpoint.starts_with("https://") {
        return Err(
            "HTTPS provider endpoints need a TLS-enabled HTTP adapter. This slice supports explicit http:// endpoints only.".to_owned(),
        );
    }

    let Some(rest) = endpoint.strip_prefix("http://") else {
        return Err("HOBIT_AI_PROVIDER_ENDPOINT must start with http://.".to_owned());
    };
    let (authority, path) = rest
        .split_once('/')
        .map(|(authority, path)| (authority, format!("/{path}")))
        .unwrap_or((rest, "/".to_owned()));

    if authority.is_empty() || authority.contains('@') {
        return Err("AI provider endpoint host is invalid.".to_owned());
    }

    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => {
            let port = port
                .parse::<u16>()
                .map_err(|_| "AI provider endpoint port is invalid.".to_owned())?;
            (host.to_owned(), port)
        }
        None => (authority.to_owned(), 80),
    };

    if host.is_empty() {
        return Err("AI provider endpoint host is invalid.".to_owned());
    }

    Ok(HttpEndpoint { host, port, path })
}

fn parse_http_response(response: &str) -> Result<String, String> {
    let Some((header_text, body)) = response.split_once("\r\n\r\n") else {
        return Err("AI provider response was not valid HTTP.".to_owned());
    };
    let mut header_lines = header_text.lines();
    let status_line = header_lines
        .next()
        .ok_or_else(|| "AI provider response status was missing.".to_owned())?;
    let status_code = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "AI provider response status was invalid.".to_owned())?;
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
            "AI provider returned HTTP {status_code}: {}",
            truncate_for_error(body)
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

fn provider_request_body(config: &ProviderConfig, artifact: &AgentChatAiRequestArtifact) -> Value {
    json!({
        "model": &config.model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt()
            },
            {
                "role": "user",
                "content": artifact_payload_json(artifact)
            }
        ],
        "temperature": 0.2,
        "response_format": {
            "type": "json_object"
        }
    })
}

fn system_prompt() -> &'static str {
    "You are Hobit's Agent Chat proposal provider. Return only structured JSON. You may summarize and propose next steps, but allowed_tools is empty. Do not execute tools, Terminal commands, Git, Notes, Queue, filesystem, scripts, or external-system actions. Mark every proposed action as not_executed."
}

fn artifact_payload_json(artifact: &AgentChatAiRequestArtifact) -> String {
    json!({
        "request_id": &artifact.request_id,
        "workspace_id": &artifact.workspace_id,
        "workbench_id": &artifact.workbench_id,
        "source_widget_instance_id": &artifact.source_widget_instance_id,
        "operator_prompt": &artifact.operator_prompt,
        "approved_context_snapshot": &artifact.approved_context_snapshot,
        "contract_pack_summary": &artifact.contract_pack_summary,
        "allowed_tools": &artifact.allowed_tools,
        "safety_constraints": &artifact.safety_constraints,
        "expected_response_format": &artifact.expected_response_format,
        "validation_plan": &artifact.validation_plan,
        "created_at": &artifact.created_at,
    })
    .to_string()
}

fn extract_provider_message_content(response_body: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(response_body).ok()?;

    if value.get("summary").is_some() {
        return Some(value.to_string());
    }

    if let Some(content) = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
    {
        return Some(content.to_owned());
    }

    if let Some(content) = value.pointer("/output_text").and_then(Value::as_str) {
        return Some(content.to_owned());
    }

    value
        .pointer("/output/0/content/0/text")
        .and_then(Value::as_str)
        .map(str::to_owned)
}

fn host_header(endpoint: &HttpEndpoint) -> String {
    if endpoint.port == 80 {
        endpoint.host.clone()
    } else {
        format!("{}:{}", endpoint.host, endpoint.port)
    }
}

fn env_var(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn truncate_for_error(value: String) -> String {
    if value.chars().count() <= MAX_ERROR_BODY_CHARS {
        return value;
    }

    let mut truncated = value.chars().take(MAX_ERROR_BODY_CHARS).collect::<String>();
    truncated.push_str("...");
    truncated
}
