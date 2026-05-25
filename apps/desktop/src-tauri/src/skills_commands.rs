use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::skills_dto::{
    CreateSkillRequest, DeleteSkillRequest, GetSkillRequest, ListSkillsRequest, SkillDto,
    UpdateSkillRequest,
};

#[tauri::command]
pub(crate) fn create_skill(
    request: CreateSkillRequest,
    state: State<'_, AppState>,
) -> Result<SkillDto, String> {
    create_skill_blocking(request, state.db_path().to_path_buf())
}

fn create_skill_blocking(
    request: CreateSkillRequest,
    db_path: PathBuf,
) -> Result<SkillDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_skill(request.into())
        .map(SkillDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_skills(
    request: ListSkillsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<SkillDto>, String> {
    list_skills_blocking(request, state.db_path().to_path_buf())
}

fn list_skills_blocking(
    request: ListSkillsRequest,
    db_path: PathBuf,
) -> Result<Vec<SkillDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_skills(&request.workspace_id)
        .map(|skills| skills.into_iter().map(SkillDto::from).collect())
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_skill(
    request: GetSkillRequest,
    state: State<'_, AppState>,
) -> Result<Option<SkillDto>, String> {
    get_skill_blocking(request, state.db_path().to_path_buf())
}

fn get_skill_blocking(
    request: GetSkillRequest,
    db_path: PathBuf,
) -> Result<Option<SkillDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_skill(&request.workspace_id, &request.skill_id)
        .map(|skill| skill.map(SkillDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_skill(
    request: UpdateSkillRequest,
    state: State<'_, AppState>,
) -> Result<Option<SkillDto>, String> {
    update_skill_blocking(request, state.db_path().to_path_buf())
}

fn update_skill_blocking(
    request: UpdateSkillRequest,
    db_path: PathBuf,
) -> Result<Option<SkillDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_skill(request.into())
        .map(|skill| skill.map(SkillDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn delete_skill(
    request: DeleteSkillRequest,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    delete_skill_blocking(request, state.db_path().to_path_buf())
}

fn delete_skill_blocking(request: DeleteSkillRequest, db_path: PathBuf) -> Result<bool, String> {
    let service = workspace_service(&db_path)?;
    service.delete_skill(request.into()).map_err(command_error)
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
