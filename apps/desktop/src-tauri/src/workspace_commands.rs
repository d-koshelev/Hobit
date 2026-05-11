use std::path::Path;

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::workspace_dto::{
    AddWidgetInstanceToWorkbenchRequest, CreateWorkspaceRequest, GetGitRepositoryStatusRequest,
    GitRepositoryStatusDto, ListWidgetLogsRequest, PersistAgentChatProposalRequest,
    PersistAgentChatProposalResponseDto, RunTerminalCommandRequest, RunTerminalCommandResponseDto,
    UpdateWidgetInstanceLayoutRequest, UpdateWidgetInstanceStateRequest, WidgetLogDto,
    WorkspaceSessionSummaryDto, WorkspaceSummaryDto, WorkspaceWorkbenchStateDto,
};

#[tauri::command]
pub(crate) fn create_workspace(
    request: CreateWorkspaceRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceSummaryDto, String> {
    let service = workspace_service(state.db_path())?;
    service
        .create_empty_workspace(request.title, request.description)
        .map(WorkspaceSummaryDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_workspaces(
    state: State<'_, AppState>,
) -> Result<Vec<WorkspaceSummaryDto>, String> {
    let service = workspace_service(state.db_path())?;
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
pub(crate) fn get_workspace_summary(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceSummaryDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_workspace_summary(&workspace_id)
        .map(|summary| summary.map(WorkspaceSummaryDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn open_workspace(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceSessionSummaryDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .open_workspace(&workspace_id)
        .map(|summary| summary.map(WorkspaceSessionSummaryDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_workspace_workbench_state(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceWorkbenchStateDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_workspace_workbench_state(&workspace_id)
        .map(|state| state.map(WorkspaceWorkbenchStateDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn add_widget_instance_to_workbench(
    request: AddWidgetInstanceToWorkbenchRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceWorkbenchStateDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .add_widget_instance_to_workbench(
            &request.workspace_id,
            &request.workbench_id,
            &request.definition_id,
            &request.title,
            &request.category,
        )
        .map(|state| state.map(WorkspaceWorkbenchStateDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_widget_instance_state(
    request: UpdateWidgetInstanceStateRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceWorkbenchStateDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .update_widget_instance_state(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            &request.state,
        )
        .map(|state| state.map(WorkspaceWorkbenchStateDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_widget_instance_layout(
    request: UpdateWidgetInstanceLayoutRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceWorkbenchStateDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .update_widget_instance_layout(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            request.layout.into(),
        )
        .map(|state| state.map(WorkspaceWorkbenchStateDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_widget_logs(
    request: ListWidgetLogsRequest,
    state: State<'_, AppState>,
) -> Result<Option<Vec<WidgetLogDto>>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .list_widget_logs(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            request.limit,
        )
        .map(|logs| logs.map(|logs| logs.into_iter().map(WidgetLogDto::from).collect()))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn run_terminal_command(
    request: RunTerminalCommandRequest,
    state: State<'_, AppState>,
) -> Result<Option<RunTerminalCommandResponseDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .run_terminal_command(request.into())
        .map(|summary| summary.map(RunTerminalCommandResponseDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn persist_agent_chat_proposal(
    request: PersistAgentChatProposalRequest,
    state: State<'_, AppState>,
) -> Result<Option<PersistAgentChatProposalResponseDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .persist_agent_chat_proposal(request.into())
        .map(|summary| summary.map(PersistAgentChatProposalResponseDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_git_repository_status(
    request: GetGitRepositoryStatusRequest,
    state: State<'_, AppState>,
) -> Result<Option<GitRepositoryStatusDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_git_repository_status(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            &request.repository_root,
        )
        .map(|status| status.map(GitRepositoryStatusDto::from))
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
