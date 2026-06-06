use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::knowledge_draft_review_dto::{
    KnowledgeDraftReviewDto, ListKnowledgeDraftReviewsRequest, RecordKnowledgeDraftReviewRequest,
};

#[tauri::command]
pub(crate) fn record_knowledge_draft_review(
    request: RecordKnowledgeDraftReviewRequest,
    state: State<'_, AppState>,
) -> Result<KnowledgeDraftReviewDto, String> {
    record_knowledge_draft_review_blocking(request, state.db_path().to_path_buf())
}

fn record_knowledge_draft_review_blocking(
    request: RecordKnowledgeDraftReviewRequest,
    db_path: PathBuf,
) -> Result<KnowledgeDraftReviewDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .record_knowledge_draft_review(request.into())
        .map(KnowledgeDraftReviewDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_knowledge_draft_reviews(
    request: ListKnowledgeDraftReviewsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<KnowledgeDraftReviewDto>, String> {
    list_knowledge_draft_reviews_blocking(request, state.db_path().to_path_buf())
}

fn list_knowledge_draft_reviews_blocking(
    request: ListKnowledgeDraftReviewsRequest,
    db_path: PathBuf,
) -> Result<Vec<KnowledgeDraftReviewDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_knowledge_draft_reviews(request.into())
        .map(|records| {
            records
                .into_iter()
                .map(KnowledgeDraftReviewDto::from)
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
