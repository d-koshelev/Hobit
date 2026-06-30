use hobit_app::{
    AgentChatProposalActionInput, AgentChatProposalInput, AgentChatProposalRunSummary,
    AgentMonitoringProposalActionSummary, AgentMonitoringProposalResultSummary,
    AgentMonitoringSnapshot, GitBranchStatusSummary, GitFileChangeSummary, GitLastCommitSummary,
    GitRepositoryStatusSummary, GitWorkingTreeStatusSummary, PersistAgentChatProposalInput,
    QueueWorkspaceRecoveryProjection, RunTerminalCommandInput, SharedStateObjectSummary,
    TerminalCommandRunSummary, WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary,
    WorkbenchEventSummary, WorkbenchSummary, WorkspaceDeletionSummary, WorkspaceSessionSummary,
    WorkspaceSummary, WorkspaceWorkbenchState,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::agent_queue_control_dto::AgentQueueControlStateDto;
#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateWorkspaceRequest {
    pub title: String,
    pub description: Option<String>,
    #[serde(default, alias = "rootPath")]
    pub root_path: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct DeleteWorkspaceRequest {
    pub workspace_id: String,
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
pub(crate) struct DeleteWidgetInstanceFromWorkbenchRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ListWidgetLogsRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub limit: usize,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetAgentMonitoringSnapshotRequest {
    pub workspace_id: String,
    pub workbench_id: String,
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

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct PersistAgentChatProposalRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub operator_prompt: String,
    pub approved_context_snapshot_json: String,
    pub proposal: AgentChatProposalRequest,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AgentChatProposalRequest {
    pub id: String,
    pub request_summary: String,
    pub proposed_plan: Vec<String>,
    pub context_needed: Vec<String>,
    pub action_proposals: Vec<AgentChatProposalActionRequest>,
    pub safety_notes: Vec<String>,
    pub runtime_notes: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct AgentChatProposalActionRequest {
    pub title: String,
    pub description: String,
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
    pub root_path: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
    pub widget_count: usize,
    pub workspace_agent_count: usize,
    pub note_count: usize,
    pub skill_count: usize,
    pub knowledge_document_count: usize,
    pub queue_task_count: usize,
    pub workbench_id: Option<String>,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceDeletionResponseDto {
    pub deleted_workspace_id: String,
    pub deleted: bool,
    pub remaining_workspaces: Vec<WorkspaceSummaryDto>,
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
    pub queue_recovery: QueueWorkspaceRecoveryProjectionDto,
    pub widget_instances: Vec<WidgetInstanceSummaryDto>,
    pub shared_state_objects: Vec<SharedStateObjectSummaryDto>,
    pub recent_events: Vec<WorkbenchEventSummaryDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueWorkspaceRecoveryProjectionDto {
    pub workspace_id: String,
    pub queue_task_count: usize,
    pub running_task_count: usize,
    pub stale_running_candidate_count: usize,
    pub has_visible_queue_view: bool,
    pub canonical_queue_widget_id: Option<String>,
    pub control_state: Option<AgentQueueControlStateDto>,
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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct PersistAgentChatProposalResponseDto {
    pub run_id: String,
    pub status: String,
    pub result_id: String,
    pub result_type: String,
    pub summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentMonitoringSnapshotDto {
    pub workspace_id: String,
    pub workbench_id: String,
    pub proposal_results: Vec<AgentMonitoringProposalResultDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentMonitoringProposalResultDto {
    pub run_id: String,
    pub result_id: String,
    pub status: String,
    pub result_type: String,
    pub result_summary: Option<String>,
    pub result_content: Option<String>,
    pub run_started_at: String,
    pub run_finished_at: Option<String>,
    pub result_created_at: String,
    pub source_widget_id: String,
    pub source_widget_title: String,
    pub runtime_status: String,
    pub provider_status: String,
    pub provider_used: bool,
    pub provider_response_received: bool,
    pub no_llm_called: bool,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub context_was_approved: bool,
    pub operator_prompt: String,
    pub proposal_summary: String,
    pub proposed_plan: Vec<String>,
    pub context_needed: Vec<String>,
    pub approved_context_summary: String,
    pub approved_context_status: String,
    pub approved_context_source_labels: Vec<String>,
    pub proposed_actions: Vec<AgentMonitoringProposalActionDto>,
    pub safety_notes: Vec<String>,
    pub raw_payload: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentMonitoringProposalActionDto {
    pub title: String,
    pub description: String,
    pub status: String,
    pub executed: bool,
}

impl From<WorkspaceSummary> for WorkspaceSummaryDto {
    fn from(summary: WorkspaceSummary) -> Self {
        Self {
            id: summary.id,
            title: summary.title,
            description: summary.description,
            root_path: summary.root_path,
            status: summary.status,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
            last_opened_at: summary.last_opened_at,
            widget_count: summary.widget_count,
            workspace_agent_count: summary.workspace_agent_count,
            note_count: summary.note_count,
            skill_count: summary.skill_count,
            knowledge_document_count: summary.knowledge_document_count,
            queue_task_count: summary.queue_task_count,
            workbench_id: summary.workbench_id,
        }
    }
}

impl From<WorkspaceDeletionSummary> for WorkspaceDeletionResponseDto {
    fn from(summary: WorkspaceDeletionSummary) -> Self {
        Self {
            deleted_workspace_id: summary.deleted_workspace_id,
            deleted: summary.deleted,
            remaining_workspaces: summary
                .remaining_workspaces
                .into_iter()
                .map(WorkspaceSummaryDto::from)
                .collect(),
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
            queue_recovery: QueueWorkspaceRecoveryProjectionDto::from(state.queue_recovery),
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

impl From<QueueWorkspaceRecoveryProjection> for QueueWorkspaceRecoveryProjectionDto {
    fn from(projection: QueueWorkspaceRecoveryProjection) -> Self {
        Self {
            workspace_id: projection.workspace_id,
            queue_task_count: projection.queue_task_count,
            running_task_count: projection.running_task_count,
            stale_running_candidate_count: projection.stale_running_candidate_count,
            has_visible_queue_view: projection.has_visible_queue_view,
            canonical_queue_widget_id: projection.canonical_queue_widget_id,
            control_state: projection
                .control_state
                .map(AgentQueueControlStateDto::from),
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

impl From<PersistAgentChatProposalRequest> for PersistAgentChatProposalInput {
    fn from(request: PersistAgentChatProposalRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            operator_prompt: request.operator_prompt,
            approved_context_snapshot_json: request.approved_context_snapshot_json,
            proposal: AgentChatProposalInput::from(request.proposal),
        }
    }
}

impl From<AgentChatProposalRequest> for AgentChatProposalInput {
    fn from(proposal: AgentChatProposalRequest) -> Self {
        Self {
            id: proposal.id,
            request_summary: proposal.request_summary,
            proposed_plan: proposal.proposed_plan,
            context_needed: proposal.context_needed,
            action_proposals: proposal
                .action_proposals
                .into_iter()
                .map(AgentChatProposalActionInput::from)
                .collect(),
            safety_notes: proposal.safety_notes,
            runtime_notes: proposal.runtime_notes,
        }
    }
}

impl From<AgentChatProposalActionRequest> for AgentChatProposalActionInput {
    fn from(action: AgentChatProposalActionRequest) -> Self {
        Self {
            title: action.title,
            description: action.description,
        }
    }
}

impl From<AgentChatProposalRunSummary> for PersistAgentChatProposalResponseDto {
    fn from(summary: AgentChatProposalRunSummary) -> Self {
        Self {
            run_id: summary.run_id,
            status: summary.status,
            result_id: summary.result_id,
            result_type: summary.result_type,
            summary: summary.summary,
        }
    }
}

impl From<AgentMonitoringSnapshot> for AgentMonitoringSnapshotDto {
    fn from(snapshot: AgentMonitoringSnapshot) -> Self {
        Self {
            workspace_id: snapshot.workspace_id,
            workbench_id: snapshot.workbench_id,
            proposal_results: snapshot
                .proposal_results
                .into_iter()
                .map(AgentMonitoringProposalResultDto::from)
                .collect(),
        }
    }
}

impl From<AgentMonitoringProposalResultSummary> for AgentMonitoringProposalResultDto {
    fn from(summary: AgentMonitoringProposalResultSummary) -> Self {
        Self {
            run_id: summary.run_id,
            result_id: summary.result_id,
            status: summary.status,
            result_type: summary.result_type,
            result_summary: summary.result_summary,
            result_content: summary.result_content,
            run_started_at: summary.run_started_at,
            run_finished_at: summary.run_finished_at,
            result_created_at: summary.result_created_at,
            source_widget_id: summary.source_widget_id,
            source_widget_title: summary.source_widget_title,
            runtime_status: summary.runtime_status,
            provider_status: summary.provider_status,
            provider_used: summary.provider_used,
            provider_response_received: summary.provider_response_received,
            no_llm_called: summary.no_llm_called,
            no_tools_executed: summary.no_tools_executed,
            no_mutations_performed: summary.no_mutations_performed,
            context_was_approved: summary.context_was_approved,
            operator_prompt: summary.operator_prompt,
            proposal_summary: summary.proposal_summary,
            proposed_plan: summary.proposed_plan,
            context_needed: summary.context_needed,
            approved_context_summary: summary.approved_context_summary,
            approved_context_status: summary.approved_context_status,
            approved_context_source_labels: summary.approved_context_source_labels,
            proposed_actions: summary
                .proposed_actions
                .into_iter()
                .map(AgentMonitoringProposalActionDto::from)
                .collect(),
            safety_notes: summary.safety_notes,
            raw_payload: summary.raw_payload,
        }
    }
}

impl From<AgentMonitoringProposalActionSummary> for AgentMonitoringProposalActionDto {
    fn from(action: AgentMonitoringProposalActionSummary) -> Self {
        Self {
            title: action.title,
            description: action.description,
            status: action.status,
            executed: action.executed,
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
