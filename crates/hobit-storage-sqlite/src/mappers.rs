//! rusqlite row mapping helpers.

use rusqlite::Result;

use crate::rows::{
    AgentQueueCompletionDecisionRow, AgentQueueControlStateRow, AgentQueueFailureDecisionRow,
    AgentQueueItemRow, AgentQueueReviewMessageRow, AgentQueueTaskRow, AgentQueueTaskRunLinkRow,
    AgentQueueWorkerEvidenceBundleRow, AgentQueueWorkerRow, AgentQueueWorkflowActionRow,
    AgentQueueWorkflowRunRow, JdbcConnectionProfileRow, JdbcConnectorRow,
    KnowledgeDocumentChunkRow, KnowledgeDocumentRow, KnowledgeDraftReviewRecordRow,
    SharedStateObjectRow, SkillRow, WidgetInstanceRow, WidgetLogRow, WidgetResultRow, WidgetRunRow,
    WorkbenchEventRow, WorkspaceNoteRow, WorkspaceRow, WorkspaceSessionRow, WorkspaceSummaryRow,
    WorkspaceWorkbenchRow,
};

pub(crate) fn workspace_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceRow> {
    Ok(WorkspaceRow {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        root_path: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

pub(crate) fn workspace_summary_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceSummaryRow> {
    Ok(WorkspaceSummaryRow {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        root_path: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        last_opened_at: row.get(7)?,
        widget_count: row.get(8)?,
        workspace_agent_count: row.get(9)?,
        note_count: row.get(10)?,
        skill_count: row.get(11)?,
        knowledge_document_count: row.get(12)?,
        queue_task_count: row.get(13)?,
        workbench_id: row.get(14)?,
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
        depends_on: row.get(7)?,
        execution_policy: row.get(8)?,
        execution_workspace: row.get(9)?,
        codex_executable: row.get(10)?,
        sandbox: row.get(11)?,
        approval_policy: row.get(12)?,
        context_json: row.get(13)?,
        assigned_executor_widget_id: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

pub(crate) fn agent_queue_task_run_link_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueTaskRunLinkRow> {
    Ok(AgentQueueTaskRunLinkRow {
        link_id: row.get(0)?,
        workspace_id: row.get(1)?,
        queue_task_id: row.get(2)?,
        executor_widget_id: row.get(3)?,
        direct_work_run_id: row.get(4)?,
        source: row.get(5)?,
        status: row.get(6)?,
        started_at: row.get(7)?,
        completed_at: row.get(8)?,
        validation_status: row.get(9)?,
        review_status: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub(crate) fn agent_queue_review_message_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueReviewMessageRow> {
    Ok(AgentQueueReviewMessageRow {
        message_id: row.get(0)?,
        workspace_id: row.get(1)?,
        queue_task_id: row.get(2)?,
        run_id: row.get(3)?,
        run_link_id: row.get(4)?,
        actor_id: row.get(5)?,
        message_body: row.get(6)?,
        status: row.get(7)?,
        created_at: row.get(8)?,
        acked_at: row.get(9)?,
        ack_actor_id: row.get(10)?,
        metadata_json: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub(crate) fn agent_queue_worker_evidence_bundle_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueWorkerEvidenceBundleRow> {
    Ok(AgentQueueWorkerEvidenceBundleRow {
        bundle_id: row.get(0)?,
        workspace_id: row.get(1)?,
        queue_task_id: row.get(2)?,
        run_id: row.get(3)?,
        run_link_id: row.get(4)?,
        executor_widget_id: row.get(5)?,
        worker_id: row.get(6)?,
        source: row.get(7)?,
        outcome: row.get(8)?,
        summary: row.get(9)?,
        changed_files_json: row.get(10)?,
        changed_files_count: row.get(11)?,
        changed_files_summary: row.get(12)?,
        validation_summary: row.get(13)?,
        error_summary: row.get(14)?,
        metadata_json: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

pub(crate) fn agent_queue_completion_decision_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueCompletionDecisionRow> {
    Ok(AgentQueueCompletionDecisionRow {
        decision_id: row.get(0)?,
        workspace_id: row.get(1)?,
        queue_task_id: row.get(2)?,
        run_id: row.get(3)?,
        run_link_id: row.get(4)?,
        review_message_id: row.get(5)?,
        actor_id: row.get(6)?,
        decision: row.get(7)?,
        reason: row.get(8)?,
        metadata_json: row.get(9)?,
        created_at: row.get(10)?,
    })
}

pub(crate) fn agent_queue_failure_decision_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueFailureDecisionRow> {
    Ok(AgentQueueFailureDecisionRow {
        decision_id: row.get(0)?,
        workspace_id: row.get(1)?,
        queue_task_id: row.get(2)?,
        run_id: row.get(3)?,
        run_link_id: row.get(4)?,
        evidence_bundle_id: row.get(5)?,
        review_message_id: row.get(6)?,
        actor_id: row.get(7)?,
        decision: row.get(8)?,
        reason: row.get(9)?,
        metadata_json: row.get(10)?,
        created_at: row.get(11)?,
    })
}

pub(crate) fn agent_queue_worker_row(row: &rusqlite::Row<'_>) -> Result<AgentQueueWorkerRow> {
    Ok(AgentQueueWorkerRow {
        worker_id: row.get(0)?,
        workspace_id: row.get(1)?,
        name: row.get(2)?,
        enabled: i64_to_bool(row.get(3)?),
        scope_kind: row.get(4)?,
        queue_tag_id: row.get(5)?,
        queue_tag_name: row.get(6)?,
        display_order: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

pub(crate) fn agent_queue_control_state_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueControlStateRow> {
    Ok(AgentQueueControlStateRow {
        workspace_id: row.get(0)?,
        status: row.get(1)?,
        version: row.get(2)?,
        updated_by_actor_id: row.get(3)?,
        reason: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

pub(crate) fn agent_queue_workflow_run_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueWorkflowRunRow> {
    Ok(AgentQueueWorkflowRunRow {
        workflow_run_id: row.get(0)?,
        workspace_id: row.get(1)?,
        workflow_id: row.get(2)?,
        request_id: row.get(3)?,
        request_hash: row.get(4)?,
        status: row.get(5)?,
        phase: row.get(6)?,
        current_step: row.get(7)?,
        pause_reason: row.get(8)?,
        blocker_reason: row.get(9)?,
        actor_id: row.get(10)?,
        inputs_snapshot_json: row.get(11)?,
        grant_summary_json: row.get(12)?,
        variables_json: row.get(13)?,
        slot_bindings_json: row.get(14)?,
        mutation_refs_json: row.get(15)?,
        idempotency_keys_json: row.get(16)?,
        action_log_summary_json: row.get(17)?,
        version: row.get(18)?,
        schema_version: row.get(19)?,
        created_at: row.get(20)?,
        updated_at: row.get(21)?,
        completed_at: row.get(22)?,
    })
}

pub(crate) fn agent_queue_workflow_action_row(
    row: &rusqlite::Row<'_>,
) -> Result<AgentQueueWorkflowActionRow> {
    Ok(AgentQueueWorkflowActionRow {
        action_id: row.get(0)?,
        workflow_run_id: row.get(1)?,
        workspace_id: row.get(2)?,
        step_id: row.get(3)?,
        action_type: row.get(4)?,
        idempotency_key: row.get(5)?,
        status: row.get(6)?,
        target_refs_json: row.get(7)?,
        result_refs_json: row.get(8)?,
        blocker_code: row.get(9)?,
        blocker_message: row.get(10)?,
        attempt_count: row.get(11)?,
        started_at: row.get(12)?,
        completed_at: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
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

pub(crate) fn skill_row(row: &rusqlite::Row<'_>) -> Result<SkillRow> {
    Ok(SkillRow {
        skill_id: row.get(0)?,
        workspace_id: row.get(1)?,
        title: row.get(2)?,
        when_to_use: row.get(3)?,
        prerequisites: row.get(4)?,
        steps: row.get(5)?,
        validation: row.get(6)?,
        risks: row.get(7)?,
        tags: row.get(8)?,
        review_status: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub(crate) fn knowledge_document_row(row: &rusqlite::Row<'_>) -> Result<KnowledgeDocumentRow> {
    Ok(KnowledgeDocumentRow {
        knowledge_document_id: row.get(0)?,
        workspace_id: row.get(1)?,
        scope: row.get(2)?,
        catalog_item_type: row.get(3)?,
        quick_summary: row.get(4)?,
        lifecycle_status: row.get(5)?,
        title: row.get(6)?,
        source_label: row.get(7)?,
        source_kind: row.get(8)?,
        source_ref: row.get(9)?,
        source_refs: row.get(10)?,
        relations: row.get(11)?,
        content: row.get(12)?,
        tags: row.get(13)?,
        enabled: i64_to_bool(row.get(14)?),
        searchable: i64_to_bool(row.get(15)?),
        version: row.get(16)?,
        version_summary: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
        reviewed_at: row.get(20)?,
        created_by_task_id: row.get(21)?,
        created_from_run_id: row.get(22)?,
    })
}

pub(crate) fn knowledge_document_chunk_row(
    row: &rusqlite::Row<'_>,
) -> Result<KnowledgeDocumentChunkRow> {
    Ok(KnowledgeDocumentChunkRow {
        chunk_id: row.get(0)?,
        knowledge_document_id: row.get(1)?,
        workspace_id: row.get(2)?,
        scope: row.get(3)?,
        chunk_index: row.get(4)?,
        text: row.get(5)?,
        created_at: row.get(6)?,
    })
}

pub(crate) fn knowledge_draft_review_record_row(
    row: &rusqlite::Row<'_>,
) -> Result<KnowledgeDraftReviewRecordRow> {
    Ok(KnowledgeDraftReviewRecordRow {
        review_id: row.get(0)?,
        workspace_id: row.get(1)?,
        draft_pack_id: row.get(2)?,
        source_fingerprint: row.get(3)?,
        source_queue_item_id: row.get(4)?,
        source_run_id: row.get(5)?,
        proposed_item_id: row.get(6)?,
        proposed_item_key: row.get(7)?,
        action: row.get(8)?,
        reviewed_at: row.get(9)?,
        accepted_knowledge_document_id: row.get(10)?,
        accepted_skill_id: row.get(11)?,
        rejection_reason: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

pub(crate) fn jdbc_connector_row(row: &rusqlite::Row<'_>) -> Result<JdbcConnectorRow> {
    Ok(JdbcConnectorRow {
        connector_id: row.get(0)?,
        workspace_id: row.get(1)?,
        display_name: row.get(2)?,
        database_kind: row.get(3)?,
        driver_kind: row.get(4)?,
        jdbc_url_masked: row.get(5)?,
        environment: row.get(6)?,
        read_only_default: i64_to_bool(row.get(7)?),
        status: row.get(8)?,
        notes: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        last_used_at: row.get(12)?,
    })
}

pub(crate) fn jdbc_connection_profile_row(
    row: &rusqlite::Row<'_>,
) -> Result<JdbcConnectionProfileRow> {
    Ok(JdbcConnectionProfileRow {
        profile_id: row.get(0)?,
        workspace_id: row.get(1)?,
        name: row.get(2)?,
        driver_jar_path: row.get(3)?,
        driver_class_name: row.get(4)?,
        jdbc_url: row.get(5)?,
        username: row.get(6)?,
        password_env_var_name: row.get(7)?,
        max_rows: row.get(8)?,
        timeout_ms: row.get(9)?,
        max_result_bytes: row.get(10)?,
        read_only: i64_to_bool(row.get(11)?),
        description: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
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
