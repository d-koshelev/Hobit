use hobit_app::{
    GitBranchStatusSummary, GitFileChangeSummary, GitLastCommitSummary, GitRepositoryStatusSummary,
    GitWorkingTreeStatusSummary, RunTerminalCommandInput, SharedStateObjectSummary,
    TerminalCommandRunSummary, WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary,
    WorkbenchEventSummary, WorkbenchSummary, WorkspaceSessionSummary, WorkspaceSummary,
    WorkspaceWorkbenchState,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateWorkspaceRequest {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AddWidgetInstanceToWorkbenchRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct UpdateWidgetInstanceStateRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub state: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct UpdateWidgetInstanceLayoutRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub layout: WidgetInstanceLayoutDto,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ListWidgetLogsRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub limit: usize,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetGitRepositoryStatusRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub repository_root: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RunTerminalCommandRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub program: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct WidgetInstanceLayoutDto {
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceSummaryDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub workbench_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceSessionSummaryDto {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub active_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceWorkbenchStateDto {
    pub workspace: WorkspaceSummaryDto,
    pub workbench: Option<WorkbenchSummaryDto>,
    pub widget_instances: Vec<WidgetInstanceSummaryDto>,
    pub shared_state_objects: Vec<SharedStateObjectSummaryDto>,
    pub recent_events: Vec<WorkbenchEventSummaryDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkbenchSummaryDto {
    pub id: String,
    pub workspace_id: String,
    pub preset_origin_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WidgetInstanceSummaryDto {
    pub id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
    pub config: Option<String>,
    pub state: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WidgetLogDto {
    pub id: String,
    pub widget_instance_id: String,
    pub run_id: Option<String>,
    pub level: String,
    pub message: String,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct SharedStateObjectSummaryDto {
    pub id: String,
    pub key: String,
    pub value: String,
    pub value_kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkbenchEventSummaryDto {
    pub id: String,
    pub kind: String,
    pub summary: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitRepositoryStatusDto {
    pub branch: Option<GitBranchStatusDto>,
    pub working_tree: GitWorkingTreeStatusDto,
    pub changed_files: Vec<GitFileChangeDto>,
    pub last_commit: Option<GitLastCommitDto>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitBranchStatusDto {
    pub name: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub is_detached: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitWorkingTreeStatusDto {
    pub is_clean: bool,
    pub is_dirty: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitFileChangeDto {
    pub area: String,
    pub kind: String,
    pub path: String,
    pub original_path: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitLastCommitDto {
    pub hash: String,
    pub title: String,
    pub author: Option<String>,
    pub committed_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct RunTerminalCommandResponseDto {
    pub run_id: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
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

impl From<WorkspaceWorkbenchState> for WorkspaceWorkbenchStateDto {
    fn from(state: WorkspaceWorkbenchState) -> Self {
        Self {
            workspace: WorkspaceSummaryDto::from(state.workspace),
            workbench: state.workbench.map(WorkbenchSummaryDto::from),
            widget_instances: state
                .widget_instances
                .into_iter()
                .map(WidgetInstanceSummaryDto::from)
                .collect(),
            shared_state_objects: state
                .shared_state_objects
                .into_iter()
                .map(SharedStateObjectSummaryDto::from)
                .collect(),
            recent_events: state
                .recent_events
                .into_iter()
                .map(WorkbenchEventSummaryDto::from)
                .collect(),
        }
    }
}

impl From<WorkbenchSummary> for WorkbenchSummaryDto {
    fn from(summary: WorkbenchSummary) -> Self {
        Self {
            id: summary.id,
            workspace_id: summary.workspace_id,
            preset_origin_id: summary.preset_origin_id,
        }
    }
}

impl From<WidgetInstanceSummary> for WidgetInstanceSummaryDto {
    fn from(summary: WidgetInstanceSummary) -> Self {
        Self {
            id: summary.id,
            definition_id: summary.definition_id,
            title: summary.title,
            category: summary.category,
            layout_mode: summary.layout_mode,
            dock_x: summary.dock_x,
            dock_y: summary.dock_y,
            dock_width: summary.dock_width,
            dock_height: summary.dock_height,
            popout_x: summary.popout_x,
            popout_y: summary.popout_y,
            popout_width: summary.popout_width,
            popout_height: summary.popout_height,
            always_on_top: summary.always_on_top,
            is_visible: summary.is_visible,
            config: summary.config,
            state: summary.state,
        }
    }
}

impl From<WidgetLogSummary> for WidgetLogDto {
    fn from(summary: WidgetLogSummary) -> Self {
        Self {
            id: summary.id,
            widget_instance_id: summary.widget_instance_id,
            run_id: summary.run_id,
            level: summary.level,
            message: summary.message,
            payload: summary.payload,
            created_at: summary.created_at,
        }
    }
}

impl From<SharedStateObjectSummary> for SharedStateObjectSummaryDto {
    fn from(summary: SharedStateObjectSummary) -> Self {
        Self {
            id: summary.id,
            key: summary.key,
            value: summary.value,
            value_kind: summary.value_kind,
        }
    }
}

impl From<WorkbenchEventSummary> for WorkbenchEventSummaryDto {
    fn from(summary: WorkbenchEventSummary) -> Self {
        Self {
            id: summary.id,
            kind: summary.kind,
            summary: summary.summary,
            created_at: summary.created_at,
        }
    }
}

impl From<GitRepositoryStatusSummary> for GitRepositoryStatusDto {
    fn from(summary: GitRepositoryStatusSummary) -> Self {
        Self {
            branch: summary.branch.map(GitBranchStatusDto::from),
            working_tree: GitWorkingTreeStatusDto::from(summary.working_tree),
            changed_files: summary
                .changed_files
                .into_iter()
                .map(GitFileChangeDto::from)
                .collect(),
            last_commit: summary.last_commit.map(GitLastCommitDto::from),
            warnings: summary.warnings,
        }
    }
}

impl From<GitBranchStatusSummary> for GitBranchStatusDto {
    fn from(summary: GitBranchStatusSummary) -> Self {
        Self {
            name: summary.name,
            upstream: summary.upstream,
            ahead: summary.ahead,
            behind: summary.behind,
            is_detached: summary.is_detached,
        }
    }
}

impl From<GitWorkingTreeStatusSummary> for GitWorkingTreeStatusDto {
    fn from(summary: GitWorkingTreeStatusSummary) -> Self {
        Self {
            is_clean: summary.is_clean,
            is_dirty: summary.is_dirty,
            staged_count: summary.staged_count,
            unstaged_count: summary.unstaged_count,
            untracked_count: summary.untracked_count,
        }
    }
}

impl From<GitFileChangeSummary> for GitFileChangeDto {
    fn from(summary: GitFileChangeSummary) -> Self {
        Self {
            area: summary.area,
            kind: summary.kind,
            path: summary.path,
            original_path: summary.original_path,
        }
    }
}

impl From<GitLastCommitSummary> for GitLastCommitDto {
    fn from(summary: GitLastCommitSummary) -> Self {
        Self {
            hash: summary.hash,
            title: summary.title,
            author: summary.author,
            committed_at: summary.committed_at,
        }
    }
}

impl From<RunTerminalCommandRequest> for RunTerminalCommandInput {
    fn from(request: RunTerminalCommandRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            program: request.program,
            args: request.args,
            working_directory: PathBuf::from(request.working_directory),
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
        }
    }
}

impl From<TerminalCommandRunSummary> for RunTerminalCommandResponseDto {
    fn from(summary: TerminalCommandRunSummary) -> Self {
        Self {
            run_id: summary.run_id,
            status: summary.status,
            exit_code: summary.exit_code,
            stdout: summary.stdout,
            stderr: summary.stderr,
            stdout_truncated: summary.stdout_truncated,
            stderr_truncated: summary.stderr_truncated,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
        }
    }
}

impl From<WidgetInstanceLayoutDto> for WidgetInstanceLayout {
    fn from(layout: WidgetInstanceLayoutDto) -> Self {
        Self {
            layout_mode: layout.layout_mode,
            dock_x: layout.dock_x,
            dock_y: layout.dock_y,
            dock_width: layout.dock_width,
            dock_height: layout.dock_height,
            popout_x: layout.popout_x,
            popout_y: layout.popout_y,
            popout_width: layout.popout_width,
            popout_height: layout.popout_height,
            always_on_top: layout.always_on_top,
            is_visible: layout.is_visible,
        }
    }
}
