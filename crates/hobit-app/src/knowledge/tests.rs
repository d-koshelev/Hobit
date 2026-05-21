use super::*;
use crate::{
    ArtifactOwnerRef, ArtifactRef, ArtifactSourceRef, RuntimeArtifactClass, RuntimeRedactionStatus,
};

fn owner() -> KnowledgeOwnerRef {
    KnowledgeOwnerRef::workspace("ws_1")
}

fn artifact_ref() -> ArtifactRef {
    ArtifactRef::new(
        "artifact_1",
        ArtifactSourceRef::ExistingWidgetResult("result_1".into()),
        ArtifactOwnerRef::widget("ws_1", "wb_1", "wid_1", "agent-run"),
        RuntimeArtifactClass::GeneratedResponse,
    )
    .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
}

#[test]
fn knowledge_creates_metadata_only_item_ref() {
    let knowledge = KnowledgeItemRef::new("knowledge_1", KnowledgeItemKind::Reference, owner())
        .with_review_status(KnowledgeReviewStatus::Reviewed)
        .with_visibility(KnowledgeVisibility::WorkspaceVisible)
        .with_freshness(KnowledgeFreshness::Current);

    assert_eq!("knowledge_1", knowledge.knowledge_item_id.as_str());
    assert_eq!(KnowledgeItemKind::Reference, knowledge.kind);
    assert_eq!(KnowledgeReviewStatus::Reviewed, knowledge.review_status);
    assert!(!knowledge.context_eligibility.ai_context_eligible);
}

#[test]
fn knowledge_creates_skill_and_runbook_refs() {
    let skill = SkillRef::new("skill_1")
        .with_version("v1")
        .with_review_status(KnowledgeReviewStatus::Approved);
    let runbook =
        RunbookRef::new("runbook_1").with_review_status(KnowledgeReviewStatus::NeedsReview);

    assert_eq!("skill_1", skill.skill_id.as_str());
    assert_eq!(
        Some("v1"),
        skill.version.as_ref().map(SkillVersionRef::as_str)
    );
    assert_eq!(KnowledgeReviewStatus::Approved, skill.review_status);
    assert_eq!("runbook_1", runbook.runbook_id.as_str());
    assert_eq!(KnowledgeReviewStatus::NeedsReview, runbook.review_status);
}

#[test]
fn knowledge_creates_evidence_ref_linked_to_artifact_without_copying_payload() {
    let artifact = artifact_ref();
    let evidence = EvidenceRef::new(
        "evidence_1",
        EvidenceSourceRef::artifact(artifact.artifact_id.clone()),
    )
    .with_artifact_link(EvidenceArtifactLink::new(artifact.clone()))
    .with_review_status(KnowledgeReviewStatus::Reviewed);

    assert_eq!("evidence_1", evidence.evidence_id.as_str());
    assert_eq!(EvidenceSourceKind::Artifact, evidence.source.source_kind);
    assert_eq!(
        Some("artifact_1"),
        evidence
            .artifact_link
            .as_ref()
            .map(|link| link.artifact.artifact_id.as_str())
    );
    assert!(evidence
        .artifact_link
        .as_ref()
        .is_some_and(|link| !link.evidence_eligible));
}

#[test]
fn knowledge_evidence_source_kind_represents_supported_sources() {
    let kinds = [
        EvidenceSourceKind::Artifact,
        EvidenceSourceKind::ExternalUrl,
        EvidenceSourceKind::File,
        EvidenceSourceKind::OperatorStatement,
        EvidenceSourceKind::RuntimeObservation,
        EvidenceSourceKind::QueryResult,
        EvidenceSourceKind::GitDiff,
        EvidenceSourceKind::TerminalOutput,
        EvidenceSourceKind::ProviderResponse,
    ];

    assert_eq!(9, kinds.len());
    assert!(kinds.contains(&EvidenceSourceKind::Artifact));
    assert!(kinds.contains(&EvidenceSourceKind::ProviderResponse));
}

#[test]
fn knowledge_unknown_review_confidence_and_freshness_are_conservative() {
    assert!(!KnowledgeReviewStatus::Unknown.is_approved());
    assert!(!EvidenceConfidence::Unknown.is_verified());
    assert!(!KnowledgeFreshness::Unknown.is_current());
    assert!(!EvidenceFreshness::Unknown.is_current());
    assert!(!KnowledgeVisibility::Unknown.is_shareable_without_review());
}

#[test]
fn knowledge_artifact_ref_does_not_automatically_become_evidence_ref() {
    let artifact = artifact_ref();
    let link = EvidenceArtifactLink::new(artifact);

    assert!(!link.evidence_eligible);
}

#[test]
fn knowledge_note_derived_item_is_explicit_not_automatic() {
    let knowledge = KnowledgeItemRef::new(
        "knowledge_from_note_1",
        KnowledgeItemKind::NoteDerived,
        owner(),
    )
    .with_review_status(KnowledgeReviewStatus::NeedsReview);

    assert_eq!(KnowledgeItemKind::NoteDerived, knowledge.kind);
    assert_eq!(KnowledgeReviewStatus::NeedsReview, knowledge.review_status);
    assert!(!knowledge.review_status.is_approved());
}

#[test]
fn knowledge_ai_context_sharing_is_not_implied() {
    let knowledge = KnowledgeItemRef::new("knowledge_context_1", KnowledgeItemKind::Skill, owner());
    let evidence = EvidenceRef::new(
        "evidence_context_1",
        EvidenceSourceRef::external(EvidenceSourceKind::OperatorStatement, "statement_1"),
    );

    assert!(!knowledge.context_eligibility.ai_context_eligible);
    assert!(!evidence.context_eligibility.ai_context_eligible);
    assert!(KnowledgeContextEligibility::explicitly_eligible().ai_context_eligible);
}

#[test]
fn knowledge_debug_output_does_not_expose_secret_like_summary_text() {
    let knowledge = KnowledgeItemRef::new(
        "knowledge_debug_1",
        KnowledgeItemKind::TroubleshootingGuide,
        owner(),
    )
    .with_summary(KnowledgeRefSummary::new("provider token=secret text"));

    let debug = format!("{knowledge:?}");

    assert!(debug.contains("KnowledgeRefSummary"));
    assert!(debug.contains("contains_secret_candidate"));
    assert!(!debug.contains("provider token=secret text"));
    assert!(!debug.contains("token=secret"));
}

#[test]
fn knowledge_model_compiles_without_schema_dto_or_runtime_wiring() {
    let knowledge =
        KnowledgeItemRef::new("knowledge_type_only_1", KnowledgeItemKind::Skill, owner());
    let evidence = EvidenceRef::new(
        "evidence_type_only_1",
        EvidenceSourceRef::external(EvidenceSourceKind::RuntimeObservation, "runtime_obs_1"),
    )
    .with_confidence(EvidenceConfidence::Medium);
    let link = KnowledgeEvidenceLink::new(knowledge, evidence);

    assert_eq!(KnowledgeItemKind::Skill, link.knowledge_item.kind);
    assert_eq!(EvidenceConfidence::Medium, link.evidence.confidence);
}
