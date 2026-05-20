use crate::{RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeRedactionStatus};

use super::jdbc_query_types::{JdbcReadOnlyQueryResultSummary, JdbcReadOnlySqlValidationSummary};

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

fn runtime_error_artifact(error: Option<&str>) -> RuntimeArtifactSummary {
    let mut summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted);

    if let Some(error) = error {
        summary = summary.with_byte_count(error.len());
    }

    summary
}
