use crate::{
    RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeErrorKind, RuntimeExecutionStatus,
    RuntimeKind, RuntimeRedactionStatus,
};

use super::jdbc_query_types::{JdbcReadOnlyQueryResultSummary, JdbcReadOnlySqlValidationSummary};
use super::jdbc_runtime::{
    STATUS_COMPLETED, STATUS_EXECUTION_FAILED, STATUS_NOT_CONFIGURED, STATUS_QUERY_REJECTED,
    STATUS_TIMEOUT, STATUS_UNSUPPORTED_DRIVER, STATUS_VALIDATION_FAILED,
};

const STATUS_AUTHENTICATION_FAILED: &str = "authentication_failed";
const STATUS_CONNECTION_FAILED: &str = "connection_failed";
const STATUS_RESULT_TRUNCATED: &str = "result_truncated";

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JdbcQueryRuntimeArtifacts {
    pub(super) sql_text: RuntimeArtifactSummary,
    pub(super) validation_result: RuntimeArtifactSummary,
}

impl JdbcQueryRuntimeArtifacts {
    pub(super) fn from_sql_and_validation(
        sql: &str,
        validation: &JdbcReadOnlySqlValidationSummary,
    ) -> Self {
        Self {
            sql_text: sql_text_artifact(sql),
            validation_result: validation_result_artifact(validation),
        }
    }

    pub(super) fn summaries_for_result(
        &self,
        result: &JdbcReadOnlyQueryResultSummary,
    ) -> [RuntimeArtifactSummary; 3] {
        [
            self.sql_text.clone(),
            self.validation_result.clone(),
            query_result_metadata_artifact(result),
        ]
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JdbcRuntimeBoundarySummary {
    pub(super) runtime_kind: RuntimeKind,
    pub(super) execution_status: RuntimeExecutionStatus,
    pub(super) error_kind: Option<RuntimeErrorKind>,
    pub(super) artifact: RuntimeArtifactSummary,
}

impl JdbcRuntimeBoundarySummary {
    pub(super) fn from_status(status: &str, sanitized_error: Option<&str>, capped: bool) -> Self {
        let execution_status = jdbc_execution_status(status);
        let error_kind = jdbc_error_kind(status);
        let mut artifact = match error_kind {
            Some(_) => runtime_error_artifact(sanitized_error),
            None => safe_status_metadata_artifact(status),
        };
        if capped {
            artifact = artifact.capped();
        }

        Self {
            runtime_kind: RuntimeKind::Jdbc,
            execution_status,
            error_kind,
            artifact,
        }
    }

    pub(super) fn from_result(result: &JdbcReadOnlyQueryResultSummary) -> Self {
        Self::from_status(
            &result.status,
            result.sanitized_error.as_deref(),
            result.truncated,
        )
    }
}

pub(super) fn sql_text_artifact(sql: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::SqlText)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(sql.len())
}

fn validation_result_artifact(
    validation: &JdbcReadOnlySqlValidationSummary,
) -> RuntimeArtifactSummary {
    if validation.is_valid {
        return RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
            .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
            .with_item_count(validation.safety_notes.len());
    }

    runtime_error_artifact(validation.rejection_reason.as_deref())
}

pub(super) fn query_result_metadata_artifact(
    result: &JdbcReadOnlyQueryResultSummary,
) -> RuntimeArtifactSummary {
    if result.status == "completed" && result.sanitized_error.is_none() {
        let mut summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
            .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
            .with_item_count(result.returned_row_count);

        if result.truncated {
            summary = summary.capped();
        }

        return summary;
    }

    runtime_error_artifact(result.sanitized_error.as_deref())
}

fn safe_status_metadata_artifact(status: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
        .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
        .with_summary(status)
}

fn runtime_error_artifact(error: Option<&str>) -> RuntimeArtifactSummary {
    let mut summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted);

    if let Some(error) = error {
        summary = summary.with_byte_count(error.len());
    }

    summary
}

fn jdbc_execution_status(status: &str) -> RuntimeExecutionStatus {
    match status {
        STATUS_COMPLETED => RuntimeExecutionStatus::Succeeded,
        STATUS_TIMEOUT => RuntimeExecutionStatus::TimedOut,
        STATUS_NOT_CONFIGURED => RuntimeExecutionStatus::NotConfigured,
        STATUS_UNSUPPORTED_DRIVER => RuntimeExecutionStatus::Unsupported,
        _ => RuntimeExecutionStatus::Failed,
    }
}

fn jdbc_error_kind(status: &str) -> Option<RuntimeErrorKind> {
    match status {
        STATUS_COMPLETED => None,
        STATUS_NOT_CONFIGURED => Some(RuntimeErrorKind::NotConfigured),
        STATUS_UNSUPPORTED_DRIVER => Some(RuntimeErrorKind::Unsupported),
        STATUS_VALIDATION_FAILED | STATUS_QUERY_REJECTED => {
            Some(RuntimeErrorKind::ValidationFailed)
        }
        STATUS_TIMEOUT => Some(RuntimeErrorKind::TimedOut),
        STATUS_AUTHENTICATION_FAILED => Some(RuntimeErrorKind::PermissionDenied),
        STATUS_RESULT_TRUNCATED => Some(RuntimeErrorKind::OutputCapped),
        STATUS_CONNECTION_FAILED | STATUS_EXECUTION_FAILED => {
            Some(RuntimeErrorKind::ExecutionFailed)
        }
        _ => Some(RuntimeErrorKind::Unknown),
    }
}
