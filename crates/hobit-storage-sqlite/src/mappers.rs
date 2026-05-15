//! rusqlite row mapping helpers.

use rusqlite::Result;

use crate::rows::{
    AgentQueueItemRow, AgentQueueTaskRow, SharedStateObjectRow, WidgetInstanceRow, WidgetLogRow,
    WidgetResultRow, WidgetRunRow, WorkbenchEventRow, WorkspaceNoteRow, WorkspaceRow,
    WorkspaceSessionRow, WorkspaceSummaryRow, WorkspaceWorkbenchRow,
};

pub(crate) fn workspace_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceRow> {
    Ok(WorkspaceRow {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub(crate) fn workspace_summary_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceSummaryRow> {
    Ok(WorkspaceSummaryRow {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        workbench_id: row.get(6)?,
    })
}

pub(crate) fn workspace_workbench_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceWorkbenchRow> {
    Ok(WorkspaceWorkbenchRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        preset_origin_id: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub(crate) fn workspace_session_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceSessionRow> {
    Ok(WorkspaceSessionRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        status: row.get(2)?,
        opened_at: row.get(3)?,
        closed_at: row.get(4)?,
        active_widget_id: row.get(5)?,
        current_focus_kind: row.get(6)?,
        current_focus_ref: row.get(7)?,
    })
}

pub(crate) fn widget_instance_row(row: &rusqlite::Row<'_>) -> Result<WidgetInstanceRow> {
    Ok(WidgetInstanceRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        workbench_id: row.get(2)?,
        definition_id: row.get(3)?,
        title: row.get(4)?,
        category: row.get(5)?,
        layout_mode: row.get(6)?,
        dock_x: row.get(7)?,
        dock_y: row.get(8)?,
        dock_width: row.get(9)?,
        dock_height: row.get(10)?,
        popout_x: row.get(11)?,
        popout_y: row.get(12)?,
        popout_width: row.get(13)?,
        popout_height: row.get(14)?,
        always_on_top: i64_to_bool(row.get(15)?),
        is_visible: i64_to_bool(row.get(16)?),
        config: row.get(17)?,
        state: row.get(18)?,
        created_at: row.get(19)?,
        updated_at: row.get(20)?,
    })
}

pub(crate) fn widget_run_row(row: &rusqlite::Row<'_>) -> Result<WidgetRunRow> {
    Ok(WidgetRunRow {
        id: row.get(0)?,
        widget_instance_id: row.get(1)?,
        status: row.get(2)?,
        command_kind: row.get(3)?,
        command_payload: row.get(4)?,
        started_at: row.get(5)?,
        finished_at: row.get(6)?,
        summary: row.get(7)?,
    })
}

pub(crate) fn widget_log_row(row: &rusqlite::Row<'_>) -> Result<WidgetLogRow> {
    Ok(WidgetLogRow {
        id: row.get(0)?,
        widget_instance_id: row.get(1)?,
        run_id: row.get(2)?,
        level: row.get(3)?,
        message: row.get(4)?,
        created_at: row.get(5)?,
        details: row.get(6)?,
    })
}

pub(crate) fn widget_result_row(row: &rusqlite::Row<'_>) -> Result<WidgetResultRow> {
    Ok(WidgetResultRow {
        id: row.get(0)?,
        run_id: row.get(1)?,
        status: row.get(2)?,
        result_type: row.get(3)?,
        summary: row.get(4)?,
        content: row.get(5)?,
        payload: row.get(6)?,
        created_at: row.get(7)?,
    })
}

pub(crate) fn agent_queue_item_row(row: &rusqlite::Row<'_>) -> Result<AgentQueueItemRow> {
    Ok(AgentQueueItemRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        workbench_id: row.get(2)?,
        source_run_id: row.get(3)?,
        source_result_id: row.get(4)?,
        source_widget_instance_id: row.get(5)?,
        title: row.get(6)?,
        status: row.get(7)?,
        payload_json: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub(crate) fn agent_queue_task_row(row: &rusqlite::Row<'_>) -> Result<AgentQueueTaskRow> {
    Ok(AgentQueueTaskRow {
        queue_item_id: row.get(0)?,
        workspace_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        prompt: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        assigned_executor_widget_id: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

pub(crate) fn workspace_note_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceNoteRow> {
    Ok(WorkspaceNoteRow {
        note_id: row.get(0)?,
        workspace_id: row.get(1)?,
        title: row.get(2)?,
        body: row.get(3)?,
        pinned: i64_to_bool(row.get(4)?),
        archived: i64_to_bool(row.get(5)?),
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub(crate) fn shared_state_object_row(row: &rusqlite::Row<'_>) -> Result<SharedStateObjectRow> {
    Ok(SharedStateObjectRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        key: row.get(2)?,
        value: row.get(3)?,
        value_kind: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

pub(crate) fn workbench_event_row(row: &rusqlite::Row<'_>) -> Result<WorkbenchEventRow> {
    Ok(WorkbenchEventRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        kind: row.get(2)?,
        summary: row.get(3)?,
        payload: row.get(4)?,
        created_at: row.get(5)?,
    })
}

pub(crate) fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn i64_to_bool(value: i64) -> bool {
    value != 0
}
