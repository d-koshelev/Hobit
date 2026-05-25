use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::knowledge_documents_dto::{
    CreateKnowledgeDocumentRequest, DeleteKnowledgeDocumentRequest, GetKnowledgeDocumentRequest,
    KnowledgeDocumentDto, KnowledgeDocumentSearchResultDto, ListKnowledgeDocumentsRequest,
    SearchKnowledgeDocumentsRequest, UpdateKnowledgeDocumentRequest,
};

#[tauri::command]
pub(crate) fn create_knowledge_document(
    request: CreateKnowledgeDocumentRequest,
    state: State<'_, AppState>,
) -> Result<KnowledgeDocumentDto, String> {
    create_knowledge_document_blocking(request, state.db_path().to_path_buf())
}

fn create_knowledge_document_blocking(
    request: CreateKnowledgeDocumentRequest,
    db_path: PathBuf,
) -> Result<KnowledgeDocumentDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_knowledge_document(request.into())
        .map(KnowledgeDocumentDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_knowledge_documents(
    request: ListKnowledgeDocumentsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<KnowledgeDocumentDto>, String> {
    list_knowledge_documents_blocking(request, state.db_path().to_path_buf())
}

fn list_knowledge_documents_blocking(
    request: ListKnowledgeDocumentsRequest,
    db_path: PathBuf,
) -> Result<Vec<KnowledgeDocumentDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_knowledge_documents(&request.workspace_id)
        .map(|documents| {
            documents
                .into_iter()
                .map(KnowledgeDocumentDto::from)
                .collect()
        })
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_knowledge_document(
    request: GetKnowledgeDocumentRequest,
    state: State<'_, AppState>,
) -> Result<Option<KnowledgeDocumentDto>, String> {
    get_knowledge_document_blocking(request, state.db_path().to_path_buf())
}

fn get_knowledge_document_blocking(
    request: GetKnowledgeDocumentRequest,
    db_path: PathBuf,
) -> Result<Option<KnowledgeDocumentDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_knowledge_document(&request.workspace_id, &request.knowledge_document_id)
        .map(|document| document.map(KnowledgeDocumentDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_knowledge_document(
    request: UpdateKnowledgeDocumentRequest,
    state: State<'_, AppState>,
) -> Result<Option<KnowledgeDocumentDto>, String> {
    update_knowledge_document_blocking(request, state.db_path().to_path_buf())
}

fn update_knowledge_document_blocking(
    request: UpdateKnowledgeDocumentRequest,
    db_path: PathBuf,
) -> Result<Option<KnowledgeDocumentDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_knowledge_document(request.into())
        .map(|document| document.map(KnowledgeDocumentDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn delete_knowledge_document(
    request: DeleteKnowledgeDocumentRequest,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    delete_knowledge_document_blocking(request, state.db_path().to_path_buf())
}

fn delete_knowledge_document_blocking(
    request: DeleteKnowledgeDocumentRequest,
    db_path: PathBuf,
) -> Result<bool, String> {
    let service = workspace_service(&db_path)?;
    service
        .delete_knowledge_document(request.into())
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn search_knowledge_documents(
    request: SearchKnowledgeDocumentsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<KnowledgeDocumentSearchResultDto>, String> {
    search_knowledge_documents_blocking(request, state.db_path().to_path_buf())
}

fn search_knowledge_documents_blocking(
    request: SearchKnowledgeDocumentsRequest,
    db_path: PathBuf,
) -> Result<Vec<KnowledgeDocumentSearchResultDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .search_knowledge_documents(request.into())
        .map(|results| {
            results
                .into_iter()
                .map(KnowledgeDocumentSearchResultDto::from)
                .collect()
        })
        .map_err(command_error)
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests;
