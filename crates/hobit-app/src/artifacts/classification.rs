use crate::RuntimeArtifactClass;

pub type ArtifactContentClass = RuntimeArtifactClass;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactOrigin {
    OperatorInput,
    RuntimeOutput,
    GeneratedResponse,
    ValidationOutput,
    SystemMetadata,
    ImportedKnowledge,
    ExternalSystem,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactStorageKind {
    ExistingWidgetRun,
    ExistingWidgetResult,
    ExistingWidgetLog,
    ExistingQueueTask,
    ExistingNote,
    ExistingCoordinatorProposal,
    FutureArtifactRecord,
    ExternalReference,
    EphemeralOnly,
    #[default]
    Unknown,
}

impl ArtifactStorageKind {
    pub fn is_known_storage(self) -> bool {
        !matches!(self, Self::Unknown)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactVisibility {
    LocalOnly,
    WorkspaceVisible,
    SharedWithExplicitApproval,
    ExternalReferenceOnly,
    #[default]
    Unknown,
}

impl ArtifactVisibility {
    pub fn is_safe_to_share_without_approval(self) -> bool {
        false
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactRetentionHint {
    Ephemeral,
    SessionOnly,
    WorkspaceDurable,
    FutureDurable,
    ExternalOwned,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactResolutionStatus {
    Resolvable,
    Unresolved,
    Missing,
    ExternalOnly,
    NotImplemented,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactSensitivity {
    SafeMetadata,
    OperatorText,
    LocalPath,
    RawRuntimeOutput,
    SourceContent,
    GeneratedText,
    SecretCandidate,
    #[default]
    Unknown,
}

impl ArtifactSensitivity {
    pub fn is_safe_metadata(self) -> bool {
        matches!(self, Self::SafeMetadata)
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ArtifactContextEligibility {
    pub ai_context_eligible: bool,
}

impl ArtifactContextEligibility {
    pub fn not_eligible() -> Self {
        Self::default()
    }

    pub fn explicitly_eligible() -> Self {
        Self {
            ai_context_eligible: true,
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ArtifactEvidenceEligibility {
    pub evidence_eligible: bool,
}

impl ArtifactEvidenceEligibility {
    pub fn not_eligible() -> Self {
        Self::default()
    }

    pub fn explicitly_eligible() -> Self {
        Self {
            evidence_eligible: true,
        }
    }
}
