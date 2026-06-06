use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn knowledge_document_command_helpers_create_list_get_update_delete_and_search() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);

    let created = create_knowledge_document_blocking(
        CreateKnowledgeDocumentRequest {
            workspace_id: workspace_id.clone(),
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Deploy guide".to_owned(),
            source_label: "Manual paste".to_owned(),
            source_kind: None,
            source_ref: None,
            source_refs: None,
            content: "Blue green deploys need validation.".to_owned(),
            tags: "deploy".to_owned(),
            enabled: true,
        },
        db_path.clone(),
    )
    .expect("create document");

    assert_eq!(created.workspace_id, workspace_id);
    assert_eq!(created.scope, "workspace");
    assert_eq!(created.title, "Deploy guide");
    assert!(created.enabled);

    let listed = list_knowledge_documents_blocking(
        ListKnowledgeDocumentsRequest {
            workspace_id: workspace_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list documents");
    assert_eq!(listed.len(), 1);
    assert_eq!(
        listed[0].knowledge_document_id,
        created.knowledge_document_id
    );

    let fetched = get_knowledge_document_blocking(
        GetKnowledgeDocumentRequest {
            workspace_id: workspace_id.clone(),
            knowledge_document_id: created.knowledge_document_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get document")
    .expect("document");
    assert_eq!(fetched, created);

    let results = search_knowledge_documents_blocking(
        SearchKnowledgeDocumentsRequest {
            workspace_id: workspace_id.clone(),
            query: "blue validation".to_owned(),
            limit: Some(5),
        },
        db_path.clone(),
    )
    .expect("search documents");
    assert_eq!(results.len(), 1);
    assert_eq!(
        results[0].knowledge_document_id,
        created.knowledge_document_id
    );

    let updated = update_knowledge_document_blocking(
        UpdateKnowledgeDocumentRequest {
            workspace_id: workspace_id.clone(),
            knowledge_document_id: created.knowledge_document_id.clone(),
            scope: None,
            catalog_item_type: Some("known_issue".to_owned()),
            quick_summary: Some("Rollback needs snapshots.".to_owned()),
            lifecycle_status: Some("stale".to_owned()),
            title: "Rollback guide".to_owned(),
            source_label: "README.md".to_owned(),
            source_kind: Some("file".to_owned()),
            source_ref: Some("README.md".to_owned()),
            source_refs: None,
            content: "Rollback needs snapshots.".to_owned(),
            tags: "rollback".to_owned(),
            enabled: false,
        },
        db_path.clone(),
    )
    .expect("update document")
    .expect("updated document");

    assert_eq!(updated.title, "Rollback guide");
    assert_eq!(updated.catalog_item_type, "known_issue");
    assert_eq!(updated.quick_summary, "Rollback needs snapshots.");
    assert_eq!(updated.lifecycle_status, "stale");
    assert_eq!(updated.source_kind, "file");
    assert_eq!(updated.source_ref, "README.md");
    assert!(!updated.enabled);

    let disabled_results = search_knowledge_documents_blocking(
        SearchKnowledgeDocumentsRequest {
            workspace_id: workspace_id.clone(),
            query: "rollback snapshots".to_owned(),
            limit: Some(5),
        },
        db_path.clone(),
    )
    .expect("search disabled document");
    assert!(disabled_results.is_empty());

    assert!(delete_knowledge_document_blocking(
        DeleteKnowledgeDocumentRequest {
            workspace_id,
            knowledge_document_id: created.knowledge_document_id,
        },
        db_path.clone(),
    )
    .expect("delete document"));
    remove_test_db_files(&db_path);
}

#[test]
fn create_knowledge_document_command_helper_rejects_unknown_workspace() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let error = create_knowledge_document_blocking(
        CreateKnowledgeDocumentRequest {
            workspace_id: "missing-workspace".to_owned(),
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Doc".to_owned(),
            source_label: "".to_owned(),
            source_kind: None,
            source_ref: None,
            source_refs: None,
            content: "".to_owned(),
            tags: "".to_owned(),
            enabled: true,
        },
        db_path.clone(),
    )
    .expect_err("unknown workspace rejected");

    assert!(error.contains("workspace not found: missing-workspace"));
    remove_test_db_files(&db_path);
}

#[test]
fn knowledge_document_command_helpers_include_global_scope_in_list_and_search() {
    let db_path = unique_test_db_path();
    let first_workspace_id = create_workspace_in_test_db(&db_path);
    let second_workspace_id = create_workspace_in_test_db(&db_path);

    let global = create_knowledge_document_blocking(
        CreateKnowledgeDocumentRequest {
            workspace_id: first_workspace_id,
            scope: Some("global".to_owned()),
            catalog_item_type: Some("documentation_knowledge".to_owned()),
            quick_summary: Some("Global EON troubleshooting.".to_owned()),
            lifecycle_status: Some("active".to_owned()),
            title: "Global Vertica EON troubleshooting".to_owned(),
            source_label: "Global paste".to_owned(),
            source_kind: Some("operator_authored".to_owned()),
            source_ref: None,
            source_refs: None,
            content: "Global EON troubleshooting needle.".to_owned(),
            tags: "global".to_owned(),
            enabled: true,
        },
        db_path.clone(),
    )
    .expect("create global document");

    assert_eq!(global.scope, "global");

    let listed = list_knowledge_documents_blocking(
        ListKnowledgeDocumentsRequest {
            workspace_id: second_workspace_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list second workspace documents");
    assert!(listed.iter().any(|document| document.knowledge_document_id
        == global.knowledge_document_id
        && document.scope == "global"));

    let results = search_knowledge_documents_blocking(
        SearchKnowledgeDocumentsRequest {
            workspace_id: second_workspace_id,
            query: "needle".to_owned(),
            limit: Some(5),
        },
        db_path.clone(),
    )
    .expect("search second workspace");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].scope, "global");

    remove_test_db_files(&db_path);
}

fn create_workspace_in_test_db(db_path: &Path) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Knowledge command test", None)
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
        "hobit-knowledge-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
