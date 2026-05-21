use super::*;
use crate::RuntimeRedactionStatus;
use crate::{CapabilityActionRef, CapabilitySubjectRef, RuntimeArtifactClass, WidgetCapabilityRef};

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
    ArtifactOwnerRef::capability_action("ws_1", CapabilityActionRef::new("action_1", capability))
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
