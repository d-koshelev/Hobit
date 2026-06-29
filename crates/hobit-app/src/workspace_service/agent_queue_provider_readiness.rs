use std::{env, path::Path};

use hobit_tools::codex_cli::{
    probe_codex_cli, run_codex_cli_doctor_json, CodexCliDoctorOutput, CodexCliDoctorRequest,
    CodexCliProbeOutput, CodexCliProbeRequest,
};
use serde_json::Value;

use crate::WorkspaceServiceError;

use super::{
    CheckQueueLocalProviderAuthContextInput, CheckQueueLocalProviderReadinessInput,
    QueueLocalProviderAuthContextSnapshot, QueueLocalProviderAuthContextSummary,
    QueueLocalProviderAuthContextsSummary, QueueLocalProviderEnvironmentSummary,
    QueueLocalProviderReadinessSummary, WorkspaceService,
};

const CODEX_PROVIDER_ID: &str = "codex";
const QUEUE_LOCAL_EXECUTION_TARGET: &str = "queue_local";
const STATUS_READY: &str = "ready";
const STATUS_BLOCKED: &str = "blocked";
const STATUS_UNKNOWN: &str = "unknown";
const AUTH_READY: &str = "ready";
const AUTH_UNAUTHORIZED: &str = "unauthorized";
const AUTH_MISSING: &str = "missing";
const AUTH_UNKNOWN: &str = "unknown";
const AUTH_NOT_CHECKED: &str = "not_checked";
const AUTH_SOURCE_ENVIRONMENT_PRESENT: &str = "environment_present";
const AUTH_SOURCE_CLI_NATIVE_SESSION_PRESENT: &str = "cli_native_session_present";
const AUTH_SOURCE_NONE_DETECTED: &str = "none_detected";
const AUTH_SOURCE_UNKNOWN: &str = "unknown";
const METHOD_VERSION_ONLY: &str = "version_only";
const METHOD_AUTH_STATUS_COMMAND: &str = "auth_status_command";
const METHOD_NOT_AVAILABLE: &str = "not_available";

const CODEX_AUTH_ENV_VARS: &[&str] = &[
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_ORG_ID",
    "OPENAI_ORGANIZATION",
    "OPENAI_PROJECT",
    "CODEX_HOME",
];

impl WorkspaceService {
    pub fn check_queue_local_provider_readiness(
        &self,
        input: CheckQueueLocalProviderReadinessInput,
    ) -> Result<QueueLocalProviderReadinessSummary, WorkspaceServiceError> {
        let provider_id = input.provider_id.trim();
        if provider_id != CODEX_PROVIDER_ID {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "unsupported queue_local provider id: {provider_id}"
            )));
        }

        Ok(check_codex_provider_readiness_with(
            input.profile_mode,
            collect_environment_summary(),
            || {
                probe_codex_cli(CodexCliProbeRequest {
                    program: None,
                    timeout_ms: None,
                })
            },
            || {
                run_codex_cli_doctor_json(CodexCliDoctorRequest {
                    program: None,
                    timeout_ms: None,
                })
            },
        ))
    }

    pub fn check_queue_local_provider_auth_context(
        &self,
        input: CheckQueueLocalProviderAuthContextInput,
    ) -> Result<QueueLocalProviderAuthContextSummary, WorkspaceServiceError> {
        let provider_id = input.provider_id.trim();
        if provider_id != CODEX_PROVIDER_ID {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "unsupported queue_local provider id: {provider_id}"
            )));
        }

        let app_environment_summary = collect_environment_summary();
        let worker_environment_summary = app_environment_summary.clone();
        let readiness =
            self.check_queue_local_provider_readiness(CheckQueueLocalProviderReadinessInput {
                provider_id: provider_id.to_owned(),
                profile_mode: input.profile_mode.clone(),
            })?;

        Ok(build_auth_context_summary(
            provider_id,
            input.profile_mode,
            normalize_environment_summary(input.operator_environment_summary),
            app_environment_summary,
            worker_environment_summary,
            readiness,
        ))
    }
}

fn collect_environment_summary() -> Vec<QueueLocalProviderEnvironmentSummary> {
    CODEX_AUTH_ENV_VARS
        .iter()
        .map(|name| QueueLocalProviderEnvironmentSummary {
            name: (*name).to_owned(),
            present: env::var_os(name).is_some(),
        })
        .collect()
}

fn normalize_environment_summary(
    environment_summary: Vec<QueueLocalProviderEnvironmentSummary>,
) -> Vec<QueueLocalProviderEnvironmentSummary> {
    CODEX_AUTH_ENV_VARS
        .iter()
        .map(|name| QueueLocalProviderEnvironmentSummary {
            name: (*name).to_owned(),
            present: environment_summary
                .iter()
                .find(|entry| entry.name == *name)
                .map(|entry| entry.present)
                .unwrap_or(false),
        })
        .collect()
}

fn check_codex_provider_readiness_with<P, D>(
    profile_mode: Option<String>,
    environment_summary: Vec<QueueLocalProviderEnvironmentSummary>,
    probe: P,
    doctor: D,
) -> QueueLocalProviderReadinessSummary
where
    P: FnOnce() -> CodexCliProbeOutput,
    D: FnOnce() -> CodexCliDoctorOutput,
{
    let probe = probe();
    let executable_summary = executable_summary(&probe.program);

    if !probe.available {
        return QueueLocalProviderReadinessSummary {
            provider_id: CODEX_PROVIDER_ID.to_owned(),
            execution_target: QUEUE_LOCAL_EXECUTION_TARGET.to_owned(),
            status: STATUS_BLOCKED.to_owned(),
            codex_executable_resolved: false,
            codex_executable_summary: executable_summary,
            codex_version: None,
            auth_status: AUTH_NOT_CHECKED.to_owned(),
            auth_source_summary: auth_source_from_environment(&environment_summary).to_owned(),
            auth_source_fingerprint: None,
            environment_summary,
            readiness_check_method: METHOD_VERSION_ONLY.to_owned(),
            last_known_provider_failure: None,
            blockers: vec!["codex_executable_missing".to_owned()],
            warnings: vec!["Codex executable probe failed.".to_owned()],
            used_direct_database_path: false,
            profile_mode,
        };
    }

    let doctor = doctor();
    let doctor_json = parse_doctor_json(&doctor.stdout);
    let overall_status = doctor_json
        .as_ref()
        .and_then(|json| json.pointer("/overallStatus"))
        .and_then(Value::as_str);
    let auth_check_status = doctor_check_field(&doctor_json, "auth.credentials", "status");
    let auth_check_summary = doctor_check_field(&doctor_json, "auth.credentials", "summary");
    let provider_reachability_status =
        doctor_check_field(&doctor_json, "network.provider_reachability", "status");
    let websocket_status =
        doctor_check_field(&doctor_json, "network.websocket_reachability", "status");
    let codex_version = doctor_json
        .as_ref()
        .and_then(|json| json.pointer("/codexVersion"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or(probe.version);

    let overall_status_normalized = normalize_doctor_status(overall_status);
    let auth_check_status_normalized = normalize_doctor_status(auth_check_status);
    let provider_reachability_status_normalized =
        normalize_doctor_status(provider_reachability_status);
    let websocket_status_normalized = normalize_doctor_status(websocket_status);
    let overall_healthy = doctor_status_is_ok(overall_status_normalized.as_deref());
    let overall_failed = doctor_status_is_failure(overall_status_normalized.as_deref());
    let auth_ready = doctor_status_is_ok(auth_check_status_normalized.as_deref())
        || auth_summary_indicates_configured(auth_check_summary);
    let auth_check_failed =
        doctor_status_is_failure(auth_check_status_normalized.as_deref()) && !auth_ready;
    let auth_check_present = auth_check_status.is_some() || auth_check_summary.is_some();
    let websocket_ready = doctor_status_is_ok(websocket_status_normalized.as_deref());
    let provider_unreachable =
        doctor_status_is_failure(provider_reachability_status_normalized.as_deref())
            || doctor_status_is_failure(websocket_status_normalized.as_deref());
    let unauthorized = auth_check_explicitly_unauthorized(
        &doctor_json,
        overall_status_normalized.as_deref(),
        auth_check_status_normalized.as_deref(),
        auth_check_summary,
    );
    let auth_source_summary =
        auth_source_from_doctor(&environment_summary, auth_check_status, auth_check_summary)
            .to_owned();

    let mut blockers = Vec::new();
    let mut warnings = Vec::new();
    let mut last_known_provider_failure = None;
    let auth_status;
    let status;

    if unauthorized {
        status = STATUS_BLOCKED;
        auth_status = AUTH_UNAUTHORIZED;
        blockers.push("codex_auth_unauthorized".to_owned());
        last_known_provider_failure = Some("codex_auth_unauthorized".to_owned());
    } else if auth_ready && (overall_healthy || websocket_ready || doctor.exit_code == Some(0)) {
        status = STATUS_READY;
        auth_status = AUTH_READY;
    } else if auth_check_failed && !environment_summary.iter().any(|entry| entry.present) {
        status = STATUS_BLOCKED;
        auth_status = AUTH_MISSING;
        blockers.push("codex_auth_missing".to_owned());
    } else if auth_ready {
        status = STATUS_BLOCKED;
        auth_status = AUTH_READY;
        if overall_failed || provider_unreachable {
            blockers.push("codex_provider_unreachable".to_owned());
        }
        if blockers.is_empty() {
            blockers.push("codex_readiness_failed".to_owned());
        }
    } else if doctor.started {
        status = if auth_check_present {
            STATUS_BLOCKED
        } else {
            STATUS_UNKNOWN
        };
        auth_status = AUTH_UNKNOWN;
        if provider_unreachable {
            blockers.push("codex_provider_unreachable".to_owned());
        }
        blockers.push("codex_auth_status_unavailable".to_owned());
    } else {
        status = STATUS_UNKNOWN;
        auth_status = AUTH_UNKNOWN;
        blockers.push("codex_auth_status_unavailable".to_owned());
        warnings.push("Codex doctor readiness command did not complete.".to_owned());
    }

    if status != STATUS_READY
        && doctor.exit_code.is_some_and(|exit_code| exit_code != 0)
        && blockers.is_empty()
    {
        blockers.push("codex_readiness_failed".to_owned());
    }
    if doctor.error_message.is_some() {
        warnings
            .push("Codex doctor readiness command returned an infrastructure error.".to_owned());
    }

    QueueLocalProviderReadinessSummary {
        provider_id: CODEX_PROVIDER_ID.to_owned(),
        execution_target: QUEUE_LOCAL_EXECUTION_TARGET.to_owned(),
        status: status.to_owned(),
        codex_executable_resolved: true,
        codex_executable_summary: executable_summary,
        codex_version,
        auth_status: auth_status.to_owned(),
        auth_source_summary,
        auth_source_fingerprint: None,
        environment_summary,
        readiness_check_method: if doctor.started {
            METHOD_AUTH_STATUS_COMMAND
        } else {
            METHOD_NOT_AVAILABLE
        }
        .to_owned(),
        last_known_provider_failure,
        blockers,
        warnings,
        used_direct_database_path: false,
        profile_mode,
    }
}

fn build_auth_context_summary(
    provider_id: &str,
    profile_mode: Option<String>,
    operator_environment_summary: Vec<QueueLocalProviderEnvironmentSummary>,
    app_environment_summary: Vec<QueueLocalProviderEnvironmentSummary>,
    worker_environment_summary: Vec<QueueLocalProviderEnvironmentSummary>,
    readiness: QueueLocalProviderReadinessSummary,
) -> QueueLocalProviderAuthContextSummary {
    let doctor_environment_summary = readiness.environment_summary.clone();
    let operator_context = auth_context_snapshot(
        "operator_process",
        operator_environment_summary.clone(),
        None,
        None,
    );
    let app_context =
        auth_context_snapshot("app_process", app_environment_summary.clone(), None, None);
    let worker_context = auth_context_snapshot(
        "worker_launch_context",
        worker_environment_summary.clone(),
        None,
        None,
    );
    let doctor_context = auth_context_snapshot(
        "codex_doctor_context",
        doctor_environment_summary,
        Some(readiness.auth_status.clone()),
        Some(readiness.readiness_check_method.clone()),
    );

    let mut mismatch_reasons = Vec::new();
    if auth_env_present_in(&operator_environment_summary)
        && !auth_env_present_in(&app_environment_summary)
    {
        mismatch_reasons.push("auth_env_present_in_operator_missing_in_app".to_owned());
    }
    if auth_env_present_in(&app_environment_summary)
        && !auth_env_present_in(&worker_environment_summary)
    {
        mismatch_reasons.push("auth_env_present_in_app_missing_in_worker".to_owned());
    }
    if readiness.auth_status == AUTH_UNAUTHORIZED {
        mismatch_reasons.push("codex_doctor_unauthorized".to_owned());
    }

    let env_mismatch = mismatch_reasons.iter().any(|reason| {
        reason == "auth_env_present_in_operator_missing_in_app"
            || reason == "auth_env_present_in_app_missing_in_worker"
    });
    let auth_source_classification = classify_auth_source(
        &operator_environment_summary,
        &app_environment_summary,
        &worker_environment_summary,
        &readiness,
    );
    let status = if env_mismatch {
        "mismatch"
    } else if readiness.status == STATUS_UNKNOWN {
        "unavailable"
    } else {
        "aligned"
    };

    QueueLocalProviderAuthContextSummary {
        provider_id: provider_id.to_owned(),
        status: status.to_owned(),
        contexts: QueueLocalProviderAuthContextsSummary {
            operator_process: operator_context,
            app_process: app_context,
            worker_launch_context: worker_context,
            codex_doctor_context: doctor_context,
        },
        mismatch_reasons,
        auth_source_classification,
        profile_mode,
        used_direct_database_path: false,
        warnings: readiness.warnings,
    }
}

fn auth_context_snapshot(
    context_id: &str,
    env_presence: Vec<QueueLocalProviderEnvironmentSummary>,
    auth_status: Option<String>,
    readiness_check_method: Option<String>,
) -> QueueLocalProviderAuthContextSnapshot {
    let auth_source_summary = auth_source_from_environment(&env_presence).to_owned();
    QueueLocalProviderAuthContextSnapshot {
        context_id: context_id.to_owned(),
        env_presence,
        auth_source_summary,
        auth_status: auth_status.unwrap_or_else(|| AUTH_NOT_CHECKED.to_owned()),
        readiness_check_method,
    }
}

fn classify_auth_source(
    operator_environment_summary: &[QueueLocalProviderEnvironmentSummary],
    app_environment_summary: &[QueueLocalProviderEnvironmentSummary],
    worker_environment_summary: &[QueueLocalProviderEnvironmentSummary],
    readiness: &QueueLocalProviderReadinessSummary,
) -> String {
    if auth_env_present_in(operator_environment_summary)
        && !auth_env_present_in(app_environment_summary)
    {
        return "auth_env_not_propagated_to_app".to_owned();
    }
    if auth_env_present_in(app_environment_summary)
        && !auth_env_present_in(worker_environment_summary)
    {
        return "auth_env_not_propagated_to_worker".to_owned();
    }
    if readiness.auth_status == AUTH_UNAUTHORIZED {
        return "auth_source_invalid".to_owned();
    }
    if readiness.auth_status == AUTH_MISSING {
        return "auth_source_absent".to_owned();
    }
    if readiness.status == STATUS_READY {
        return "auth_source_ready".to_owned();
    }
    "unknown_auth_failure".to_owned()
}

fn auth_env_present_in(environment_summary: &[QueueLocalProviderEnvironmentSummary]) -> bool {
    environment_summary
        .iter()
        .any(|entry| entry.name == "OPENAI_API_KEY" && entry.present)
}

fn parse_doctor_json(output: &str) -> Option<Value> {
    serde_json::from_str(output).ok()
}

fn doctor_check_field<'a>(
    doctor_json: &'a Option<Value>,
    check_id: &str,
    field: &str,
) -> Option<&'a str> {
    doctor_check_value(doctor_json, check_id, field).and_then(Value::as_str)
}

fn doctor_check_value<'a>(
    doctor_json: &'a Option<Value>,
    check_id: &str,
    field: &str,
) -> Option<&'a Value> {
    let checks = doctor_json.as_ref()?.get("checks")?;

    if let Some(value) = checks.get(check_id).and_then(|check| check.get(field)) {
        return Some(value);
    }

    let mut check = checks;
    for segment in check_id.split('.') {
        check = check.get(segment)?;
    }
    check.get(field)
}

fn normalize_doctor_status(status: Option<&str>) -> Option<String> {
    status
        .map(str::trim)
        .filter(|status| !status.is_empty())
        .map(|status| status.to_ascii_lowercase())
}

fn doctor_status_is_ok(status: Option<&str>) -> bool {
    matches!(status, Some("ok" | "pass" | "passed" | "ready"))
}

fn doctor_status_is_failure(status: Option<&str>) -> bool {
    matches!(
        status,
        Some("fail" | "failed" | "error" | "unauthorized" | "missing")
    )
}

fn auth_summary_indicates_configured(summary: Option<&str>) -> bool {
    let Some(summary) = summary else {
        return false;
    };
    let summary = summary.to_ascii_lowercase();
    summary.contains("auth is configured") || summary.contains("auth is provided by environment")
}

fn auth_check_explicitly_unauthorized(
    doctor_json: &Option<Value>,
    overall_status: Option<&str>,
    auth_check_status: Option<&str>,
    auth_check_summary: Option<&str>,
) -> bool {
    if auth_check_status == Some("unauthorized") {
        return true;
    }

    let auth_status_failed =
        doctor_status_is_failure(auth_check_status) && !doctor_status_is_ok(auth_check_status);
    if !auth_status_failed && !doctor_status_is_failure(overall_status) {
        return false;
    }

    let auth_text = doctor_check_text(doctor_json, "auth.credentials", auth_check_summary);
    contains_unauthorized_marker(&auth_text)
}

fn doctor_check_text(doctor_json: &Option<Value>, check_id: &str, summary: Option<&str>) -> String {
    let mut text = String::new();
    if let Some(summary) = summary {
        text.push_str(summary);
        text.push(' ');
    }
    if let Some(details) = doctor_check_value(doctor_json, check_id, "details") {
        text.push_str(&details.to_string());
    }
    text.to_ascii_lowercase()
}

fn contains_unauthorized_marker(text: &str) -> bool {
    text.contains("401 unauthorized")
        || text.contains("unauthorized")
        || text.contains("missing bearer or basic authentication")
}

fn auth_source_from_environment(
    environment_summary: &[QueueLocalProviderEnvironmentSummary],
) -> &'static str {
    if environment_summary
        .iter()
        .any(|entry| entry.name == "OPENAI_API_KEY" && entry.present)
    {
        AUTH_SOURCE_ENVIRONMENT_PRESENT
    } else {
        AUTH_SOURCE_NONE_DETECTED
    }
}

fn auth_source_from_doctor(
    environment_summary: &[QueueLocalProviderEnvironmentSummary],
    auth_check_status: Option<&str>,
    auth_check_summary: Option<&str>,
) -> &'static str {
    if environment_summary
        .iter()
        .any(|entry| entry.name == "OPENAI_API_KEY" && entry.present)
    {
        return AUTH_SOURCE_ENVIRONMENT_PRESENT;
    }

    if auth_check_status == Some("ok") {
        let summary = auth_check_summary.unwrap_or_default().to_ascii_lowercase();
        if summary.contains("file") || summary.contains("session") || summary.contains("login") {
            return AUTH_SOURCE_CLI_NATIVE_SESSION_PRESENT;
        }
        return AUTH_SOURCE_UNKNOWN;
    }

    AUTH_SOURCE_NONE_DETECTED
}

fn executable_summary(program: &str) -> Option<String> {
    let program = program.trim();
    if program.is_empty() {
        return None;
    }
    Path::new(program)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| Some(program.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env_summary(openai_key_present: bool) -> Vec<QueueLocalProviderEnvironmentSummary> {
        vec![
            QueueLocalProviderEnvironmentSummary {
                name: "OPENAI_API_KEY".to_owned(),
                present: openai_key_present,
            },
            QueueLocalProviderEnvironmentSummary {
                name: "CODEX_HOME".to_owned(),
                present: false,
            },
        ]
    }

    fn probe(available: bool) -> CodexCliProbeOutput {
        CodexCliProbeOutput {
            available,
            program: if available {
                r"C:\Users\someone\AppData\Roaming\npm\codex.cmd".to_owned()
            } else {
                "missing-codex".to_owned()
            },
            version: available.then(|| "codex-cli 0.142.3".to_owned()),
            stdout: String::new(),
            stderr: String::new(),
            error_message: (!available).then(|| "could not resolve Codex executable".to_owned()),
            duration_ms: 1,
        }
    }

    fn doctor(stdout: impl Into<String>, exit_code: Option<i32>) -> CodexCliDoctorOutput {
        CodexCliDoctorOutput {
            started: true,
            program: "codex.cmd".to_owned(),
            exit_code,
            stdout: stdout.into(),
            stderr: String::new(),
            error_message: None,
            duration_ms: 1,
        }
    }

    fn readiness(status: &str, auth_status: &str) -> QueueLocalProviderReadinessSummary {
        QueueLocalProviderReadinessSummary {
            provider_id: "codex".to_owned(),
            execution_target: "queue_local".to_owned(),
            status: status.to_owned(),
            codex_executable_resolved: true,
            codex_executable_summary: Some("codex.cmd".to_owned()),
            codex_version: Some("0.142.3".to_owned()),
            auth_status: auth_status.to_owned(),
            auth_source_summary: "environment_present".to_owned(),
            auth_source_fingerprint: None,
            environment_summary: env_summary(true),
            readiness_check_method: "auth_status_command".to_owned(),
            last_known_provider_failure: (auth_status == "unauthorized")
                .then(|| "codex_auth_unauthorized".to_owned()),
            blockers: if auth_status == "unauthorized" {
                vec!["codex_auth_unauthorized".to_owned()]
            } else {
                Vec::new()
            },
            warnings: Vec::new(),
            used_direct_database_path: false,
            profile_mode: Some("dogfood".to_owned()),
        }
    }

    #[test]
    fn queue_local_provider_readiness_reports_executable_missing_without_worker() {
        let summary = check_codex_provider_readiness_with(
            Some("dogfood".to_owned()),
            env_summary(false),
            || probe(false),
            || panic!("doctor must not run when executable probe fails"),
        );

        assert_eq!(summary.provider_id, "codex");
        assert_eq!(summary.execution_target, "queue_local");
        assert_eq!(summary.status, "blocked");
        assert!(!summary.codex_executable_resolved);
        assert_eq!(summary.auth_status, "not_checked");
        assert_eq!(summary.blockers, vec!["codex_executable_missing"]);
        assert_eq!(summary.used_direct_database_path, false);
        assert_eq!(summary.profile_mode.as_deref(), Some("dogfood"));
    }

    #[test]
    fn queue_local_provider_readiness_reports_auth_unauthorized_without_secret_values() {
        let summary = check_codex_provider_readiness_with(
            Some("dogfood".to_owned()),
            env_summary(true),
            || probe(true),
            || {
                doctor(
                    r#"{
  "overallStatus": "fail",
  "codexVersion": "0.142.3",
  "checks": {
    "auth.credentials": {
      "status": "error",
      "summary": "http 401 Unauthorized: Missing bearer or basic authentication in header"
    },
    "network.websocket_reachability": {
      "status": "ok",
      "summary": "websocket handshake returned HTTP 101"
    }
  }
}"#,
                    Some(1),
                )
            },
        );

        assert_eq!(summary.status, "blocked");
        assert_eq!(summary.auth_status, "unauthorized");
        assert_eq!(summary.auth_source_summary, "environment_present");
        assert_eq!(summary.blockers, vec!["codex_auth_unauthorized"]);
        assert_eq!(
            summary.last_known_provider_failure.as_deref(),
            Some("codex_auth_unauthorized")
        );
        assert_eq!(
            summary.codex_executable_summary.as_deref(),
            Some("codex.cmd")
        );
        let serialized = serde_json::to_string(&summary).expect("summary json");
        assert!(serialized.contains("OPENAI_API_KEY"));
        assert!(!serialized.contains("secret-value"));
        assert!(!serialized.contains("sk-"));
        assert!(!serialized.contains("C:\\\\Users\\\\someone"));
    }

    #[test]
    fn queue_local_provider_readiness_reports_ready_from_current_doctor_ok_shape() {
        let summary = check_codex_provider_readiness_with(
            Some("dogfood".to_owned()),
            env_summary(true),
            || probe(true),
            || {
                doctor(
                    r#"{
  "overallStatus": "ok",
  "codexVersion": "0.142.3",
  "checks": {
    "auth": {
      "credentials": {
        "status": "ok",
        "summary": "auth is configured",
        "details": {
          "openaiApiKeyPresent": true,
          "storedChatGptTokens": true
        }
      }
    },
    "network": {
      "websocket_reachability": {
        "status": "ok",
        "summary": "websocket handshake returned HTTP 101",
        "details": {
          "httpStatus": 101
        }
      },
      "provider_reachability": {
        "status": "error",
        "summary": "route probe returned HTTP 401",
        "details": {
          "httpStatus": 401,
          "routeProbe": "HTTP 401 provider route probe"
        }
      }
    }
  }
}"#,
                    Some(1),
                )
            },
        );

        assert_eq!(summary.status, "ready");
        assert_eq!(summary.auth_status, "ready");
        assert_eq!(summary.auth_source_summary, "environment_present");
        assert!(summary.blockers.is_empty(), "{summary:#?}");
        assert!(!summary
            .blockers
            .contains(&"codex_auth_status_unavailable".to_owned()));
        assert!(!summary
            .blockers
            .contains(&"codex_auth_unauthorized".to_owned()));
        assert_eq!(summary.last_known_provider_failure, None);
    }

    #[test]
    fn queue_local_provider_readiness_reports_ready_from_doctor_pass() {
        let summary = check_codex_provider_readiness_with(
            None,
            env_summary(true),
            || probe(true),
            || {
                doctor(
                    r#"{
  "overallStatus": "pass",
  "codexVersion": "0.142.3",
  "checks": {
    "auth.credentials": {
      "status": "ok",
      "summary": "auth is provided by environment"
    }
  }
}"#,
                    Some(0),
                )
            },
        );

        assert_eq!(summary.status, "ready");
        assert_eq!(summary.auth_status, "ready");
        assert!(summary.blockers.is_empty());
        assert_eq!(summary.readiness_check_method, "auth_status_command");
    }

    #[test]
    fn queue_local_provider_readiness_reports_unknown_from_malformed_doctor_json() {
        let summary = check_codex_provider_readiness_with(
            None,
            env_summary(true),
            || probe(true),
            || doctor(r#"{ "overallStatus": "ok", "checks": "#, Some(0)),
        );

        assert_eq!(summary.status, "unknown");
        assert_eq!(summary.auth_status, "unknown");
        assert!(summary
            .blockers
            .contains(&"codex_auth_status_unavailable".to_owned()));
        assert!(!summary
            .blockers
            .contains(&"codex_auth_unauthorized".to_owned()));
    }

    #[test]
    fn queue_local_provider_readiness_auth_context_reports_env_presence_only_and_redacts_values() {
        let summary = build_auth_context_summary(
            "codex",
            Some("dogfood".to_owned()),
            vec![QueueLocalProviderEnvironmentSummary {
                name: "OPENAI_API_KEY".to_owned(),
                present: true,
            }],
            env_summary(true),
            env_summary(true),
            readiness("blocked", "unauthorized"),
        );

        assert_eq!(summary.status, "aligned");
        assert_eq!(summary.auth_source_classification, "auth_source_invalid");
        assert!(summary
            .mismatch_reasons
            .contains(&"codex_doctor_unauthorized".to_owned()));
        assert_eq!(
            summary.contexts.operator_process.env_presence[0].name,
            "OPENAI_API_KEY"
        );
        assert_eq!(
            summary.contexts.operator_process.env_presence[0].present,
            true
        );
        let json = serde_json::to_string(&summary).expect("auth context json");
        assert!(!json.contains("sk-secret-auth-context"));
        assert!(!json.contains("secret-value"));
        assert!(!json.contains("token="));
    }

    #[test]
    fn queue_local_provider_readiness_auth_context_classifies_operator_to_app_mismatch() {
        let summary = build_auth_context_summary(
            "codex",
            Some("dogfood".to_owned()),
            env_summary(true),
            env_summary(false),
            env_summary(false),
            readiness("blocked", "missing"),
        );

        assert_eq!(summary.status, "mismatch");
        assert_eq!(
            summary.auth_source_classification,
            "auth_env_not_propagated_to_app"
        );
        assert_eq!(
            summary.mismatch_reasons,
            vec!["auth_env_present_in_operator_missing_in_app"]
        );
    }

    #[test]
    fn queue_local_provider_readiness_auth_context_classifies_app_to_worker_mismatch() {
        let summary = build_auth_context_summary(
            "codex",
            Some("dogfood".to_owned()),
            env_summary(true),
            env_summary(true),
            env_summary(false),
            readiness("blocked", "missing"),
        );

        assert_eq!(summary.status, "mismatch");
        assert_eq!(
            summary.auth_source_classification,
            "auth_env_not_propagated_to_worker"
        );
        assert_eq!(
            summary.mismatch_reasons,
            vec!["auth_env_present_in_app_missing_in_worker"]
        );
    }

    #[test]
    fn queue_local_provider_readiness_dogfood_profile_does_not_hide_auth_source_when_env_is_aligned(
    ) {
        let summary = build_auth_context_summary(
            "codex",
            Some("dogfood".to_owned()),
            env_summary(true),
            env_summary(true),
            env_summary(true),
            readiness("ready", "ready"),
        );

        assert_eq!(summary.status, "aligned");
        assert_eq!(summary.auth_source_classification, "auth_source_ready");
        assert!(summary.mismatch_reasons.is_empty());
        assert_eq!(summary.profile_mode.as_deref(), Some("dogfood"));
    }
}
