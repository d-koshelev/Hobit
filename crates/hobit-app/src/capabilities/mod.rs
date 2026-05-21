use std::fmt;

use crate::{
    AuditActionRef, AuditApprovalRef, AuditApprovalStatus, AuditCausationId, AuditCorrelationId,
    AuditEventId,
};

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
capability_id!(CapabilityActionId);

impl From<CapabilityActionId> for AuditActionRef {
    fn from(value: CapabilityActionId) -> Self {
        Self::new(value.as_str().to_owned())
    }
}

impl From<&CapabilityActionId> for AuditActionRef {
    fn from(value: &CapabilityActionId) -> Self {
        Self::new(value.as_str().to_owned())
    }
}

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

impl CapabilitySubjectRef {
    pub fn capability_id(&self) -> &CapabilityId {
        match self {
            Self::Workspace(workspace) => &workspace.capability_id,
            Self::Widget(widget) => &widget.capability_id,
        }
    }
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityActionRef {
    pub action_id: CapabilityActionId,
    pub capability: CapabilitySubjectRef,
}

impl CapabilityActionRef {
    pub fn new(action_id: impl Into<CapabilityActionId>, capability: CapabilitySubjectRef) -> Self {
        Self {
            action_id: action_id.into(),
            capability,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityActionKind {
    ProposalCreated,
    ApprovalRequested,
    Approved,
    Rejected,
    ActionRequested,
    RuntimeStartRequested,
    RuntimeStarted,
    RuntimeCompleted,
    RuntimeFailed,
    ArtifactProduced,
    #[default]
    Unknown,
}

impl CapabilityActionKind {
    pub fn is_approval_grant(self) -> bool {
        matches!(self, Self::Approved)
    }

    pub fn is_runtime_start(self) -> bool {
        matches!(self, Self::RuntimeStarted)
    }

    pub fn is_runtime_completion(self) -> bool {
        matches!(self, Self::RuntimeCompleted | Self::RuntimeFailed)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CapabilityActionLifecycleStatus {
    Draft,
    Proposed,
    AwaitingApproval,
    Approved,
    Rejected,
    Requested,
    Started,
    Running,
    Completed,
    Failed,
    Cancelled,
    #[default]
    Unknown,
}

impl CapabilityActionLifecycleStatus {
    pub fn is_approved(self) -> bool {
        matches!(self, Self::Approved)
    }

    pub fn has_runtime_started(self) -> bool {
        matches!(
            self,
            Self::Started | Self::Running | Self::Completed | Self::Failed
        )
    }

    pub fn is_completed(self) -> bool {
        matches!(self, Self::Completed)
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CapabilityActionCausation {
    pub causation_id: Option<AuditCausationId>,
    pub caused_by_action_id: Option<CapabilityActionId>,
    pub caused_by_event_id: Option<AuditEventId>,
}

impl CapabilityActionCausation {
    pub fn none() -> Self {
        Self::default()
    }

    pub fn by_action(
        causation_id: impl Into<AuditCausationId>,
        action_id: impl Into<CapabilityActionId>,
    ) -> Self {
        Self {
            causation_id: Some(causation_id.into()),
            caused_by_action_id: Some(action_id.into()),
            caused_by_event_id: None,
        }
    }

    pub fn by_event(
        causation_id: impl Into<AuditCausationId>,
        event_id: impl Into<AuditEventId>,
    ) -> Self {
        Self {
            causation_id: Some(causation_id.into()),
            caused_by_action_id: None,
            caused_by_event_id: Some(event_id.into()),
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CapabilityActionCorrelation {
    pub correlation_id: Option<AuditCorrelationId>,
}

impl CapabilityActionCorrelation {
    pub fn none() -> Self {
        Self::default()
    }

    pub fn new(correlation_id: impl Into<AuditCorrelationId>) -> Self {
        Self {
            correlation_id: Some(correlation_id.into()),
        }
    }
}

pub type CapabilityApprovalRef = AuditApprovalRef;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityApprovalDecision {
    pub approval: CapabilityApprovalRef,
    pub action_id: CapabilityActionId,
}

impl CapabilityApprovalDecision {
    pub fn new(approval: CapabilityApprovalRef, action_id: impl Into<CapabilityActionId>) -> Self {
        Self {
            approval,
            action_id: action_id.into(),
        }
    }

    pub fn status(&self) -> AuditApprovalStatus {
        self.approval.approval_status
    }

    pub fn is_approved(&self) -> bool {
        matches!(self.status(), AuditApprovalStatus::Approved)
    }

    pub fn implies_execution(&self) -> bool {
        false
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityActionSummary {
    pub action: CapabilityActionRef,
    pub actor: Option<CapabilityActorRef>,
    pub kind: CapabilityActionKind,
    pub lifecycle_status: CapabilityActionLifecycleStatus,
    pub causation: CapabilityActionCausation,
    pub correlation: CapabilityActionCorrelation,
    pub approval: Option<CapabilityApprovalDecision>,
    pub audit_event_id: Option<AuditEventId>,
    pub summary: Option<CapabilitySummary>,
}

impl CapabilityActionSummary {
    pub fn new(action: CapabilityActionRef) -> Self {
        Self {
            action,
            actor: None,
            kind: CapabilityActionKind::Unknown,
            lifecycle_status: CapabilityActionLifecycleStatus::Unknown,
            causation: CapabilityActionCausation::default(),
            correlation: CapabilityActionCorrelation::default(),
            approval: None,
            audit_event_id: None,
            summary: None,
        }
    }

    pub fn with_actor(mut self, actor: CapabilityActorRef) -> Self {
        self.actor = Some(actor);
        self
    }

    pub fn with_kind(mut self, kind: CapabilityActionKind) -> Self {
        self.kind = kind;
        self
    }

    pub fn with_lifecycle_status(
        mut self,
        lifecycle_status: CapabilityActionLifecycleStatus,
    ) -> Self {
        self.lifecycle_status = lifecycle_status;
        self
    }

    pub fn with_causation(mut self, causation: CapabilityActionCausation) -> Self {
        self.causation = causation;
        self
    }

    pub fn with_correlation(mut self, correlation: CapabilityActionCorrelation) -> Self {
        self.correlation = correlation;
        self
    }

    pub fn with_approval(mut self, approval: CapabilityApprovalDecision) -> Self {
        self.approval = Some(approval);
        self
    }

    pub fn with_audit_event_id(mut self, audit_event_id: impl Into<AuditEventId>) -> Self {
        self.audit_event_id = Some(audit_event_id.into());
        self
    }

    pub fn with_summary(mut self, summary: CapabilitySummary) -> Self {
        self.summary = Some(summary);
        self
    }
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
    use crate::{AuditActorRef, AuditEventEnvelope, AuditEventKind};

    fn widget_subject() -> CapabilitySubjectRef {
        CapabilitySubjectRef::Widget(WidgetCapabilityRef::new(
            "ws_1",
            "wb_1",
            "wid_1",
            "agent-run",
            "agent_executor.start_direct_work",
        ))
    }

    fn workspace_subject() -> CapabilitySubjectRef {
        CapabilitySubjectRef::Workspace(WorkspaceCapabilityRef::new(
            "ws_1",
            "workspace.create_note_candidate",
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
    fn capability_action_creates_minimal_refs_for_workspace_and_widget_capabilities() {
        let workspace_action = CapabilityActionRef::new("action_1", workspace_subject());
        let widget_action = CapabilityActionRef::new("action_2", widget_subject());

        assert_eq!("action_1", workspace_action.action_id.as_str());
        assert_eq!(
            "workspace.create_note_candidate",
            workspace_action.capability.capability_id().as_str()
        );
        assert_eq!("action_2", widget_action.action_id.as_str());
        assert_eq!(
            "agent_executor.start_direct_work",
            widget_action.capability.capability_id().as_str()
        );
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
    fn capability_action_proposal_created_does_not_imply_approval() {
        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_proposal_1",
            widget_subject(),
        ))
        .with_kind(CapabilityActionKind::ProposalCreated)
        .with_lifecycle_status(CapabilityActionLifecycleStatus::Proposed);

        assert_eq!(CapabilityActionKind::ProposalCreated, action.kind);
        assert!(!action.kind.is_approval_grant());
        assert!(!action.lifecycle_status.is_approved());
        assert!(action.approval.is_none());
    }

    #[test]
    fn capability_action_approved_does_not_imply_execution() {
        let decision = CapabilityApprovalDecision::new(
            CapabilityApprovalRef::new("approval_1", AuditApprovalStatus::Approved),
            "action_approved_1",
        );
        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_approved_1",
            widget_subject(),
        ))
        .with_kind(CapabilityActionKind::Approved)
        .with_lifecycle_status(CapabilityActionLifecycleStatus::Approved)
        .with_approval(decision.clone());

        assert!(action.kind.is_approval_grant());
        assert!(action.lifecycle_status.is_approved());
        assert!(decision.is_approved());
        assert!(!decision.implies_execution());
        assert!(!action.kind.is_runtime_start());
        assert!(!action.lifecycle_status.has_runtime_started());
    }

    #[test]
    fn capability_action_requested_does_not_imply_runtime_started() {
        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_requested_1",
            widget_subject(),
        ))
        .with_kind(CapabilityActionKind::ActionRequested)
        .with_lifecycle_status(CapabilityActionLifecycleStatus::Requested);

        assert_eq!(CapabilityActionKind::ActionRequested, action.kind);
        assert!(!action.kind.is_runtime_start());
        assert!(!action.lifecycle_status.has_runtime_started());
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
    fn capability_action_causation_and_correlation_ids_are_distinct() {
        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_child_1",
            widget_subject(),
        ))
        .with_causation(CapabilityActionCausation::by_action(
            "cause_action_parent_1",
            "action_parent_1",
        ))
        .with_correlation(CapabilityActionCorrelation::new("workflow_1"));

        assert_eq!(
            Some("cause_action_parent_1"),
            action
                .causation
                .causation_id
                .as_ref()
                .map(AuditCausationId::as_str)
        );
        assert_eq!(
            Some("workflow_1"),
            action
                .correlation
                .correlation_id
                .as_ref()
                .map(AuditCorrelationId::as_str)
        );
        assert_ne!(
            action
                .causation
                .causation_id
                .as_ref()
                .map(AuditCausationId::as_str),
            action
                .correlation
                .correlation_id
                .as_ref()
                .map(AuditCorrelationId::as_str)
        );
    }

    #[test]
    fn capability_action_approval_decision_is_representable_without_persistence() {
        let decision = CapabilityApprovalDecision::new(
            CapabilityApprovalRef::new("approval_reject_1", AuditApprovalStatus::Rejected),
            "action_rejected_1",
        );

        assert_eq!(AuditApprovalStatus::Rejected, decision.status());
        assert_eq!("action_rejected_1", decision.action_id.as_str());
        assert!(!decision.is_approved());
        assert!(!decision.implies_execution());
    }

    #[test]
    fn capability_action_unknown_kind_and_status_are_conservative() {
        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_unknown_1",
            widget_subject(),
        ));

        assert_eq!(CapabilityActionKind::Unknown, action.kind);
        assert_eq!(
            CapabilityActionLifecycleStatus::Unknown,
            action.lifecycle_status
        );
        assert!(!action.kind.is_approval_grant());
        assert!(!action.kind.is_runtime_start());
        assert!(!action.kind.is_runtime_completion());
        assert!(!action.lifecycle_status.is_approved());
        assert!(!action.lifecycle_status.has_runtime_started());
        assert!(!action.lifecycle_status.is_completed());
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
    fn capability_action_summary_debug_output_omits_secret_like_summary_text() {
        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_secret_summary_1",
            widget_subject(),
        ))
        .with_summary(CapabilitySummary::new(
            "operator asked with authorization: bearer secret",
        ));

        let debug = format!("{action:?}");

        assert!(debug.contains("CapabilitySummary"));
        assert!(debug.contains("contains_secret_candidate"));
        assert!(!debug.contains("operator asked with authorization"));
        assert!(!debug.contains("bearer secret"));
    }

    #[test]
    fn future_audit_envelope_can_reference_action_approval_and_correlation_ids() {
        let action_ref = CapabilityActionRef::new("action_audit_1", widget_subject());
        let decision = CapabilityApprovalDecision::new(
            CapabilityApprovalRef::new("approval_audit_1", AuditApprovalStatus::Approved),
            action_ref.action_id.clone(),
        );
        let action = CapabilityActionSummary::new(action_ref.clone())
            .with_kind(CapabilityActionKind::RuntimeStarted)
            .with_lifecycle_status(CapabilityActionLifecycleStatus::Started)
            .with_approval(decision.clone())
            .with_causation(CapabilityActionCausation::by_event(
                "cause_audit_event_1",
                "audit_previous_1",
            ))
            .with_correlation(CapabilityActionCorrelation::new("workflow_audit_1"))
            .with_audit_event_id("audit_current_1");

        let event = AuditEventEnvelope::new(
            "audit_current_1",
            "2026-05-21T00:00:00Z",
            AuditActorRef::local_operator(),
            AuditEventKind::RuntimeStarted,
        )
        .with_capability(action.action.capability.capability_id().as_str())
        .with_action_id(&action.action.action_id)
        .with_causation_id(
            action
                .causation
                .causation_id
                .clone()
                .expect("causation id should be present"),
        )
        .with_correlation_id(
            action
                .correlation
                .correlation_id
                .clone()
                .expect("correlation id should be present"),
        )
        .with_approval(decision.approval.clone());

        assert_eq!(
            Some("action_audit_1"),
            event.action_id.as_ref().map(AuditActionRef::as_str)
        );
        assert_eq!(
            Some("agent_executor.start_direct_work"),
            event
                .capability_id
                .as_ref()
                .map(crate::AuditCapabilityRef::as_str)
        );
        assert_eq!(
            Some("cause_audit_event_1"),
            event.causation_id.as_ref().map(AuditCausationId::as_str)
        );
        assert_eq!(
            Some("workflow_audit_1"),
            event
                .correlation_id
                .as_ref()
                .map(AuditCorrelationId::as_str)
        );
        assert_eq!(
            Some(AuditApprovalStatus::Approved),
            event
                .approval
                .as_ref()
                .map(|approval| approval.approval_status)
        );
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

        let action = CapabilityActionSummary::new(CapabilityActionRef::new(
            "action_type_only_1",
            widget_subject(),
        ))
        .with_actor(CapabilityActorRef::local_operator())
        .with_kind(CapabilityActionKind::ProposalCreated)
        .with_lifecycle_status(CapabilityActionLifecycleStatus::Proposed);

        assert_eq!(CapabilityActionKind::ProposalCreated, action.kind);
        assert_eq!(
            CapabilityActionLifecycleStatus::Proposed,
            action.lifecycle_status
        );
    }
}
