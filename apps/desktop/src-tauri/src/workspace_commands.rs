use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::{Emitter, State};

use crate::agent_chat_ai_dto::{
    GenerateAgentChatAiProposalRequest, GenerateAgentChatAiProposalResponseDto,
};
use crate::agent_chat_ai_provider::EnvHttpAgentChatAiProvider;
use crate::agent_executor_diff_dto::{
    AgentExecutorDiffSummaryDto, GetAgentExecutorDiffSummaryRequest,
};
use crate::agent_executor_history_dto::{
    AgentExecutorRunDetailDto, AgentExecutorRunHistoryDto, GetAgentExecutorRunDetailRequest,
    ListAgentExecutorRunsRequest,
};
use crate::agent_queue_dto::{
    AgentQueueItemDto, AgentQueueSnapshotDto, CreateAgentQueueItemFromProposalRequest,
    GetAgentQueueSnapshotRequest,
};
use crate::app_state::{
    AppState, DirectWorkActiveRun, DirectWorkActiveRunRegistry, TerminalPtySessionRegistry,
};
use crate::codex_direct_work_dto::{
    try_run_codex_direct_work_input_from_request,
    try_run_codex_direct_work_input_from_stream_request, CancelCodexDirectWorkRunRequest,
    CancelCodexDirectWorkRunResponseDto, DirectWorkStreamEventDto,
    ForceKillCodexDirectWorkRunRequest, ForceKillCodexDirectWorkRunResponseDto,
    RunCodexDirectWorkRequest, RunCodexDirectWorkResponseDto, RunDirectWorkValidationRequest,
    RunDirectWorkValidationResponseDto, StartCodexDirectWorkStreamRequest,
    StartCodexDirectWorkStreamResponseDto, DIRECT_WORK_STREAM_EVENT_NAME,
};
use crate::direct_work_host_artifacts::{
    DirectWorkHostRuntimeBoundarySummary, DirectWorkHostStartRuntimeArtifacts,
    DirectWorkHostStreamEventRuntimeArtifact,
};
use crate::git_commit_dto::{CreateGitCommitRequest, GitCommitResponseDto};
use crate::git_review_dto::{GetGitFileDiffRequest, GetGitLogRequest, GitFileDiffDto, GitLogDto};
use crate::workspace_dto::{
    AddWidgetInstanceToWorkbenchRequest, AgentMonitoringSnapshotDto, CreateWorkspaceRequest,
    DeleteWidgetInstanceFromWorkbenchRequest, DeleteWorkspaceRequest,
    GetAgentMonitoringSnapshotRequest, GetGitRepositoryStatusRequest, GitRepositoryStatusDto,
    ListWidgetLogsRequest, PersistAgentChatProposalRequest, PersistAgentChatProposalResponseDto,
    RunTerminalCommandRequest, RunTerminalCommandResponseDto, UpdateWidgetInstanceLayoutRequest,
    UpdateWidgetInstanceStateRequest, WidgetLogDto, WorkspaceDeletionResponseDto,
    WorkspaceSessionSummaryDto, WorkspaceSummaryDto, WorkspaceWorkbenchStateDto,
};
use crate::workspace_git_dto::{
    CreateWorkspaceGitCommitRequest, GetWorkspaceGitDiffSummaryRequest,
    GetWorkspaceGitFileDiffRequest, GetWorkspaceGitLogRequest, GetWorkspaceGitStatusRequest,
    PushWorkspaceGitRequest, WorkspaceGitCommitResponseDto, WorkspaceGitDiffSummaryDto,
    WorkspaceGitFileDiffDto, WorkspaceGitLogDto, WorkspaceGitPushResponseDto,
    WorkspaceGitStatusDto,
};
use crate::workspace_root_dto as root_dto;

#[tauri::command]
pub(crate) fn create_workspace(
    request: CreateWorkspaceRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceSummaryDto, String> {
    let service = workspace_service(state.db_path())?;
    service
        .create_empty_workspace(request.title, request.description)
        .map(|summary| root_dto::summary(summary, state.workspace_root()))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_workspaces(
    state: State<'_, AppState>,
) -> Result<Vec<WorkspaceSummaryDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .list_workspaces()
        .map(|workspaces| root_dto::summaries(workspaces, state.workspace_root()))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn delete_workspace(
    request: DeleteWorkspaceRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceDeletionResponseDto, String> {
    delete_workspace_blocking(
        request,
        state.db_path().to_path_buf(),
        state.workspace_root().map(str::to_owned),
        state.direct_work_active_runs(),
        state.terminal_pty_sessions(),
    )
}

fn delete_workspace_blocking(
    request: DeleteWorkspaceRequest,
    db_path: PathBuf,
    workspace_root: Option<String>,
    active_runs: DirectWorkActiveRunRegistry,
    terminal_pty_sessions: TerminalPtySessionRegistry,
) -> Result<WorkspaceDeletionResponseDto, String> {
    if active_runs.has_active_workspace_run(&request.workspace_id) {
        return Err(
            "Workspace has an active Direct Work run. Stop the run before deleting the workspace."
                .to_owned(),
        );
    }
    if terminal_pty_sessions.has_active_workspace_session(&request.workspace_id) {
        return Err(
            "Workspace has an active Terminal PTY session. Stop or kill the session before deleting the workspace."
                .to_owned(),
        );
    }

    let service = workspace_service(&db_path)?;
    service
        .delete_workspace(&request.workspace_id)
        .map(|summary| root_dto::deletion(summary, workspace_root.as_deref()))
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
        .map(|summary| root_dto::optional_summary(summary, state.workspace_root()))
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
        .map(|summary| root_dto::optional_workbench_state(summary, state.workspace_root()))
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
        .map(|summary| root_dto::optional_workbench_state(summary, state.workspace_root()))
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
        .map(|summary| root_dto::optional_workbench_state(summary, state.workspace_root()))
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
        .map(|summary| root_dto::optional_workbench_state(summary, state.workspace_root()))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn delete_widget_instance_from_workbench(
    request: DeleteWidgetInstanceFromWorkbenchRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceWorkbenchStateDto>, String> {
    delete_widget_instance_from_workbench_blocking(
        request,
        state.db_path().to_path_buf(),
        state.workspace_root().map(str::to_owned),
        state.direct_work_active_runs(),
        state.terminal_pty_sessions(),
    )
}

fn delete_widget_instance_from_workbench_blocking(
    request: DeleteWidgetInstanceFromWorkbenchRequest,
    db_path: PathBuf,
    workspace_root: Option<String>,
    active_runs: DirectWorkActiveRunRegistry,
    terminal_pty_sessions: TerminalPtySessionRegistry,
) -> Result<Option<WorkspaceWorkbenchStateDto>, String> {
    if active_runs.has_active_widget_run(
        &request.workspace_id,
        &request.workbench_id,
        &request.widget_instance_id,
    ) {
        return Err(
            "cannot delete widget instance while Direct Work run is active; stop the active run before deleting the widget".to_owned(),
        );
    }
    if terminal_pty_sessions.has_active_widget_session(
        &request.workspace_id,
        &request.workbench_id,
        &request.widget_instance_id,
    ) {
        return Err(
            "cannot delete widget instance while Terminal PTY session is active; stop or kill the active session before deleting the widget".to_owned(),
        );
    }

    let service = workspace_service(&db_path)?;
    service
        .delete_widget_instance_from_workbench(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
        )
        .map(|summary| root_dto::optional_workbench_state(summary, workspace_root.as_deref()))
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
pub(crate) fn list_agent_executor_runs(
    request: ListAgentExecutorRunsRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentExecutorRunHistoryDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .list_agent_executor_runs(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            request.limit,
        )
        .map(|history| history.map(AgentExecutorRunHistoryDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_executor_run_detail(
    request: GetAgentExecutorRunDetailRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentExecutorRunDetailDto>, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_agent_executor_run_detail(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            &request.run_id,
        )
        .map(|detail| detail.map(AgentExecutorRunDetailDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn get_agent_executor_diff_summary(
    request: GetAgentExecutorDiffSummaryRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentExecutorDiffSummaryDto>, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        get_agent_executor_diff_summary_blocking(request, db_path)
    })
    .await
    .map_err(command_error)?
}

fn get_agent_executor_diff_summary_blocking(
    request: GetAgentExecutorDiffSummaryRequest,
    db_path: PathBuf,
) -> Result<Option<AgentExecutorDiffSummaryDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_agent_executor_diff_summary(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            &request.repo_root,
            request.max_files,
            request.max_patch_bytes_per_file,
            request.include_patch_preview,
        )
        .map(|summary| summary.map(AgentExecutorDiffSummaryDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn get_workspace_git_diff_summary(
    request: GetWorkspaceGitDiffSummaryRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceGitDiffSummaryDto, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        get_workspace_git_diff_summary_blocking(request, db_path)
    })
    .await
    .map_err(command_error)?
}

fn get_workspace_git_diff_summary_blocking(
    request: GetWorkspaceGitDiffSummaryRequest,
    db_path: PathBuf,
) -> Result<WorkspaceGitDiffSummaryDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_workspace_git_diff_summary(
            &request.repo_root,
            request.max_files,
            request.max_patch_bytes_per_file,
            request.include_patch_preview,
        )
        .map(WorkspaceGitDiffSummaryDto::from)
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
    let input = try_run_codex_direct_work_input_from_request(request)?;
    let _host_start_artifacts = DirectWorkHostStartRuntimeArtifacts::from_input(&input);
    let service = workspace_service(&db_path)?;
    service
        .run_codex_direct_work(input)
        .map(|summary| summary.map(RunCodexDirectWorkResponseDto::from))
        .map_err(classify_host_error)
}

#[tauri::command]
pub(crate) async fn run_direct_work_validation(
    request: RunDirectWorkValidationRequest,
    state: State<'_, AppState>,
) -> Result<Option<RunDirectWorkValidationResponseDto>, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        run_direct_work_validation_blocking(request, db_path)
    })
    .await
    .map_err(command_error)?
}

fn run_direct_work_validation_blocking(
    request: RunDirectWorkValidationRequest,
    db_path: PathBuf,
) -> Result<Option<RunDirectWorkValidationResponseDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .run_direct_work_validation(request.into())
        .map(|summary| summary.map(RunDirectWorkValidationResponseDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn start_codex_direct_work_stream(
    request: StartCodexDirectWorkStreamRequest,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<StartCodexDirectWorkStreamResponseDto>, String> {
    let db_path = state.db_path().to_path_buf();
    let active_runs = state.direct_work_active_runs();
    let input = try_run_codex_direct_work_input_from_stream_request(request)?;
    let _host_start_artifacts = DirectWorkHostStartRuntimeArtifacts::from_input(&input);
    let start = tauri::async_runtime::spawn_blocking({
        let db_path = db_path.clone();
        let input = input.clone();
        move || start_codex_direct_work_stream_blocking(input, db_path)
    })
    .await
    .map_err(command_error)??;

    if let Some(start_summary) = start.clone() {
        let run_id = start_summary.run_id.clone();
        let cancellation_token = hobit_app::CodexDirectStreamCancellationToken::new();
        active_runs.register(DirectWorkActiveRun::new(
            run_id.clone(),
            input.workspace_id.clone(),
            input.workbench_id.clone(),
            input.widget_instance_id.clone(),
            cancellation_token.clone(),
        ));
        tauri::async_runtime::spawn_blocking(move || {
            let result = run_codex_direct_work_stream_background(
                input,
                run_id.clone(),
                db_path,
                app,
                cancellation_token,
            );
            active_runs.unregister(&run_id);
            if let Err(error) = result {
                let _host_error_artifact =
                    DirectWorkHostRuntimeBoundarySummary::from_host_error(&error);
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
        .map_err(classify_host_error)
}

fn run_codex_direct_work_stream_background(
    input: hobit_app::RunCodexDirectWorkInput,
    run_id: String,
    db_path: PathBuf,
    app: tauri::AppHandle,
    cancellation_token: hobit_app::CodexDirectStreamCancellationToken,
) -> Result<(), String> {
    let service = workspace_service(&db_path)?;
    service
        .run_codex_direct_work_stream_with_cancellation(
            input,
            &run_id,
            cancellation_token,
            |event| {
                let _event_artifact = DirectWorkHostStreamEventRuntimeArtifact::from_event(&event);
                let emit_result = app.emit(
                    DIRECT_WORK_STREAM_EVENT_NAME,
                    DirectWorkStreamEventDto::from(event),
                );
                let _emit_artifact = match &emit_result {
                    Ok(_) => DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(None),
                    Err(error) => {
                        let error_message = error.to_string();
                        DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(Some(
                            &error_message,
                        ))
                    }
                };
                let _ = emit_result;
            },
        )
        .map(|_| ())
        .map_err(classify_host_error)
}

#[tauri::command]
pub(crate) async fn cancel_codex_direct_work_run(
    request: CancelCodexDirectWorkRunRequest,
    state: State<'_, AppState>,
) -> Result<CancelCodexDirectWorkRunResponseDto, String> {
    let db_path = state.db_path().to_path_buf();
    let active_runs = state.direct_work_active_runs();
    tauri::async_runtime::spawn_blocking(move || {
        cancel_codex_direct_work_run_blocking(request, db_path, active_runs)
    })
    .await
    .map_err(command_error)?
}

fn cancel_codex_direct_work_run_blocking(
    request: CancelCodexDirectWorkRunRequest,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
) -> Result<CancelCodexDirectWorkRunResponseDto, String> {
    let input: hobit_app::CancelCodexDirectWorkRunInput = request.into();
    let service = workspace_service(&db_path)?;
    let inspection = service
        .inspect_codex_direct_work_cancellation(input.clone())
        .map_err(command_error)?;

    if inspection.status != "active" {
        return Ok(CancelCodexDirectWorkRunResponseDto::from(inspection));
    }

    if !active_runs.request_cancellation(
        &input.workspace_id,
        &input.workbench_id,
        &input.widget_instance_id,
        &input.run_id,
    ) {
        let refreshed = service
            .inspect_codex_direct_work_cancellation(input.clone())
            .map_err(command_error)?;
        if refreshed.status != "active" {
            return Ok(CancelCodexDirectWorkRunResponseDto::from(refreshed));
        }

        let _not_active_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_status("not_active", None);
        return Ok(CancelCodexDirectWorkRunResponseDto {
            run_id: input.run_id,
            status: "not_active".to_owned(),
            message: "Direct Work run is not active in this app session".to_owned(),
            cancellation_requested: false,
        });
    }

    service
        .record_codex_direct_work_cancellation_requested(input)
        .map(CancelCodexDirectWorkRunResponseDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn force_kill_codex_direct_work_run(
    request: ForceKillCodexDirectWorkRunRequest,
    state: State<'_, AppState>,
) -> Result<ForceKillCodexDirectWorkRunResponseDto, String> {
    let db_path = state.db_path().to_path_buf();
    let active_runs = state.direct_work_active_runs();
    tauri::async_runtime::spawn_blocking(move || {
        force_kill_codex_direct_work_run_blocking(request, db_path, active_runs)
    })
    .await
    .map_err(command_error)?
}

fn force_kill_codex_direct_work_run_blocking(
    request: ForceKillCodexDirectWorkRunRequest,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
) -> Result<ForceKillCodexDirectWorkRunResponseDto, String> {
    let input: hobit_app::ForceKillCodexDirectWorkRunInput = request.into();
    let service = workspace_service(&db_path)?;
    let inspection = service
        .inspect_codex_direct_work_force_kill(input.clone())
        .map_err(command_error)?;

    if inspection.status != "active" {
        return Ok(ForceKillCodexDirectWorkRunResponseDto::from(inspection));
    }

    if !active_runs.request_force_kill(
        &input.workspace_id,
        &input.workbench_id,
        &input.widget_instance_id,
        &input.run_id,
    ) {
        let refreshed = service
            .inspect_codex_direct_work_force_kill(input.clone())
            .map_err(command_error)?;
        if refreshed.status != "active" {
            return Ok(ForceKillCodexDirectWorkRunResponseDto::from(refreshed));
        }

        let _not_active_artifact =
            DirectWorkHostRuntimeBoundarySummary::from_status("not_active", None);
        return Ok(ForceKillCodexDirectWorkRunResponseDto {
            run_id: input.run_id,
            status: "not_active".to_owned(),
            message: "Direct Work run is not active in this app session".to_owned(),
            force_kill_requested: false,
        });
    }

    service
        .record_codex_direct_work_force_kill_requested(input)
        .map(ForceKillCodexDirectWorkRunResponseDto::from)
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

#[tauri::command]
pub(crate) async fn get_git_file_diff(
    request: GetGitFileDiffRequest,
    state: State<'_, AppState>,
) -> Result<Option<GitFileDiffDto>, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || get_git_file_diff_blocking(request, db_path))
        .await
        .map_err(command_error)?
}

fn get_git_file_diff_blocking(
    request: GetGitFileDiffRequest,
    db_path: PathBuf,
) -> Result<Option<GitFileDiffDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_git_file_diff(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            &request.repository_root,
            &request.path,
            request.max_patch_bytes,
        )
        .map(|diff| diff.map(GitFileDiffDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn get_git_log(
    request: GetGitLogRequest,
    state: State<'_, AppState>,
) -> Result<Option<GitLogDto>, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || get_git_log_blocking(request, db_path))
        .await
        .map_err(command_error)?
}

fn get_git_log_blocking(
    request: GetGitLogRequest,
    db_path: PathBuf,
) -> Result<Option<GitLogDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_git_log(
            &request.workspace_id,
            &request.workbench_id,
            &request.widget_instance_id,
            &request.repository_root,
            request.limit,
        )
        .map(|log| log.map(GitLogDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_workspace_git_status(
    request: GetWorkspaceGitStatusRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceGitStatusDto, String> {
    let service = workspace_service(state.db_path())?;
    service
        .get_workspace_git_status(&request.repo_root)
        .map(WorkspaceGitStatusDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn get_workspace_git_file_diff(
    request: GetWorkspaceGitFileDiffRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceGitFileDiffDto, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        get_workspace_git_file_diff_blocking(request, db_path)
    })
    .await
    .map_err(command_error)?
}

fn get_workspace_git_file_diff_blocking(
    request: GetWorkspaceGitFileDiffRequest,
    db_path: PathBuf,
) -> Result<WorkspaceGitFileDiffDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_workspace_git_file_diff(&request.repo_root, &request.path, request.max_patch_bytes)
        .map(WorkspaceGitFileDiffDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn get_workspace_git_log(
    request: GetWorkspaceGitLogRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceGitLogDto, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || get_workspace_git_log_blocking(request, db_path))
        .await
        .map_err(command_error)?
}

fn get_workspace_git_log_blocking(
    request: GetWorkspaceGitLogRequest,
    db_path: PathBuf,
) -> Result<WorkspaceGitLogDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_workspace_git_log(&request.repo_root, request.limit)
        .map(WorkspaceGitLogDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn create_git_commit(
    request: CreateGitCommitRequest,
    state: State<'_, AppState>,
) -> Result<Option<GitCommitResponseDto>, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || create_git_commit_blocking(request, db_path))
        .await
        .map_err(command_error)?
}

fn create_git_commit_blocking(
    request: CreateGitCommitRequest,
    db_path: PathBuf,
) -> Result<Option<GitCommitResponseDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_git_commit(request.into())
        .map(|summary| summary.map(GitCommitResponseDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn create_workspace_git_commit(
    request: CreateWorkspaceGitCommitRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceGitCommitResponseDto, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        create_workspace_git_commit_blocking(request, db_path)
    })
    .await
    .map_err(command_error)?
}

fn create_workspace_git_commit_blocking(
    request: CreateWorkspaceGitCommitRequest,
    db_path: PathBuf,
) -> Result<WorkspaceGitCommitResponseDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_workspace_git_commit(request.into())
        .map(WorkspaceGitCommitResponseDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) async fn push_workspace_git(
    request: PushWorkspaceGitRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceGitPushResponseDto, String> {
    let db_path = state.db_path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || push_workspace_git_blocking(request, db_path))
        .await
        .map_err(command_error)?
}

fn push_workspace_git_blocking(
    request: PushWorkspaceGitRequest,
    db_path: PathBuf,
) -> Result<WorkspaceGitPushResponseDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .push_workspace_git(request.into())
        .map(WorkspaceGitPushResponseDto::from)
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

fn classify_host_error(error: impl std::fmt::Display) -> String {
    let error = error.to_string();
    let _host_error_artifact = DirectWorkHostRuntimeBoundarySummary::from_host_error(&error);
    error
}

#[cfg(test)]
mod tests;
