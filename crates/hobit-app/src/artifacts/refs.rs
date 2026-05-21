use crate::{audit_events::AuditArtifactRef, RuntimeRedactionStatus};

use super::{
    ArtifactContentClass, ArtifactContextEligibility, ArtifactCoordinatorProposalRef,
    ArtifactDirectWorkRunRef, ArtifactEvidenceEligibility, ArtifactExternalSourceRef,
    ArtifactGitCommitRef, ArtifactGitDiffRef, ArtifactGitStatusRef, ArtifactId,
    ArtifactJdbcQueryRef, ArtifactJdbcResultRef, ArtifactNoteRef, ArtifactOrigin, ArtifactOwnerRef,
    ArtifactQueueTaskRef, ArtifactRefSummary, ArtifactResolutionStatus, ArtifactRetentionHint,
    ArtifactSensitivity, ArtifactStorageKind, ArtifactTerminalRunRef, ArtifactTerminalSessionRef,
    ArtifactVisibility, ArtifactWidgetLogRef, ArtifactWidgetResultRef, ArtifactWidgetRunRef,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtifactRef {
    pub artifact_id: ArtifactId,
    pub source: ArtifactSourceRef,
    pub owner: ArtifactOwnerRef,
    pub origin: ArtifactOrigin,
    pub storage_kind: ArtifactStorageKind,
    pub visibility: ArtifactVisibility,
    pub retention_hint: ArtifactRetentionHint,
    pub resolution_status: ArtifactResolutionStatus,
    pub content_class: ArtifactContentClass,
    pub redaction_status: RuntimeRedactionStatus,
    pub sensitivity: ArtifactSensitivity,
    pub context_eligibility: ArtifactContextEligibility,
    pub evidence_eligibility: ArtifactEvidenceEligibility,
    pub summary: Option<ArtifactRefSummary>,
}

impl ArtifactRef {
    pub fn new(
        artifact_id: impl Into<ArtifactId>,
        source: ArtifactSourceRef,
        owner: ArtifactOwnerRef,
        content_class: ArtifactContentClass,
    ) -> Self {
        Self {
            artifact_id: artifact_id.into(),
            source,
            owner,
            origin: ArtifactOrigin::Unknown,
            storage_kind: ArtifactStorageKind::Unknown,
            visibility: ArtifactVisibility::Unknown,
            retention_hint: ArtifactRetentionHint::Unknown,
            resolution_status: ArtifactResolutionStatus::Unresolved,
            content_class,
            redaction_status: RuntimeRedactionStatus::Unknown,
            sensitivity: ArtifactSensitivity::Unknown,
            context_eligibility: ArtifactContextEligibility::default(),
            evidence_eligibility: ArtifactEvidenceEligibility::default(),
            summary: None,
        }
    }

    pub fn with_origin(mut self, origin: ArtifactOrigin) -> Self {
        self.origin = origin;
        self
    }

    pub fn with_storage_kind(mut self, storage_kind: ArtifactStorageKind) -> Self {
        self.storage_kind = storage_kind;
        self
    }

    pub fn with_visibility(mut self, visibility: ArtifactVisibility) -> Self {
        self.visibility = visibility;
        self
    }

    pub fn with_retention_hint(mut self, retention_hint: ArtifactRetentionHint) -> Self {
        self.retention_hint = retention_hint;
        self
    }

    pub fn with_resolution_status(mut self, resolution_status: ArtifactResolutionStatus) -> Self {
        self.resolution_status = resolution_status;
        self
    }

    pub fn with_redaction_status(mut self, redaction_status: RuntimeRedactionStatus) -> Self {
        self.redaction_status = redaction_status;
        self
    }

    pub fn with_sensitivity(mut self, sensitivity: ArtifactSensitivity) -> Self {
        self.sensitivity = sensitivity;
        self
    }

    pub fn with_context_eligibility(
        mut self,
        context_eligibility: ArtifactContextEligibility,
    ) -> Self {
        self.context_eligibility = context_eligibility;
        self
    }

    pub fn with_evidence_eligibility(
        mut self,
        evidence_eligibility: ArtifactEvidenceEligibility,
    ) -> Self {
        self.evidence_eligibility = evidence_eligibility;
        self
    }

    pub fn with_summary(mut self, summary: ArtifactRefSummary) -> Self {
        self.summary = Some(summary);
        self
    }

    pub fn to_audit_artifact_ref(&self) -> AuditArtifactRef {
        AuditArtifactRef::new(&self.artifact_id, self.content_class, self.redaction_status)
    }
}

impl From<&ArtifactRef> for AuditArtifactRef {
    fn from(value: &ArtifactRef) -> Self {
        value.to_audit_artifact_ref()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ArtifactSourceRef {
    ExistingWidgetRun(ArtifactWidgetRunRef),
    ExistingWidgetResult(ArtifactWidgetResultRef),
    ExistingWidgetLog(ArtifactWidgetLogRef),
    ExistingQueueTask(ArtifactQueueTaskRef),
    ExistingNote(ArtifactNoteRef),
    ExistingCoordinatorProposal(ArtifactCoordinatorProposalRef),
    DirectWorkRun(ArtifactDirectWorkRunRef),
    TerminalRun(ArtifactTerminalRunRef),
    TerminalSession(ArtifactTerminalSessionRef),
    GitStatus(ArtifactGitStatusRef),
    GitDiff(ArtifactGitDiffRef),
    GitCommit(ArtifactGitCommitRef),
    JdbcQuery(ArtifactJdbcQueryRef),
    JdbcResult(ArtifactJdbcResultRef),
    FutureArtifactRecord(ArtifactId),
    ExternalReference(ArtifactExternalSourceRef),
    EphemeralOnly(ArtifactId),
    Unknown,
}
