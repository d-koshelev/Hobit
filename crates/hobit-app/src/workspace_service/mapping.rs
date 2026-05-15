use hobit_storage_sqlite::{
    AgentQueueTaskRow, SharedStateObjectRow, WidgetInstanceRow, WidgetLogRow, WidgetResultRow,
    WidgetRunRow, WorkbenchEventRow, WorkspaceNoteRow, WorkspaceRow, WorkspaceSummaryRow,
    WorkspaceWorkbenchRow,
};

use super::{
    AgentQueueTaskSummary, SharedStateObjectSummary, WidgetInstanceSummary, WidgetLogSummary,
    WidgetResultSummary, WidgetRunSummary, WorkbenchEventSummary, WorkbenchSummary,
    WorkspaceNoteSummary, WorkspaceSummary,
};

pub(super) fn workbench_summary(row: WorkspaceWorkbenchRow) -> WorkbenchSummary {
    WorkbenchSummary {
        id: row.id,
        workspace_id: row.workspace_id,
        preset_origin_id: row.preset_origin_id,
    }
}

pub(super) fn workspace_summary(
    row: &WorkspaceRow,
    workbench_id: Option<String>,
) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id.clone(),
        title: row.title.clone(),
        description: row.description.clone(),
        status: row.status.clone(),
        workbench_id,
    }
}

pub(super) fn workspace_summary_row(row: WorkspaceSummaryRow) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        workbench_id: row.workbench_id,
    }
}

pub(super) fn widget_instance_summary(row: WidgetInstanceRow) -> WidgetInstanceSummary {
    WidgetInstanceSummary {
        id: row.id,
        definition_id: row.definition_id,
        title: row.title,
        category: row.category,
        layout_mode: row.layout_mode,
        dock_x: row.dock_x,
        dock_y: row.dock_y,
        dock_width: row.dock_width,
        dock_height: row.dock_height,
        popout_x: row.popout_x,
        popout_y: row.popout_y,
        popout_width: row.popout_width,
        popout_height: row.popout_height,
        always_on_top: row.always_on_top,
        is_visible: row.is_visible,
        config: row.config,
        state: row.state,
    }
}

pub(super) fn widget_log_summary(row: WidgetLogRow) -> WidgetLogSummary {
    WidgetLogSummary {
        id: row.id,
        widget_instance_id: row.widget_instance_id,
        run_id: row.run_id,
        level: row.level,
        message: row.message,
        payload: row.details,
        created_at: row.created_at,
    }
}

pub(super) fn widget_run_summary(row: WidgetRunRow) -> WidgetRunSummary {
    WidgetRunSummary {
        id: row.id,
        widget_instance_id: row.widget_instance_id,
        status: row.status,
        command_kind: row.command_kind,
        command_payload: row.command_payload,
        started_at: row.started_at,
        finished_at: row.finished_at,
        summary: row.summary,
    }
}

pub(super) fn widget_result_summary(row: WidgetResultRow) -> WidgetResultSummary {
    WidgetResultSummary {
        id: row.id,
        run_id: row.run_id,
        status: row.status,
        result_type: row.result_type,
        summary: row.summary,
        content: row.content,
        payload: row.payload,
        created_at: row.created_at,
    }
}

pub(super) fn workspace_note_summary(row: WorkspaceNoteRow) -> WorkspaceNoteSummary {
    WorkspaceNoteSummary {
        note_id: row.note_id,
        workspace_id: row.workspace_id,
        title: row.title,
        body: row.body,
        pinned: row.pinned,
        archived: row.archived,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

pub(super) fn agent_queue_task_summary(row: AgentQueueTaskRow) -> AgentQueueTaskSummary {
    AgentQueueTaskSummary {
        queue_item_id: row.queue_item_id,
        workspace_id: row.workspace_id,
        title: row.title,
        description: row.description,
        prompt: row.prompt,
        status: row.status,
        priority: row.priority,
        assigned_executor_widget_id: row.assigned_executor_widget_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

pub(super) fn shared_state_object_summary(row: SharedStateObjectRow) -> SharedStateObjectSummary {
    SharedStateObjectSummary {
        id: row.id,
        key: row.key,
        value: row.value,
        value_kind: row.value_kind,
    }
}

pub(super) fn workbench_event_summary(row: WorkbenchEventRow) -> WorkbenchEventSummary {
    WorkbenchEventSummary {
        id: row.id,
        kind: row.kind,
        summary: row.summary,
        created_at: row.created_at,
    }
}
