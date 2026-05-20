use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

pub(crate) trait CoordinatorHttpJsonTransport {
    fn post_json(
        &self,
        endpoint: &str,
        api_key: &str,
        body: &str,
        timeout: Duration,
        max_response_body_bytes: usize,
    ) -> Result<String, CoordinatorHttpJsonProviderError>;
}

pub(crate) struct TcpCoordinatorHttpJsonTransport;

impl CoordinatorHttpJsonTransport for TcpCoordinatorHttpJsonTransport {
    fn post_json(
        &self,
        endpoint: &str,
        api_key: &str,
        body: &str,
        timeout: Duration,
        max_response_body_bytes: usize,
    ) -> Result<String, CoordinatorHttpJsonProviderError> {
        post_json(endpoint, api_key, body, timeout, max_response_body_bytes)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct CoordinatorHttpJsonProviderError {
    pub(crate) kind: CoordinatorHttpJsonProviderErrorKind,
    pub(crate) message: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CoordinatorHttpJsonProviderErrorKind {
    InvalidResponse,
    NetworkFailure,
    ProviderError,
    Timeout,
    Unsupported,
}

impl CoordinatorHttpJsonProviderError {
    pub(crate) fn invalid_response(message: impl Into<String>) -> Self {
        Self::new(
            CoordinatorHttpJsonProviderErrorKind::InvalidResponse,
            message,
        )
    }

    pub(crate) fn network_failure(message: impl Into<String>) -> Self {
        Self::new(
            CoordinatorHttpJsonProviderErrorKind::NetworkFailure,
            message,
        )
    }

    pub(crate) fn provider_error(message: impl Into<String>) -> Self {
        Self::new(CoordinatorHttpJsonProviderErrorKind::ProviderError, message)
    }

    pub(crate) fn timeout(message: impl Into<String>) -> Self {
        Self::new(CoordinatorHttpJsonProviderErrorKind::Timeout, message)
    }

    pub(crate) fn unsupported(message: impl Into<String>) -> Self {
        Self::new(CoordinatorHttpJsonProviderErrorKind::Unsupported, message)
    }

    fn new(kind: CoordinatorHttpJsonProviderErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct HttpEndpoint {
    host: String,
    port: u16,
    path: String,
}

fn post_json(
    endpoint: &str,
    api_key: &str,
    body: &str,
    timeout: Duration,
    max_response_body_bytes: usize,
) -> Result<String, CoordinatorHttpJsonProviderError> {
    let endpoint = parse_http_endpoint(endpoint)?;
    let mut stream = connect_with_timeout(&endpoint, timeout)?;
    let timeout = Some(timeout);
    stream.set_read_timeout(timeout).map_err(|error| {
        CoordinatorHttpJsonProviderError::network_failure(format!(
            "Coordinator provider read timeout could not be set: {error}"
        ))
    })?;
    stream.set_write_timeout(timeout).map_err(|error| {
        CoordinatorHttpJsonProviderError::network_failure(format!(
            "Coordinator provider write timeout could not be set: {error}"
        ))
    })?;

    let request = http_request(&endpoint, api_key, body);
    stream
        .write_all(request.as_bytes())
        .map_err(|error| io_error("Coordinator provider request write failed.", error))?;

    let response = read_capped_response(&mut stream, max_response_body_bytes)?;
    parse_http_response(&response)
}

fn connect_with_timeout(
    endpoint: &HttpEndpoint,
    timeout: Duration,
) -> Result<TcpStream, CoordinatorHttpJsonProviderError> {
    let addresses = (endpoint.host.as_str(), endpoint.port)
        .to_socket_addrs()
        .map_err(|_| {
            CoordinatorHttpJsonProviderError::network_failure(
                "Coordinator provider host could not be resolved.",
            )
        })?
        .collect::<Vec<_>>();

    if addresses.is_empty() {
        return Err(CoordinatorHttpJsonProviderError::network_failure(
            "Coordinator provider host did not resolve to a network address.",
        ));
    }

    let mut saw_timeout = false;
    for address in addresses {
        match TcpStream::connect_timeout(&address, timeout) {
            Ok(stream) => return Ok(stream),
            Err(error) if is_timeout_error(&error) => saw_timeout = true,
            Err(_) => {}
        }
    }

    if saw_timeout {
        Err(CoordinatorHttpJsonProviderError::timeout(
            "Coordinator provider request timed out while connecting.",
        ))
    } else {
        Err(CoordinatorHttpJsonProviderError::network_failure(
            "Coordinator provider connection failed.",
        ))
    }
}

fn read_capped_response(
    stream: &mut TcpStream,
    max_response_body_bytes: usize,
) -> Result<String, CoordinatorHttpJsonProviderError> {
    let mut response = Vec::new();
    let mut chunk = [0_u8; 8192];

    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(bytes_read) => {
                if response.len() + bytes_read > max_response_body_bytes {
                    return Err(CoordinatorHttpJsonProviderError::invalid_response(
                        "Coordinator provider response exceeded the configured size limit.",
                    ));
                }
                response.extend_from_slice(&chunk[..bytes_read]);
            }
            Err(error) => {
                return Err(io_error(
                    "Coordinator provider response read failed.",
                    error,
                ));
            }
        }
    }

    Ok(String::from_utf8_lossy(&response).into_owned())
}

fn io_error(message: &str, error: std::io::Error) -> CoordinatorHttpJsonProviderError {
    if is_timeout_error(&error) {
        CoordinatorHttpJsonProviderError::timeout("Coordinator provider request timed out.")
    } else {
        CoordinatorHttpJsonProviderError::network_failure(format!("{message} {error}"))
    }
}

fn is_timeout_error(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
    )
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

fn parse_http_endpoint(endpoint: &str) -> Result<HttpEndpoint, CoordinatorHttpJsonProviderError> {
    if endpoint.starts_with("https://") {
        return Err(CoordinatorHttpJsonProviderError::unsupported(
            "HTTPS Coordinator provider endpoints need a TLS-enabled HTTP adapter. This slice supports explicit http:// endpoints only.",
        ));
    }

    let Some(rest) = endpoint.strip_prefix("http://") else {
        return Err(CoordinatorHttpJsonProviderError::unsupported(
            "HOBIT_COORDINATOR_PROVIDER_ENDPOINT must start with http://.",
        ));
    };
    let (authority, path) = rest
        .split_once('/')
        .map(|(authority, path)| (authority, format!("/{path}")))
        .unwrap_or((rest, "/".to_owned()));

    if authority.is_empty() || authority.contains('@') {
        return Err(CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider endpoint host is invalid.",
        ));
    }

    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => {
            let port = port.parse::<u16>().map_err(|_| {
                CoordinatorHttpJsonProviderError::invalid_response(
                    "Coordinator provider endpoint port is invalid.",
                )
            })?;
            (host.to_owned(), port)
        }
        None => (authority.to_owned(), 80),
    };

    if host.is_empty() {
        return Err(CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider endpoint host is invalid.",
        ));
    }

    Ok(HttpEndpoint { host, port, path })
}

fn parse_http_response(response: &str) -> Result<String, CoordinatorHttpJsonProviderError> {
    let Some((header_text, body)) = response.split_once("\r\n\r\n") else {
        return Err(CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider response was not valid HTTP.",
        ));
    };
    let mut header_lines = header_text.lines();
    let status_line = header_lines.next().ok_or_else(|| {
        CoordinatorHttpJsonProviderError::invalid_response(
            "Coordinator provider response status was missing.",
        )
    })?;
    let status_code = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| {
            CoordinatorHttpJsonProviderError::invalid_response(
                "Coordinator provider response status was invalid.",
            )
        })?;
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
        return Err(CoordinatorHttpJsonProviderError::provider_error(format!(
            "Coordinator provider returned HTTP status {status_code}."
        )));
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
