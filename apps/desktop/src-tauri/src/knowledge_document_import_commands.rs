use std::{fs, path::Path};

use crate::knowledge_document_import_dto::{
    KnowledgeDocumentImportFileDto, ReadKnowledgeDocumentImportFileRequest,
};

const MAX_IMPORT_FILE_BYTES: u64 = 1024 * 1024;

#[tauri::command]
pub(crate) fn read_knowledge_document_import_file(
    request: ReadKnowledgeDocumentImportFileRequest,
) -> Result<KnowledgeDocumentImportFileDto, String> {
    read_knowledge_document_import_file_blocking(request)
}

fn read_knowledge_document_import_file_blocking(
    request: ReadKnowledgeDocumentImportFileRequest,
) -> Result<KnowledgeDocumentImportFileDto, String> {
    let trimmed_path = request.path.trim();
    if trimmed_path.is_empty() {
        return Err("Path is required before importing a document.".to_owned());
    }

    let path = Path::new(trimmed_path);
    let file_name = path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .ok_or_else(|| "Selected file must have a valid UTF-8 file name.".to_owned())?
        .to_owned();

    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(unsupported_extension_message)?;
    if !matches!(extension.as_str(), "txt" | "md" | "markdown") {
        return Err(unsupported_extension_message());
    }

    let metadata =
        fs::metadata(path).map_err(|_| "Unable to read selected file metadata.".to_owned())?;
    if !metadata.is_file() {
        return Err("Import supports files only.".to_owned());
    }
    if metadata.len() > MAX_IMPORT_FILE_BYTES {
        return Err("Selected file is too large. Import supports files up to 1 MB.".to_owned());
    }

    let bytes = fs::read(path).map_err(|_| "Unable to read selected file.".to_owned())?;
    if bytes.len() as u64 > MAX_IMPORT_FILE_BYTES {
        return Err("Selected file is too large. Import supports files up to 1 MB.".to_owned());
    }
    let content = String::from_utf8(bytes)
        .map_err(|_| "Selected file is not valid UTF-8 text.".to_owned())?;

    let title = path
        .file_stem()
        .and_then(|file_stem| file_stem.to_str())
        .map(str::trim)
        .filter(|file_stem| !file_stem.is_empty())
        .unwrap_or("Imported document")
        .to_owned();

    Ok(KnowledgeDocumentImportFileDto {
        file_name,
        title,
        content,
    })
}

fn unsupported_extension_message() -> String {
    "Unsupported file type. Import supports .txt, .md, and .markdown files.".to_owned()
}

#[cfg(test)]
mod tests;
