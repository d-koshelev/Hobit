use hobit_app::{KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary};
use serde_json::json;

use crate::knowledge_documents_dto::{
    CreateKnowledgeDocumentRequest, KnowledgeDocumentDto, KnowledgeDocumentSearchResultDto,
    SearchKnowledgeDocumentsRequest, UpdateKnowledgeDocumentRequest,
};

#[test]
fn maps_create_knowledge_document_request_to_app_input_with_scope_and_enabled() {
    let request = CreateKnowledgeDocumentRequest {
        workspace_id: "ws_1".to_owned(),
        scope: Some("global".to_owned()),
        catalog_item_type: Some("known_issue".to_owned()),
        quick_summary: Some("Quick note".to_owned()),
        lifecycle_status: Some("draft".to_owned()),
        title: "Doc".to_owned(),
        source_label: "Paste".to_owned(),
        source_kind: Some("operator_authored".to_owned()),
        source_ref: Some("manual".to_owned()),
        content: "Content".to_owned(),
        tags: "ops".to_owned(),
        enabled: true,
    };

    let input: hobit_app::CreateKnowledgeDocumentInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.scope.as_deref(), Some("global"));
    assert_eq!(input.catalog_item_type.as_deref(), Some("known_issue"));
    assert_eq!(input.quick_summary.as_deref(), Some("Quick note"));
    assert_eq!(input.lifecycle_status.as_deref(), Some("draft"));
    assert_eq!(input.source_label, "Paste");
    assert_eq!(input.source_kind.as_deref(), Some("operator_authored"));
    assert_eq!(input.source_ref.as_deref(), Some("manual"));
    assert!(input.enabled);
}

#[test]
fn maps_update_knowledge_document_request_to_app_input_with_scope_and_enabled() {
    let request = UpdateKnowledgeDocumentRequest {
        workspace_id: "ws_1".to_owned(),
        knowledge_document_id: "kdoc_1".to_owned(),
        scope: Some("workspace".to_owned()),
        catalog_item_type: Some("validation_rule".to_owned()),
        quick_summary: Some("Validate before release".to_owned()),
        lifecycle_status: Some("active".to_owned()),
        title: "Doc".to_owned(),
        source_label: "Paste".to_owned(),
        source_kind: Some("file".to_owned()),
        source_ref: Some("docs/checks.md".to_owned()),
        content: "Content".to_owned(),
        tags: "ops".to_owned(),
        enabled: false,
    };

    let input: hobit_app::UpdateKnowledgeDocumentInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.knowledge_document_id, "kdoc_1");
    assert_eq!(input.scope.as_deref(), Some("workspace"));
    assert_eq!(input.catalog_item_type.as_deref(), Some("validation_rule"));
    assert_eq!(
        input.quick_summary.as_deref(),
        Some("Validate before release")
    );
    assert_eq!(input.lifecycle_status.as_deref(), Some("active"));
    assert_eq!(input.source_kind.as_deref(), Some("file"));
    assert_eq!(input.source_ref.as_deref(), Some("docs/checks.md"));
    assert!(!input.enabled);
}

#[test]
fn deserializes_search_request_with_snake_case_names() {
    let request: SearchKnowledgeDocumentsRequest = serde_json::from_value(json!({
        "workspace_id": "ws_1",
        "query": "deploy",
        "limit": 3
    }))
    .expect("deserialize search request");

    let input: hobit_app::SearchKnowledgeDocumentsInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.query, "deploy");
    assert_eq!(input.limit, Some(3));
}

#[test]
fn serializes_knowledge_document_dto_with_stable_snake_case_fields() {
    let dto = KnowledgeDocumentDto::from(KnowledgeDocumentSummary {
        knowledge_document_id: "kdoc_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        scope: "global".to_owned(),
        catalog_item_type: "external_reference".to_owned(),
        quick_summary: "One-line summary".to_owned(),
        lifecycle_status: "active".to_owned(),
        title: "Doc".to_owned(),
        source_label: "Paste".to_owned(),
        source_kind: "external_url".to_owned(),
        source_ref: "https://example.invalid/doc".to_owned(),
        content: "Content".to_owned(),
        tags: "ops".to_owned(),
        enabled: true,
        created_at: "1".to_owned(),
        updated_at: "2".to_owned(),
    });

    assert_eq!(
        serde_json::to_value(dto).expect("serialize document dto"),
        json!({
            "knowledge_document_id": "kdoc_1",
            "workspace_id": "ws_1",
            "scope": "global",
            "catalog_item_type": "external_reference",
            "quick_summary": "One-line summary",
            "lifecycle_status": "active",
            "title": "Doc",
            "source_label": "Paste",
            "source_kind": "external_url",
            "source_ref": "https://example.invalid/doc",
            "content": "Content",
            "tags": "ops",
            "enabled": true,
            "created_at": "1",
            "updated_at": "2"
        })
    );
}

#[test]
fn serializes_knowledge_search_result_dto_with_scope_source_and_snippet() {
    let dto = KnowledgeDocumentSearchResultDto::from(KnowledgeDocumentSearchResultSummary {
        knowledge_document_id: "kdoc_1".to_owned(),
        document_title: "Doc".to_owned(),
        scope: "workspace".to_owned(),
        source_label: "Paste".to_owned(),
        tags: "ops".to_owned(),
        chunk_id: "kdoc_1_chunk_0000".to_owned(),
        chunk_index: 0,
        snippet: "matching text".to_owned(),
        score: 12,
    });

    assert_eq!(
        serde_json::to_value(dto).expect("serialize search dto"),
        json!({
            "knowledge_document_id": "kdoc_1",
            "document_title": "Doc",
            "scope": "workspace",
            "source_label": "Paste",
            "tags": "ops",
            "chunk_id": "kdoc_1_chunk_0000",
            "chunk_index": 0,
            "snippet": "matching text",
            "score": 12
        })
    );
}
