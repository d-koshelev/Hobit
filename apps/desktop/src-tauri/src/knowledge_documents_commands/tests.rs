use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn knowledge_document_command_helpers_create_list_get_update_delete_and_search() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);

    let created = create_knowledge_document_blocking(
        CreateKnowledgeDocumentRequest {
            workspace_id: workspace_id.clone(),
            title: "Deploy guide".to_owned(),
            source_label: "Manual paste".to_owned(),
            content: "Blue green deploys need validation.".to_owned(),
            tags: "deploy".to_owned(),
            enabled: true,
        },
        db_path.clone(),
    )
    .expect("create document");

    assert_eq!(created.workspace_id, workspace_id);
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
            title: "Rollback guide".to_owned(),
            source_label: "README.md".to_owned(),
            content: "Rollback needs snapshots.".to_owned(),
            tags: "rollback".to_owned(),
            enabled: false,
        },
        db_path.clone(),
    )
    .expect("update document")
    .expect("updated document");

    assert_eq!(updated.title, "Rollback guide");
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
            title: "Doc".to_owned(),
            source_label: "".to_owned(),
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
