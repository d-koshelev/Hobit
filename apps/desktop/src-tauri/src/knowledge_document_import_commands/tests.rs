use super::*;

use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

#[test]
fn read_import_file_accepts_markdown_and_derives_safe_metadata() {
    let path = unique_temp_path("README.md");
    fs::write(&path, "# API\n\nUse the documented API.").expect("write markdown file");

    let imported =
        read_knowledge_document_import_file_blocking(ReadKnowledgeDocumentImportFileRequest {
            path: path.to_string_lossy().to_string(),
        })
        .expect("read import file");

    assert_eq!(imported.file_name, "README.md");
    assert_eq!(imported.title, "README");
    assert_eq!(imported.content, "# API\n\nUse the documented API.");

    remove_temp_file(path);
}

#[cfg(unix)]
#[test]
fn read_import_file_accepts_unix_absolute_markdown_path() {
    let path = unique_temp_path("LINUX.markdown");
    fs::write(&path, "Portable text").expect("write markdown file");
    let path_text = path.to_string_lossy().to_string();
    assert!(path_text.starts_with('/'));

    let imported =
        read_knowledge_document_import_file_blocking(ReadKnowledgeDocumentImportFileRequest {
            path: path_text,
        })
        .expect("read import file");

    assert_eq!(imported.file_name, "LINUX.markdown");
    assert_eq!(imported.title, "LINUX");
    assert_eq!(imported.content, "Portable text");

    remove_temp_file(path);
}

#[test]
fn read_import_file_rejects_unsupported_extension() {
    let path = unique_temp_path("guide.pdf");
    fs::write(&path, "not a real pdf").expect("write unsupported file");

    let error =
        read_knowledge_document_import_file_blocking(ReadKnowledgeDocumentImportFileRequest {
            path: path.to_string_lossy().to_string(),
        })
        .expect_err("unsupported extension rejected");

    assert!(error.contains(".txt, .md, and .markdown"));
    remove_temp_file(path);
}

#[test]
fn read_import_file_rejects_large_file() {
    let path = unique_temp_path("large.txt");
    fs::write(&path, vec![b'a'; (MAX_IMPORT_FILE_BYTES as usize) + 1]).expect("write large file");

    let error =
        read_knowledge_document_import_file_blocking(ReadKnowledgeDocumentImportFileRequest {
            path: path.to_string_lossy().to_string(),
        })
        .expect_err("large file rejected");

    assert!(error.contains("up to 1 MB"));
    remove_temp_file(path);
}

#[test]
fn read_import_file_rejects_non_utf8_content() {
    let path = unique_temp_path("binary.md");
    fs::write(&path, [0xff, 0xfe, 0xfd]).expect("write non-utf8 file");

    let error =
        read_knowledge_document_import_file_blocking(ReadKnowledgeDocumentImportFileRequest {
            path: path.to_string_lossy().to_string(),
        })
        .expect_err("non-utf8 file rejected");

    assert!(error.contains("valid UTF-8"));
    remove_temp_file(path);
}

fn unique_temp_path(file_name: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    let dir = std::env::temp_dir().join(format!(
        "hobit-knowledge-import-test-{}-{nanos}",
        std::process::id()
    ));
    fs::create_dir_all(&dir).expect("create temp test directory");
    dir.join(file_name)
}

fn remove_temp_file(path: std::path::PathBuf) {
    let parent = path.parent().map(std::path::Path::to_path_buf);
    let _ = fs::remove_file(&path);
    if let Some(parent) = parent {
        let _ = fs::remove_dir_all(parent);
    }
}
