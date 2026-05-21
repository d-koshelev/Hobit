use super::*;
use crate::{AuditActorRef, AuditCausationId, AuditCorrelationId};
use crate::{AuditApprovalStatus, AuditEventEnvelope, AuditEventKind};

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
    let action =
        CapabilityActionSummary::new(CapabilityActionRef::new("action_child_1", widget_subject()))
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
        event.action_id.as_ref().map(crate::AuditActionRef::as_str)
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
