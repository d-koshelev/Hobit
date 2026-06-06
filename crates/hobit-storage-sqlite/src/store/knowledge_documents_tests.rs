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
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title,
            source_label: "Manual paste",
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content,
            tags: "deploy, runbook",
            enabled,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create knowledge document")
}

fn create_document_with_metadata(
    store: &SqliteStore,
    workspace_id: &str,
    document_id: &str,
    title: &str,
    source_label: &str,
    content: &str,
    tags: &str,
    enabled: bool,
) -> KnowledgeDocumentRow {
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: document_id,
            workspace_id,
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title,
            source_label,
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content,
            tags,
            enabled,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
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
    assert_eq!(document.scope, "workspace");
    assert_eq!(document.catalog_item_type, "documentation_knowledge");
    assert_eq!(document.quick_summary, "");
    assert_eq!(document.lifecycle_status, "active");
    assert_eq!(document.title, "Deploy Guide");
    assert_eq!(document.source_label, "Manual paste");
    assert_eq!(document.source_kind, "operator_authored");
    assert_eq!(document.source_ref, "");
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
                scope: None,
                catalog_item_type: Some("known_issue"),
                quick_summary: Some("Rollback changed."),
                lifecycle_status: Some("stale"),
                title: "Updated",
                source_label: "README.md",
                source_kind: Some("file"),
                source_ref: Some("README.md"),
                source_refs: None,
                relations: None,
                content: "Updated rollback procedure.",
                tags: "rollback",
                enabled: false,
                searchable: true,
                version_summary: Some("Marked rollback stale."),
                updated_at: Some("2"),
                reviewed_at: None,
                created_by_task_id: None,
                created_from_run_id: None,
            },
        )
        .expect("update document")
        .expect("updated document");

    assert_eq!(updated.title, "Updated");
    assert_eq!(updated.catalog_item_type, "known_issue");
    assert_eq!(updated.quick_summary, "Rollback changed.");
    assert_eq!(updated.lifecycle_status, "stale");
    assert_eq!(updated.source_label, "README.md");
    assert_eq!(updated.source_kind, "file");
    assert_eq!(updated.source_ref, "README.md");
    assert_eq!(updated.content, "Updated rollback procedure.");
    assert_eq!(updated.tags, "rollback");
    assert!(!updated.enabled);
    assert!(updated.searchable);
    assert_eq!(updated.version, 2);
    assert_eq!(updated.version_summary, "Marked rollback stale.");
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
                scope: None,
                catalog_item_type: None,
                quick_summary: None,
                lifecycle_status: None,
                title: "Chunked",
                source_label: "Manual paste",
                source_kind: None,
                source_ref: None,
                source_refs: None,
                relations: None,
                content: "Replacement content about rollback.",
                tags: "rollback",
                enabled: true,
                searchable: true,
                version_summary: None,
                updated_at: Some("2"),
                reviewed_at: None,
                created_by_task_id: None,
                created_from_run_id: None,
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
fn chunking_is_deterministic_for_equivalent_line_endings() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    create_document(
        &store,
        "workspace-1",
        "doc-lf",
        "LF",
        "Heading\n\nFirst paragraph.\n\nSecond paragraph.",
        true,
    );
    create_document(
        &store,
        "workspace-1",
        "doc-crlf",
        "CRLF",
        "Heading\r\n\r\nFirst paragraph.\r\n\r\nSecond paragraph.",
        true,
    );

    let lf_chunks = store
        .list_knowledge_document_chunks("workspace-1", "doc-lf")
        .expect("list lf chunks")
        .into_iter()
        .map(|chunk| chunk.text)
        .collect::<Vec<_>>();
    let crlf_chunks = store
        .list_knowledge_document_chunks("workspace-1", "doc-crlf")
        .expect("list crlf chunks")
        .into_iter()
        .map(|chunk| chunk.text)
        .collect::<Vec<_>>();

    assert_eq!(lf_chunks, crlf_chunks);
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
fn create_global_document_and_list_with_workspace_documents() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let workspace_document = create_document(
        &store,
        "workspace-1",
        "doc-workspace",
        "Workspace deploy guide",
        "Workspace-specific deployment notes.",
        true,
    );
    let global_document = store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-global",
            workspace_id: "workspace-1",
            scope: Some("global"),
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Global Vertica EON troubleshooting",
            source_label: "Global paste",
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "Global EON troubleshooting content.",
            tags: "global, eon",
            enabled: true,
            searchable: true,
            version_summary: None,
            created_at: Some("2"),
            updated_at: Some("2"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create global document");

    assert_eq!(global_document.workspace_id, "");
    assert_eq!(global_document.scope, "global");

    let listed = store
        .list_knowledge_documents_for_workspace("workspace-1")
        .expect("list all visible documents");
    assert_eq!(listed.len(), 2);
    assert!(listed.contains(&workspace_document));
    assert!(listed.contains(&global_document));
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
    create_document_with_metadata(
        &store,
        "workspace-1",
        "doc-source",
        "Source only",
        "Operator manual",
        "General content.",
        "",
        true,
    );

    let results = store
        .search_knowledge_documents("workspace-1", "incident failover deploy operator", 5)
        .expect("search documents");

    assert_eq!(results.len(), 3);
    assert!(results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-title"));
    assert!(results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-content"));
    assert!(results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-source"));
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
fn search_includes_global_documents_for_each_workspace_without_cross_workspace_leaks() {
    let store = initialized_store();
    create_workspace(&store, "workspace-a");
    create_workspace(&store, "workspace-b");
    create_document(
        &store,
        "workspace-a",
        "doc-a",
        "Falcon deployment notes",
        "Falcon workspace A needle.",
        true,
    );
    create_document(
        &store,
        "workspace-b",
        "doc-b",
        "Bison deployment notes",
        "Bison workspace B needle.",
        true,
    );
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-global",
            workspace_id: "workspace-a",
            scope: Some("global"),
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Global Vertica EON troubleshooting",
            source_label: "Global paste",
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "Global EON needle.",
            tags: "global",
            enabled: true,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create global document");

    let workspace_a_results = store
        .search_knowledge_documents("workspace-a", "needle", 10)
        .expect("search workspace a");
    let workspace_b_results = store
        .search_knowledge_documents("workspace-b", "needle", 10)
        .expect("search workspace b");

    assert!(workspace_a_results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-a" && result.scope == "workspace"));
    assert!(workspace_a_results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-global" && result.scope == "global"));
    assert!(!workspace_a_results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-b"));
    assert!(workspace_b_results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-b" && result.scope == "workspace"));
    assert!(workspace_b_results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-global" && result.scope == "global"));
    assert!(!workspace_b_results
        .iter()
        .any(|result| result.knowledge_document_id == "doc-a"));
}

#[test]
fn disabled_and_deleted_global_documents_are_not_searched() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-global-disabled",
            workspace_id: "workspace-1",
            scope: Some("global"),
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Disabled global",
            source_label: "Global paste",
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "disabledglobal needle.",
            tags: "",
            enabled: false,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create disabled global document");
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-global-delete",
            workspace_id: "workspace-1",
            scope: Some("global"),
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Deleted global",
            source_label: "Global paste",
            source_kind: None,
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "deletedglobal needle.",
            tags: "",
            enabled: true,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create deleted global document");

    assert!(store
        .delete_knowledge_document("workspace-1", "doc-global-delete")
        .expect("delete global document"));

    let results = store
        .search_knowledge_documents("workspace-1", "disabledglobal deletedglobal", 10)
        .expect("search global documents");

    assert!(results.is_empty());
    assert!(store
        .list_knowledge_document_chunks("workspace-1", "doc-global-delete")
        .expect("list deleted global chunks")
        .is_empty());
}

#[test]
fn deleted_documents_and_chunks_are_not_searched() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_document(
        &store,
        "workspace-1",
        "doc-delete",
        "Delete",
        "Needle appears here.",
        true,
    );

    store
        .delete_knowledge_document("workspace-1", "doc-delete")
        .expect("delete document");

    let results = store
        .search_knowledge_documents("workspace-1", "needle", 5)
        .expect("search documents");

    assert!(results.is_empty());
    assert!(store
        .list_knowledge_document_chunks("workspace-1", "doc-delete")
        .expect("list deleted chunks")
        .is_empty());
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
fn search_result_ordering_is_stable_by_score_title_and_chunk() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    for (document_id, title) in [
        ("doc-beta", "Beta deploy"),
        ("doc-alpha", "Alpha deploy"),
        ("doc-gamma", "Gamma deploy"),
    ] {
        create_document(
            &store,
            "workspace-1",
            document_id,
            title,
            "deploy keyword",
            true,
        );
    }

    let results = store
        .search_knowledge_documents("workspace-1", "deploy", 10)
        .expect("search documents");

    assert_eq!(
        results
            .iter()
            .map(|result| result.knowledge_document_id.as_str())
            .collect::<Vec<_>>(),
        vec!["doc-alpha", "doc-beta", "doc-gamma"]
    );
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
