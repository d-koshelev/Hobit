use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ReadPromptPackSourceRequest {
    pub path: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct PromptPackImportFileDto {
    pub relative_path: String,
    pub file_name: String,
    pub byte_size: u64,
    pub text: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct PromptPackImportSourceDto {
    pub source_path: String,
    pub source_kind: String,
    pub files: Vec<PromptPackImportFileDto>,
}
