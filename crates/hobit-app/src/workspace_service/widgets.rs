use hobit_storage_sqlite::{NewWidgetInstance, WidgetInstanceLayoutUpdate};

use crate::WorkspaceServiceError;

use super::{
    logs::append_widget_info_log,
    placeholder_id,
    validation::{required_input, validate_json_state, validate_widget_instance_layout},
    workbenches::workspace_workbench_state_from_store,
    WidgetInstanceLayout, WorkspaceService, WorkspaceWorkbenchState, PLACEHOLDER_WIDGET_CONFIG,
    PLACEHOLDER_WIDGET_DOCK_GAP, PLACEHOLDER_WIDGET_DOCK_HEIGHT, PLACEHOLDER_WIDGET_DOCK_WIDTH,
    PLACEHOLDER_WIDGET_DOCK_X, PLACEHOLDER_WIDGET_LAYOUT_MODE, PLACEHOLDER_WIDGET_STATE,
    WIDGET_LOG_LAYOUT_UPDATED, WIDGET_LOG_STATE_SAVED, WIDGET_LOG_WIDGET_ADDED,
};

impl WorkspaceService {
    pub fn add_widget_instance_to_workbench(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        definition_id: &str,
        title: &str,
        category: &str,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let definition_id = required_input(definition_id, "widget definition id")?;
        let title = required_input(title, "widget title")?;
        let category = required_input(category, "widget category")?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(workspace_id)? else {
                    return Ok(None);
                };

                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == workbench_id)
                else {
                    return Ok(None);
                };

                let existing_widget_count = store
                    .list_widget_instances_for_workbench(&workbench.id)?
                    .len();
                let widget_id = placeholder_id("wid_");
                let widget = store.insert_widget_instance(NewWidgetInstance {
                    id: &widget_id,
                    workspace_id: &workspace.id,
                    workbench_id: &workbench.id,
                    definition_id,
                    title,
                    category,
                    layout_mode: PLACEHOLDER_WIDGET_LAYOUT_MODE,
                    dock_x: Some(PLACEHOLDER_WIDGET_DOCK_X),
                    dock_y: Some(next_placeholder_widget_dock_y(existing_widget_count)),
                    dock_width: Some(PLACEHOLDER_WIDGET_DOCK_WIDTH),
                    dock_height: Some(PLACEHOLDER_WIDGET_DOCK_HEIGHT),
                    popout_x: None,
                    popout_y: None,
                    popout_width: None,
                    popout_height: None,
                    always_on_top: false,
                    is_visible: true,
                    config: Some(PLACEHOLDER_WIDGET_CONFIG),
                    state: Some(PLACEHOLDER_WIDGET_STATE),
                })?;

                append_widget_info_log(store, &widget.id, WIDGET_LOG_WIDGET_ADDED)?;

                let event_payload = format!(
                    "workbench_id={};widget_instance_id={};definition_id={}",
                    workbench.id, widget.id, widget.definition_id
                );
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    &workspace.id,
                    "widget_instance_added",
                    "Widget instance added",
                    Some(&event_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                let state =
                    workspace_workbench_state_from_store(store, workspace, Some(workbench))?;
                Ok(Some(state))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn update_widget_instance_state(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        state: &str,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        validate_json_state(state)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(workspace_id)? else {
                    return Ok(None);
                };

                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == workbench_id)
                else {
                    return Ok(None);
                };

                let Some(widget) = store.get_widget_instance(widget_instance_id)? else {
                    return Ok(None);
                };

                if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
                    return Ok(None);
                }

                store.update_widget_instance_state(&widget.id, state)?;

                append_widget_info_log(store, &widget.id, WIDGET_LOG_STATE_SAVED)?;

                let event_payload = format!(
                    "workbench_id={};widget_instance_id={}",
                    workbench.id, widget.id
                );
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    &workspace.id,
                    "widget_state_updated",
                    "Widget state updated",
                    Some(&event_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                let state =
                    workspace_workbench_state_from_store(store, workspace, Some(workbench))?;
                Ok(Some(state))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn update_widget_instance_layout(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        layout: WidgetInstanceLayout,
    ) -> Result<Option<WorkspaceWorkbenchState>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let layout = validate_widget_instance_layout(layout)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(workspace_id)? else {
                    return Ok(None);
                };

                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == workbench_id)
                else {
                    return Ok(None);
                };

                let Some(widget) = store.get_widget_instance(widget_instance_id)? else {
                    return Ok(None);
                };

                if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
                    return Ok(None);
                }

                store.update_widget_instance_layout(
                    &widget.id,
                    WidgetInstanceLayoutUpdate {
                        layout_mode: &layout.layout_mode,
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
                    },
                )?;

                append_widget_info_log(store, &widget.id, WIDGET_LOG_LAYOUT_UPDATED)?;

                let event_payload = format!(
                    "workbench_id={};widget_instance_id={};layout_mode={}",
                    workbench.id, widget.id, layout.layout_mode
                );
                store.append_workbench_event(
                    &placeholder_id("evt_"),
                    &workspace.id,
                    "widget_layout_updated",
                    "Widget layout updated",
                    Some(&event_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                let state =
                    workspace_workbench_state_from_store(store, workspace, Some(workbench))?;
                Ok(Some(state))
            })
            .map_err(WorkspaceServiceError::from)
    }
}

fn next_placeholder_widget_dock_y(existing_widget_count: usize) -> i64 {
    existing_widget_count as i64 * (PLACEHOLDER_WIDGET_DOCK_HEIGHT + PLACEHOLDER_WIDGET_DOCK_GAP)
}
