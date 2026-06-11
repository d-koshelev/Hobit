use serde_json::json;

use crate::prompt_pack_import_dto::{
    PromptPackImportFileDto, PromptPackImportSourceDto, ReadPromptPackSourceRequest,
};

#[test]
fn deserializes_prompt_pack_source_request_without_runtime_fields() {
    let request: ReadPromptPackSourceRequest = serde_json::from_value(json!({
        "path": "C:/packs/smoke-pack"
    }))
    .expect("deserialize prompt-pack source request");

    assert_eq!(request.path, "C:/packs/smoke-pack");
}

#[test]
fn serializes_prompt_pack_source_response_shape() {
    let source = PromptPackImportSourceDto {
        source_path: "C:/packs/smoke-pack".to_owned(),
        source_kind: "folder".to_owned(),
        files: vec![PromptPackImportFileDto {
            relative_path: "001.md".to_owned(),
            file_name: "001.md".to_owned(),
            byte_size: 12,
            text: "# One".to_owned(),
        }],
    };

    assert_eq!(
        serde_json::to_value(source).expect("serialize prompt-pack source dto"),
        json!({
            "source_path": "C:/packs/smoke-pack",
            "source_kind": "folder",
            "files": [
                {
                    "relative_path": "001.md",
                    "file_name": "001.md",
                    "byte_size": 12,
                    "text": "# One"
                }
            ]
        })
    );
}
