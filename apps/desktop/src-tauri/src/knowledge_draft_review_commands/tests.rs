use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::CreateKnowledgeDocumentInput;

#[test]
fn knowledge_draft_review_command_helpers_record_and_reload_decisions() {
    let db_path = unique_test_db_path();
    let (workspace_id, document_id) = create_workspace_and_document_in_test_db(&db_path);

    let accepted = record_knowledge_draft_review_blocking(
        RecordKnowledgeDraftReviewRequest {
            workspace_id: workspace_id.clone(),
            draft_pack_id: "pack_command_1".to_owned(),
            source_fingerprint: Some("queue:task_1|pack:pack_command_1".to_owned()),
            source_queue_item_id: Some("task_1".to_owned()),
            source_run_id: Some("run_1".to_owned()),
            proposed_item_id: "draft_doc".to_owned(),
            proposed_item_key: Some("pack_command_1|draft_doc".to_owned()),
            action: "accepted".to_owned(),
            reviewed_at: Some("2026-06-06T10:00:00.000Z".to_owned()),
            accepted_knowledge_document_id: Some(document_id.clone()),
            accepted_skill_id: None,
            rejection_reason: None,
        },
        db_path.clone(),
    )
    .expect("record accepted review");

    assert_eq!(accepted.action, "accepted");
    assert_eq!(
        accepted.accepted_knowledge_document_id.as_deref(),
        Some(document_id.as_str())
    );

    let rejected = record_knowledge_draft_review_blocking(
        RecordKnowledgeDraftReviewRequest {
            workspace_id: workspace_id.clone(),
            draft_pack_id: "pack_command_1".to_owned(),
            source_fingerprint: Some("queue:task_1|pack:pack_command_1".to_owned()),
            source_queue_item_id: Some("task_1".to_owned()),
            source_run_id: Some("run_1".to_owned()),
            proposed_item_id: "draft_reject".to_owned(),
            proposed_item_key: Some("pack_command_1|draft_reject".to_owned()),
            action: "rejected".to_owned(),
            reviewed_at: Some("2026-06-06T10:05:00.000Z".to_owned()),
            accepted_knowledge_document_id: None,
            accepted_skill_id: None,
            rejection_reason: Some("Operator rejected this draft.".to_owned()),
        },
        db_path.clone(),
    )
    .expect("record rejected review");

    assert_eq!(rejected.action, "rejected");
    assert_eq!(rejected.accepted_knowledge_document_id, None);
    assert_eq!(rejected.accepted_skill_id, None);

    let reloaded = list_knowledge_draft_reviews_blocking(
        ListKnowledgeDraftReviewsRequest {
            workspace_id,
            draft_pack_id: "pack_command_1".to_owned(),
            source_fingerprint: Some("queue:task_1|pack:pack_command_1".to_owned()),
        },
        db_path.clone(),
    )
    .expect("reload reviews");

    assert_eq!(reloaded.len(), 2);
    assert!(reloaded
        .iter()
        .any(|review| review.proposed_item_id == "draft_doc"
            && review.accepted_knowledge_document_id.as_deref() == Some(document_id.as_str())));
    assert!(reloaded
        .iter()
        .any(|review| review.proposed_item_id == "draft_reject"
            && review.action == "rejected"
            && review.accepted_knowledge_document_id.is_none()
            && review.accepted_skill_id.is_none()));

    remove_test_db_files(&db_path);
}

fn create_workspace_and_document_in_test_db(db_path: &Path) -> (String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Knowledge draft review command test", None)
        .expect("create workspace");
    let document = service
        .create_knowledge_document(CreateKnowledgeDocumentInput {
            workspace_id: workspace.id.clone(),
            scope: None,
            catalog_item_type: None,
            quick_summary: Some("Accepted draft summary".to_owned()),
            lifecycle_status: None,
            title: "Accepted draft".to_owned(),
            source_label: "Queue task task_1".to_owned(),
            source_kind: Some("queue_draft".to_owned()),
            source_ref: Some("queue:task_1;draft:draft_doc".to_owned()),
            source_refs: Vec::new(),
            relations: Vec::new(),
            content: "Accepted explicit Knowledge content.".to_owned(),
            tags: "queue, knowledge".to_owned(),
            enabled: true,
            searchable: true,
            version_summary: None,
            reviewed_at: None,
            created_by_task_id: Some("task_1".to_owned()),
            created_from_run_id: Some("run_1".to_owned()),
        })
        .expect("create document");
    let result = (workspace.id, document.knowledge_document_id);
    drop(service);
    result
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-knowledge-draft-review-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
