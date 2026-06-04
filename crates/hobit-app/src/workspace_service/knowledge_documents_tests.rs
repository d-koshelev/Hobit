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
        quick_summary: None,
        lifecycle_status: None,
        title: "Deploy guide".to_owned(),
        source_label: "Manual paste".to_owned(),
        source_kind: None,
        source_ref: None,
        content: "Blue green deployment requires validation.".to_owned(),
        tags: "deploy, release".to_owned(),
        enabled: true,
    }
}

#[test]
fn create_list_get_update_delete_and_search_knowledge_document() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge workspace");

    let document = service
        .create_knowledge_document(create_document_input(workspace.id.clone()))
        .expect("create document");

    assert_eq!(document.workspace_id, workspace.id);
    assert_eq!(document.scope, "workspace");
    assert_eq!(document.catalog_item_type, "documentation_knowledge");
    assert_eq!(document.quick_summary, "");
    assert_eq!(document.lifecycle_status, "active");
    assert_eq!(document.title, "Deploy guide");
    assert_eq!(document.source_label, "Manual paste");
    assert_eq!(document.source_kind, "operator_authored");
    assert_eq!(document.source_ref, "");
    assert_eq!(document.tags, "deploy, release");
    assert!(document.enabled);
    assert!(!document.created_at.is_empty());
    assert_eq!(document.created_at, document.updated_at);

    let listed = service
        .list_knowledge_documents(&workspace.id)
        .expect("list documents");
    assert_eq!(listed, vec![document.clone()]);

    let fetched = service
        .get_knowledge_document(&workspace.id, &document.knowledge_document_id)
        .expect("get document")
        .expect("document");
    assert_eq!(fetched, document);

    let results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: workspace.id.clone(),
            query: "blue deployment".to_owned(),
            limit: Some(5),
        })
        .expect("search documents");
    assert_eq!(results.len(), 1);
    assert_eq!(
        results[0].knowledge_document_id,
        document.knowledge_document_id
    );
    assert!(results[0].snippet.contains("Blue green deployment"));

    std::thread::sleep(std::time::Duration::from_millis(1));
    let updated = service
        .update_knowledge_document(UpdateKnowledgeDocumentInput {
            workspace_id: workspace.id.clone(),
            knowledge_document_id: document.knowledge_document_id.clone(),
            scope: None,
            catalog_item_type: Some("validation_rule".to_owned()),
            quick_summary: Some(
                "Rollback requires database snapshots.\nOperator must verify.\nExtra line.\nIgnored line."
                    .to_owned(),
            ),
            lifecycle_status: Some("stale".to_owned()),
            title: "Rollback guide".to_owned(),
            source_label: "".to_owned(),
            source_kind: Some("file".to_owned()),
            source_ref: Some(" docs/rollback.md ".to_owned()),
            content: "Rollback needs database snapshots.".to_owned(),
            tags: "rollback,  release, ".to_owned(),
            enabled: false,
        })
        .expect("update document")
        .expect("updated document");

    assert_eq!(updated.title, "Rollback guide");
    assert_eq!(updated.catalog_item_type, "validation_rule");
    assert_eq!(
        updated.quick_summary,
        "Rollback requires database snapshots.\nOperator must verify.\nExtra line."
    );
    assert_eq!(updated.lifecycle_status, "stale");
    assert_eq!(updated.source_label, "Workspace document");
    assert_eq!(updated.source_kind, "file");
    assert_eq!(updated.source_ref, "docs/rollback.md");
    assert_eq!(updated.tags, "rollback, release");
    assert!(!updated.enabled);
    assert_ne!(updated.updated_at, document.updated_at);

    let disabled_results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: workspace.id.clone(),
            query: "rollback snapshots".to_owned(),
            limit: Some(5),
        })
        .expect("search disabled document");
    assert!(disabled_results.is_empty());

    assert!(service
        .delete_knowledge_document(DeleteKnowledgeDocumentInput {
            workspace_id: workspace.id.clone(),
            knowledge_document_id: document.knowledge_document_id.clone(),
        })
        .expect("delete document"));
    assert!(service
        .get_knowledge_document(&workspace.id, &document.knowledge_document_id)
        .expect("get deleted document")
        .is_none());
}

#[test]
fn knowledge_document_search_is_workspace_scoped_and_capped() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");

    for index in 0..8 {
        let mut input = create_document_input(first.id.clone());
        input.title = format!("Deploy guide {index}");
        service
            .create_knowledge_document(input)
            .expect("create first workspace document");
    }

    let mut other_input = create_document_input(second.id);
    other_input.title = "Other deploy secret".to_owned();
    other_input.content = "deploy needle from another workspace".to_owned();
    let other = service
        .create_knowledge_document(other_input)
        .expect("create other workspace document");

    let results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: first.id,
            query: "deploy".to_owned(),
            limit: Some(3),
        })
        .expect("search documents");

    assert_eq!(results.len(), 3);
    assert!(results
        .iter()
        .all(|result| result.knowledge_document_id != other.knowledge_document_id));
}

#[test]
fn global_knowledge_documents_are_visible_and_searchable_across_workspaces() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");

    let mut first_input = create_document_input(first.id.clone());
    first_input.title = "Workspace Falcon deployment notes".to_owned();
    first_input.content = "Falcon workspace-only deployment needle.".to_owned();
    let workspace_document = service
        .create_knowledge_document(first_input)
        .expect("create workspace document");

    let mut global_input = create_document_input(first.id.clone());
    global_input.scope = Some("global".to_owned());
    global_input.title = "Global Vertica EON troubleshooting".to_owned();
    global_input.source_label = "Global paste".to_owned();
    global_input.content = "Vertica EON global troubleshooting needle.".to_owned();
    let global_document = service
        .create_knowledge_document(global_input)
        .expect("create global document");

    assert_eq!(global_document.scope, "global");

    let second_list = service
        .list_knowledge_documents(&second.id)
        .expect("list second workspace documents");
    assert!(second_list
        .iter()
        .any(|document| document.knowledge_document_id == global_document.knowledge_document_id));
    assert!(
        !second_list
            .iter()
            .any(|document| document.knowledge_document_id
                == workspace_document.knowledge_document_id)
    );

    let second_results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: second.id,
            query: "needle".to_owned(),
            limit: Some(10),
        })
        .expect("search second workspace");

    assert!(second_results
        .iter()
        .any(
            |result| result.knowledge_document_id == global_document.knowledge_document_id
                && result.scope == "global"
        ));
    assert!(!second_results
        .iter()
        .any(|result| result.knowledge_document_id == workspace_document.knowledge_document_id));
}

#[test]
fn non_active_knowledge_documents_are_not_searchable() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge workspace");
    let unique_needle = "stale_lifecycle_needle";
    let mut input = create_document_input(workspace.id.clone());
    input.lifecycle_status = Some("stale".to_owned());
    input.content = format!("{unique_needle} should not be used.");
    let document = service
        .create_knowledge_document(input)
        .expect("create stale document");

    assert_eq!(document.lifecycle_status, "stale");

    let results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: workspace.id,
            query: unique_needle.to_owned(),
            limit: Some(5),
        })
        .expect("search documents");

    assert!(results.is_empty());
}

#[test]
fn knowledge_document_search_result_shape_and_snippet_cap_are_preserved() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge workspace");
    let mut input = create_document_input(workspace.id.clone());
    input.title = "Long guide".to_owned();
    input.source_label = "Operator paste".to_owned();
    input.tags = "guide".to_owned();
    input.content = format!("needle {}", "longword ".repeat(250));
    let document = service
        .create_knowledge_document(input)
        .expect("create document");

    let results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: workspace.id,
            query: "needle".to_owned(),
            limit: Some(5),
        })
        .expect("search documents");

    assert_eq!(results.len(), 1);
    assert_eq!(
        results[0].knowledge_document_id,
        document.knowledge_document_id
    );
    assert_eq!(results[0].document_title, "Long guide");
    assert_eq!(results[0].source_label, "Operator paste");
    assert_eq!(results[0].tags, "guide");
    assert!(results[0].chunk_id.ends_with("_chunk_0000"));
    assert_eq!(results[0].chunk_index, 0);
    assert_eq!(results[0].snippet.chars().count(), 900);
    assert!(results[0].snippet.ends_with("..."));
    assert!(results[0].score > 0);
}

#[test]
fn knowledge_document_methods_reject_unknown_and_cross_workspace_access() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let document = service
        .create_knowledge_document(create_document_input(first.id.clone()))
        .expect("create document");

    let create_error = service
        .create_knowledge_document(create_document_input("missing-workspace".to_owned()))
        .expect_err("unknown workspace rejected");
    assert!(create_error
        .to_string()
        .contains("workspace not found: missing-workspace"));

    let get_error = service
        .get_knowledge_document(&second.id, &document.knowledge_document_id)
        .expect_err("cross-workspace get rejected");
    assert!(get_error
        .to_string()
        .contains("knowledge document does not belong"));

    let update_error = service
        .update_knowledge_document(UpdateKnowledgeDocumentInput {
            workspace_id: second.id.clone(),
            knowledge_document_id: document.knowledge_document_id.clone(),
            scope: None,
            catalog_item_type: None,
            quick_summary: None,
            lifecycle_status: None,
            title: "Other".to_owned(),
            source_label: "Other".to_owned(),
            source_kind: None,
            source_ref: None,
            content: "Other".to_owned(),
            tags: "other".to_owned(),
            enabled: true,
        })
        .expect_err("cross-workspace update rejected");
    assert!(update_error
        .to_string()
        .contains("knowledge document does not belong"));

    let delete_error = service
        .delete_knowledge_document(DeleteKnowledgeDocumentInput {
            workspace_id: second.id,
            knowledge_document_id: document.knowledge_document_id,
        })
        .expect_err("cross-workspace delete rejected");
    assert!(delete_error
        .to_string()
        .contains("knowledge document does not belong"));
}

#[test]
fn empty_knowledge_search_query_returns_no_results() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Knowledge workspace");
    service
        .create_knowledge_document(create_document_input(workspace.id.clone()))
        .expect("create document");

    let results = service
        .search_knowledge_documents(SearchKnowledgeDocumentsInput {
            workspace_id: workspace.id,
            query: "   ".to_owned(),
            limit: Some(5),
        })
        .expect("search blank query");

    assert!(results.is_empty());
}
