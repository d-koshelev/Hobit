use crate::RuntimeRedactionStatus;

use super::{
    AuditActionRef, AuditActorRef, AuditApprovalRef, AuditArtifactRef, AuditCapabilityRef,
    AuditCausationId, AuditCorrelationId, AuditErrorClass, AuditEventId, AuditEventKind,
    AuditEventSummary, AuditOrganizationRef, AuditRiskLevel, AuditRunRef, AuditTaskRef,
    AuditWidgetRef, AuditWorkbenchRef, AuditWorkspaceRef,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditSchemaVersion {
    V0,
}

impl Default for AuditSchemaVersion {
    fn default() -> Self {
        Self::V0
    }
}

impl AuditSchemaVersion {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::V0 => "audit_event_envelope_v0",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditEventEnvelope {
    pub event_id: AuditEventId,
    pub schema_version: AuditSchemaVersion,
    pub occurred_at: String,
    pub actor: AuditActorRef,
    pub organization_id: Option<AuditOrganizationRef>,
    pub workspace_id: Option<AuditWorkspaceRef>,
    pub workbench_id: Option<AuditWorkbenchRef>,
    pub widget: Option<AuditWidgetRef>,
    pub capability_id: Option<AuditCapabilityRef>,
    pub event_kind: AuditEventKind,
    pub task_id: Option<AuditTaskRef>,
    pub run_id: Option<AuditRunRef>,
    pub action_id: Option<AuditActionRef>,
    pub causation_id: Option<AuditCausationId>,
    pub correlation_id: Option<AuditCorrelationId>,
    pub approval: Option<AuditApprovalRef>,
    pub risk_level: AuditRiskLevel,
    pub input_artifact_refs: Vec<AuditArtifactRef>,
    pub output_artifact_refs: Vec<AuditArtifactRef>,
    pub redaction_status: RuntimeRedactionStatus,
    pub summary: Option<AuditEventSummary>,
    pub error_class: Option<AuditErrorClass>,
}

impl AuditEventEnvelope {
    pub fn new(
        event_id: impl Into<AuditEventId>,
        occurred_at: impl Into<String>,
        actor: AuditActorRef,
        event_kind: AuditEventKind,
    ) -> Self {
        Self {
            event_id: event_id.into(),
            schema_version: AuditSchemaVersion::default(),
            occurred_at: occurred_at.into(),
            actor,
            organization_id: None,
            workspace_id: None,
            workbench_id: None,
            widget: None,
            capability_id: None,
            event_kind,
            task_id: None,
            run_id: None,
            action_id: None,
            causation_id: None,
            correlation_id: None,
            approval: None,
            risk_level: AuditRiskLevel::Unknown,
            input_artifact_refs: Vec::new(),
            output_artifact_refs: Vec::new(),
            redaction_status: RuntimeRedactionStatus::Unknown,
            summary: None,
            error_class: None,
        }
    }

    pub fn with_workspace(mut self, workspace_id: impl Into<AuditWorkspaceRef>) -> Self {
        self.workspace_id = Some(workspace_id.into());
        self
    }

    pub fn with_workbench(mut self, workbench_id: impl Into<AuditWorkbenchRef>) -> Self {
        self.workbench_id = Some(workbench_id.into());
        self
    }

    pub fn with_widget(mut self, widget: AuditWidgetRef) -> Self {
        self.widget = Some(widget);
        self
    }

    pub fn with_capability(mut self, capability_id: impl Into<AuditCapabilityRef>) -> Self {
        self.capability_id = Some(capability_id.into());
        self
    }

    pub fn with_action_id(mut self, action_id: impl Into<AuditActionRef>) -> Self {
        self.action_id = Some(action_id.into());
        self
    }

    pub fn with_causation_id(mut self, causation_id: impl Into<AuditCausationId>) -> Self {
        self.causation_id = Some(causation_id.into());
        self
    }

    pub fn with_correlation_id(mut self, correlation_id: impl Into<AuditCorrelationId>) -> Self {
        self.correlation_id = Some(correlation_id.into());
        self
    }

    pub fn with_approval(mut self, approval: AuditApprovalRef) -> Self {
        self.approval = Some(approval);
        self
    }

    pub fn with_risk_level(mut self, risk_level: AuditRiskLevel) -> Self {
        self.risk_level = risk_level;
        self
    }

    pub fn with_input_artifact_ref(mut self, artifact_ref: AuditArtifactRef) -> Self {
        self.input_artifact_refs.push(artifact_ref);
        self
    }

    pub fn with_output_artifact_ref(mut self, artifact_ref: AuditArtifactRef) -> Self {
        self.output_artifact_refs.push(artifact_ref);
        self
    }

    pub fn with_redaction_status(mut self, redaction_status: RuntimeRedactionStatus) -> Self {
        self.redaction_status = redaction_status;
        self
    }

    pub fn with_summary(mut self, summary: AuditEventSummary) -> Self {
        self.summary = Some(summary);
        self
    }

    pub fn with_error_class(mut self, error_class: AuditErrorClass) -> Self {
        self.error_class = Some(error_class);
        self
    }
}
