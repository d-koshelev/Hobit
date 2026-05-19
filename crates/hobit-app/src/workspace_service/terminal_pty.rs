use crate::WorkspaceServiceError;

use super::{
    validation::{required_input, validate_widget_ownership},
    WorkspaceService, TERMINAL_WIDGET_DEFINITION_ID,
};

impl WorkspaceService {
    pub fn validate_terminal_pty_widget_owner(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
    ) -> Result<bool, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(false);
        };

        Ok(widget.definition_id == TERMINAL_WIDGET_DEFINITION_ID)
    }
}
