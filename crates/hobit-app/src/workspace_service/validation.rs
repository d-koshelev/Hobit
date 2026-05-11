use hobit_storage_sqlite::{
    SqliteStore, StorageError, WidgetInstanceRow, WidgetRunRow, WorkspaceRow, WorkspaceWorkbenchRow,
};

use crate::WorkspaceServiceError;

use super::{
    WidgetInstanceLayout, MAX_WIDGET_LAYOUT_DIMENSION, WIDGET_LAYOUT_MODE_DOCKED,
    WIDGET_LAYOUT_MODE_MINIMIZED, WIDGET_LAYOUT_MODE_POPPED_OUT,
};

pub(super) fn required_input<'a>(
    value: &'a str,
    label: &str,
) -> Result<&'a str, WorkspaceServiceError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must not be empty"
        )));
    }

    Ok(value)
}

pub(super) fn validate_json_state(state: &str) -> Result<(), WorkspaceServiceError> {
    serde_json::from_str::<serde_json::Value>(state).map_err(|error| {
        WorkspaceServiceError::InvalidInput(format!("widget state must be valid JSON: {error}"))
    })?;
    Ok(())
}

pub(super) fn validate_widget_instance_layout(
    mut layout: WidgetInstanceLayout,
) -> Result<WidgetInstanceLayout, WorkspaceServiceError> {
    let layout_mode = required_input(&layout.layout_mode, "widget layout mode")?.to_owned();
    match layout_mode.as_str() {
        WIDGET_LAYOUT_MODE_DOCKED
        | WIDGET_LAYOUT_MODE_POPPED_OUT
        | WIDGET_LAYOUT_MODE_MINIMIZED => {}
        _ => {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "unsupported widget layout mode: {layout_mode}"
            )));
        }
    }
    layout.layout_mode = layout_mode;

    validate_dimension("dock_width", layout.dock_width)?;
    validate_dimension("dock_height", layout.dock_height)?;
    validate_dimension("popout_width", layout.popout_width)?;
    validate_dimension("popout_height", layout.popout_height)?;

    if layout.dock_width.is_none() || layout.dock_height.is_none() {
        return Err(WorkspaceServiceError::InvalidInput(
            "dock dimensions are required".to_owned(),
        ));
    }

    if layout.layout_mode == WIDGET_LAYOUT_MODE_POPPED_OUT
        && (layout.popout_width.is_none() || layout.popout_height.is_none())
    {
        return Err(WorkspaceServiceError::InvalidInput(
            "popout dimensions are required for popped_out layout".to_owned(),
        ));
    }

    if layout.always_on_top && layout.layout_mode != WIDGET_LAYOUT_MODE_POPPED_OUT {
        return Err(WorkspaceServiceError::InvalidInput(
            "always_on_top is only valid for popped_out layout".to_owned(),
        ));
    }

    Ok(layout)
}

fn validate_dimension(label: &str, dimension: Option<i64>) -> Result<(), WorkspaceServiceError> {
    let Some(dimension) = dimension else {
        return Ok(());
    };

    if dimension <= 0 {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must be positive"
        )));
    }

    if dimension > MAX_WIDGET_LAYOUT_DIMENSION {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must be no greater than {MAX_WIDGET_LAYOUT_DIMENSION}"
        )));
    }

    Ok(())
}

pub(super) fn validate_widget_ownership(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    widget_instance_id: &str,
) -> Result<Option<(WorkspaceRow, WorkspaceWorkbenchRow, WidgetInstanceRow)>, StorageError> {
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

    Ok(Some((workspace, workbench, widget)))
}

pub(super) fn validate_widget_run_ownership(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    widget_instance_id: &str,
    run_id: &str,
) -> Result<
    Option<(
        WorkspaceRow,
        WorkspaceWorkbenchRow,
        WidgetInstanceRow,
        WidgetRunRow,
    )>,
    StorageError,
> {
    let Some((workspace, workbench, widget)) =
        validate_widget_ownership(store, workspace_id, workbench_id, widget_instance_id)?
    else {
        return Ok(None);
    };

    let Some(run) = store.get_widget_run(run_id)? else {
        return Ok(None);
    };

    if run.widget_instance_id != widget.id {
        return Ok(None);
    }

    Ok(Some((workspace, workbench, widget, run)))
}
