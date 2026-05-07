use std::path::{Path, PathBuf};

use hobit_app::{WorkspaceService, WorkspaceSessionSummary, WorkspaceSummary};
use hobit_storage_sqlite::SqliteStore;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

pub struct AppState {
    db_path: PathBuf,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct WorkspaceSummaryDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub workbench_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct WorkspaceSessionSummaryDto {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub active_widget_id: Option<String>,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = initialize_database(app)?;
            app.manage(AppState { db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_workspace,
            list_workspaces,
            get_workspace_summary,
            open_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hobit desktop shell");
}

#[tauri::command]
fn create_workspace(
    request: CreateWorkspaceRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceSummaryDto, String> {
    let service = workspace_service(&state.db_path)?;
    service
        .create_empty_workspace(request.title, request.description)
        .map(WorkspaceSummaryDto::from)
        .map_err(command_error)
}

#[tauri::command]
fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<WorkspaceSummaryDto>, String> {
    let service = workspace_service(&state.db_path)?;
    service
        .list_workspaces()
        .map(|workspaces| {
            workspaces
                .into_iter()
                .map(WorkspaceSummaryDto::from)
                .collect()
        })
        .map_err(command_error)
}

#[tauri::command]
fn get_workspace_summary(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceSummaryDto>, String> {
    let service = workspace_service(&state.db_path)?;
    service
        .get_workspace_summary(&workspace_id)
        .map(|summary| summary.map(WorkspaceSummaryDto::from))
        .map_err(command_error)
}

#[tauri::command]
fn open_workspace(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceSessionSummaryDto>, String> {
    let service = workspace_service(&state.db_path)?;
    service
        .open_workspace(&workspace_id)
        .map(|summary| summary.map(WorkspaceSessionSummaryDto::from))
        .map_err(command_error)
}

fn initialize_database<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("hobit.sqlite3");
    let store = SqliteStore::open(&db_path)?;
    store.init_schema()?;

    Ok(db_path)
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

impl From<WorkspaceSummary> for WorkspaceSummaryDto {
    fn from(summary: WorkspaceSummary) -> Self {
        Self {
            id: summary.id,
            title: summary.title,
            description: summary.description,
            status: summary.status,
            workbench_id: summary.workbench_id,
        }
    }
}

impl From<WorkspaceSessionSummary> for WorkspaceSessionSummaryDto {
    fn from(summary: WorkspaceSessionSummary) -> Self {
        Self {
            id: summary.id,
            workspace_id: summary.workspace_id,
            status: summary.status,
            active_widget_id: summary.active_widget_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_workspace_summary_to_dto() {
        let summary = WorkspaceSummary {
            id: "ws_1".to_owned(),
            title: "Incident".to_owned(),
            description: Some("Investigate".to_owned()),
            status: "active".to_owned(),
            workbench_id: Some("wb_1".to_owned()),
        };

        let dto = WorkspaceSummaryDto::from(summary);

        assert_eq!(
            dto,
            WorkspaceSummaryDto {
                id: "ws_1".to_owned(),
                title: "Incident".to_owned(),
                description: Some("Investigate".to_owned()),
                status: "active".to_owned(),
                workbench_id: Some("wb_1".to_owned()),
            }
        );
    }

    #[test]
    fn maps_workspace_session_summary_to_dto() {
        let summary = WorkspaceSessionSummary {
            id: "wss_1".to_owned(),
            workspace_id: "ws_1".to_owned(),
            status: "open".to_owned(),
            active_widget_id: None,
        };

        let dto = WorkspaceSessionSummaryDto::from(summary);

        assert_eq!(
            dto,
            WorkspaceSessionSummaryDto {
                id: "wss_1".to_owned(),
                workspace_id: "ws_1".to_owned(),
                status: "open".to_owned(),
                active_widget_id: None,
            }
        );
    }
}
