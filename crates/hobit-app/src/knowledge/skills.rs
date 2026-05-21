use super::{
    KnowledgeItemRef, KnowledgeRefSummary, KnowledgeReviewStatus, RunbookId, SkillId,
    SkillVersionRef,
};

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
