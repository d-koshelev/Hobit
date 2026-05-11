use hobit_storage_sqlite::{SqliteStore, StorageError, WorkspaceRow, WorkspaceWorkbenchRow};

use crate::WorkspaceServiceError;

use super::{
    mapping::{
        shared_state_object_summary, widget_instance_summary, workbench_event_summary,
        workbench_summary, workspace_summary,
    },
    WorkspaceService, WorkspaceWorkbenchState, WORKBENCH_STATE_RECENT_EVENT_LIMIT,
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

    Ok(WorkspaceWorkbenchState {
        workspace: workspace_summary(&workspace, workbench_id),
        workbench: workbench.map(workbench_summary),
        widget_instances,
        shared_state_objects,
        recent_events,
    })
}
