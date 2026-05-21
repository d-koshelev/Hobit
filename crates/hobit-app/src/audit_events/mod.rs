use std::fmt;

use crate::{RuntimeArtifactClass, RuntimeRedactionStatus};

macro_rules! audit_id {
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

audit_id!(AuditEventId);
audit_id!(AuditOrganizationRef);
audit_id!(AuditWorkspaceRef);
audit_id!(AuditWorkbenchRef);
audit_id!(AuditWidgetInstanceRef);
audit_id!(AuditWidgetDefinitionRef);
audit_id!(AuditCapabilityRef);
audit_id!(AuditTaskRef);
audit_id!(AuditRunRef);
audit_id!(AuditActionRef);
audit_id!(AuditCausationId);
audit_id!(AuditCorrelationId);
audit_id!(AuditApprovalId);
audit_id!(AuditArtifactId);

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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditActorKind {
    LocalOperator,
    System,
    Provider,
    Runtime,
    Unknown,
}

impl Default for AuditActorKind {
    fn default() -> Self {
        Self::Unknown
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditApprovalStatus {
    Requested,
    Approved,
    Rejected,
    NotRequired,
    Unknown,
}

impl Default for AuditApprovalStatus {
    fn default() -> Self {
        Self::Unknown
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditEventKind {
    WorkspaceCreated,
    WidgetAdded,
    CapabilityRequested,
    CapabilityApproved,
    CapabilityRejected,
    RuntimeStarted,
    RuntimeEventObserved,
    RuntimeCompleted,
    RuntimeFailed,
    TaskCreated,
    TaskUpdated,
    TaskStarted,
    TaskCompleted,
    ArtifactCreated,
    ProposalCreated,
    ProposalApproved,
    NoteCreated,
    Unknown,
}

impl Default for AuditEventKind {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuditRiskLevel {
    ReadOnly,
    AnalysisOnly,
    LocalWrite,
    ExternalRead,
    ExternalWrite,
    Destructive,
    SecretSensitive,
    Unknown,
}

impl Default for AuditRiskLevel {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct AuditEventSummary {
    text: String,
}

impl AuditEventSummary {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl fmt::Debug for AuditEventSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AuditEventSummary")
            .field("text_present", &true)
            .field("text_bytes", &self.text.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.text),
            )
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct AuditErrorClass {
    label: String,
}

impl AuditErrorClass {
    pub fn new(label: impl Into<String>) -> Self {
        Self {
            label: label.into(),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.label
    }
}

impl fmt::Debug for AuditErrorClass {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AuditErrorClass")
            .field("label_present", &true)
            .field("label_bytes", &self.label.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.label),
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

    #[test]
    fn creates_minimal_local_desktop_event_without_organization() {
        let event = AuditEventEnvelope::new(
            "audit_1",
            "2026-05-21T00:00:00Z",
            AuditActorRef::local_operator(),
            AuditEventKind::WorkspaceCreated,
        );

        assert_eq!(AuditSchemaVersion::V0, event.schema_version);
        assert_eq!("audit_event_envelope_v0", event.schema_version.as_str());
        assert_eq!(AuditActorKind::LocalOperator, event.actor.actor_kind);
        assert!(event.actor.actor_id.is_none());
        assert!(event.organization_id.is_none());
        assert_eq!(AuditRiskLevel::Unknown, event.risk_level);
        assert_eq!(RuntimeRedactionStatus::Unknown, event.redaction_status);
    }

    #[test]
    fn creates_event_with_workspace_workbench_widget_and_capability_refs() {
        let event = AuditEventEnvelope::new(
            "audit_2",
            "2026-05-21T00:00:00Z",
            AuditActorRef::system(),
            AuditEventKind::CapabilityRequested,
        )
        .with_workspace("ws_1")
        .with_workbench("wb_1")
        .with_widget(AuditWidgetRef::new("wid_1", "agent-run"))
        .with_capability("agent_executor.start_direct_work")
        .with_risk_level(AuditRiskLevel::LocalWrite);

        assert_eq!(
            Some("ws_1"),
            event.workspace_id.as_ref().map(AuditWorkspaceRef::as_str)
        );
        assert_eq!(
            Some("wb_1"),
            event.workbench_id.as_ref().map(AuditWorkbenchRef::as_str)
        );
        assert_eq!(
            Some("wid_1"),
            event
                .widget
                .as_ref()
                .map(|widget| widget.widget_instance_id.as_str())
        );
        assert_eq!(
            Some("agent-run"),
            event
                .widget
                .as_ref()
                .map(|widget| widget.widget_definition_id.as_str())
        );
        assert_eq!(
            Some("agent_executor.start_direct_work"),
            event.capability_id.as_ref().map(AuditCapabilityRef::as_str)
        );
        assert_eq!(AuditRiskLevel::LocalWrite, event.risk_level);
    }

    #[test]
    fn correlation_and_causation_ids_are_separate() {
        let event = AuditEventEnvelope::new(
            "audit_3",
            "2026-05-21T00:00:00Z",
            AuditActorRef::system(),
            AuditEventKind::RuntimeStarted,
        )
        .with_causation_id("event_previous")
        .with_correlation_id("operator_action_1");

        assert_eq!(
            Some("event_previous"),
            event.causation_id.as_ref().map(AuditCausationId::as_str)
        );
        assert_eq!(
            Some("operator_action_1"),
            event
                .correlation_id
                .as_ref()
                .map(AuditCorrelationId::as_str)
        );
        assert_ne!(
            event.causation_id.as_ref().map(AuditCausationId::as_str),
            event
                .correlation_id
                .as_ref()
                .map(AuditCorrelationId::as_str)
        );
    }

    #[test]
    fn approval_metadata_is_optional() {
        let without_approval = AuditEventEnvelope::new(
            "audit_4",
            "2026-05-21T00:00:00Z",
            AuditActorRef::local_operator(),
            AuditEventKind::TaskStarted,
        );
        let with_approval = AuditEventEnvelope::new(
            "audit_5",
            "2026-05-21T00:00:00Z",
            AuditActorRef::local_operator(),
            AuditEventKind::CapabilityApproved,
        )
        .with_approval(AuditApprovalRef::new(
            "approval_1",
            AuditApprovalStatus::Approved,
        ));

        assert!(without_approval.approval.is_none());
        assert_eq!(
            Some(AuditApprovalStatus::Approved),
            with_approval
                .approval
                .as_ref()
                .map(|approval| approval.approval_status)
        );
    }

    #[test]
    fn artifact_refs_are_references_only() {
        let artifact_ref = AuditArtifactRef::new(
            "artifact_1",
            RuntimeArtifactClass::RawToolOutput,
            RuntimeRedactionStatus::Redacted,
        );
        let event = AuditEventEnvelope::new(
            "audit_6",
            "2026-05-21T00:00:00Z",
            AuditActorRef::system(),
            AuditEventKind::ArtifactCreated,
        )
        .with_input_artifact_ref(artifact_ref.clone())
        .with_output_artifact_ref(AuditArtifactRef::new(
            "artifact_2",
            RuntimeArtifactClass::GeneratedResponse,
            RuntimeRedactionStatus::NotRedacted,
        ));

        assert_eq!(artifact_ref, event.input_artifact_refs[0]);
        assert_eq!(1, event.output_artifact_refs.len());
        assert_eq!(
            "artifact_1",
            event.input_artifact_refs[0].artifact_id.as_str()
        );
        assert_eq!(
            RuntimeArtifactClass::RawToolOutput,
            event.input_artifact_refs[0].artifact_class
        );
    }

    #[test]
    fn redaction_status_is_metadata_not_raw_sensitive_content() {
        let event = AuditEventEnvelope::new(
            "audit_7",
            "2026-05-21T00:00:00Z",
            AuditActorRef::system(),
            AuditEventKind::RuntimeFailed,
        )
        .with_redaction_status(RuntimeRedactionStatus::ContainsSecretCandidate)
        .with_error_class(AuditErrorClass::new("runtime_error"));

        assert_eq!(
            RuntimeRedactionStatus::ContainsSecretCandidate,
            event.redaction_status
        );
        assert_eq!(
            Some("runtime_error"),
            event.error_class.as_ref().map(AuditErrorClass::as_str)
        );
    }

    #[test]
    fn debug_output_omits_secret_like_summary_and_error_text() {
        let event = AuditEventEnvelope::new(
            "audit_8",
            "2026-05-21T00:00:00Z",
            AuditActorRef::system(),
            AuditEventKind::RuntimeFailed,
        )
        .with_summary(AuditEventSummary::new("runtime failed token=secret"))
        .with_error_class(AuditErrorClass::new("password=secret"));

        let debug = format!("{event:?}");

        assert!(debug.contains("RuntimeFailed"));
        assert!(debug.contains("AuditEventSummary"));
        assert!(debug.contains("AuditErrorClass"));
        assert!(!debug.contains("runtime failed token=secret"));
        assert!(!debug.contains("password=secret"));
        assert!(!debug.contains("token=secret"));
    }

    #[test]
    fn event_kind_and_risk_level_defaults_are_unknown() {
        assert_eq!(AuditEventKind::Unknown, AuditEventKind::default());
        assert_eq!(AuditRiskLevel::Unknown, AuditRiskLevel::default());
        assert_eq!(AuditActorKind::Unknown, AuditActorKind::default());
        assert_eq!(AuditApprovalStatus::Unknown, AuditApprovalStatus::default());
    }
}
