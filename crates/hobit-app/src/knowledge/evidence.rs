use crate::ArtifactId;

use super::{
    EvidenceId, EvidenceSourceId, KnowledgeContextEligibility, KnowledgeOwnerId,
    KnowledgeRefSummary, KnowledgeReviewStatus,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceRef {
    pub evidence_id: EvidenceId,
    pub source: EvidenceSourceRef,
    pub attribution: EvidenceAttribution,
    pub confidence: EvidenceConfidence,
    pub freshness: EvidenceFreshness,
    pub review_status: EvidenceReviewStatus,
    pub artifact_link: Option<super::EvidenceArtifactLink>,
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

    pub fn with_artifact_link(mut self, artifact_link: super::EvidenceArtifactLink) -> Self {
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
