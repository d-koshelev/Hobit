use hobit_app::{CreateSkillInput, DeleteSkillInput, SkillSummary, UpdateSkillInput};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateSkillRequest {
    pub workspace_id: String,
    pub title: String,
    pub when_to_use: String,
    pub prerequisites: String,
    pub steps: String,
    pub validation: String,
    pub risks: String,
    pub tags: String,
    pub review_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListSkillsRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetSkillRequest {
    pub workspace_id: String,
    pub skill_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct UpdateSkillRequest {
    pub workspace_id: String,
    pub skill_id: String,
    pub title: String,
    pub when_to_use: String,
    pub prerequisites: String,
    pub steps: String,
    pub validation: String,
    pub risks: String,
    pub tags: String,
    pub review_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct DeleteSkillRequest {
    pub workspace_id: String,
    pub skill_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct SkillDto {
    pub skill_id: String,
    pub workspace_id: String,
    pub title: String,
    pub when_to_use: String,
    pub prerequisites: String,
    pub steps: String,
    pub validation: String,
    pub risks: String,
    pub tags: String,
    pub review_status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CreateSkillRequest> for CreateSkillInput {
    fn from(request: CreateSkillRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            title: request.title,
            when_to_use: request.when_to_use,
            prerequisites: request.prerequisites,
            steps: request.steps,
            validation: request.validation,
            risks: request.risks,
            tags: request.tags,
            review_status: request.review_status,
        }
    }
}

impl From<UpdateSkillRequest> for UpdateSkillInput {
    fn from(request: UpdateSkillRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            skill_id: request.skill_id,
            title: request.title,
            when_to_use: request.when_to_use,
            prerequisites: request.prerequisites,
            steps: request.steps,
            validation: request.validation,
            risks: request.risks,
            tags: request.tags,
            review_status: request.review_status,
        }
    }
}

impl From<DeleteSkillRequest> for DeleteSkillInput {
    fn from(request: DeleteSkillRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            skill_id: request.skill_id,
        }
    }
}

impl From<SkillSummary> for SkillDto {
    fn from(summary: SkillSummary) -> Self {
        Self {
            skill_id: summary.skill_id,
            workspace_id: summary.workspace_id,
            title: summary.title,
            when_to_use: summary.when_to_use,
            prerequisites: summary.prerequisites,
            steps: summary.steps,
            validation: summary.validation,
            risks: summary.risks,
            tags: summary.tags,
            review_status: summary.review_status,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
