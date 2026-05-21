use std::fmt;

macro_rules! capability_id {
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

capability_id!(CapabilityId);
capability_id!(CapabilityActorId);
capability_id!(CapabilityWorkspaceRef);
capability_id!(CapabilityWorkbenchRef);
capability_id!(CapabilityWidgetInstanceRef);
capability_id!(CapabilityWidgetDefinitionRef);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceCapabilityRef {
    pub workspace_id: CapabilityWorkspaceRef,
    pub capability_id: CapabilityId,
}

impl WorkspaceCapabilityRef {
    pub fn new(
        workspace_id: impl Into<CapabilityWorkspaceRef>,
        capability_id: impl Into<CapabilityId>,
    ) -> Self {
        Self {
            workspace_id: workspace_id.into(),
            capability_id: capability_id.into(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetCapabilityRef {
    pub workspace_id: CapabilityWorkspaceRef,
    pub workbench_id: CapabilityWorkbenchRef,
    pub widget_instance_id: CapabilityWidgetInstanceRef,
    pub widget_definition_id: CapabilityWidgetDefinitionRef,
    pub capability_id: CapabilityId,
}

impl WidgetCapabilityRef {
    pub fn new(
        workspace_id: impl Into<CapabilityWorkspaceRef>,
        workbench_id: impl Into<CapabilityWorkbenchRef>,
        widget_instance_id: impl Into<CapabilityWidgetInstanceRef>,
        widget_definition_id: impl Into<CapabilityWidgetDefinitionRef>,
        capability_id: impl Into<CapabilityId>,
    ) -> Self {
        Self {
            workspace_id: workspace_id.into(),
            workbench_id: workbench_id.into(),
            widget_instance_id: widget_instance_id.into(),
            widget_definition_id: widget_definition_id.into(),
            capability_id: capability_id.into(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CapabilitySubjectRef {
    Workspace(WorkspaceCapabilityRef),
    Widget(WidgetCapabilityRef),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityActorRef {
    pub actor_kind: CapabilityActorKind,
    pub actor_id: Option<CapabilityActorId>,
}

impl CapabilityActorRef {
    pub fn new(actor_kind: CapabilityActorKind, actor_id: Option<CapabilityActorId>) -> Self {
        Self {
            actor_kind,
            actor_id,
        }
    }

    pub fn local_operator() -> Self {
        Self::new(CapabilityActorKind::LocalOperator, None)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityActorKind {
    LocalOperator,
    Coordinator,
    Provider,
    Runtime,
    System,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityKind {
    ReadState,
    WriteState,
    StartRuntime,
    StopRuntime,
    ExternalRead,
    ExternalWrite,
    GenerateProposal,
    CreateArtifact,
    ApproveAction,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityRiskLevel {
    ReadOnly,
    AnalysisOnly,
    LocalWrite,
    ExternalRead,
    ExternalWrite,
    Destructive,
    SecretSensitive,
    #[default]
    Unknown,
}

impl CapabilityRiskLevel {
    pub fn is_safe_without_approval(self) -> bool {
        matches!(self, Self::ReadOnly | Self::AnalysisOnly)
    }

    pub fn is_mutating(self) -> bool {
        matches!(
            self,
            Self::LocalWrite | Self::ExternalWrite | Self::Destructive
        )
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityApprovalRequirement {
    NotRequired,
    RequiredBeforeRun,
    RequiredBeforeMutation,
    RequiredBeforeExternalAccess,
    RequiredBeforeContextShare,
    #[default]
    Unsupported,
}

impl CapabilityApprovalRequirement {
    pub fn requires_approval(self) -> bool {
        !matches!(self, Self::NotRequired | Self::Unsupported)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityExecutionMode {
    DisplayOnly,
    ProposalOnly,
    ExplicitOperatorAction,
    RuntimeExecution,
    BackgroundObservation,
    #[default]
    Unsupported,
}

impl CapabilityExecutionMode {
    pub fn implies_runtime_execution(self) -> bool {
        matches!(self, Self::RuntimeExecution)
    }

    pub fn is_background(self) -> bool {
        matches!(self, Self::BackgroundObservation)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityMutationScope {
    NoMutation,
    LocalState,
    LocalWorkspace,
    ExternalSystem,
    Destructive,
    #[default]
    Unknown,
}

impl CapabilityMutationScope {
    pub fn can_mutate_local_state(self) -> bool {
        matches!(self, Self::LocalState | Self::LocalWorkspace)
    }

    pub fn can_mutate_external_system(self) -> bool {
        matches!(self, Self::ExternalSystem | Self::Destructive)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityExternalAccess {
    None,
    Read,
    Write,
    ReadWrite,
    #[default]
    Unknown,
}

impl CapabilityExternalAccess {
    pub fn can_read_external(self) -> bool {
        matches!(self, Self::Read | Self::ReadWrite)
    }

    pub fn can_write_external(self) -> bool {
        matches!(self, Self::Write | Self::ReadWrite)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilitySecretExposure {
    None,
    RedactedOnly,
    SecretCandidate,
    RawSecretForbidden,
    #[default]
    Unknown,
}

impl CapabilitySecretExposure {
    pub fn can_expose_secret_candidate(self) -> bool {
        matches!(self, Self::SecretCandidate)
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CapabilityContextExposure {
    pub ai_context_allowed: bool,
    pub hidden_context_allowed: bool,
}

impl CapabilityContextExposure {
    pub fn no_context_share() -> Self {
        Self::default()
    }

    pub fn ai_context_allowed() -> Self {
        Self {
            ai_context_allowed: true,
            hidden_context_allowed: false,
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CapabilityArtifactPolicy {
    pub can_produce_artifacts: bool,
    pub ai_context_eligible_by_default: bool,
    pub evidence_eligible_by_default: bool,
}

impl CapabilityArtifactPolicy {
    pub fn no_artifacts() -> Self {
        Self::default()
    }

    pub fn produces_artifacts() -> Self {
        Self {
            can_produce_artifacts: true,
            ai_context_eligible_by_default: false,
            evidence_eligible_by_default: false,
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct CapabilitySummary {
    text: String,
}

impl CapabilitySummary {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl fmt::Debug for CapabilitySummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("CapabilitySummary")
            .field("text_present", &true)
            .field("text_bytes", &self.text.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.text),
            )
            .finish()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityBoundarySummary {
    pub subject: CapabilitySubjectRef,
    pub actor: Option<CapabilityActorRef>,
    pub kind: CapabilityKind,
    pub risk_level: CapabilityRiskLevel,
    pub approval_requirement: CapabilityApprovalRequirement,
    pub execution_mode: CapabilityExecutionMode,
    pub mutation_scope: CapabilityMutationScope,
    pub external_access: CapabilityExternalAccess,
    pub secret_exposure: CapabilitySecretExposure,
    pub context_exposure: CapabilityContextExposure,
    pub artifact_policy: CapabilityArtifactPolicy,
    pub summary: Option<CapabilitySummary>,
}

impl CapabilityBoundarySummary {
    pub fn new(subject: CapabilitySubjectRef, kind: CapabilityKind) -> Self {
        Self {
            subject,
            actor: None,
            kind,
            risk_level: CapabilityRiskLevel::Unknown,
            approval_requirement: CapabilityApprovalRequirement::Unsupported,
            execution_mode: CapabilityExecutionMode::Unsupported,
            mutation_scope: CapabilityMutationScope::Unknown,
            external_access: CapabilityExternalAccess::Unknown,
            secret_exposure: CapabilitySecretExposure::Unknown,
            context_exposure: CapabilityContextExposure::default(),
            artifact_policy: CapabilityArtifactPolicy::default(),
            summary: None,
        }
    }

    pub fn with_actor(mut self, actor: CapabilityActorRef) -> Self {
        self.actor = Some(actor);
        self
    }

    pub fn with_risk_level(mut self, risk_level: CapabilityRiskLevel) -> Self {
        self.risk_level = risk_level;
        self
    }

    pub fn with_approval_requirement(
        mut self,
        approval_requirement: CapabilityApprovalRequirement,
    ) -> Self {
        self.approval_requirement = approval_requirement;
        self
    }

    pub fn with_execution_mode(mut self, execution_mode: CapabilityExecutionMode) -> Self {
        self.execution_mode = execution_mode;
        self
    }

    pub fn with_mutation_scope(mut self, mutation_scope: CapabilityMutationScope) -> Self {
        self.mutation_scope = mutation_scope;
        self
    }

    pub fn with_external_access(mut self, external_access: CapabilityExternalAccess) -> Self {
        self.external_access = external_access;
        self
    }

    pub fn with_secret_exposure(mut self, secret_exposure: CapabilitySecretExposure) -> Self {
        self.secret_exposure = secret_exposure;
        self
    }

    pub fn with_context_exposure(mut self, context_exposure: CapabilityContextExposure) -> Self {
        self.context_exposure = context_exposure;
        self
    }

    pub fn with_artifact_policy(mut self, artifact_policy: CapabilityArtifactPolicy) -> Self {
        self.artifact_policy = artifact_policy;
        self
    }

    pub fn with_summary(mut self, summary: CapabilitySummary) -> Self {
        self.summary = Some(summary);
        self
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

    fn widget_subject() -> CapabilitySubjectRef {
        CapabilitySubjectRef::Widget(WidgetCapabilityRef::new(
            "ws_1",
            "wb_1",
            "wid_1",
            "agent-run",
            "agent_executor.start_direct_work",
        ))
    }

    #[test]
    fn capability_creates_minimal_workspace_and_widget_refs() {
        let workspace_ref = WorkspaceCapabilityRef::new("ws_1", "workspace.create_note_candidate");
        let widget_ref =
            WidgetCapabilityRef::new("ws_1", "wb_1", "wid_1", "notes", "notes.create_note");

        assert_eq!("ws_1", workspace_ref.workspace_id.as_str());
        assert_eq!(
            "workspace.create_note_candidate",
            workspace_ref.capability_id.as_str()
        );
        assert_eq!("wb_1", widget_ref.workbench_id.as_str());
        assert_eq!("wid_1", widget_ref.widget_instance_id.as_str());
        assert_eq!("notes", widget_ref.widget_definition_id.as_str());
        assert_eq!("notes.create_note", widget_ref.capability_id.as_str());
    }

    #[test]
    fn capability_unknown_risk_is_not_safe() {
        assert!(!CapabilityRiskLevel::Unknown.is_safe_without_approval());
        assert!(CapabilityRiskLevel::ReadOnly.is_safe_without_approval());
        assert!(CapabilityRiskLevel::AnalysisOnly.is_safe_without_approval());
        assert!(!CapabilityRiskLevel::LocalWrite.is_safe_without_approval());
    }

    #[test]
    fn capability_proposal_only_does_not_imply_execution() {
        let summary =
            CapabilityBoundarySummary::new(widget_subject(), CapabilityKind::GenerateProposal)
                .with_execution_mode(CapabilityExecutionMode::ProposalOnly);

        assert_eq!(
            CapabilityExecutionMode::ProposalOnly,
            summary.execution_mode
        );
        assert!(!summary.execution_mode.implies_runtime_execution());
    }

    #[test]
    fn capability_explicit_operator_action_is_distinct_from_background_and_runtime() {
        assert_ne!(
            CapabilityExecutionMode::ExplicitOperatorAction,
            CapabilityExecutionMode::RuntimeExecution
        );
        assert_ne!(
            CapabilityExecutionMode::ExplicitOperatorAction,
            CapabilityExecutionMode::BackgroundObservation
        );
        assert!(CapabilityExecutionMode::RuntimeExecution.implies_runtime_execution());
        assert!(CapabilityExecutionMode::BackgroundObservation.is_background());
        assert!(!CapabilityExecutionMode::ExplicitOperatorAction.is_background());
    }

    #[test]
    fn capability_approval_required_states_do_not_create_approval_records() {
        let summary = CapabilityBoundarySummary::new(widget_subject(), CapabilityKind::WriteState)
            .with_approval_requirement(CapabilityApprovalRequirement::RequiredBeforeMutation);

        assert!(summary.approval_requirement.requires_approval());
        assert_eq!(None, summary.actor);
        assert_eq!(
            CapabilityApprovalRequirement::RequiredBeforeMutation,
            summary.approval_requirement
        );
    }

    #[test]
    fn capability_mutation_scope_distinguishes_none_local_and_external() {
        assert!(!CapabilityMutationScope::NoMutation.can_mutate_local_state());
        assert!(!CapabilityMutationScope::NoMutation.can_mutate_external_system());
        assert!(CapabilityMutationScope::LocalState.can_mutate_local_state());
        assert!(CapabilityMutationScope::LocalWorkspace.can_mutate_local_state());
        assert!(CapabilityMutationScope::ExternalSystem.can_mutate_external_system());
    }

    #[test]
    fn capability_context_exposure_defaults_to_no_ai_context_sharing() {
        let exposure = CapabilityContextExposure::default();

        assert!(!exposure.ai_context_allowed);
        assert!(!exposure.hidden_context_allowed);
    }

    #[test]
    fn capability_artifact_and_evidence_eligibility_default_false() {
        let policy = CapabilityArtifactPolicy::default();

        assert!(!policy.can_produce_artifacts);
        assert!(!policy.ai_context_eligible_by_default);
        assert!(!policy.evidence_eligible_by_default);

        let producing_policy = CapabilityArtifactPolicy::produces_artifacts();
        assert!(producing_policy.can_produce_artifacts);
        assert!(!producing_policy.ai_context_eligible_by_default);
        assert!(!producing_policy.evidence_eligible_by_default);
    }

    #[test]
    fn capability_debug_output_omits_secret_like_summary_text() {
        let summary = CapabilityBoundarySummary::new(widget_subject(), CapabilityKind::ReadState)
            .with_summary(CapabilitySummary::new("read token=secret from output"));

        let debug = format!("{summary:?}");

        assert!(debug.contains("CapabilitySummary"));
        assert!(debug.contains("contains_secret_candidate"));
        assert!(!debug.contains("read token=secret from output"));
        assert!(!debug.contains("token=secret"));
    }

    #[test]
    fn capability_model_is_type_only_without_runtime_persistence_or_dto_contracts() {
        let summary = CapabilityBoundarySummary::new(widget_subject(), CapabilityKind::ReadState)
            .with_actor(CapabilityActorRef::local_operator())
            .with_risk_level(CapabilityRiskLevel::ReadOnly)
            .with_approval_requirement(CapabilityApprovalRequirement::NotRequired)
            .with_execution_mode(CapabilityExecutionMode::DisplayOnly)
            .with_mutation_scope(CapabilityMutationScope::NoMutation)
            .with_external_access(CapabilityExternalAccess::None)
            .with_secret_exposure(CapabilitySecretExposure::None)
            .with_context_exposure(CapabilityContextExposure::no_context_share())
            .with_artifact_policy(CapabilityArtifactPolicy::no_artifacts());

        assert_eq!(CapabilityKind::ReadState, summary.kind);
        assert_eq!(CapabilityRiskLevel::ReadOnly, summary.risk_level);
        assert_eq!(
            CapabilityApprovalRequirement::NotRequired,
            summary.approval_requirement
        );
        assert_eq!(CapabilityExecutionMode::DisplayOnly, summary.execution_mode);
    }
}
