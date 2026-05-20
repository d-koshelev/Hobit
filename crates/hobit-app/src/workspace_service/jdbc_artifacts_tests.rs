use crate::{RuntimeArtifactClass, RuntimeRedactionStatus};

use super::jdbc_artifacts::{
    query_result_metadata_artifact, sql_text_artifact, JdbcQueryRuntimeArtifacts,
};
use super::jdbc_query::validate_read_only_sql;
use super::jdbc_runtime::{failed_query_result, STATUS_VALIDATION_FAILED};

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
