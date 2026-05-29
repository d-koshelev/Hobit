use crate::WorkspaceServiceError;

use super::{
    jdbc_query_types::{
        CheckJdbcSidecarHealthInput, JdbcExperimentalSidecarRuntimeInput,
        JdbcSidecarDiagnosticSummary, ProbeJdbcDriverInput,
    },
    jdbc_runtime::{sanitize_error, STATUS_NOT_CONFIGURED},
    jdbc_runtime_config::{contains_secret_bearing_url_key, explicit_sidecar_diagnostic_runner},
    validation::required_input,
    WorkspaceService,
};

const DEFAULT_DIAGNOSTIC_TIMEOUT_MS: u64 = 10_000;
const MAX_DIAGNOSTIC_TIMEOUT_MS: u64 = 10_000;

impl WorkspaceService {
    pub fn check_jdbc_sidecar_health(
        &self,
        input: CheckJdbcSidecarHealthInput,
    ) -> Result<JdbcSidecarDiagnosticSummary, WorkspaceServiceError> {
        let input = normalize_health_input(input)?;
        self.validate_jdbc_query_owner(
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
        )?;

        if contains_secret_bearing_url_key(&input.experimental_sidecar.jdbc_url) {
            return Ok(secret_bearing_url_diagnostic("health_check"));
        }

        let timeout_ms = diagnostic_timeout_ms(&input.experimental_sidecar);
        let runner =
            match explicit_sidecar_diagnostic_runner(&input.experimental_sidecar, timeout_ms) {
                Ok(runner) => runner,
                Err(message) => {
                    return Ok(failed_diagnostic(
                        "health_check",
                        STATUS_NOT_CONFIGURED,
                        &message,
                    ));
                }
            };

        Ok(runner.check_health())
    }

    pub fn probe_jdbc_driver(
        &self,
        input: ProbeJdbcDriverInput,
    ) -> Result<JdbcSidecarDiagnosticSummary, WorkspaceServiceError> {
        let input = normalize_probe_input(input)?;
        self.validate_jdbc_query_owner(
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
        )?;

        let driver_jar_path = input.experimental_sidecar.driver_jar_path.trim();
        if driver_jar_path.is_empty() {
            return Ok(failed_diagnostic(
                "driver_probe",
                STATUS_NOT_CONFIGURED,
                "JDBC driver JAR path is required for driver probe.",
            ));
        }

        if contains_secret_bearing_url_key(&input.experimental_sidecar.jdbc_url) {
            return Ok(secret_bearing_url_diagnostic("driver_probe"));
        }

        let timeout_ms = diagnostic_timeout_ms(&input.experimental_sidecar);
        let runner =
            match explicit_sidecar_diagnostic_runner(&input.experimental_sidecar, timeout_ms) {
                Ok(runner) => runner,
                Err(message) => {
                    return Ok(failed_diagnostic(
                        "driver_probe",
                        STATUS_NOT_CONFIGURED,
                        &message,
                    ));
                }
            };

        Ok(runner.probe_driver(
            driver_jar_path,
            input.experimental_sidecar.driver_class_name.as_deref(),
        ))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedHealthInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    experimental_sidecar: JdbcExperimentalSidecarRuntimeInput,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedProbeInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    experimental_sidecar: JdbcExperimentalSidecarRuntimeInput,
}

fn normalize_health_input(
    input: CheckJdbcSidecarHealthInput,
) -> Result<NormalizedHealthInput, WorkspaceServiceError> {
    Ok(NormalizedHealthInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        experimental_sidecar: input.experimental_sidecar,
    })
}

fn normalize_probe_input(
    input: ProbeJdbcDriverInput,
) -> Result<NormalizedProbeInput, WorkspaceServiceError> {
    Ok(NormalizedProbeInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        experimental_sidecar: input.experimental_sidecar,
    })
}

fn diagnostic_timeout_ms(input: &JdbcExperimentalSidecarRuntimeInput) -> u64 {
    input
        .timeout_ms
        .unwrap_or(DEFAULT_DIAGNOSTIC_TIMEOUT_MS)
        .clamp(1, MAX_DIAGNOSTIC_TIMEOUT_MS)
}

fn failed_diagnostic(action: &str, status: &str, message: &str) -> JdbcSidecarDiagnosticSummary {
    JdbcSidecarDiagnosticSummary {
        action: action.to_owned(),
        ok: false,
        status: status.to_owned(),
        message: sanitize_error(message),
        details: None,
        duration_ms: 0,
        no_secrets_returned: true,
        no_ai_context_shared: true,
    }
}

fn secret_bearing_url_diagnostic(action: &str) -> JdbcSidecarDiagnosticSummary {
    failed_diagnostic(
        action,
        STATUS_NOT_CONFIGURED,
        "JDBC URL must not contain password, token, or secret parameters; use a credential environment variable name.",
    )
}
