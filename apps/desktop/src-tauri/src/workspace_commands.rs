use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::{Emitter, State};

use crate::agent_chat_ai_dto::{
    GenerateAgentChatAiProposalRequest, GenerateAgentChatAiProposalResponseDto,
};
use crate::agent_chat_ai_provider::EnvHttpAgentChatAiProvider;
use crate::agent_queue_dto::{
    AgentQueueItemDto, AgentQueueSnapshotDto, CreateAgentQueueItemFromProposalRequest,
    GetAgentQueueSnapshotRequest,
};
use crate::app_state::AppState;
use crate::codex_direct_work_dto::{
    DirectWorkStreamEventDto, RunCodexDirectWorkRequest, RunCodexDirectWorkResponseDto,
    StartCodexDirectWorkStreamRequest, StartCodexDirectWorkStreamResponseDto,
    DIRECT_WORK_STREAM_EVENT_NAME,
};
use crate::workspace_dto::{
    AddWidgetInstanceToWorkbenchRequest, AgentMonitoringSnapshotDto, CreateWorkspaceRequest,
    GetAgentMonitoringSnapshotRequest, GetGitRepositoryStatusRequest, GitRepositoryStatusDto,
    ListWidgetLogsRequest, PersistAgentChatProposalRequest, PersistAgentChatProposalResponseDto,
    RunTerminalCommandRequest, RunTerminalCommandResponseDto, UpdateWidgetInstanceLayoutRequest,
    UpdateWidgetInstanceStateRequest, WidgetLogDto, WorkspaceSessionSummaryDto,
    WorkspaceSummaryDto, WorkspaceWorkbenchStateDto,
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
pub(crate) async fn run_codex_direct_work(
    request: RunCodexDirectWorkRequest,
    state: State<'_, AppState>,
) -> Result<Option<RunCodexDirectWorkResponseDto>, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || run_codex_direct_work_blocking(request, db_path))
        .await
        .map_err(command_error)?
}

fn run_codex_direct_work_blocking(
    request: RunCodexDirectWorkRequest,
    db_path: PathBuf,
) -> Result<Option<RunCodexDirectWorkResponseDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .run_codex_direct_work(request.into())
        .map(|summary| summary.map(RunCodexDirectWorkResponseDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn start_codex_direct_work_stream(
    request: StartCodexDirectWorkStreamRequest,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<StartCodexDirectWorkStreamResponseDto>, String> {
    let db_path = state.db_path().to_path_buf();
    let input: hobit_app::RunCodexDirectWorkInput = request.into();
    let start = tauri::async_runtime::spawn_blocking({
        let db_path = db_path.clone();
        let input = input.clone();
        move || start_codex_direct_work_stream_blocking(input, db_path)
    })
    .await
    .map_err(command_error)??;

    if let Some(start_summary) = start.clone() {
        let run_id = start_summary.run_id.clone();
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = run_codex_direct_work_stream_background(input, run_id, db_path, app)
            {
                eprintln!("Direct Work stream background task failed: {error}");
            }
        });
    }

    Ok(start.map(StartCodexDirectWorkStreamResponseDto::from))
}

fn start_codex_direct_work_stream_blocking(
    input: hobit_app::RunCodexDirectWorkInput,
    db_path: PathBuf,
) -> Result<Option<hobit_app::CodexDirectWorkStreamStartSummary>, String> {
    let service = workspace_service(&db_path)?;
    service
        .start_codex_direct_work_stream(input)
        .map_err(command_error)
}

fn run_codex_direct_work_stream_background(
    input: hobit_app::RunCodexDirectWorkInput,
    run_id: String,
    db_path: PathBuf,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let service = workspace_service(&db_path)?;
    service
        .run_codex_direct_work_stream(input, &run_id, |event| {
            let _ = app.emit(
                DIRECT_WORK_STREAM_EVENT_NAME,
                DirectWorkStreamEventDto::from(event),
            );
        })
        .map(|_| ())
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
pub(crate) fn generate_agent_chat_ai_proposal(
    request: GenerateAgentChatAiProposalRequest,
    state: State<'_, AppState>,
) -> Result<Option<GenerateAgentChatAiProposalResponseDto>, String> {
    let service = workspace_service(state.db_path())?;
    let provider = EnvHttpAgentChatAiProvider::from_env();
    service
        .generate_agent_chat_ai_proposal(request.into(), &provider)
        .map(|summary| summary.map(GenerateAgentChatAiProposalResponseDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_monitoring_snapshot(
    request: GetAgentMonitoringSnapshotRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentMonitoringSnapshotDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_agent_monitoring_snapshot(&request.workspace_id, &request.workbench_id)
        .map(|snapshot| snapshot.map(AgentMonitoringSnapshotDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn create_agent_queue_item_from_proposal(
    request: CreateAgentQueueItemFromProposalRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueItemDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .create_agent_queue_item_from_proposal(request.into())
        .map(|item| item.map(AgentQueueItemDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_queue_snapshot(
    request: GetAgentQueueSnapshotRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueSnapshotDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_agent_queue_snapshot(&request.workspace_id, &request.workbench_id)
        .map(|snapshot| snapshot.map(AgentQueueSnapshotDto::from))
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

#[cfg(test)]
mod tests {
    use super::*;

    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn run_codex_direct_work_blocking_rejects_missing_workspace_without_process_run() {
        let db_path = unique_test_db_path();
        let store = SqliteStore::open(&db_path).expect("open sqlite test store");
        store.init_schema().expect("initialize schema");
        drop(store);

        let response = run_codex_direct_work_blocking(
            RunCodexDirectWorkRequest {
                workspace_id: "missing-workspace".to_owned(),
                workbench_id: "missing-workbench".to_owned(),
                widget_instance_id: "missing-widget".to_owned(),
                codex_executable: "codex".to_owned(),
                repo_root: ".".to_owned(),
                operator_prompt: "Return exactly: test".to_owned(),
                sandbox: "read_only".to_owned(),
                approval_policy: "never".to_owned(),
                timeout_ms: Some(1),
                stdout_cap_bytes: Some(1),
                stderr_cap_bytes: Some(1),
            },
            db_path.clone(),
        )
        .expect("direct work command helper should return cleanly");

        assert!(response.is_none());
        remove_test_db_files(&db_path);
    }

    #[test]
    fn start_codex_direct_work_stream_blocking_rejects_missing_workspace_without_process_run() {
        let db_path = unique_test_db_path();
        let store = SqliteStore::open(&db_path).expect("open sqlite test store");
        store.init_schema().expect("initialize schema");
        drop(store);

        let response = start_codex_direct_work_stream_blocking(
            hobit_app::RunCodexDirectWorkInput {
                workspace_id: "missing-workspace".to_owned(),
                workbench_id: "missing-workbench".to_owned(),
                widget_instance_id: "missing-widget".to_owned(),
                codex_executable: "codex".to_owned(),
                repo_root: ".".into(),
                operator_prompt: "Return exactly: test".to_owned(),
                sandbox: "read_only".to_owned(),
                approval_policy: "never".to_owned(),
                timeout_ms: Some(1),
                stdout_cap_bytes: Some(1),
                stderr_cap_bytes: Some(1),
            },
            db_path.clone(),
        )
        .expect("direct work stream command helper should return cleanly");

        assert!(response.is_none());
        remove_test_db_files(&db_path);
    }

    fn unique_test_db_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "hobit-workspace-command-test-{}-{nanos}.sqlite3",
            std::process::id()
        ))
    }

    fn remove_test_db_files(db_path: &Path) {
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
        let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
    }
}
