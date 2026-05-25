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

fn create_document(
    store: &SqliteStore,
    workspace_id: &str,
    document_id: &str,
    title: &str,
    content: &str,
    enabled: bool,
) -> KnowledgeDocumentRow {
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: document_id,
            workspace_id,
            title,
            source_label: "Manual paste",
            content,
            tags: "deploy, runbook",
            enabled,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create knowledge document")
}

#[test]
fn create_list_get_update_and_delete_knowledge_document() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let document = create_document(
        &store,
        "workspace-1",
        "doc-1",
        "Deploy Guide",
        "Use blue green deploys.",
        true,
    );

    assert_eq!(document.knowledge_document_id, "doc-1");
    assert_eq!(document.workspace_id, "workspace-1");
    assert_eq!(document.title, "Deploy Guide");
    assert_eq!(document.source_label, "Manual paste");
    assert_eq!(document.tags, "deploy, runbook");
    assert!(document.enabled);

    let listed = store
        .list_knowledge_documents_for_workspace("workspace-1")
        .expect("list documents");
    assert_eq!(listed, vec![document.clone()]);

    let fetched = store
        .get_knowledge_document("workspace-1", "doc-1")
        .expect("get document");
    assert_eq!(fetched, Some(document));

    let updated = store
        .update_knowledge_document(
            "workspace-1",
            "doc-1",
            KnowledgeDocumentUpdate {
                title: "Updated",
                source_label: "README.md",
                content: "Updated rollback procedure.",
                tags: "rollback",
                enabled: false,
                updated_at: Some("2"),
            },
        )
        .expect("update document")
        .expect("updated document");

    assert_eq!(updated.title, "Updated");
    assert_eq!(updated.source_label, "README.md");
    assert_eq!(updated.content, "Updated rollback procedure.");
    assert_eq!(updated.tags, "rollback");
    assert!(!updated.enabled);
    assert_eq!(updated.updated_at, "2");

    assert!(store
        .delete_knowledge_document("workspace-1", "doc-1")
        .expect("delete document"));
    assert!(store
        .get_knowledge_document("workspace-1", "doc-1")
        .expect("get deleted document")
        .is_none());
}

#[test]
fn chunks_are_created_updated_and_deleted_with_document() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    let content = [
        "# Heading",
        "",
        "First paragraph about deployment.",
        "",
        "Second paragraph about validation.",
    ]
    .join("\n");

    create_document(&store, "workspace-1", "doc-1", "Chunked", &content, true);
    let chunks = store
        .list_knowledge_document_chunks("workspace-1", "doc-1")
        .expect("list chunks");
    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0].chunk_index, 0);
    assert!(chunks[0].text.contains("deployment"));

    store
        .update_knowledge_document(
            "workspace-1",
            "doc-1",
            KnowledgeDocumentUpdate {
                title: "Chunked",
                source_label: "Manual paste",
                content: "Replacement content about rollback.",
                tags: "rollback",
                enabled: true,
                updated_at: Some("2"),
            },
        )
        .expect("update document");
    let updated_chunks = store
        .list_knowledge_document_chunks("workspace-1", "doc-1")
        .expect("list updated chunks");
    assert_eq!(updated_chunks.len(), 1);
    assert!(updated_chunks[0].text.contains("rollback"));
    assert!(!updated_chunks[0].text.contains("deployment"));

    store
        .delete_knowledge_document("workspace-1", "doc-1")
        .expect("delete document");
    assert!(store
        .list_knowledge_document_chunks("workspace-1", "doc-1")
        .expect("list deleted chunks")
        .is_empty());
}

#[test]
fn disabled_documents_are_not_searched() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_document(
        &store,
        "workspace-1",
        "doc-disabled",
        "Disabled deploy guide",
        "Contains unique disabled keyword.",
        false,
    );

    let results = store
        .search_knowledge_documents("workspace-1", "disabled keyword", 5)
        .expect("search documents");

    assert!(results.is_empty());
}

#[test]
fn lexical_search_finds_title_tag_source_and_content_matches() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_document(
        &store,
        "workspace-1",
        "doc-title",
        "Incident Playbook",
        "General content.",
        true,
    );
    create_document(
        &store,
        "workspace-1",
        "doc-content",
        "Other",
        "The failover checklist has validation steps.",
        true,
    );

    let results = store
        .search_knowledge_documents("workspace-1", "incident failover deploy", 5)
        .expect("search documents");

    assert_eq!(results.len(), 2);
    assert!(results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-title"));
    assert!(results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-content"));
    assert!(results.iter().all(|result| result.score > 0));
}

#[test]
fn search_is_workspace_scoped() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_document(
        &store,
        "workspace-2",
        "doc-other",
        "Secret other workspace",
        "Needle appears here.",
        true,
    );

    let results = store
        .search_knowledge_documents("workspace-1", "needle", 5)
        .expect("search documents");

    assert!(results.is_empty());
}

#[test]
fn search_result_caps_are_enforced() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    for index in 0..8 {
        create_document(
            &store,
            "workspace-1",
            &format!("doc-{index}"),
            &format!("Deploy {index}"),
            "deploy keyword",
            true,
        );
    }

    let results = store
        .search_knowledge_documents("workspace-1", "deploy", 3)
        .expect("search documents");

    assert_eq!(results.len(), 3);
}

#[test]
fn delete_workspace_deletes_documents_and_chunks() {
    let store = initialized_store();
    create_workspace(&store, "workspace-delete");
    create_workspace(&store, "workspace-keep");
    create_document(
        &store,
        "workspace-delete",
        "doc-delete",
        "Delete",
        "Delete content.",
        true,
    );
    create_document(
        &store,
        "workspace-keep",
        "doc-keep",
        "Keep",
        "Keep content.",
        true,
    );

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_knowledge_document_by_id("doc-delete")
        .expect("get deleted document")
        .is_none());
    assert!(store
        .get_knowledge_document_by_id("doc-keep")
        .expect("get kept document")
        .is_some());
}
