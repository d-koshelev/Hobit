use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> WorkspaceSummary {
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
}

fn create_skill_input(workspace_id: String) -> CreateSkillInput {
    CreateSkillInput {
        workspace_id,
        title: "Review deploy checklist".to_owned(),
        when_to_use: "Before production deploys".to_owned(),
        prerequisites: "Release branch exists".to_owned(),
        steps: "Read changes\nRun validation".to_owned(),
        validation: "Checks pass".to_owned(),
        risks: "Outdated checklist".to_owned(),
        tags: "deploy, review".to_owned(),
        review_status: "draft".to_owned(),
    }
}

#[test]
fn create_list_get_update_and_delete_skill() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Skills workspace");

    let skill = service
        .create_skill(create_skill_input(workspace.id.clone()))
        .expect("create skill");

    assert_eq!(skill.workspace_id, workspace.id);
    assert_eq!(skill.title, "Review deploy checklist");
    assert_eq!(skill.review_status, "draft");
    assert_eq!(skill.tags, "deploy, review");
    assert!(!skill.created_at.is_empty());
    assert_eq!(skill.created_at, skill.updated_at);

    let listed = service.list_skills(&workspace.id).expect("list skills");
    assert_eq!(listed, vec![skill.clone()]);

    let fetched = service
        .get_skill(&workspace.id, &skill.skill_id)
        .expect("get skill")
        .expect("skill");
    assert_eq!(fetched, skill);

    std::thread::sleep(std::time::Duration::from_millis(1));

    let updated = service
        .update_skill(UpdateSkillInput {
            workspace_id: workspace.id.clone(),
            skill_id: skill.skill_id.clone(),
            title: "Updated skill".to_owned(),
            when_to_use: "Updated when".to_owned(),
            prerequisites: "Updated prerequisites".to_owned(),
            steps: "Updated steps".to_owned(),
            validation: "Updated validation".to_owned(),
            risks: "Updated risks".to_owned(),
            tags: "updated,  reviewed, ".to_owned(),
            review_status: "reviewed".to_owned(),
        })
        .expect("update skill")
        .expect("updated skill");

    assert_eq!(updated.title, "Updated skill");
    assert_eq!(updated.when_to_use, "Updated when");
    assert_eq!(updated.tags, "updated, reviewed");
    assert_eq!(updated.review_status, "reviewed");
    assert_ne!(updated.updated_at, skill.updated_at);

    assert!(service
        .delete_skill(DeleteSkillInput {
            workspace_id: workspace.id.clone(),
            skill_id: skill.skill_id.clone(),
        })
        .expect("delete skill"));
    assert!(service
        .get_skill(&workspace.id, &skill.skill_id)
        .expect("get deleted skill")
        .is_none());
}

#[test]
fn create_skill_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .create_skill(create_skill_input("missing-workspace".to_owned()))
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn list_skills_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .list_skills("missing-workspace")
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn get_update_and_delete_skill_reject_cross_workspace_access() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let skill = service
        .create_skill(create_skill_input(first.id.clone()))
        .expect("create skill");

    let get_error = service
        .get_skill(&second.id, &skill.skill_id)
        .expect_err("cross-workspace get rejected");
    assert!(get_error.to_string().contains("skill does not belong"));

    let update_error = service
        .update_skill(UpdateSkillInput {
            workspace_id: second.id.clone(),
            skill_id: skill.skill_id.clone(),
            title: "Other".to_owned(),
            when_to_use: "Other".to_owned(),
            prerequisites: "Other".to_owned(),
            steps: "Other".to_owned(),
            validation: "Other".to_owned(),
            risks: "Other".to_owned(),
            tags: "other".to_owned(),
            review_status: "draft".to_owned(),
        })
        .expect_err("cross-workspace update rejected");
    assert!(update_error.to_string().contains("skill does not belong"));

    let delete_error = service
        .delete_skill(DeleteSkillInput {
            workspace_id: second.id,
            skill_id: skill.skill_id,
        })
        .expect_err("cross-workspace delete rejected");
    assert!(delete_error.to_string().contains("skill does not belong"));
}

#[test]
fn get_update_and_delete_unknown_skill_return_absent() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Skills workspace");

    assert!(service
        .get_skill(&workspace.id, "missing-skill")
        .expect("get unknown skill")
        .is_none());
    assert!(service
        .update_skill(UpdateSkillInput {
            workspace_id: workspace.id.clone(),
            skill_id: "missing-skill".to_owned(),
            title: "Missing".to_owned(),
            when_to_use: "".to_owned(),
            prerequisites: "".to_owned(),
            steps: "".to_owned(),
            validation: "".to_owned(),
            risks: "".to_owned(),
            tags: "".to_owned(),
            review_status: "draft".to_owned(),
        })
        .expect("update unknown skill")
        .is_none());
    assert!(!service
        .delete_skill(DeleteSkillInput {
            workspace_id: workspace.id,
            skill_id: "missing-skill".to_owned(),
        })
        .expect("delete unknown skill"));
}

#[test]
fn skill_review_status_is_limited_to_mvp_values() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Skills workspace");
    let mut input = create_skill_input(workspace.id);
    input.review_status = "approved".to_owned();

    let error = service
        .create_skill(input)
        .expect_err("unsupported status rejected");

    assert!(error
        .to_string()
        .contains("unsupported skill review status: approved"));
}
