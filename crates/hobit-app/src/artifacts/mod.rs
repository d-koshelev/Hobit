use std::fmt;

use crate::{
    audit_events::{AuditArtifactId, AuditArtifactRef},
    capabilities::CapabilityActionRef,
    RuntimeArtifactClass, RuntimeRedactionStatus,
};

macro_rules! artifact_id {
    ($name:ident) => {
        #[derive(Clone, Eq, Hash, Ord, PartialEq, PartialOrd)]
        pub struct $name(String);

        impl $name {
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Debug for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter
                    .debug_tuple(stringify!($name))
                    .field(&self.0)
                    .finish()
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self::new(value)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self::new(value)
            }
        }
    };
}

artifact_id!(ArtifactId);
artifact_id!(ArtifactWorkspaceRef);
artifact_id!(ArtifactWorkbenchRef);
artifact_id!(ArtifactWidgetInstanceRef);
artifact_id!(ArtifactWidgetDefinitionRef);
artifact_id!(ArtifactWidgetRunRef);
artifact_id!(ArtifactWidgetResultRef);
artifact_id!(ArtifactWidgetLogRef);
artifact_id!(ArtifactQueueTaskRef);
artifact_id!(ArtifactDirectWorkRunRef);
artifact_id!(ArtifactTerminalRunRef);
artifact_id!(ArtifactTerminalSessionRef);
artifact_id!(ArtifactGitStatusRef);
artifact_id!(ArtifactGitDiffRef);
artifact_id!(ArtifactGitCommitRef);
artifact_id!(ArtifactJdbcQueryRef);
artifact_id!(ArtifactJdbcResultRef);
artifact_id!(ArtifactNoteRef);
artifact_id!(ArtifactCoordinatorProposalRef);
artifact_id!(ArtifactExternalSourceRef);

pub type ArtifactContentClass = RuntimeArtifactClass;

impl From<ArtifactId> for AuditArtifactId {
    fn from(value: ArtifactId) -> Self {
        Self::new(value.as_str().to_owned())
    }
}

impl From<&ArtifactId> for AuditArtifactId {
    fn from(value: &ArtifactId) -> Self {
        Self::new(value.as_str().to_owned())
    }
}

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtifactOwnerRef {
    pub owner_kind: ArtifactOwnerKind,
    pub workspace_id: Option<ArtifactWorkspaceRef>,
    pub workbench_id: Option<ArtifactWorkbenchRef>,
    pub widget_instance_id: Option<ArtifactWidgetInstanceRef>,
    pub widget_definition_id: Option<ArtifactWidgetDefinitionRef>,
    pub queue_task_id: Option<ArtifactQueueTaskRef>,
    pub runtime_run_id: Option<ArtifactWidgetRunRef>,
    pub capability_action: Option<CapabilityActionRef>,
    pub note_id: Option<ArtifactNoteRef>,
    pub coordinator_proposal_id: Option<ArtifactCoordinatorProposalRef>,
    pub external_source_id: Option<ArtifactExternalSourceRef>,
}

impl ArtifactOwnerRef {
    pub fn workspace(workspace_id: impl Into<ArtifactWorkspaceRef>) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::Workspace,
            workspace_id: Some(workspace_id.into()),
            workbench_id: None,
            widget_instance_id: None,
            widget_definition_id: None,
            queue_task_id: None,
            runtime_run_id: None,
            capability_action: None,
            note_id: None,
            coordinator_proposal_id: None,
            external_source_id: None,
        }
    }

    pub fn workbench(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        workbench_id: impl Into<ArtifactWorkbenchRef>,
    ) -> Self {
        Self {
            workbench_id: Some(workbench_id.into()),
            owner_kind: ArtifactOwnerKind::Workbench,
            ..Self::workspace(workspace_id)
        }
    }

    pub fn widget(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        workbench_id: impl Into<ArtifactWorkbenchRef>,
        widget_instance_id: impl Into<ArtifactWidgetInstanceRef>,
        widget_definition_id: impl Into<ArtifactWidgetDefinitionRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::Widget,
            widget_instance_id: Some(widget_instance_id.into()),
            widget_definition_id: Some(widget_definition_id.into()),
            ..Self::workbench(workspace_id, workbench_id)
        }
    }

    pub fn queue_task(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        queue_task_id: impl Into<ArtifactQueueTaskRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::QueueTask,
            queue_task_id: Some(queue_task_id.into()),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn runtime_run(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        workbench_id: impl Into<ArtifactWorkbenchRef>,
        widget_instance_id: impl Into<ArtifactWidgetInstanceRef>,
        widget_definition_id: impl Into<ArtifactWidgetDefinitionRef>,
        runtime_run_id: impl Into<ArtifactWidgetRunRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::RuntimeRun,
            runtime_run_id: Some(runtime_run_id.into()),
            ..Self::widget(
                workspace_id,
                workbench_id,
                widget_instance_id,
                widget_definition_id,
            )
        }
    }

    pub fn capability_action(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        action: CapabilityActionRef,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::CapabilityAction,
            capability_action: Some(action),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn note(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        note_id: impl Into<ArtifactNoteRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::Note,
            note_id: Some(note_id.into()),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn coordinator_proposal(
        workspace_id: impl Into<ArtifactWorkspaceRef>,
        proposal_id: impl Into<ArtifactCoordinatorProposalRef>,
    ) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::CoordinatorProposal,
            coordinator_proposal_id: Some(proposal_id.into()),
            ..Self::workspace(workspace_id)
        }
    }

    pub fn external_source(source_id: impl Into<ArtifactExternalSourceRef>) -> Self {
        Self {
            owner_kind: ArtifactOwnerKind::ExternalSource,
            workspace_id: None,
            workbench_id: None,
            widget_instance_id: None,
            widget_definition_id: None,
            queue_task_id: None,
            runtime_run_id: None,
            capability_action: None,
            note_id: None,
            coordinator_proposal_id: None,
            external_source_id: Some(source_id.into()),
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ArtifactOwnerKind {
    Workspace,
    Workbench,
    Widget,
    QueueTask,
    RuntimeRun,
    CapabilityAction,
    Note,
    CoordinatorProposal,
    ExternalSource,
    #[default]
    Unknown,
}

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

#[derive(Clone, Eq, PartialEq)]
pub struct ArtifactRefSummary {
    text: String,
}

impl ArtifactRefSummary {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl fmt::Debug for ArtifactRefSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ArtifactRefSummary")
            .field("text_present", &true)
            .field("text_bytes", &self.text.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.text),
            )
            .finish()
    }
}

fn contains_secret_like(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("password=")
        || lower.contains("token=")
        || lower.contains("secret=")
        || lower.contains("api_key=")
        || lower.contains("apikey=")
        || lower.contains("authorization:")
        || lower.contains("bearer ")
        || value.contains("sk-")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CapabilityActionRef, CapabilitySubjectRef, WidgetCapabilityRef};

    fn widget_owner() -> ArtifactOwnerRef {
        ArtifactOwnerRef::widget("ws_1", "wb_1", "wid_1", "agent-run")
    }

    fn capability_action_owner() -> ArtifactOwnerRef {
        let capability = CapabilitySubjectRef::Widget(WidgetCapabilityRef::new(
            "ws_1",
            "wb_1",
            "wid_1",
            "agent-run",
            "agent_executor.start_direct_work",
        ));
        ArtifactOwnerRef::capability_action(
            "ws_1",
            CapabilityActionRef::new("action_1", capability),
        )
    }

    #[test]
    fn artifact_creates_metadata_only_ref() {
        let artifact = ArtifactRef::new(
            "artifact_1",
            ArtifactSourceRef::ExistingWidgetResult("result_1".into()),
            widget_owner(),
            RuntimeArtifactClass::GeneratedResponse,
        )
        .with_origin(ArtifactOrigin::GeneratedResponse)
        .with_storage_kind(ArtifactStorageKind::ExistingWidgetResult)
        .with_visibility(ArtifactVisibility::WorkspaceVisible)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_sensitivity(ArtifactSensitivity::GeneratedText);

        assert_eq!("artifact_1", artifact.artifact_id.as_str());
        assert_eq!(ArtifactOwnerKind::Widget, artifact.owner.owner_kind);
        assert_eq!(
            RuntimeArtifactClass::GeneratedResponse,
            artifact.content_class
        );
        assert_eq!(
            RuntimeRedactionStatus::NotRedacted,
            artifact.redaction_status
        );
    }

    #[test]
    fn artifact_ref_does_not_store_raw_payload_content() {
        let artifact = ArtifactRef::new(
            "artifact_stdout_1",
            ArtifactSourceRef::ExistingWidgetLog("log_1".into()),
            widget_owner(),
            RuntimeArtifactClass::RawToolOutput,
        )
        .with_summary(ArtifactRefSummary::new("bounded stdout chunk"));

        assert_eq!(
            Some("bounded stdout chunk"),
            artifact.summary.as_ref().map(ArtifactRefSummary::as_str)
        );
        assert_eq!(
            ArtifactSourceRef::ExistingWidgetLog("log_1".into()),
            artifact.source
        );
    }

    #[test]
    fn artifact_existing_widget_run_result_and_log_refs_can_be_represented() {
        let run = ArtifactSourceRef::ExistingWidgetRun("run_1".into());
        let result = ArtifactSourceRef::ExistingWidgetResult("result_1".into());
        let log = ArtifactSourceRef::ExistingWidgetLog("log_1".into());

        assert_eq!(
            ArtifactSourceRef::ExistingWidgetRun(ArtifactWidgetRunRef::new("run_1")),
            run
        );
        assert_eq!(
            ArtifactSourceRef::ExistingWidgetResult(ArtifactWidgetResultRef::new("result_1")),
            result
        );
        assert_eq!(
            ArtifactSourceRef::ExistingWidgetLog(ArtifactWidgetLogRef::new("log_1")),
            log
        );
    }

    #[test]
    fn artifact_future_record_refs_can_be_represented_without_resolution() {
        let artifact = ArtifactRef::new(
            "artifact_future_1",
            ArtifactSourceRef::FutureArtifactRecord("future_artifact_1".into()),
            ArtifactOwnerRef::workspace("ws_1"),
            RuntimeArtifactClass::SafeMetadata,
        )
        .with_storage_kind(ArtifactStorageKind::FutureArtifactRecord)
        .with_resolution_status(ArtifactResolutionStatus::NotImplemented);

        assert_eq!(
            ArtifactStorageKind::FutureArtifactRecord,
            artifact.storage_kind
        );
        assert_eq!(
            ArtifactResolutionStatus::NotImplemented,
            artifact.resolution_status
        );
    }

    #[test]
    fn artifact_owner_kind_distinguishes_current_and_future_owners() {
        let widget = widget_owner();
        let queue = ArtifactOwnerRef::queue_task("ws_1", "task_1");
        let run = ArtifactOwnerRef::runtime_run("ws_1", "wb_1", "wid_1", "agent-run", "run_1");
        let action = capability_action_owner();
        let note = ArtifactOwnerRef::note("ws_1", "note_1");
        let proposal = ArtifactOwnerRef::coordinator_proposal("ws_1", "proposal_1");

        assert_eq!(ArtifactOwnerKind::Widget, widget.owner_kind);
        assert_eq!(ArtifactOwnerKind::QueueTask, queue.owner_kind);
        assert_eq!(ArtifactOwnerKind::RuntimeRun, run.owner_kind);
        assert_eq!(ArtifactOwnerKind::CapabilityAction, action.owner_kind);
        assert_eq!(ArtifactOwnerKind::Note, note.owner_kind);
        assert_eq!(ArtifactOwnerKind::CoordinatorProposal, proposal.owner_kind);
    }

    #[test]
    fn artifact_ai_context_eligibility_defaults_false() {
        let artifact = ArtifactRef::new(
            "artifact_context_1",
            ArtifactSourceRef::ExistingWidgetResult("result_1".into()),
            widget_owner(),
            RuntimeArtifactClass::GeneratedResponse,
        );

        assert!(!artifact.context_eligibility.ai_context_eligible);
        assert!(ArtifactContextEligibility::explicitly_eligible().ai_context_eligible);
    }

    #[test]
    fn artifact_evidence_eligibility_defaults_false() {
        let artifact = ArtifactRef::new(
            "artifact_evidence_1",
            ArtifactSourceRef::ExistingWidgetResult("result_1".into()),
            widget_owner(),
            RuntimeArtifactClass::EvidenceCandidate,
        );

        assert!(!artifact.evidence_eligibility.evidence_eligible);
        assert!(ArtifactEvidenceEligibility::explicitly_eligible().evidence_eligible);
    }

    #[test]
    fn artifact_unknown_visibility_sensitivity_and_storage_are_conservative() {
        let artifact = ArtifactRef::new(
            "artifact_unknown_1",
            ArtifactSourceRef::Unknown,
            ArtifactOwnerRef::workspace("ws_1"),
            RuntimeArtifactClass::SafeMetadata,
        );

        assert_eq!(ArtifactVisibility::Unknown, artifact.visibility);
        assert_eq!(ArtifactSensitivity::Unknown, artifact.sensitivity);
        assert_eq!(ArtifactStorageKind::Unknown, artifact.storage_kind);
        assert!(!artifact.visibility.is_safe_to_share_without_approval());
        assert!(!artifact.sensitivity.is_safe_metadata());
        assert!(!artifact.storage_kind.is_known_storage());
    }

    #[test]
    fn artifact_debug_output_does_not_expose_secret_like_summary_text() {
        let artifact = ArtifactRef::new(
            "artifact_debug_1",
            ArtifactSourceRef::ExistingWidgetResult("result_1".into()),
            widget_owner(),
            RuntimeArtifactClass::SecretCandidate,
        )
        .with_summary(ArtifactRefSummary::new("provider token=secret output"));

        let debug = format!("{artifact:?}");

        assert!(debug.contains("ArtifactRefSummary"));
        assert!(debug.contains("contains_secret_candidate"));
        assert!(!debug.contains("provider token=secret output"));
        assert!(!debug.contains("token=secret"));
    }

    #[test]
    fn artifact_model_compiles_without_schema_dto_or_runtime_wiring() {
        let artifact = ArtifactRef::new(
            "artifact_type_only_1",
            ArtifactSourceRef::DirectWorkRun("direct_run_1".into()),
            capability_action_owner(),
            RuntimeArtifactClass::RawToolOutput,
        )
        .with_storage_kind(ArtifactStorageKind::ExistingWidgetRun)
        .with_retention_hint(ArtifactRetentionHint::WorkspaceDurable)
        .with_resolution_status(ArtifactResolutionStatus::Unresolved);
        let audit_ref = artifact.to_audit_artifact_ref();

        assert_eq!("artifact_type_only_1", audit_ref.artifact_id.as_str());
        assert_eq!(
            RuntimeArtifactClass::RawToolOutput,
            audit_ref.artifact_class
        );
        assert_eq!(RuntimeRedactionStatus::Unknown, audit_ref.redaction_status);
        assert_eq!(
            ArtifactOwnerKind::CapabilityAction,
            artifact.owner.owner_kind
        );
    }
}
