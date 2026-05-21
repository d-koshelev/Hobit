use std::fmt;

use crate::{
    ArtifactRef, CapabilityActionRef, EvidenceRef, EvidenceSourceRef, KnowledgeItemRef, RunbookRef,
    SkillRef,
};

macro_rules! context_pack_id {
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

context_pack_id!(ContextPackId);
context_pack_id!(ContextPackExternalRef);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContextPackRef {
    pub context_pack_id: ContextPackId,
    pub review_status: ContextPackReviewStatus,
    pub visibility: ContextPackVisibility,
    pub sharing_scope: ContextPackSharingScope,
    pub freshness: ContextPackFreshness,
    pub sensitivity: ContextPackSensitivity,
    pub eligibility: ContextPackEligibility,
    pub items: Vec<ContextPackItemRef>,
    pub summary: Option<ContextPackSummary>,
}

impl ContextPackRef {
    pub fn new(context_pack_id: impl Into<ContextPackId>) -> Self {
        Self {
            context_pack_id: context_pack_id.into(),
            review_status: ContextPackReviewStatus::Unknown,
            visibility: ContextPackVisibility::Unknown,
            sharing_scope: ContextPackSharingScope::NotShared,
            freshness: ContextPackFreshness::Unknown,
            sensitivity: ContextPackSensitivity::Unknown,
            eligibility: ContextPackEligibility::default(),
            items: Vec::new(),
            summary: None,
        }
    }

    pub fn with_review_status(mut self, review_status: ContextPackReviewStatus) -> Self {
        self.review_status = review_status;
        self
    }

    pub fn with_visibility(mut self, visibility: ContextPackVisibility) -> Self {
        self.visibility = visibility;
        self
    }

    pub fn with_sharing_scope(mut self, sharing_scope: ContextPackSharingScope) -> Self {
        self.sharing_scope = sharing_scope;
        self
    }

    pub fn with_freshness(mut self, freshness: ContextPackFreshness) -> Self {
        self.freshness = freshness;
        self
    }

    pub fn with_sensitivity(mut self, sensitivity: ContextPackSensitivity) -> Self {
        self.sensitivity = sensitivity;
        self
    }

    pub fn with_eligibility(mut self, eligibility: ContextPackEligibility) -> Self {
        self.eligibility = eligibility;
        self
    }

    pub fn with_item(mut self, item: ContextPackItemRef) -> Self {
        self.items.push(item);
        self
    }

    pub fn with_summary(mut self, summary: ContextPackSummary) -> Self {
        self.summary = Some(summary);
        self
    }

    pub fn provider_visible(&self) -> bool {
        self.sharing_scope.provider_visible()
            && self.eligibility.ai_context_eligible
            && self.review_status.is_approved_for_context()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContextPackItemRef {
    pub item: ContextPackItemKind,
    pub selection_reason: ContextPackSelectionReason,
    pub review_status: ContextPackReviewStatus,
    pub visibility: ContextPackVisibility,
    pub sensitivity: ContextPackSensitivity,
    pub eligibility: ContextPackEligibility,
    pub summary: Option<ContextPackSummary>,
}

impl ContextPackItemRef {
    pub fn new(item: ContextPackItemKind, selection_reason: ContextPackSelectionReason) -> Self {
        Self {
            item,
            selection_reason,
            review_status: ContextPackReviewStatus::Unknown,
            visibility: ContextPackVisibility::Unknown,
            sensitivity: ContextPackSensitivity::Unknown,
            eligibility: ContextPackEligibility::default(),
            summary: None,
        }
    }

    pub fn knowledge_item(
        knowledge_item: KnowledgeItemRef,
        selection_reason: ContextPackSelectionReason,
    ) -> Self {
        Self::new(
            ContextPackItemKind::KnowledgeItem(knowledge_item),
            selection_reason,
        )
    }

    pub fn skill(skill: SkillRef, selection_reason: ContextPackSelectionReason) -> Self {
        Self::new(ContextPackItemKind::Skill(skill), selection_reason)
    }

    pub fn runbook(runbook: RunbookRef, selection_reason: ContextPackSelectionReason) -> Self {
        Self::new(ContextPackItemKind::Runbook(runbook), selection_reason)
    }

    pub fn evidence(evidence: EvidenceRef, selection_reason: ContextPackSelectionReason) -> Self {
        Self::new(ContextPackItemKind::Evidence(evidence), selection_reason)
    }

    pub fn artifact(artifact: ArtifactRef, selection_reason: ContextPackSelectionReason) -> Self {
        Self::new(ContextPackItemKind::Artifact(artifact), selection_reason)
    }

    pub fn with_review_status(mut self, review_status: ContextPackReviewStatus) -> Self {
        self.review_status = review_status;
        self
    }

    pub fn with_visibility(mut self, visibility: ContextPackVisibility) -> Self {
        self.visibility = visibility;
        self
    }

    pub fn with_sensitivity(mut self, sensitivity: ContextPackSensitivity) -> Self {
        self.sensitivity = sensitivity;
        self
    }

    pub fn with_eligibility(mut self, eligibility: ContextPackEligibility) -> Self {
        self.eligibility = eligibility;
        self
    }

    pub fn with_summary(mut self, summary: ContextPackSummary) -> Self {
        self.summary = Some(summary);
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ContextPackItemKind {
    KnowledgeItem(KnowledgeItemRef),
    Skill(SkillRef),
    Runbook(RunbookRef),
    Evidence(EvidenceRef),
    EvidenceSource(EvidenceSourceRef),
    Artifact(ArtifactRef),
    CapabilityAction(CapabilityActionRef),
    ExternalReference(ContextPackExternalRef),
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ContextPackSelectionReason {
    OperatorSelected,
    RequiredForTask,
    SuggestedByCoordinator,
    SuggestedBySkill,
    LinkedEvidence,
    RelatedArtifact,
    ImportedReference,
    #[default]
    Unknown,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ContextPackReviewStatus {
    Draft,
    NeedsReview,
    Reviewed,
    ApprovedForContext,
    Rejected,
    Deprecated,
    #[default]
    Unknown,
}

impl ContextPackReviewStatus {
    pub fn is_approved_for_context(self) -> bool {
        matches!(self, Self::ApprovedForContext)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ContextPackVisibility {
    LocalOnly,
    WorkspaceVisible,
    SharedWithExplicitApproval,
    ExternalReferenceOnly,
    #[default]
    Unknown,
}

impl ContextPackVisibility {
    pub fn is_safe_without_review(self) -> bool {
        false
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ContextPackSharingScope {
    #[default]
    NotShared,
    LocalPreviewOnly,
    CoordinatorVisible,
    ProviderVisibleWithApproval,
    WorkspaceVisible,
    Unknown,
}

impl ContextPackSharingScope {
    pub fn provider_visible(self) -> bool {
        matches!(self, Self::ProviderVisibleWithApproval)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ContextPackFreshness {
    Current,
    NeedsRefresh,
    Stale,
    Historical,
    #[default]
    Unknown,
}

impl ContextPackFreshness {
    pub fn is_current(self) -> bool {
        matches!(self, Self::Current)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum ContextPackSensitivity {
    SafeMetadata,
    OperatorText,
    SourceContent,
    RawRuntimeOutput,
    GeneratedText,
    SecretCandidate,
    #[default]
    Unknown,
}

impl ContextPackSensitivity {
    pub fn is_safe_metadata(self) -> bool {
        matches!(self, Self::SafeMetadata)
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct ContextPackEligibility {
    pub ai_context_eligible: bool,
}

impl ContextPackEligibility {
    pub fn not_eligible() -> Self {
        Self::default()
    }

    pub fn explicitly_ai_context_eligible() -> Self {
        Self {
            ai_context_eligible: true,
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct ContextPackSummary {
    text: String,
}

impl ContextPackSummary {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl fmt::Debug for ContextPackSummary {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ContextPackSummary")
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
        ArtifactOwnerRef, ArtifactSourceRef, CapabilityActionRef, CapabilitySubjectRef,
        EvidenceArtifactLink, EvidenceSourceKind, EvidenceSourceRef, KnowledgeItemKind,
        KnowledgeOwnerRef, KnowledgeReviewStatus, RuntimeArtifactClass, WidgetCapabilityRef,
    };

    fn knowledge_ref() -> KnowledgeItemRef {
        KnowledgeItemRef::new(
            "knowledge_1",
            KnowledgeItemKind::Reference,
            KnowledgeOwnerRef::workspace("ws_1"),
        )
        .with_review_status(KnowledgeReviewStatus::Reviewed)
    }

    fn skill_ref() -> SkillRef {
        SkillRef::new("skill_1").with_review_status(KnowledgeReviewStatus::Reviewed)
    }

    fn runbook_ref() -> RunbookRef {
        RunbookRef::new("runbook_1").with_review_status(KnowledgeReviewStatus::Reviewed)
    }

    fn artifact_ref() -> ArtifactRef {
        ArtifactRef::new(
            "artifact_1",
            ArtifactSourceRef::ExistingWidgetResult("result_1".into()),
            ArtifactOwnerRef::widget("ws_1", "wb_1", "wid_1", "agent-run"),
            RuntimeArtifactClass::GeneratedResponse,
        )
    }

    fn evidence_ref() -> EvidenceRef {
        EvidenceRef::new(
            "evidence_1",
            EvidenceSourceRef::artifact(artifact_ref().artifact_id),
        )
        .with_artifact_link(EvidenceArtifactLink::new(artifact_ref()))
    }

    #[test]
    fn context_creates_metadata_only_pack_ref() {
        let pack = ContextPackRef::new("context_pack_1")
            .with_review_status(ContextPackReviewStatus::Draft)
            .with_visibility(ContextPackVisibility::LocalOnly)
            .with_summary(ContextPackSummary::new("local preview selection"));

        assert_eq!("context_pack_1", pack.context_pack_id.as_str());
        assert_eq!(ContextPackReviewStatus::Draft, pack.review_status);
        assert_eq!(ContextPackSharingScope::NotShared, pack.sharing_scope);
        assert!(!pack.provider_visible());
        assert_eq!(0, pack.items.len());
    }

    #[test]
    fn context_creates_items_for_core_ref_types() {
        let items = vec![
            ContextPackItemRef::knowledge_item(
                knowledge_ref(),
                ContextPackSelectionReason::OperatorSelected,
            ),
            ContextPackItemRef::skill(skill_ref(), ContextPackSelectionReason::SuggestedBySkill),
            ContextPackItemRef::runbook(runbook_ref(), ContextPackSelectionReason::RequiredForTask),
            ContextPackItemRef::evidence(
                evidence_ref(),
                ContextPackSelectionReason::LinkedEvidence,
            ),
            ContextPackItemRef::artifact(
                artifact_ref(),
                ContextPackSelectionReason::RelatedArtifact,
            ),
        ];

        assert!(matches!(
            items[0].item,
            ContextPackItemKind::KnowledgeItem(_)
        ));
        assert!(matches!(items[1].item, ContextPackItemKind::Skill(_)));
        assert!(matches!(items[2].item, ContextPackItemKind::Runbook(_)));
        assert!(matches!(items[3].item, ContextPackItemKind::Evidence(_)));
        assert!(matches!(items[4].item, ContextPackItemKind::Artifact(_)));
    }

    #[test]
    fn context_item_ref_does_not_store_raw_payload_content() {
        let item = ContextPackItemRef::artifact(
            artifact_ref(),
            ContextPackSelectionReason::RelatedArtifact,
        )
        .with_summary(ContextPackSummary::new("generated result reference"));

        assert_eq!(
            Some("generated result reference"),
            item.summary.as_ref().map(ContextPackSummary::as_str)
        );
        assert!(matches!(item.item, ContextPackItemKind::Artifact(_)));
    }

    #[test]
    fn context_selection_reason_is_explicit() {
        let item = ContextPackItemRef::knowledge_item(
            knowledge_ref(),
            ContextPackSelectionReason::RequiredForTask,
        );

        assert_eq!(
            ContextPackSelectionReason::RequiredForTask,
            item.selection_reason
        );
    }

    #[test]
    fn context_review_status_is_explicit() {
        let item = ContextPackItemRef::evidence(
            evidence_ref(),
            ContextPackSelectionReason::LinkedEvidence,
        )
        .with_review_status(ContextPackReviewStatus::Reviewed);

        assert_eq!(ContextPackReviewStatus::Reviewed, item.review_status);
        assert!(!item.review_status.is_approved_for_context());
    }

    #[test]
    fn context_default_sharing_and_provider_visibility_do_not_expose_context() {
        let pack = ContextPackRef::new("context_pack_private_1");

        assert_eq!(ContextPackSharingScope::NotShared, pack.sharing_scope);
        assert!(!pack.eligibility.ai_context_eligible);
        assert!(!pack.provider_visible());
    }

    #[test]
    fn context_unknown_review_sensitivity_and_sharing_are_conservative() {
        let pack = ContextPackRef::new("context_pack_unknown_1")
            .with_sharing_scope(ContextPackSharingScope::Unknown);

        assert_eq!(ContextPackReviewStatus::Unknown, pack.review_status);
        assert_eq!(ContextPackSensitivity::Unknown, pack.sensitivity);
        assert_eq!(ContextPackSharingScope::Unknown, pack.sharing_scope);
        assert!(!pack.review_status.is_approved_for_context());
        assert!(!pack.sensitivity.is_safe_metadata());
        assert!(!pack.provider_visible());
        assert!(!ContextPackVisibility::Unknown.is_safe_without_review());
    }

    #[test]
    fn context_membership_does_not_imply_evidence_eligibility() {
        let artifact = artifact_ref();
        let item = ContextPackItemRef::artifact(
            artifact.clone(),
            ContextPackSelectionReason::RelatedArtifact,
        );
        let link = EvidenceArtifactLink::new(artifact);

        assert!(matches!(item.item, ContextPackItemKind::Artifact(_)));
        assert!(!link.evidence_eligible);
    }

    #[test]
    fn context_membership_does_not_imply_ai_context_sharing() {
        let item = ContextPackItemRef::knowledge_item(
            knowledge_ref(),
            ContextPackSelectionReason::OperatorSelected,
        );
        let pack = ContextPackRef::new("context_pack_no_share_1").with_item(item);

        assert!(!pack.eligibility.ai_context_eligible);
        assert!(!pack.items[0].eligibility.ai_context_eligible);
        assert!(!pack.provider_visible());
    }

    #[test]
    fn context_debug_output_does_not_expose_secret_like_summary_text() {
        let pack = ContextPackRef::new("context_pack_debug_1")
            .with_summary(ContextPackSummary::new("provider token=secret context"));

        let debug = format!("{pack:?}");

        assert!(debug.contains("ContextPackSummary"));
        assert!(debug.contains("contains_secret_candidate"));
        assert!(!debug.contains("provider token=secret context"));
        assert!(!debug.contains("token=secret"));
    }

    #[test]
    fn context_model_compiles_without_schema_dto_or_runtime_wiring() {
        let capability = CapabilitySubjectRef::Widget(WidgetCapabilityRef::new(
            "ws_1",
            "wb_1",
            "wid_1",
            "agent-run",
            "agent_executor.start_direct_work",
        ));
        let action_item = ContextPackItemRef::new(
            ContextPackItemKind::CapabilityAction(CapabilityActionRef::new("action_1", capability)),
            ContextPackSelectionReason::RequiredForTask,
        );
        let source_item = ContextPackItemRef::new(
            ContextPackItemKind::EvidenceSource(EvidenceSourceRef::external(
                EvidenceSourceKind::ExternalUrl,
                "source_1",
            )),
            ContextPackSelectionReason::ImportedReference,
        );
        let pack = ContextPackRef::new("context_pack_type_only_1")
            .with_item(action_item)
            .with_item(source_item);

        assert_eq!(2, pack.items.len());
        assert!(!pack.provider_visible());
    }
}
