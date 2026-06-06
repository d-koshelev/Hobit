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

#[test]
fn create_active_document_with_production_metadata() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    let source_refs =
        r#"[{"kind":"queue_run","label":"Queue run","queue_task_id":"task-1","run_id":"run-1"}]"#;
    let relations = r#"[{"relation_id":"rel-1","relation_type":"supports","target_ref":"task-1","label":"Supports task"}]"#;

    let document = store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-production",
            workspace_id: "workspace-1",
            scope: None,
            catalog_item_type: Some("codebase_knowledge"),
            quick_summary: Some("Active production metadata."),
            lifecycle_status: Some("active"),
            title: "Production metadata",
            source_label: "Queue run",
            source_kind: Some("queue_run"),
            source_ref: Some("run-1"),
            source_refs: Some(source_refs),
            relations: Some(relations),
            content: "Production metadata content.",
            tags: "production",
            enabled: true,
            searchable: true,
            version_summary: Some("Accepted from run."),
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: Some("2"),
            created_by_task_id: Some("task-1"),
            created_from_run_id: Some("run-1"),
        })
        .expect("create production document");

    assert_eq!(document.catalog_item_type, "codebase_knowledge");
    assert_eq!(document.source_refs, source_refs);
    assert_eq!(document.relations, relations);
    assert!(document.searchable);
    assert_eq!(document.version, 1);
    assert_eq!(document.version_summary, "Accepted from run.");
    assert_eq!(document.reviewed_at.as_deref(), Some("2"));
    assert_eq!(document.created_by_task_id.as_deref(), Some("task-1"));
    assert_eq!(document.created_from_run_id.as_deref(), Some("run-1"));
}

#[test]
fn non_searchable_documents_are_not_searched() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-not-searchable",
            workspace_id: "workspace-1",
            scope: None,
            catalog_item_type: Some("documentation_knowledge"),
            quick_summary: Some("Hidden from search."),
            lifecycle_status: Some("active"),
            title: "Not searchable",
            source_label: "Manual paste",
            source_kind: Some("operator_authored"),
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "Contains unique not_searchable_storage keyword.",
            tags: "hidden",
            enabled: true,
            searchable: false,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create non-searchable document");

    let results = store
        .search_knowledge_documents("workspace-1", "not_searchable_storage", 5)
        .expect("search documents");

    assert!(results.is_empty());
}

#[test]
fn non_active_documents_are_not_searched() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    store
        .create_knowledge_document(NewKnowledgeDocument {
            knowledge_document_id: "doc-stale",
            workspace_id: "workspace-1",
            scope: None,
            catalog_item_type: Some("documentation_knowledge"),
            quick_summary: Some("Stale summary"),
            lifecycle_status: Some("stale"),
            title: "Stale guide",
            source_label: "Manual paste",
            source_kind: Some("operator_authored"),
            source_ref: None,
            source_refs: None,
            relations: None,
            content: "Contains unique stale lifecycle keyword.",
            tags: "stale",
            enabled: true,
            searchable: true,
            version_summary: None,
            created_at: Some("1"),
            updated_at: Some("1"),
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create stale document");

    let results = store
        .search_knowledge_documents("workspace-1", "stale lifecycle keyword", 5)
        .expect("search documents");

    assert!(results.is_empty());
}
