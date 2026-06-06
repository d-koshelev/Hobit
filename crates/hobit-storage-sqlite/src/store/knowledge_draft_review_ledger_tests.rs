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

fn create_document(store: &SqliteStore, workspace_id: &str, document_id: &str) {
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: document_id,
            workspace_id,
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Accepted draft",
            source_label: "Queue task",
            source_kind: Some("queue_draft"),
            source_ref: Some("queue:task_1"),
            source_refs: None,
            relations: None,
            content: "Accepted explicit Knowledge content.",
            tags: "queue",
            enabled: true,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create document");
}

#[test]
fn upserts_accepted_review_record_with_created_item_id() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_document(&store, "workspace-1", "kdoc-1");

    let row = store
        .upsert_knowledge_draft_review_record(NewKnowledgeDraftReviewRecord {
            review_id: "review-1",
            workspace_id: "workspace-1",
            draft_pack_id: "pack-1",
            source_fingerprint: "queue:task-1|pack:pack-1",
            source_queue_item_id: Some("task-1"),
            source_run_id: Some("run-1"),
            proposed_item_id: "draft-1",
            proposed_item_key: "pack-1|draft-1",
            action: "accepted",
            reviewed_at: Some("2026-06-06T10:00:00.000Z"),
            accepted_knowledge_document_id: Some("kdoc-1"),
            accepted_skill_id: None,
            rejection_reason: None,
            created_at: Some("2026-06-06T10:00:00.000Z"),
            updated_at: Some("2026-06-06T10:00:00.000Z"),
        })
        .expect("record review");

    assert_eq!(row.action, "accepted");
    assert_eq!(
        row.accepted_knowledge_document_id.as_deref(),
        Some("kdoc-1")
    );

    let listed = store
        .list_knowledge_draft_review_records_for_pack(
            "workspace-1",
            "pack-1",
            Some("queue:task-1|pack:pack-1"),
        )
        .expect("list reviews");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].review_id, "review-1");
}

#[test]
fn records_rejection_without_created_item_id() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let row = store
        .upsert_knowledge_draft_review_record(NewKnowledgeDraftReviewRecord {
            review_id: "review-reject",
            workspace_id: "workspace-1",
            draft_pack_id: "pack-1",
            source_fingerprint: "queue:task-1|pack:pack-1",
            source_queue_item_id: Some("task-1"),
            source_run_id: None,
            proposed_item_id: "draft-reject",
            proposed_item_key: "pack-1|draft-reject",
            action: "rejected",
            reviewed_at: Some("2026-06-06T10:05:00.000Z"),
            accepted_knowledge_document_id: None,
            accepted_skill_id: None,
            rejection_reason: Some("Not useful"),
            created_at: Some("2026-06-06T10:05:00.000Z"),
            updated_at: Some("2026-06-06T10:05:00.000Z"),
        })
        .expect("record rejection");

    assert_eq!(row.action, "rejected");
    assert_eq!(row.accepted_knowledge_document_id, None);
    assert_eq!(row.accepted_skill_id, None);
    assert_eq!(row.rejection_reason.as_deref(), Some("Not useful"));
}
