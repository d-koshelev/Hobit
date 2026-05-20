use std::fmt;

use super::kinds::{RuntimeArtifactClass, RuntimeRedactionStatus};

/// Metadata-only artifact summary for runtime boundaries.
///
/// This type must not carry raw stdout, stderr, prompts, SQL, local paths, or
/// provider payloads. `summary` is intended for a safe human-readable label,
/// and `Debug` deliberately omits it so accidental debug logs do not leak
/// secret-looking text.
#[derive(Clone, Eq, PartialEq)]
pub struct RuntimeArtifactSummary {
    pub artifact_class: RuntimeArtifactClass,
    pub redaction_status: RuntimeRedactionStatus,
    pub summary: Option<String>,
    pub byte_count: Option<usize>,
    pub item_count: Option<usize>,
    pub capped: bool,
    pub ai_context_eligible: bool,
    pub evidence_eligible: bool,
}

impl RuntimeArtifactSummary {
    pub fn new(artifact_class: RuntimeArtifactClass) -> Self {
        Self {
            artifact_class,
            redaction_status: RuntimeRedactionStatus::Unknown,
            summary: None,
            byte_count: None,
            item_count: None,
            capped: false,
            ai_context_eligible: false,
            evidence_eligible: false,
        }
    }

    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = Some(summary.into());
        self
    }

    pub fn with_redaction_status(mut self, status: RuntimeRedactionStatus) -> Self {
        self.redaction_status = status;
        self
    }

    pub fn with_byte_count(mut self, byte_count: usize) -> Self {
        self.byte_count = Some(byte_count);
        self
    }

    pub fn with_item_count(mut self, item_count: usize) -> Self {
        self.item_count = Some(item_count);
        self
    }

    pub fn capped(mut self) -> Self {
        self.capped = true;
        self
    }

    pub fn ai_context_eligible(mut self) -> Self {
        self.ai_context_eligible = true;
        self
    }

    pub fn evidence_eligible(mut self) -> Self {
        self.evidence_eligible = true;
        self
    }
}

impl fmt::Debug for RuntimeArtifactSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("RuntimeArtifactSummary")
            .field("artifact_class", &self.artifact_class)
            .field("redaction_status", &self.redaction_status)
            .field("summary_present", &self.summary.is_some())
            .field("summary_bytes", &self.summary.as_ref().map(String::len))
            .field("byte_count", &self.byte_count)
            .field("item_count", &self.item_count)
            .field("capped", &self.capped)
            .field("ai_context_eligible", &self.ai_context_eligible)
            .field("evidence_eligible", &self.evidence_eligible)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::{RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeRedactionStatus};

    #[test]
    fn artifact_summary_is_metadata_only_by_default() {
        let summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput);

        assert_eq!(RuntimeArtifactClass::RawToolOutput, summary.artifact_class);
        assert_eq!(RuntimeRedactionStatus::Unknown, summary.redaction_status);
        assert!(!summary.capped);
        assert!(!summary.ai_context_eligible);
        assert!(!summary.evidence_eligible);
        assert!(summary.summary.is_none());
    }

    #[test]
    fn debug_output_omits_secret_like_summary_text() {
        let summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::SecretCandidate)
            .with_summary("password=super-secret-token")
            .with_redaction_status(RuntimeRedactionStatus::ContainsSecretCandidate)
            .with_byte_count(27);

        let debug = format!("{summary:?}");

        assert!(debug.contains("SecretCandidate"));
        assert!(debug.contains("ContainsSecretCandidate"));
        assert!(debug.contains("summary_present: true"));
        assert!(!debug.contains("password"));
        assert!(!debug.contains("super-secret-token"));
    }

    #[test]
    fn caps_are_separate_from_redaction_status() {
        let summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
            .capped()
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted);

        assert!(summary.capped);
        assert_eq!(
            RuntimeRedactionStatus::NotRedacted,
            summary.redaction_status
        );
    }

    #[test]
    fn ai_context_and_evidence_eligibility_are_explicit() {
        let default_summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::GeneratedResponse);
        let eligible_summary = RuntimeArtifactSummary::new(RuntimeArtifactClass::EvidenceCandidate)
            .ai_context_eligible()
            .evidence_eligible();

        assert!(!default_summary.ai_context_eligible);
        assert!(!default_summary.evidence_eligible);
        assert!(eligible_summary.ai_context_eligible);
        assert!(eligible_summary.evidence_eligible);
    }
}
