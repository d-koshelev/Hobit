use std::cmp::Ordering;

use hobit_storage_sqlite::{
    AgentQueueControlStateRow, SqliteStore, StorageError, WidgetInstanceRow, WorkspaceRow,
    WorkspaceWorkbenchRow,
};

use crate::{QueueWorkspaceRecoveryProjection, WorkspaceServiceError};

use super::{
    agent_queue_lifecycle::AGENT_QUEUE_TASK_STATUS_RUNNING,
    mapping::{
        shared_state_object_summary, widget_instance_summary, workbench_event_summary,
        workbench_summary, workspace_summary,
    },
    AgentQueueControlStateSummary, AgentQueueTaskRunStatus, WorkspaceService,
    WorkspaceWorkbenchState, AGENT_QUEUE_WIDGET_DEFINITION_ID,
    QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID, WORKBENCH_STATE_RECENT_EVENT_LIMIT,
};

impl WorkspaceService {
    pub fn get_workspace_workbench_state(
        &self,
        workspace_id: &str,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let workbench = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .next();

        Ok(Some(workspace_workbench_state_from_store(
            &self.store,
            workspace,
            workbench,
        )?))
    }
}

pub(super) fn workspace_workbench_state_from_store(
    store: &SqliteStore,
    workspace: WorkspaceRow,
    workbench: Option<WorkspaceWorkbenchRow>,
) -> Result<WorkspaceWorkbenchState, StorageError> {
    let workbench_id = workbench.as_ref().map(|workbench| workbench.id.clone());
    let widget_instances = match workbench.as_ref() {
        Some(workbench) => store
            .list_widget_instances_for_workbench(&workbench.id)?
            .into_iter()
            .map(widget_instance_summary)
            .collect(),
        None => Vec::new(),
    };
    let shared_state_objects = store
        .list_shared_state_objects(&workspace.id)?
        .into_iter()
        .map(shared_state_object_summary)
        .collect();
    let recent_events = match workbench.as_ref() {
        Some(_) => store
            .list_recent_workspace_events(&workspace.id, WORKBENCH_STATE_RECENT_EVENT_LIMIT)?
            .into_iter()
            .map(workbench_event_summary)
            .collect(),
        None => Vec::new(),
    };
    let queue_recovery = queue_workspace_recovery_projection_from_store(store, &workspace.id)?;
    let mut workspace_summary = workspace_summary(&workspace, workbench_id);
    workspace_summary.queue_task_count = queue_recovery.queue_task_count;

    Ok(WorkspaceWorkbenchState {
        workspace: workspace_summary,
        workbench: workbench.map(workbench_summary),
        queue_recovery,
        widget_instances,
        shared_state_objects,
        recent_events,
    })
}

fn queue_workspace_recovery_projection_from_store(
    store: &SqliteStore,
    workspace_id: &str,
) -> Result<QueueWorkspaceRecoveryProjection, StorageError> {
    let tasks = store.list_agent_queue_tasks(workspace_id)?;
    let running_task_count = tasks
        .iter()
        .filter(|task| task.status == AGENT_QUEUE_TASK_STATUS_RUNNING)
        .count();
    let mut stale_running_candidate_count = 0;

    for task in tasks
        .iter()
        .filter(|task| task.status == AGENT_QUEUE_TASK_STATUS_RUNNING)
    {
        let has_running_queue_local_link = store
            .list_agent_queue_task_run_links(workspace_id, &task.queue_item_id)?
            .iter()
            .any(|link| {
                link.executor_widget_id == QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
                    && link.status == AgentQueueTaskRunStatus::Running.as_str()
            });

        if has_running_queue_local_link {
            stale_running_candidate_count += 1;
        }
    }

    let widgets = store.list_widget_instances(workspace_id)?;
    let queue_widgets: Vec<&WidgetInstanceRow> = widgets
        .iter()
        .filter(|widget| widget.definition_id == AGENT_QUEUE_WIDGET_DEFINITION_ID)
        .collect();
    let has_visible_queue_view = queue_widgets.iter().any(|widget| widget.is_visible);
    let canonical_queue_widget_id = queue_widgets
        .iter()
        .copied()
        .min_by(compare_queue_widget_rank)
        .map(|widget| widget.id.clone());
    let control_state = store
        .get_agent_queue_control_state(workspace_id)?
        .map(agent_queue_control_state_summary);

    Ok(QueueWorkspaceRecoveryProjection {
        workspace_id: workspace_id.to_owned(),
        queue_task_count: tasks.len(),
        running_task_count,
        stale_running_candidate_count,
        has_visible_queue_view,
        canonical_queue_widget_id,
        control_state,
    })
}

fn compare_queue_widget_rank(left: &&WidgetInstanceRow, right: &&WidgetInstanceRow) -> Ordering {
    compare_bool_desc(left.is_visible, right.is_visible)
        .then_with(|| left.created_at.cmp(&right.created_at))
        .then_with(|| compare_option_i64(left.dock_y, right.dock_y))
        .then_with(|| compare_option_i64(left.dock_x, right.dock_x))
        .then_with(|| left.id.cmp(&right.id))
}

fn compare_bool_desc(left: bool, right: bool) -> Ordering {
    match (left, right) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => Ordering::Equal,
    }
}

fn compare_option_i64(left: Option<i64>, right: Option<i64>) -> Ordering {
    left.unwrap_or(i64::MAX).cmp(&right.unwrap_or(i64::MAX))
}

fn agent_queue_control_state_summary(
    row: AgentQueueControlStateRow,
) -> AgentQueueControlStateSummary {
    AgentQueueControlStateSummary {
        workspace_id: row.workspace_id,
        status: row.status,
        version: row.version,
        updated_by_actor_id: row.updated_by_actor_id,
        reason: row.reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}
