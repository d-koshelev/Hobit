use super::*;
use crate::{RuntimeArtifactClass, RuntimeRedactionStatus};

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
