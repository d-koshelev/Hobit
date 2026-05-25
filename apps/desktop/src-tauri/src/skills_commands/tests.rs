use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn skill_command_helpers_create_list_get_update_and_delete() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);

    let created = create_skill_blocking(
        CreateSkillRequest {
            workspace_id: workspace_id.clone(),
            title: "Skill".to_owned(),
            when_to_use: "When".to_owned(),
            prerequisites: "Prereqs".to_owned(),
            steps: "Steps".to_owned(),
            validation: "Validation".to_owned(),
            risks: "Risks".to_owned(),
            tags: "ops".to_owned(),
            review_status: "draft".to_owned(),
        },
        db_path.clone(),
    )
    .expect("create skill");

    assert_eq!(created.workspace_id, workspace_id);
    assert_eq!(created.title, "Skill");
    assert_eq!(created.review_status, "draft");

    let listed = list_skills_blocking(
        ListSkillsRequest {
            workspace_id: workspace_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list skills");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].skill_id, created.skill_id);

    let fetched = get_skill_blocking(
        GetSkillRequest {
            workspace_id: workspace_id.clone(),
            skill_id: created.skill_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get skill")
    .expect("skill");
    assert_eq!(fetched, created);

    let updated = update_skill_blocking(
        UpdateSkillRequest {
            workspace_id: workspace_id.clone(),
            skill_id: created.skill_id.clone(),
            title: "Updated".to_owned(),
            when_to_use: "Updated when".to_owned(),
            prerequisites: "Updated prereqs".to_owned(),
            steps: "Updated steps".to_owned(),
            validation: "Updated validation".to_owned(),
            risks: "Updated risks".to_owned(),
            tags: "updated".to_owned(),
            review_status: "reviewed".to_owned(),
        },
        db_path.clone(),
    )
    .expect("update skill")
    .expect("updated skill");

    assert_eq!(updated.title, "Updated");
    assert_eq!(updated.review_status, "reviewed");

    assert!(delete_skill_blocking(
        DeleteSkillRequest {
            workspace_id,
            skill_id: created.skill_id,
        },
        db_path.clone(),
    )
    .expect("delete skill"));
    remove_test_db_files(&db_path);
}

#[test]
fn create_skill_command_helper_rejects_unknown_workspace() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let error = create_skill_blocking(
        CreateSkillRequest {
            workspace_id: "missing-workspace".to_owned(),
            title: "Skill".to_owned(),
            when_to_use: "".to_owned(),
            prerequisites: "".to_owned(),
            steps: "".to_owned(),
            validation: "".to_owned(),
            risks: "".to_owned(),
            tags: "".to_owned(),
            review_status: "draft".to_owned(),
        },
        db_path.clone(),
    )
    .expect_err("unknown workspace rejected");

    assert!(error.contains("workspace not found: missing-workspace"));
    remove_test_db_files(&db_path);
}

#[test]
fn get_skill_command_helper_rejects_cross_workspace_access() {
    let db_path = unique_test_db_path();
    let first_workspace_id = create_workspace_in_test_db(&db_path);
    let second_workspace_id = create_workspace_in_test_db(&db_path);
    let created = create_skill_blocking(
        CreateSkillRequest {
            workspace_id: first_workspace_id,
            title: "Skill".to_owned(),
            when_to_use: "When".to_owned(),
            prerequisites: "".to_owned(),
            steps: "".to_owned(),
            validation: "".to_owned(),
            risks: "".to_owned(),
            tags: "".to_owned(),
            review_status: "draft".to_owned(),
        },
        db_path.clone(),
    )
    .expect("create skill");

    let error = get_skill_blocking(
        GetSkillRequest {
            workspace_id: second_workspace_id,
            skill_id: created.skill_id,
        },
        db_path.clone(),
    )
    .expect_err("cross-workspace access rejected");

    assert!(error.contains("skill does not belong"));
    remove_test_db_files(&db_path);
}

fn create_workspace_in_test_db(db_path: &Path) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Skills command test", None)
        .expect("create workspace");
    let workspace_id = workspace.id;
    drop(service);

    workspace_id
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-skills-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
