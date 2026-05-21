mod classification;
mod ids;
mod ownership;
mod refs;
mod summary;

pub use classification::{
    ArtifactContentClass, ArtifactContextEligibility, ArtifactEvidenceEligibility, ArtifactOrigin,
    ArtifactResolutionStatus, ArtifactRetentionHint, ArtifactSensitivity, ArtifactStorageKind,
    ArtifactVisibility,
};
pub use ids::{
    ArtifactCoordinatorProposalRef, ArtifactDirectWorkRunRef, ArtifactExternalSourceRef,
    ArtifactGitCommitRef, ArtifactGitDiffRef, ArtifactGitStatusRef, ArtifactId,
    ArtifactJdbcQueryRef, ArtifactJdbcResultRef, ArtifactNoteRef, ArtifactQueueTaskRef,
    ArtifactTerminalRunRef, ArtifactTerminalSessionRef, ArtifactWidgetDefinitionRef,
    ArtifactWidgetInstanceRef, ArtifactWidgetLogRef, ArtifactWidgetResultRef, ArtifactWidgetRunRef,
    ArtifactWorkbenchRef, ArtifactWorkspaceRef,
};
pub use ownership::{ArtifactOwnerKind, ArtifactOwnerRef};
pub use refs::{ArtifactRef, ArtifactSourceRef};
pub use summary::ArtifactRefSummary;

#[cfg(test)]
mod tests;
