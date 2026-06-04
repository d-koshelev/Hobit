use crate::{RuntimeArtifactClass, RuntimeRedactionStatus};

use super::{
    AuditActorKind, AuditApprovalId, AuditApprovalStatus, AuditArtifactId,
    AuditWidgetDefinitionRef, AuditWidgetInstanceRef,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditActorRef {
    pub actor_kind: AuditActorKind,
    pub actor_id: Option<String>,
}

impl AuditActorRef {
    pub fn new(actor_kind: AuditActorKind, actor_id: Option<String>) -> Self {
        Self {
            actor_kind,
            actor_id,
        }
    }

    pub fn local_operator() -> Self {
        Self::new(AuditActorKind::LocalOperator, None)
    }

    pub fn system() -> Self {
        Self::new(AuditActorKind::System, None)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditWidgetRef {
    pub widget_instance_id: AuditWidgetInstanceRef,
    pub widget_definition_id: AuditWidgetDefinitionRef,
}

impl AuditWidgetRef {
    pub fn new(
        widget_instance_id: impl Into<AuditWidgetInstanceRef>,
        widget_definition_id: impl Into<AuditWidgetDefinitionRef>,
    ) -> Self {
        Self {
            widget_instance_id: widget_instance_id.into(),
            widget_definition_id: widget_definition_id.into(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditApprovalRef {
    pub approval_id: AuditApprovalId,
    pub approval_status: AuditApprovalStatus,
}

impl AuditApprovalRef {
    pub fn new(
        approval_id: impl Into<AuditApprovalId>,
        approval_status: AuditApprovalStatus,
    ) -> Self {
        Self {
            approval_id: approval_id.into(),
            approval_status,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditArtifactRef {
    pub artifact_id: AuditArtifactId,
    pub artifact_class: RuntimeArtifactClass,
    pub redaction_status: RuntimeRedactionStatus,
}

impl AuditArtifactRef {
    pub fn new(
        artifact_id: impl Into<AuditArtifactId>,
        artifact_class: RuntimeArtifactClass,
        redaction_status: RuntimeRedactionStatus,
    ) -> Self {
        Self {
            artifact_id: artifact_id.into(),
            artifact_class,
            redaction_status,
        }
    }
}
