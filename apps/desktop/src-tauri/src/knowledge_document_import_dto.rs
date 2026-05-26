use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ReadKnowledgeDocumentImportFileRequest {
    pub path: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct KnowledgeDocumentImportFileDto {
    pub file_name: String,
    pub title: String,
    pub content: String,
}
