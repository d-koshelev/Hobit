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

fn create_document_input(workspace_id: String) -> CreateKnowledgeDocumentInput {
    CreateKnowledgeDocumentInput {
        workspace_id,
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
    }
}

#[test]
fn accept_persists_review_record_and_created_item_id() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge review ledger");
    let document = service
        .create_knowledge_document(create_document_input(workspace.id.clone()))
        .expect("create explicit document");

    let review = service
        .record_knowledge_draft_review(RecordKnowledgeDraftReviewInput {
            workspace_id: workspace.id.clone(),
            draft_pack_id: "pack_1".to_owned(),
            source_fingerprint: Some("queue:task_1|pack:pack_1".to_owned()),
            source_queue_item_id: Some("task_1".to_owned()),
            source_run_id: Some("run_1".to_owned()),
            proposed_item_id: "draft_doc".to_owned(),
            proposed_item_key: Some("pack_1|draft_doc".to_owned()),
            action: "accepted".to_owned(),
            reviewed_at: Some("2026-06-06T10:00:00.000Z".to_owned()),
            accepted_knowledge_document_id: Some(document.knowledge_document_id.clone()),
            accepted_skill_id: None,
            rejection_reason: None,
        })
        .expect("record accepted review");

    assert_eq!(review.action, "accepted");
    assert_eq!(
        review.accepted_knowledge_document_id.as_deref(),
        Some(document.knowledge_document_id.as_str())
    );
    assert_eq!(review.accepted_skill_id, None);

    let listed = service
        .list_knowledge_draft_reviews(ListKnowledgeDraftReviewsInput {
            workspace_id: workspace.id,
            draft_pack_id: "pack_1".to_owned(),
            source_fingerprint: Some("queue:task_1|pack:pack_1".to_owned()),
        })
        .expect("list reviews");
    assert_eq!(listed, vec![review]);
}

#[test]
fn reject_persists_rejection_record_only_and_creates_no_hidden_knowledge() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge review rejection");

    let review = service
        .record_knowledge_draft_review(RecordKnowledgeDraftReviewInput {
            workspace_id: workspace.id.clone(),
            draft_pack_id: "pack_1".to_owned(),
            source_fingerprint: Some("queue:task_1|pack:pack_1".to_owned()),
            source_queue_item_id: Some("task_1".to_owned()),
            source_run_id: None,
            proposed_item_id: "draft_reject".to_owned(),
            proposed_item_key: Some("pack_1|draft_reject".to_owned()),
            action: "rejected".to_owned(),
            reviewed_at: Some("2026-06-06T10:05:00.000Z".to_owned()),
            accepted_knowledge_document_id: None,
            accepted_skill_id: None,
            rejection_reason: Some("Operator rejected this draft.".to_owned()),
        })
        .expect("record rejection");

    assert_eq!(review.action, "rejected");
    assert_eq!(review.accepted_knowledge_document_id, None);
    assert_eq!(review.accepted_skill_id, None);

    let documents = service
        .list_knowledge_documents(&workspace.id)
        .expect("list documents");
    assert!(documents.is_empty());
}

#[test]
fn accepted_reviews_must_link_explicitly_created_item() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge review safety");

    let error = service
        .record_knowledge_draft_review(RecordKnowledgeDraftReviewInput {
            workspace_id: workspace.id,
            draft_pack_id: "pack_1".to_owned(),
            source_fingerprint: None,
            source_queue_item_id: None,
            source_run_id: None,
            proposed_item_id: "draft_doc".to_owned(),
            proposed_item_key: None,
            action: "accepted".to_owned(),
            reviewed_at: None,
            accepted_knowledge_document_id: None,
            accepted_skill_id: None,
            rejection_reason: None,
        })
        .expect_err("accepted review without created id rejected");

    assert!(error
        .to_string()
        .contains("accepted draft review records must link"));
}
