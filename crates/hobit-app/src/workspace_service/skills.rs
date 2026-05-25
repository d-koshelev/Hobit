use hobit_storage_sqlite::{NewSkill, SkillUpdate};

use crate::WorkspaceServiceError;

use super::{
    mapping::skill_summary, placeholder_id, placeholder_timestamp, validation::required_input,
    CreateSkillInput, DeleteSkillInput, SkillSummary, UpdateSkillInput, WorkspaceService,
};

const REVIEW_STATUS_DRAFT: &str = "draft";
const REVIEW_STATUS_NEEDS_REVIEW: &str = "needs_review";
const REVIEW_STATUS_REVIEWED: &str = "reviewed";
const REVIEW_STATUS_DEPRECATED: &str = "deprecated";

impl WorkspaceService {
    pub fn create_skill(
        &self,
        input: CreateSkillInput,
    ) -> Result<SkillSummary, WorkspaceServiceError> {
        let input = normalize_create_skill_input(input)?;
        let skill_id = placeholder_id("skill_");
        let created_at = placeholder_timestamp();

        let skill = self
            .store
            .with_immediate_transaction(|store| {
                if store.get_workspace(&input.workspace_id)?.is_none() {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("workspace not found: {}", input.workspace_id),
                    ));
                }

                let skill = store.create_skill(NewSkill {
                    skill_id: &skill_id,
                    workspace_id: &input.workspace_id,
                    title: &input.title,
                    when_to_use: &input.when_to_use,
                    prerequisites: &input.prerequisites,
                    steps: &input.steps,
                    validation: &input.validation,
                    risks: &input.risks,
                    tags: &input.tags,
                    review_status: &input.review_status,
                    created_at: Some(&created_at),
                    updated_at: Some(&created_at),
                })?;
                store.touch_workspace(&input.workspace_id)?;
                Ok(skill)
            })
            .map_err(map_storage_skill_error)?;

        Ok(skill_summary(skill))
    }

    pub fn list_skills(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<SkillSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        Ok(self
            .store
            .list_skills_for_workspace(workspace_id)?
            .into_iter()
            .map(skill_summary)
            .collect())
    }

    pub fn get_skill(
        &self,
        workspace_id: &str,
        skill_id: &str,
    ) -> Result<Option<SkillSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let skill_id = required_input(skill_id, "skill id")?;

        self.validate_skill_workspace_access(workspace_id, skill_id)?;
        Ok(self
            .store
            .get_skill(workspace_id, skill_id)?
            .map(skill_summary))
    }

    pub fn update_skill(
        &self,
        input: UpdateSkillInput,
    ) -> Result<Option<SkillSummary>, WorkspaceServiceError> {
        let input = normalize_update_skill_input(input)?;
        self.validate_skill_workspace_access(&input.workspace_id, &input.skill_id)?;

        let updated_at = placeholder_timestamp();
        let skill = self.store.with_immediate_transaction(|store| {
            let skill = store.update_skill(
                &input.workspace_id,
                &input.skill_id,
                SkillUpdate {
                    title: &input.title,
                    when_to_use: &input.when_to_use,
                    prerequisites: &input.prerequisites,
                    steps: &input.steps,
                    validation: &input.validation,
                    risks: &input.risks,
                    tags: &input.tags,
                    review_status: &input.review_status,
                    updated_at: Some(&updated_at),
                },
            )?;
            if skill.is_some() {
                store.touch_workspace(&input.workspace_id)?;
            }
            Ok(skill)
        })?;

        Ok(skill.map(skill_summary))
    }

    pub fn delete_skill(&self, input: DeleteSkillInput) -> Result<bool, WorkspaceServiceError> {
        let input = normalize_delete_skill_input(input)?;
        self.validate_skill_workspace_access(&input.workspace_id, &input.skill_id)?;

        self.store
            .with_immediate_transaction(|store| {
                let deleted = store.delete_skill(&input.workspace_id, &input.skill_id)?;
                if deleted {
                    store.touch_workspace(&input.workspace_id)?;
                }
                Ok(deleted)
            })
            .map_err(WorkspaceServiceError::from)
    }

    fn validate_skill_workspace_access(
        &self,
        workspace_id: &str,
        skill_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(skill) = self.store.get_skill_by_id(skill_id)? else {
            return Ok(());
        };

        if skill.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "skill does not belong to workspace: {skill_id}"
            )));
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedCreateSkillInput {
    workspace_id: String,
    title: String,
    when_to_use: String,
    prerequisites: String,
    steps: String,
    validation: String,
    risks: String,
    tags: String,
    review_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedUpdateSkillInput {
    workspace_id: String,
    skill_id: String,
    title: String,
    when_to_use: String,
    prerequisites: String,
    steps: String,
    validation: String,
    risks: String,
    tags: String,
    review_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedDeleteSkillInput {
    workspace_id: String,
    skill_id: String,
}

fn normalize_create_skill_input(
    input: CreateSkillInput,
) -> Result<NormalizedCreateSkillInput, WorkspaceServiceError> {
    Ok(NormalizedCreateSkillInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        title: required_owned(input.title, "skill title")?,
        when_to_use: input.when_to_use,
        prerequisites: input.prerequisites,
        steps: input.steps,
        validation: input.validation,
        risks: input.risks,
        tags: normalize_tags(input.tags),
        review_status: normalize_review_status(input.review_status)?,
    })
}

fn normalize_update_skill_input(
    input: UpdateSkillInput,
) -> Result<NormalizedUpdateSkillInput, WorkspaceServiceError> {
    Ok(NormalizedUpdateSkillInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        skill_id: required_owned(input.skill_id, "skill id")?,
        title: required_owned(input.title, "skill title")?,
        when_to_use: input.when_to_use,
        prerequisites: input.prerequisites,
        steps: input.steps,
        validation: input.validation,
        risks: input.risks,
        tags: normalize_tags(input.tags),
        review_status: normalize_review_status(input.review_status)?,
    })
}

fn normalize_delete_skill_input(
    input: DeleteSkillInput,
) -> Result<NormalizedDeleteSkillInput, WorkspaceServiceError> {
    Ok(NormalizedDeleteSkillInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        skill_id: required_owned(input.skill_id, "skill id")?,
    })
}

fn normalize_tags(tags: String) -> String {
    tags.split(',')
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

fn normalize_review_status(status: String) -> Result<String, WorkspaceServiceError> {
    let status = required_owned(status, "skill review status")?;
    match status.as_str() {
        REVIEW_STATUS_DRAFT
        | REVIEW_STATUS_NEEDS_REVIEW
        | REVIEW_STATUS_REVIEWED
        | REVIEW_STATUS_DEPRECATED => Ok(status),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported skill review status: {status}"
        ))),
    }
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn map_storage_skill_error(error: hobit_storage_sqlite::StorageError) -> WorkspaceServiceError {
    match error {
        hobit_storage_sqlite::StorageError::InvalidParameterName(message) => {
            WorkspaceServiceError::InvalidInput(message)
        }
        error => WorkspaceServiceError::from(error),
    }
}
