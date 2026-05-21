use std::fmt;

use crate::{ArtifactId, ArtifactRef};

macro_rules! knowledge_id {
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

knowledge_id!(KnowledgeItemId);
knowledge_id!(KnowledgeWorkspaceRef);
knowledge_id!(KnowledgeOwnerId);
knowledge_id!(SkillId);
knowledge_id!(SkillVersionRef);
knowledge_id!(RunbookId);
knowledge_id!(EvidenceId);
knowledge_id!(EvidenceSourceId);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeItemRef {
    pub knowledge_item_id: KnowledgeItemId,
    pub kind: KnowledgeItemKind,
    pub owner: KnowledgeOwnerRef,
    pub review_status: KnowledgeReviewStatus,
    pub visibility: KnowledgeVisibility,
    pub freshness: KnowledgeFreshness,
    pub context_eligibility: KnowledgeContextEligibility,
    pub summary: Option<KnowledgeRefSummary>,
}

impl KnowledgeItemRef {
    pub fn new(
        knowledge_item_id: impl Into<KnowledgeItemId>,
        kind: KnowledgeItemKind,
        owner: KnowledgeOwnerRef,
    ) -> Self {
        Self {
            knowledge_item_id: knowledge_item_id.into(),
            kind,
            owner,
            review_status: KnowledgeReviewStatus::Unknown,
            visibility: KnowledgeVisibility::Unknown,
            freshness: KnowledgeFreshness::Unknown,
            context_eligibility: KnowledgeContextEligibility::default(),
            summary: None,
        }
    }

    pub fn with_review_status(mut self, review_status: KnowledgeReviewStatus) -> Self {
        self.review_status = review_status;
        self
    }

    pub fn with_visibility(mut self, visibility: KnowledgeVisibility) -> Self {
        self.visibility = visibility;
        self
    }

    pub fn with_freshness(mut self, freshness: KnowledgeFreshness) -> Self {
        self.freshness = freshness;
        self
    }

    pub fn with_context_eligibility(
        mut self,
        context_eligibility: KnowledgeContextEligibility,
    ) -> Self {
        self.context_eligibility = context_eligibility;
        self
    }

    pub fn with_summary(mut self, summary: KnowledgeRefSummary) -> Self {
        self.summary = Some(summary);
        self
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum KnowledgeItemKind {
    NoteDerived,
    Skill,
    Runbook,
    Procedure,
    TroubleshootingGuide,
    Reference,
    ExternalDocument,
    #[default]
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeOwnerRef {
    pub workspace_id: Option<KnowledgeWorkspaceRef>,
    pub owner_id: Option<KnowledgeOwnerId>,
}

impl KnowledgeOwnerRef {
    pub fn workspace(workspace_id: impl Into<KnowledgeWorkspaceRef>) -> Self {
        Self {
            workspace_id: Some(workspace_id.into()),
            owner_id: None,
        }
    }

    pub fn explicit(
        workspace_id: impl Into<KnowledgeWorkspaceRef>,
        owner_id: impl Into<KnowledgeOwnerId>,
    ) -> Self {
        Self {
            workspace_id: Some(workspace_id.into()),
            owner_id: Some(owner_id.into()),
        }
    }

    pub fn local_unknown() -> Self {
        Self {
            workspace_id: None,
            owner_id: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum KnowledgeReviewStatus {
    Draft,
    NeedsReview,
    Reviewed,
    Approved,
    Deprecated,
    Rejected,
    #[default]
    Unknown,
}

impl KnowledgeReviewStatus {
    pub fn is_approved(self) -> bool {
        matches!(self, Self::Approved)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum KnowledgeVisibility {
    LocalOnly,
    WorkspaceVisible,
    SharedWithExplicitApproval,
    ExternalReferenceOnly,
    #[default]
    Unknown,
}

impl KnowledgeVisibility {
    pub fn is_shareable_without_review(self) -> bool {
        false
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum KnowledgeFreshness {
    Current,
    NeedsRefresh,
    Stale,
    Historical,
    #[default]
    Unknown,
}

impl KnowledgeFreshness {
    pub fn is_current(self) -> bool {
        matches!(self, Self::Current)
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct KnowledgeContextEligibility {
    pub ai_context_eligible: bool,
}

impl KnowledgeContextEligibility {
    pub fn not_eligible() -> Self {
        Self::default()
    }

    pub fn explicitly_eligible() -> Self {
        Self {
            ai_context_eligible: true,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SkillRef {
    pub skill_id: SkillId,
    pub version: Option<SkillVersionRef>,
    pub review_status: SkillReviewStatus,
    pub knowledge_item: Option<KnowledgeItemRef>,
    pub summary: Option<KnowledgeRefSummary>,
}

impl SkillRef {
    pub fn new(skill_id: impl Into<SkillId>) -> Self {
        Self {
            skill_id: skill_id.into(),
            version: None,
            review_status: SkillReviewStatus::Unknown,
            knowledge_item: None,
            summary: None,
        }
    }

    pub fn with_version(mut self, version: impl Into<SkillVersionRef>) -> Self {
        self.version = Some(version.into());
        self
    }

    pub fn with_review_status(mut self, review_status: SkillReviewStatus) -> Self {
        self.review_status = review_status;
        self
    }

    pub fn with_knowledge_item(mut self, knowledge_item: KnowledgeItemRef) -> Self {
        self.knowledge_item = Some(knowledge_item);
        self
    }
}

pub type SkillReviewStatus = KnowledgeReviewStatus;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunbookRef {
    pub runbook_id: RunbookId,
    pub review_status: KnowledgeReviewStatus,
    pub knowledge_item: Option<KnowledgeItemRef>,
}

impl RunbookRef {
    pub fn new(runbook_id: impl Into<RunbookId>) -> Self {
        Self {
            runbook_id: runbook_id.into(),
            review_status: KnowledgeReviewStatus::Unknown,
            knowledge_item: None,
        }
    }

    pub fn with_review_status(mut self, review_status: KnowledgeReviewStatus) -> Self {
        self.review_status = review_status;
        self
    }

    pub fn with_knowledge_item(mut self, knowledge_item: KnowledgeItemRef) -> Self {
        self.knowledge_item = Some(knowledge_item);
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceRef {
    pub evidence_id: EvidenceId,
    pub source: EvidenceSourceRef,
    pub attribution: EvidenceAttribution,
    pub confidence: EvidenceConfidence,
    pub freshness: EvidenceFreshness,
    pub review_status: EvidenceReviewStatus,
    pub artifact_link: Option<EvidenceArtifactLink>,
    pub context_eligibility: KnowledgeContextEligibility,
    pub summary: Option<KnowledgeRefSummary>,
}

impl EvidenceRef {
    pub fn new(evidence_id: impl Into<EvidenceId>, source: EvidenceSourceRef) -> Self {
        Self {
            evidence_id: evidence_id.into(),
            source,
            attribution: EvidenceAttribution::unknown(),
            confidence: EvidenceConfidence::Unknown,
            freshness: EvidenceFreshness::Unknown,
            review_status: EvidenceReviewStatus::Unknown,
            artifact_link: None,
            context_eligibility: KnowledgeContextEligibility::default(),
            summary: None,
        }
    }

    pub fn with_artifact_link(mut self, artifact_link: EvidenceArtifactLink) -> Self {
        self.artifact_link = Some(artifact_link);
        self
    }

    pub fn with_attribution(mut self, attribution: EvidenceAttribution) -> Self {
        self.attribution = attribution;
        self
    }

    pub fn with_confidence(mut self, confidence: EvidenceConfidence) -> Self {
        self.confidence = confidence;
        self
    }

    pub fn with_freshness(mut self, freshness: EvidenceFreshness) -> Self {
        self.freshness = freshness;
        self
    }

    pub fn with_review_status(mut self, review_status: EvidenceReviewStatus) -> Self {
        self.review_status = review_status;
        self
    }

    pub fn with_context_eligibility(
        mut self,
        context_eligibility: KnowledgeContextEligibility,
    ) -> Self {
        self.context_eligibility = context_eligibility;
        self
    }

    pub fn with_summary(mut self, summary: KnowledgeRefSummary) -> Self {
        self.summary = Some(summary);
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceSourceRef {
    pub source_kind: EvidenceSourceKind,
    pub source_id: Option<EvidenceSourceId>,
}

impl EvidenceSourceRef {
    pub fn new(source_kind: EvidenceSourceKind, source_id: Option<EvidenceSourceId>) -> Self {
        Self {
            source_kind,
            source_id,
        }
    }

    pub fn artifact(artifact_id: impl Into<ArtifactId>) -> Self {
        Self {
            source_kind: EvidenceSourceKind::Artifact,
            source_id: Some(EvidenceSourceId::new(
                artifact_id.into().as_str().to_owned(),
            )),
        }
    }

    pub fn external(
        source_kind: EvidenceSourceKind,
        source_id: impl Into<EvidenceSourceId>,
    ) -> Self {
        Self::new(source_kind, Some(source_id.into()))
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum EvidenceSourceKind {
    Artifact,
    ExternalUrl,
    File,
    OperatorStatement,
    RuntimeObservation,
    QueryResult,
    GitDiff,
    TerminalOutput,
    ProviderResponse,
    #[default]
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceAttribution {
    pub source_label: Option<KnowledgeRefSummary>,
    pub actor_id: Option<KnowledgeOwnerId>,
}

impl EvidenceAttribution {
    pub fn unknown() -> Self {
        Self {
            source_label: None,
            actor_id: None,
        }
    }

    pub fn source_label(label: KnowledgeRefSummary) -> Self {
        Self {
            source_label: Some(label),
            actor_id: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum EvidenceConfidence {
    Low,
    Medium,
    High,
    Verified,
    #[default]
    Unknown,
}

impl EvidenceConfidence {
    pub fn is_verified(self) -> bool {
        matches!(self, Self::Verified)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum EvidenceFreshness {
    Current,
    NeedsRefresh,
    Stale,
    Historical,
    #[default]
    Unknown,
}

impl EvidenceFreshness {
    pub fn is_current(self) -> bool {
        matches!(self, Self::Current)
    }
}

pub type EvidenceReviewStatus = KnowledgeReviewStatus;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceArtifactLink {
    pub artifact: ArtifactRef,
    pub evidence_eligible: bool,
}

impl EvidenceArtifactLink {
    pub fn new(artifact: ArtifactRef) -> Self {
        Self {
            artifact,
            evidence_eligible: false,
        }
    }

    pub fn explicitly_evidence_eligible(mut self) -> Self {
        self.evidence_eligible = true;
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeEvidenceLink {
    pub knowledge_item: KnowledgeItemRef,
    pub evidence: EvidenceRef,
}

impl KnowledgeEvidenceLink {
    pub fn new(knowledge_item: KnowledgeItemRef, evidence: EvidenceRef) -> Self {
        Self {
            knowledge_item,
            evidence,
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct KnowledgeRefSummary {
    text: String,
}

impl KnowledgeRefSummary {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl fmt::Debug for KnowledgeRefSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("KnowledgeRefSummary")
            .field("text_present", &true)
            .field("text_bytes", &self.text.len())
            .field(
                "contains_secret_candidate",
                &contains_secret_like(&self.text),
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
    use crate::{
        ArtifactOwnerRef, ArtifactSourceRef, RuntimeArtifactClass, RuntimeRedactionStatus,
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
        let knowledge =
            KnowledgeItemRef::new("knowledge_context_1", KnowledgeItemKind::Skill, owner());
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
}
