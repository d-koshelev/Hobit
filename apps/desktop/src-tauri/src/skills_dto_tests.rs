use hobit_app::SkillSummary;

use crate::skills_dto::{CreateSkillRequest, DeleteSkillRequest, SkillDto, UpdateSkillRequest};

#[test]
fn maps_create_skill_request_to_app_input() {
    let request = CreateSkillRequest {
        workspace_id: "ws_1".to_owned(),
        title: "Skill".to_owned(),
        when_to_use: "When".to_owned(),
        prerequisites: "Prereqs".to_owned(),
        steps: "Steps".to_owned(),
        validation: "Validation".to_owned(),
        risks: "Risks".to_owned(),
        tags: "ops".to_owned(),
        review_status: "draft".to_owned(),
    };

    let input: hobit_app::CreateSkillInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.title, "Skill");
    assert_eq!(input.when_to_use, "When");
    assert_eq!(input.review_status, "draft");
}

#[test]
fn maps_update_skill_request_to_app_input() {
    let request = UpdateSkillRequest {
        workspace_id: "ws_1".to_owned(),
        skill_id: "skill_1".to_owned(),
        title: "Updated".to_owned(),
        when_to_use: "Updated when".to_owned(),
        prerequisites: "Updated prereqs".to_owned(),
        steps: "Updated steps".to_owned(),
        validation: "Updated validation".to_owned(),
        risks: "Updated risks".to_owned(),
        tags: "updated".to_owned(),
        review_status: "reviewed".to_owned(),
    };

    let input: hobit_app::UpdateSkillInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.skill_id, "skill_1");
    assert_eq!(input.title, "Updated");
    assert_eq!(input.review_status, "reviewed");
}

#[test]
fn maps_delete_skill_request_to_app_input() {
    let request = DeleteSkillRequest {
        workspace_id: "ws_1".to_owned(),
        skill_id: "skill_1".to_owned(),
    };

    let input: hobit_app::DeleteSkillInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.skill_id, "skill_1");
}

#[test]
fn maps_skill_summary_to_dto() {
    let summary = SkillSummary {
        skill_id: "skill_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        title: "Skill".to_owned(),
        when_to_use: "When".to_owned(),
        prerequisites: "Prereqs".to_owned(),
        steps: "Steps".to_owned(),
        validation: "Validation".to_owned(),
        risks: "Risks".to_owned(),
        tags: "ops".to_owned(),
        review_status: "draft".to_owned(),
        created_at: "1".to_owned(),
        updated_at: "2".to_owned(),
    };

    let dto = SkillDto::from(summary);

    assert_eq!(dto.skill_id, "skill_1");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.title, "Skill");
    assert_eq!(dto.when_to_use, "When");
    assert_eq!(dto.prerequisites, "Prereqs");
    assert_eq!(dto.steps, "Steps");
    assert_eq!(dto.validation, "Validation");
    assert_eq!(dto.risks, "Risks");
    assert_eq!(dto.tags, "ops");
    assert_eq!(dto.review_status, "draft");
    assert_eq!(dto.created_at, "1");
    assert_eq!(dto.updated_at, "2");
}
