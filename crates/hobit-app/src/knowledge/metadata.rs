use super::{KnowledgeItemId, KnowledgeOwnerId, KnowledgeRefSummary, KnowledgeWorkspaceRef};

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
