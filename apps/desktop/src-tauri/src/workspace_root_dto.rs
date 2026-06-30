use hobit_app::{WorkspaceDeletionSummary, WorkspaceSummary, WorkspaceWorkbenchState};

use crate::workspace_dto::{
    QueueWorkspaceRecoveryProjectionDto, SharedStateObjectSummaryDto, WidgetInstanceSummaryDto,
    WorkbenchEventSummaryDto, WorkbenchSummaryDto, WorkspaceDeletionResponseDto,
    WorkspaceSummaryDto, WorkspaceWorkbenchStateDto,
};

pub(crate) fn summary(
    summary: WorkspaceSummary,
    fallback_root_path: Option<&str>,
) -> WorkspaceSummaryDto {
    WorkspaceSummaryDto {
        id: summary.id,
        title: summary.title,
        description: summary.description,
        root_path: summary
            .root_path
            .or_else(|| fallback_root_path.and_then(normalize_workspace_root)),
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

pub(crate) fn summaries(
    summaries: Vec<WorkspaceSummary>,
    fallback_root_path: Option<&str>,
) -> Vec<WorkspaceSummaryDto> {
    summaries
        .into_iter()
        .map(|workspace| summary(workspace, fallback_root_path))
        .collect()
}

pub(crate) fn optional_summary(
    summary: Option<WorkspaceSummary>,
    fallback_root_path: Option<&str>,
) -> Option<WorkspaceSummaryDto> {
    summary.map(|summary| self::summary(summary, fallback_root_path))
}

pub(crate) fn deletion(
    summary: WorkspaceDeletionSummary,
    fallback_root_path: Option<&str>,
) -> WorkspaceDeletionResponseDto {
    WorkspaceDeletionResponseDto {
        deleted_workspace_id: summary.deleted_workspace_id,
        deleted: summary.deleted,
        remaining_workspaces: summaries(summary.remaining_workspaces, fallback_root_path),
    }
}

pub(crate) fn workbench_state(
    state: WorkspaceWorkbenchState,
    fallback_root_path: Option<&str>,
) -> WorkspaceWorkbenchStateDto {
    WorkspaceWorkbenchStateDto {
        workspace: summary(state.workspace, fallback_root_path),
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

pub(crate) fn optional_workbench_state(
    state: Option<WorkspaceWorkbenchState>,
    fallback_root_path: Option<&str>,
) -> Option<WorkspaceWorkbenchStateDto> {
    state.map(|state| workbench_state(state, fallback_root_path))
}

fn normalize_workspace_root(value: &str) -> Option<String> {
    let trimmed = value.trim();

    if trimmed.is_empty() || trimmed == "~" || trimmed == "." {
        return None;
    }

    Some(trimmed.to_owned())
}
