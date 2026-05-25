use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_skill(
    store: &SqliteStore,
    workspace_id: &str,
    skill_id: &str,
    title: &str,
    updated_at: &str,
) {
    store
        .create_skill(NewSkill {
            skill_id,
            workspace_id,
            title,
            when_to_use: "When this work repeats",
            prerequisites: "Known workspace",
            steps: "Do the work",
            validation: "Check the result",
            risks: "Stale instructions",
            tags: "ops,review",
            review_status: "draft",
            created_at: Some(updated_at),
            updated_at: Some(updated_at),
        })
        .expect("create skill");
}

#[test]
fn create_skill_stores_workspace_scoped_skill() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let skill = store
        .create_skill(NewSkill {
            skill_id: "skill-1",
            workspace_id: "workspace-1",
            title: "Review incident notes",
            when_to_use: "Use when reviewing an incident timeline",
            prerequisites: "Incident notes exist",
            steps: "Read notes\nIdentify gaps",
            validation: "Timeline has owners",
            risks: "Missing context",
            tags: "incident,review",
            review_status: "needs_review",
            created_at: Some("1"),
            updated_at: Some("2"),
        })
        .expect("create skill");

    assert_eq!(skill.skill_id, "skill-1");
    assert_eq!(skill.workspace_id, "workspace-1");
    assert_eq!(skill.title, "Review incident notes");
    assert_eq!(skill.when_to_use, "Use when reviewing an incident timeline");
    assert_eq!(skill.prerequisites, "Incident notes exist");
    assert_eq!(skill.steps, "Read notes\nIdentify gaps");
    assert_eq!(skill.validation, "Timeline has owners");
    assert_eq!(skill.risks, "Missing context");
    assert_eq!(skill.tags, "incident,review");
    assert_eq!(skill.review_status, "needs_review");
    assert_eq!(skill.created_at, "1");
    assert_eq!(skill.updated_at, "2");
}

#[test]
fn list_skills_returns_only_skills_for_workspace() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_skill(&store, "workspace-1", "skill-1", "One", "1");
    create_skill(&store, "workspace-2", "skill-2", "Two", "2");

    let skills = store
        .list_skills_for_workspace("workspace-1")
        .expect("list skills");

    assert_eq!(skills.len(), 1);
    assert_eq!(skills[0].skill_id, "skill-1");
}

#[test]
fn get_skill_rejects_cross_workspace_access() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_skill(&store, "workspace-1", "skill-1", "One", "1");

    assert!(store
        .get_skill("workspace-2", "skill-1")
        .expect("get cross-workspace skill")
        .is_none());
}

#[test]
fn update_skill_updates_fields_and_updated_at() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_skill(&store, "workspace-1", "skill-1", "Original", "1");

    let skill = store
        .update_skill(
            "workspace-1",
            "skill-1",
            SkillUpdate {
                title: "Updated",
                when_to_use: "Updated when",
                prerequisites: "Updated prerequisites",
                steps: "Updated steps",
                validation: "Updated validation",
                risks: "Updated risks",
                tags: "updated",
                review_status: "reviewed",
                updated_at: Some("2"),
            },
        )
        .expect("update skill")
        .expect("updated skill");

    assert_eq!(skill.title, "Updated");
    assert_eq!(skill.when_to_use, "Updated when");
    assert_eq!(skill.review_status, "reviewed");
    assert_eq!(skill.updated_at, "2");
}

#[test]
fn delete_skill_removes_only_workspace_skill() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_skill(&store, "workspace-1", "skill-1", "One", "1");
    create_skill(&store, "workspace-2", "skill-2", "Two", "2");

    assert!(store
        .delete_skill("workspace-1", "skill-1")
        .expect("delete skill"));

    assert!(store
        .get_skill("workspace-1", "skill-1")
        .expect("get deleted skill")
        .is_none());
    assert!(store
        .get_skill("workspace-2", "skill-2")
        .expect("get kept skill")
        .is_some());
}

#[test]
fn delete_workspace_deletes_workspace_skills_and_preserves_other_skills() {
    let store = initialized_store();
    create_workspace(&store, "workspace-delete");
    create_workspace(&store, "workspace-keep");
    create_skill(&store, "workspace-delete", "skill-delete", "Delete", "1");
    create_skill(&store, "workspace-keep", "skill-keep", "Keep", "2");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_skill_by_id("skill-delete")
        .expect("get deleted skill")
        .is_none());
    assert!(store
        .get_skill_by_id("skill-keep")
        .expect("get kept skill")
        .is_some());
}
