use hobit_storage_sqlite::{
    AgentQueueTaskRow, AgentQueueWorkerRow, JdbcConnectionProfileRow, JdbcConnectorRow,
    KnowledgeDocumentRow, KnowledgeDocumentSearchResultRow, SharedStateObjectRow, SkillRow,
    WidgetInstanceRow, WidgetLogRow, WidgetResultRow, WidgetRunRow, WorkbenchEventRow,
    WorkspaceNoteRow, WorkspaceRow, WorkspaceSummaryRow, WorkspaceWorkbenchRow,
};

use crate::{KnowledgeRelation, KnowledgeSourceRef};

use super::{
    AgentQueueTaskSummary, AgentQueueWorkerSummary, JdbcConnectionProfileSummary,
    JdbcConnectorSummary, KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary,
    SharedStateObjectSummary, SkillSummary, WidgetInstanceSummary, WidgetLogSummary,
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
        root_path: None,
        status: row.status.clone(),
        created_at: row.created_at.clone(),
        updated_at: row.updated_at.clone(),
        last_opened_at: None,
        widget_count: 0,
        workspace_agent_count: 0,
        note_count: 0,
        skill_count: 0,
        knowledge_document_count: 0,
        queue_task_count: 0,
        workbench_id,
    }
}

pub(super) fn workspace_summary_row(row: WorkspaceSummaryRow) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id,
        title: row.title,
        description: row.description,
        root_path: None,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_opened_at: row.last_opened_at,
        widget_count: count_to_usize(row.widget_count),
        workspace_agent_count: count_to_usize(row.workspace_agent_count),
        note_count: count_to_usize(row.note_count),
        skill_count: count_to_usize(row.skill_count),
        knowledge_document_count: count_to_usize(row.knowledge_document_count),
        queue_task_count: count_to_usize(row.queue_task_count),
        workbench_id: row.workbench_id,
    }
}

fn count_to_usize(count: i64) -> usize {
    usize::try_from(count).unwrap_or(0)
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

pub(super) fn skill_summary(row: SkillRow) -> SkillSummary {
    SkillSummary {
        skill_id: row.skill_id,
        workspace_id: row.workspace_id,
        title: row.title,
        when_to_use: row.when_to_use,
        prerequisites: row.prerequisites,
        steps: row.steps,
        validation: row.validation,
        risks: row.risks,
        tags: row.tags,
        review_status: row.review_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

pub(super) fn knowledge_document_summary(row: KnowledgeDocumentRow) -> KnowledgeDocumentSummary {
    let source_refs = parse_json_vec::<KnowledgeSourceRef>(&row.source_refs).unwrap_or_else(|| {
        vec![KnowledgeSourceRef::from_legacy_fields(
            &row.source_kind,
            &row.source_ref,
            row.source_label.clone(),
        )]
    });
    let relations = parse_json_vec::<KnowledgeRelation>(&row.relations).unwrap_or_default();

    KnowledgeDocumentSummary {
        knowledge_document_id: row.knowledge_document_id,
        workspace_id: row.workspace_id,
        scope: row.scope,
        catalog_item_type: row.catalog_item_type,
        quick_summary: row.quick_summary,
        lifecycle_status: row.lifecycle_status,
        title: row.title,
        source_label: row.source_label,
        source_kind: row.source_kind,
        source_ref: row.source_ref,
        source_refs,
        relations,
        content: row.content,
        tags: row.tags,
        enabled: row.enabled,
        searchable: row.searchable,
        version: row.version,
        version_summary: row.version_summary,
        created_at: row.created_at,
        updated_at: row.updated_at,
        reviewed_at: row.reviewed_at,
        created_by_task_id: row.created_by_task_id,
        created_from_run_id: row.created_from_run_id,
    }
}

pub(super) fn knowledge_document_search_result_summary(
    row: KnowledgeDocumentSearchResultRow,
    snippet: String,
) -> KnowledgeDocumentSearchResultSummary {
    KnowledgeDocumentSearchResultSummary {
        knowledge_document_id: row.knowledge_document_id,
        document_title: row.document_title,
        scope: row.scope,
        source_label: row.source_label,
        tags: row.tags,
        chunk_id: row.chunk_id,
        chunk_index: row.chunk_index,
        snippet,
        score: row.score,
    }
}

pub(super) fn jdbc_connector_summary(row: JdbcConnectorRow) -> JdbcConnectorSummary {
    JdbcConnectorSummary {
        connector_id: row.connector_id,
        workspace_id: row.workspace_id,
        display_name: row.display_name,
        database_kind: row.database_kind,
        driver_kind: row.driver_kind,
        jdbc_url_masked: row.jdbc_url_masked,
        environment: row.environment,
        read_only_default: row.read_only_default,
        status: row.status,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_used_at: row.last_used_at,
    }
}

pub(super) fn jdbc_connection_profile_summary(
    row: JdbcConnectionProfileRow,
) -> JdbcConnectionProfileSummary {
    JdbcConnectionProfileSummary {
        profile_id: row.profile_id,
        workspace_id: row.workspace_id,
        name: row.name,
        driver_jar_path: row.driver_jar_path,
        driver_class_name: row.driver_class_name,
        jdbc_url: row.jdbc_url,
        username: row.username,
        password_env_var_name: row.password_env_var_name,
        max_rows: usize::try_from(row.max_rows).unwrap_or(0),
        timeout_ms: u64::try_from(row.timeout_ms).unwrap_or(0),
        max_result_bytes: usize::try_from(row.max_result_bytes).unwrap_or(0),
        read_only: row.read_only,
        description: row.description,
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
        depends_on: parse_json_vec::<String>(&row.depends_on).unwrap_or_default(),
        execution_policy: row.execution_policy,
        execution_workspace: row.execution_workspace,
        codex_executable: row.codex_executable,
        sandbox: row.sandbox,
        approval_policy: row.approval_policy,
        context_json: row.context_json,
        assigned_executor_widget_id: row.assigned_executor_widget_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

pub(super) fn agent_queue_worker_summary(row: AgentQueueWorkerRow) -> AgentQueueWorkerSummary {
    AgentQueueWorkerSummary {
        worker_id: row.worker_id,
        workspace_id: row.workspace_id,
        name: row.name,
        enabled: row.enabled,
        scope_kind: row.scope_kind,
        queue_tag_id: row.queue_tag_id,
        queue_tag_name: row.queue_tag_name,
        display_order: row.display_order,
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

fn parse_json_vec<T>(raw: &str) -> Option<Vec<T>>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_str::<Vec<T>>(raw).ok()
}
