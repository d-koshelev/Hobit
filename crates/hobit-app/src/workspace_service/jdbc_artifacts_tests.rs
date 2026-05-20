use crate::{
    RuntimeArtifactClass, RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind,
    RuntimeRedactionStatus,
};

use super::jdbc_artifacts::{
    query_result_metadata_artifact, sql_text_artifact, JdbcQueryRuntimeArtifacts,
    JdbcRuntimeBoundarySummary,
};
use super::jdbc_query::validate_read_only_sql;
use super::jdbc_runtime::{
    failed_query_result, STATUS_COMPLETED, STATUS_EXECUTION_FAILED, STATUS_NOT_CONFIGURED,
    STATUS_VALIDATION_FAILED,
};

#[test]
fn jdbc_sql_text_is_classified_as_sql_text_not_safe_metadata() {
    let artifact = sql_text_artifact("select * from orders");

    assert_eq!(RuntimeArtifactClass::SqlText, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn jdbc_validation_errors_are_classified_as_runtime_error() {
    let validation = validate_read_only_sql("drop table orders");
    let artifacts =
        JdbcQueryRuntimeArtifacts::from_sql_and_validation("drop table orders", &validation);

    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        artifacts.validation_result.artifact_class
    );
}

#[test]
fn jdbc_runtime_errors_are_classified_as_runtime_error() {
    let validation = validate_read_only_sql("drop table orders");
    let result = failed_query_result(
        "connector-1".to_owned(),
        Some("Analytics readonly".to_owned()),
        validation,
        100,
        STATUS_VALIDATION_FAILED,
        "SQL did not pass the read-only validator.",
        true,
    );
    let artifact = query_result_metadata_artifact(&result);

    assert_eq!(RuntimeArtifactClass::RuntimeError, artifact.artifact_class);
}

#[test]
fn jdbc_sql_artifact_debug_does_not_expose_raw_sql() {
    let raw_sql = "select 'sk-secret-jdbc-artifact-test' as token";
    let artifact = sql_text_artifact(raw_sql);
    let debug = format!("{artifact:?}");

    assert!(debug.contains("SqlText"));
    assert!(!debug.contains(raw_sql));
    assert!(!debug.contains("sk-secret-jdbc-artifact-test"));
}

#[test]
fn jdbc_artifact_ai_context_and_evidence_eligibility_default_to_false() {
    let artifact = sql_text_artifact("select * from orders");

    assert!(!artifact.ai_context_eligible);
    assert!(!artifact.evidence_eligible);
}

#[test]
fn jdbc_sidecar_not_configured_maps_to_runtime_boundary_failure() {
    let boundary = JdbcRuntimeBoundarySummary::from_status(
        STATUS_NOT_CONFIGURED,
        Some("JDBC sidecar process is unavailable or not configured."),
        false,
    );

    assert_eq!(RuntimeKind::Jdbc, boundary.runtime_kind);
    assert_eq!(
        RuntimeExecutionStatus::NotConfigured,
        boundary.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::NotConfigured), boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        boundary.artifact.artifact_class
    );
    assert_eq!(
        RuntimeRedactionStatus::Redacted,
        boundary.artifact.redaction_status
    );
}

#[test]
fn jdbc_sidecar_protocol_errors_are_runtime_error_artifacts() {
    let boundary = JdbcRuntimeBoundarySummary::from_status(
        STATUS_EXECUTION_FAILED,
        Some("JDBC sidecar returned invalid JSON."),
        false,
    );

    assert_eq!(RuntimeExecutionStatus::Failed, boundary.execution_status);
    assert_eq!(Some(RuntimeErrorKind::ExecutionFailed), boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        boundary.artifact.artifact_class
    );
}

#[test]
fn jdbc_sidecar_completed_status_metadata_is_safe_metadata() {
    let boundary = JdbcRuntimeBoundarySummary::from_status(STATUS_COMPLETED, None, false);

    assert_eq!(RuntimeKind::Jdbc, boundary.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Succeeded, boundary.execution_status);
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
fn jdbc_sidecar_boundary_ai_context_and_evidence_default_to_false() {
    let boundary = JdbcRuntimeBoundarySummary::from_status(STATUS_COMPLETED, None, false);

    assert!(!boundary.artifact.ai_context_eligible);
    assert!(!boundary.artifact.evidence_eligible);
}

#[test]
fn jdbc_sidecar_boundary_debug_omits_sensitive_runtime_details() {
    let sensitive_detail = concat!(
        "select 'sk-secret-jdbc-boundary' as token ",
        "jdbc:postgresql://private-host/app ",
        "username=readonly-user password=secret ",
        "HOBIT_JDBC_SIDECAR_WORKING_DIR=C:/secret/path ",
        "java -cp C:/secret/classes com.example.Sidecar"
    );
    let boundary = JdbcRuntimeBoundarySummary::from_status(
        STATUS_EXECUTION_FAILED,
        Some(sensitive_detail),
        true,
    );
    let debug = format!("{boundary:?}");

    assert!(debug.contains("Jdbc"));
    assert!(debug.contains("ExecutionFailed"));
    assert!(!debug.contains("sk-secret-jdbc-boundary"));
    assert!(!debug.contains("jdbc:postgresql://private-host"));
    assert!(!debug.contains("readonly-user"));
    assert!(!debug.contains("password=secret"));
    assert!(!debug.contains("HOBIT_JDBC_SIDECAR_WORKING_DIR"));
    assert!(!debug.contains("C:/secret"));
    assert!(!debug.contains("java -cp"));
}

#[test]
fn jdbc_sidecar_caps_remain_separate_from_redaction() {
    let boundary = JdbcRuntimeBoundarySummary::from_status("result_truncated", None, true);

    assert_eq!(Some(RuntimeErrorKind::OutputCapped), boundary.error_kind);
    assert!(boundary.artifact.capped);
    assert_eq!(
        RuntimeRedactionStatus::Redacted,
        boundary.artifact.redaction_status
    );
}

#[test]
fn jdbc_completed_result_metadata_can_be_safe_metadata_without_raw_sql() {
    let validation = validate_read_only_sql("select * from orders");
    let result = super::jdbc_query_types::JdbcReadOnlyQueryResultSummary {
        status: "completed".to_owned(),
        connector_id: "connector-1".to_owned(),
        connector_display_name: Some("Analytics readonly".to_owned()),
        validation,
        statement_kind: Some("SELECT".to_owned()),
        columns: Vec::new(),
        rows: vec![vec!["raw sql should stay out of artifact".to_owned()]],
        row_count: 1,
        returned_row_count: 1,
        row_limit: 100,
        truncated: false,
        truncated_rows: false,
        truncated_columns: false,
        truncated_cells: false,
        truncated_bytes: false,
        duration_ms: 0,
        sanitized_error: None,
        no_secrets_returned: true,
        no_ai_context_shared: true,
        mock_execution: true,
    };
    let artifact = query_result_metadata_artifact(&result);
    let debug = format!("{artifact:?}");

    assert_eq!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
    assert_eq!(RuntimeRedactionStatus::NotNeeded, artifact.redaction_status);
    assert!(!debug.contains("raw sql should stay out of artifact"));
}
