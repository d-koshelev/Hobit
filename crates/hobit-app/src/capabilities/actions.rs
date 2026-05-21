use crate::{
    AuditActionRef, AuditApprovalRef, AuditApprovalStatus, AuditCausationId, AuditCorrelationId,
    AuditEventId,
};

use super::{CapabilityActionId, CapabilityActorRef, CapabilitySubjectRef, CapabilitySummary};

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
