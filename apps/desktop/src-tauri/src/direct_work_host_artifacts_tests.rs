use std::path::PathBuf;

use hobit_app::{
    CodexDirectWorkStreamEventSummary, RunCodexDirectWorkInput, RuntimeArtifactClass,
    RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind, RuntimeRedactionStatus,
};

use crate::direct_work_host_artifacts::{
    command_payload_artifact, local_path_artifact, runtime_error_artifact,
    DirectWorkHostRuntimeBoundarySummary, DirectWorkHostStartRuntimeArtifacts,
    DirectWorkHostStreamEventRuntimeArtifact,
};

#[test]
fn active_run_status_only_metadata_is_safe_when_safe() {
    let boundary = DirectWorkHostRuntimeBoundarySummary::from_active_run_status("run_1", "active");

    assert_eq!(RuntimeKind::AgentExecutor, boundary.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Running, boundary.execution_status);
    assert_eq!(None, boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::SafeMetadata,
        boundary.artifact.artifact_class
    );
    assert_eq!(
        RuntimeRedactionStatus::NotNeeded,
        boundary.artifact.redaction_status
    );
}

#[test]
fn repo_root_and_local_paths_are_local_path_artifacts() {
    let artifact = local_path_artifact(&PathBuf::from("C:/Users/Private/project"));

    assert_eq!(RuntimeArtifactClass::LocalPath, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn host_command_and_options_are_command_payload() {
    let artifacts = DirectWorkHostStartRuntimeArtifacts::from_input(&direct_work_input());
    let direct_artifact = command_payload_artifact(&[
        "codex.cmd".to_owned(),
        "exec".to_owned(),
        "--sandbox".to_owned(),
        "workspace-write".to_owned(),
    ]);

    assert_eq!(
        RuntimeArtifactClass::CommandPayload,
        artifacts.command_payload.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::CommandPayload,
        direct_artifact.artifact_class
    );
    assert_ne!(
        RuntimeArtifactClass::SafeMetadata,
        artifacts.command_payload.artifact_class
    );
}

#[test]
fn stream_raw_output_events_are_raw_tool_output() {
    for event_kind in ["stdout_line", "stderr_line", "codex_json_event"] {
        let artifact = DirectWorkHostStreamEventRuntimeArtifact::from_event(&stream_event(
            event_kind,
            Some("stdout token=secret"),
            None,
            None,
        ));

        assert_eq!(RuntimeKind::AgentExecutor, artifact.runtime_kind);
        assert_eq!(RuntimeExecutionStatus::Running, artifact.execution_status);
        assert_eq!(
            RuntimeArtifactClass::RawToolOutput,
            artifact.artifact.artifact_class
        );
        assert_ne!(
            RuntimeArtifactClass::SafeMetadata,
            artifact.artifact.artifact_class
        );
    }
}

#[test]
fn stream_final_response_is_generated_response() {
    let artifact = DirectWorkHostStreamEventRuntimeArtifact::from_event(&stream_event(
        "final_message",
        None,
        Some("final response token=secret"),
        None,
    ));

    assert_eq!(RuntimeExecutionStatus::Running, artifact.execution_status);
    assert_eq!(
        RuntimeArtifactClass::GeneratedResponse,
        artifact.artifact.artifact_class
    );
    assert_eq!(
        RuntimeRedactionStatus::ContainsSecretCandidate,
        artifact.artifact.redaction_status
    );
}

#[test]
fn host_process_and_runtime_errors_are_runtime_error() {
    let artifact = runtime_error_artifact("process failed token=secret");
    let boundary =
        DirectWorkHostRuntimeBoundarySummary::from_host_error("process failed token=secret");
    let event = DirectWorkHostStreamEventRuntimeArtifact::from_event(&stream_event(
        "failed",
        None,
        None,
        Some("codex process failed token=secret"),
    ));

    assert_eq!(RuntimeArtifactClass::RuntimeError, artifact.artifact_class);
    assert_eq!(RuntimeRedactionStatus::Redacted, artifact.redaction_status);
    assert_eq!(RuntimeExecutionStatus::Failed, boundary.execution_status);
    assert_eq!(Some(RuntimeErrorKind::ExecutionFailed), boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        event.artifact.artifact_class
    );
}

#[test]
fn cancellation_and_force_kill_statuses_map_to_runtime_status_vocabulary() {
    let cancel = DirectWorkHostRuntimeBoundarySummary::from_status("cancellation_requested", None);
    let force_kill =
        DirectWorkHostRuntimeBoundarySummary::from_status("force_kill_requested", None);
    let force_killed = DirectWorkHostRuntimeBoundarySummary::from_status("force_killed", None);

    assert_eq!(
        RuntimeExecutionStatus::CancelRequested,
        cancel.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::Cancelled), cancel.error_kind);
    assert_eq!(
        RuntimeExecutionStatus::ForceKillRequested,
        force_kill.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::ForceKilled), force_kill.error_kind);
    assert_eq!(
        RuntimeExecutionStatus::ForceKilled,
        force_killed.execution_status
    );
}

#[test]
fn unsafe_status_metadata_is_not_safe_metadata() {
    let path_status =
        DirectWorkHostRuntimeBoundarySummary::from_active_run_status("run_1", "C:/Users/me/repo");
    let command_status =
        DirectWorkHostRuntimeBoundarySummary::from_active_run_status("run_1", "codex exec --json");
    let secret_status =
        DirectWorkHostRuntimeBoundarySummary::from_active_run_status("run_1", "token=secret");

    assert_eq!(
        RuntimeArtifactClass::LocalPath,
        path_status.artifact.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::CommandPayload,
        command_status.artifact.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::SecretCandidate,
        secret_status.artifact.artifact_class
    );
}

#[test]
fn event_emit_transport_metadata_is_safe_metadata_when_emit_succeeds() {
    let boundary = DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(None);

    assert_eq!(RuntimeKind::AgentExecutor, boundary.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Running, boundary.execution_status);
    assert_eq!(None, boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::SafeMetadata,
        boundary.artifact.artifact_class
    );
    assert_eq!(
        RuntimeRedactionStatus::NotNeeded,
        boundary.artifact.redaction_status
    );
}

#[test]
fn ai_context_and_evidence_eligibility_default_to_false() {
    let artifacts = DirectWorkHostStartRuntimeArtifacts::from_input(&direct_work_input());
    let event = DirectWorkHostStreamEventRuntimeArtifact::from_event(&stream_event(
        "stdout_line",
        Some("raw stdout"),
        None,
        None,
    ));

    assert!(!artifacts.operator_prompt.ai_context_eligible);
    assert!(!artifacts.operator_prompt.evidence_eligible);
    assert!(!artifacts.repo_root.ai_context_eligible);
    assert!(!artifacts.repo_root.evidence_eligible);
    assert!(!artifacts.command_payload.ai_context_eligible);
    assert!(!artifacts.command_payload.evidence_eligible);
    assert!(!event.artifact.ai_context_eligible);
    assert!(!event.artifact.evidence_eligible);
}

#[test]
fn debug_output_omits_prompt_command_output_response_validation_path_env_and_secret_values() {
    let artifacts = DirectWorkHostStartRuntimeArtifacts::from_input(&direct_work_input());
    let stdout_event = DirectWorkHostStreamEventRuntimeArtifact::from_event(&stream_event(
        "stdout_line",
        Some("stdout password=secret"),
        None,
        None,
    ));
    let final_event = DirectWorkHostStreamEventRuntimeArtifact::from_event(&stream_event(
        "final_message",
        None,
        Some("final response sk-secret-direct-work"),
        None,
    ));
    let error =
        DirectWorkHostRuntimeBoundarySummary::from_host_error("validation output env:SECRET=value");
    let debug = format!("{artifacts:?} {stdout_event:?} {final_event:?} {error:?}");

    assert!(debug.contains("OperatorText"));
    assert!(debug.contains("CommandPayload"));
    assert!(debug.contains("RawToolOutput"));
    assert!(debug.contains("GeneratedResponse"));
    assert!(debug.contains("RuntimeError"));
    assert!(!debug.contains("prompt with token=secret"));
    assert!(!debug.contains("codex.cmd"));
    assert!(!debug.contains("--sandbox"));
    assert!(!debug.contains("stdout password=secret"));
    assert!(!debug.contains("final response"));
    assert!(!debug.contains("validation output"));
    assert!(!debug.contains("C:/Users/Private/project"));
    assert!(!debug.contains("env:SECRET"));
    assert!(!debug.contains("sk-secret-direct-work"));
}

fn direct_work_input() -> RunCodexDirectWorkInput {
    RunCodexDirectWorkInput {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        codex_executable: "codex.cmd".to_owned(),
        repo_root: PathBuf::from("C:/Users/Private/project"),
        operator_prompt: "prompt with token=secret".to_owned(),
        sandbox: "workspace-write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(1000),
        stdout_cap_bytes: Some(2048),
        stderr_cap_bytes: Some(1024),
    }
}

fn stream_event(
    event_kind: &str,
    line: Option<&str>,
    text: Option<&str>,
    error_message: Option<&str>,
) -> CodexDirectWorkStreamEventSummary {
    CodexDirectWorkStreamEventSummary {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
        event_kind: event_kind.to_owned(),
        line: line.map(ToOwned::to_owned),
        text: text.map(ToOwned::to_owned),
        parsed_codex_event_type: None,
        status: None,
        elapsed_ms: 12,
        is_final: matches!(
            event_kind,
            "completed" | "failed" | "timed_out" | "cancelled"
        ),
        error_message: error_message.map(ToOwned::to_owned),
        stderr_preview: None,
        exit_code: None,
        final_status: None,
        failed_stage: None,
    }
}
