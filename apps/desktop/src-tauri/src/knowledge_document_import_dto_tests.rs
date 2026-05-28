use serde_json::json;

use crate::knowledge_document_import_dto::{
    KnowledgeDocumentImportFileDto, ReadKnowledgeDocumentImportFileRequest,
};

#[test]
fn deserializes_import_file_request_without_broad_filesystem_dto() {
    let request: ReadKnowledgeDocumentImportFileRequest = serde_json::from_value(json!({
        "path": "C:/docs/runbook.md"
    }))
    .expect("deserialize import request");

    assert_eq!(request.path, "C:/docs/runbook.md");
}

#[test]
fn serializes_import_file_response_shape() {
    let dto = KnowledgeDocumentImportFileDto {
        file_name: "runbook.md".to_owned(),
        title: "runbook".to_owned(),
        content: "# Runbook".to_owned(),
    };

    assert_eq!(
        serde_json::to_value(dto).expect("serialize import dto"),
        json!({
            "file_name": "runbook.md",
            "title": "runbook",
            "content": "# Runbook"
        })
    );
}
