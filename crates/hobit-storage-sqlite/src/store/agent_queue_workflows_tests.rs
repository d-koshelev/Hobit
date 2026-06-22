use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_workflow_run(
    store: &SqliteStore,
    workspace_id: &str,
    workflow_run_id: &str,
    request_id: &str,
    request_hash: &str,
    status: &str,
) -> AgentQueueWorkflowRunRow {
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id,
            workspace_id,
            workflow_id: "dependency_acceptance_smoke",
            request_id,
            request_hash,
            status,
            phase: "intake",
            current_step: Some("created"),
            pause_reason: None,
            blocker_reason: None,
            actor_id: Some("workspace-agent"),
            inputs_snapshot_json: Some(r#"{"taskIdsBySlot":{"upstream":"task-1"}}"#),
            grant_summary_json: Some(r#"{"mode":"queue_acceptance_smoke"}"#),
            variables_json: Some(r#"{"slots":["upstream"]}"#),
            slot_bindings_json: Some(r#"{"upstream":{"taskId":"task-1"}}"#),
            mutation_refs_json: Some("{}"),
            idempotency_keys_json: Some("{}"),
            action_log_summary_json: Some("[]"),
            version: 1,
            schema_version: 1,
            created_at: Some("1"),
            updated_at: Some("1"),
            completed_at: None,
        })
        .expect("insert workflow run")
}

fn workflow_action_input<'a>(
    workflow_run_id: &'a str,
    workspace_id: &'a str,
    idempotency_key: &'a str,
    target_refs_json: Option<&'a str>,
) -> NewAgentQueueWorkflowAction<'a> {
    NewAgentQueueWorkflowAction {
        action_id: "action-1",
        workflow_run_id,
        workspace_id,
        step_id: "review.create",
        action_type: "queue.review.createMessage",
        idempotency_key,
        status: "created",
        target_refs_json,
        result_refs_json: None,
        blocker_code: None,
        blocker_message: None,
        attempt_count: 1,
        started_at: Some("2"),
        completed_at: None,
        created_at: Some("2"),
        updated_at: Some("2"),
    }
}

fn start_worker_action_input<'a>(
    action_id: &'a str,
    workflow_run_id: &'a str,
    workspace_id: &'a str,
    idempotency_key: &'a str,
    target_refs_json: &'a str,
    result_refs_json: Option<&'a str>,
    status: &'a str,
) -> NewAgentQueueWorkflowAction<'a> {
    NewAgentQueueWorkflowAction {
        action_id,
        workflow_run_id,
        workspace_id,
        step_id: "start_worker",
        action_type: "start_worker",
        idempotency_key,
        status,
        target_refs_json: Some(target_refs_json),
        result_refs_json,
        blocker_code: None,
        blocker_message: None,
        attempt_count: 1,
        started_at: Some("2"),
        completed_at: None,
        created_at: Some("2"),
        updated_at: Some("2"),
    }
}

#[test]
fn create_get_and_list_agent_queue_workflow_runs_are_workspace_scoped() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    let run = create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "created",
    );
    create_workflow_run(
        &store,
        "workspace-2",
        "workflow-run-2",
        "request-1",
        "hash-1",
        "running",
    );

    let fetched = store
        .get_agent_queue_workflow_run("workspace-1", "workflow-run-1")
        .expect("get workflow run")
        .expect("workflow run");
    let cross_workspace = store
        .get_agent_queue_workflow_run("workspace-2", "workflow-run-1")
        .expect("get cross-workspace workflow run");
    let listed = store
        .list_agent_queue_workflow_runs("workspace-1", None, None)
        .expect("list workflow runs");

    assert_eq!(fetched, run);
    assert!(cross_workspace.is_none());
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].workflow_run_id, "workflow-run-1");
}

#[test]
fn workflow_request_id_is_unique_per_workspace() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "created",
    );
    create_workflow_run(
        &store,
        "workspace-2",
        "workflow-run-2",
        "request-1",
        "hash-1",
        "created",
    );

    let duplicate = store.insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
        workflow_run_id: "workflow-run-duplicate",
        workspace_id: "workspace-1",
        workflow_id: "dependency_acceptance_smoke",
        request_id: "request-1",
        request_hash: "hash-1",
        status: "created",
        phase: "intake",
        current_step: None,
        pause_reason: None,
        blocker_reason: None,
        actor_id: None,
        inputs_snapshot_json: None,
        grant_summary_json: None,
        variables_json: None,
        slot_bindings_json: None,
        mutation_refs_json: None,
        idempotency_keys_json: None,
        action_log_summary_json: None,
        version: 1,
        schema_version: 1,
        created_at: Some("1"),
        updated_at: Some("1"),
        completed_at: None,
    });

    assert!(duplicate.is_err());
}

#[test]
fn list_agent_queue_workflow_runs_filters_by_status_and_workflow() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "created",
    );
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-2",
        "request-2",
        "hash-2",
        "cancelled",
    );

    let created = store
        .list_agent_queue_workflow_runs(
            "workspace-1",
            Some("created"),
            Some("dependency_acceptance_smoke"),
        )
        .expect("list filtered workflow runs");

    assert_eq!(created.len(), 1);
    assert_eq!(created[0].workflow_run_id, "workflow-run-1");
}

#[test]
fn update_agent_queue_workflow_run_status_increments_version() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );

    let updated = store
        .update_agent_queue_workflow_run_status(
            "workspace-1",
            "workflow-run-1",
            AgentQueueWorkflowRunStatusUpdate {
                status: "cancelled",
                phase: Some("closed"),
                current_step: Some("cancelled"),
                pause_reason: None,
                blocker_reason: None,
                updated_at: Some("3"),
                completed_at: Some("3"),
            },
        )
        .expect("update workflow run")
        .expect("updated workflow run");

    assert_eq!(updated.status, "cancelled");
    assert_eq!(updated.phase, "closed");
    assert_eq!(updated.current_step.as_deref(), Some("cancelled"));
    assert_eq!(updated.version, 2);
    assert_eq!(updated.completed_at.as_deref(), Some("3"));
}

#[test]
fn update_agent_queue_workflow_run_report_updates_bounded_report_fields() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );

    let updated = store
        .update_agent_queue_workflow_run_report(
            "workspace-1",
            "workflow-run-1",
            AgentQueueWorkflowRunReportUpdate {
                status: "paused",
                phase: Some("review"),
                current_step: Some("review_ack"),
                pause_reason: Some("waiting_for_operator"),
                blocker_reason: None,
                variables_json: Some(r#"{"workflowId":"dependency_acceptance_smoke"}"#),
                slot_bindings_json: Some(r#"{"upstream":{"taskId":"task-1"}}"#),
                mutation_refs_json: Some(r#"{"messageId":"message-1"}"#),
                idempotency_keys_json: Some(r#"["workflow-run-1:review:create:task-1"]"#),
                action_log_summary_json: Some(r#"{"actions":1}"#),
                updated_at: Some("3"),
                completed_at: None,
            },
        )
        .expect("update workflow run report")
        .expect("updated workflow run report");

    assert_eq!(updated.status, "paused");
    assert_eq!(updated.phase, "review");
    assert_eq!(updated.current_step.as_deref(), Some("review_ack"));
    assert_eq!(
        updated.pause_reason.as_deref(),
        Some("waiting_for_operator")
    );
    assert_eq!(
        updated.mutation_refs_json.as_deref(),
        Some(r#"{"messageId":"message-1"}"#)
    );
    assert_eq!(
        updated.action_log_summary_json.as_deref(),
        Some(r#"{"actions":1}"#)
    );
    assert_eq!(updated.version, 2);
    assert_eq!(updated.completed_at, None);
}

#[test]
fn workflow_action_insert_is_idempotent_for_same_key_and_refs() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );

    let inserted = store
        .insert_agent_queue_workflow_action(workflow_action_input(
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:review:create",
            Some(r#"{"taskId":"task-1"}"#),
        ))
        .expect("insert action");
    let duplicate = store
        .insert_agent_queue_workflow_action(workflow_action_input(
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:review:create",
            Some(r#"{"taskId":"task-1"}"#),
        ))
        .expect("insert duplicate action");

    assert_eq!(duplicate, inserted);
}

#[test]
fn workflow_action_duplicate_key_conflicting_refs_is_rejected() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );
    store
        .insert_agent_queue_workflow_action(workflow_action_input(
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:review:create",
            Some(r#"{"taskId":"task-1"}"#),
        ))
        .expect("insert action");

    let conflict = store.insert_agent_queue_workflow_action(workflow_action_input(
        "workflow-run-1",
        "workspace-1",
        "workflow-run-1:review:create",
        Some(r#"{"taskId":"task-2"}"#),
    ));

    assert!(conflict.is_err());
}

#[test]
fn start_worker_action_idempotency_reuses_same_refs_and_rejects_conflicting_refs() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );
    let target_refs = r#"{"executorWidgetId":"exec-1","settingsHash":"hash-a","taskId":"task-1","workflowActionId":"action-start","workflowRunId":"workflow-run-1"}"#;
    let result_refs = r#"{"currentRunState":"running","runId":"run-1"}"#;

    let first = store
        .insert_agent_queue_workflow_action(start_worker_action_input(
            "action-start",
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:start_worker:task-1:exec-1:hash-a",
            target_refs,
            Some(result_refs),
            "completed",
        ))
        .expect("insert start worker action");
    let duplicate = store
        .insert_agent_queue_workflow_action(start_worker_action_input(
            "action-start-duplicate",
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:start_worker:task-1:exec-1:hash-a",
            target_refs,
            Some(result_refs),
            "completed",
        ))
        .expect("idempotent duplicate returns existing start action");

    assert_eq!(duplicate, first);
    assert_eq!(duplicate.result_refs_json.as_deref(), Some(result_refs));

    let conflict = store.insert_agent_queue_workflow_action(start_worker_action_input(
        "action-start-conflict",
        "workflow-run-1",
        "workspace-1",
        "workflow-run-1:start_worker:task-1:exec-1:hash-a",
        r#"{"executorWidgetId":"exec-2","settingsHash":"hash-a","taskId":"task-1","workflowActionId":"action-start","workflowRunId":"workflow-run-1"}"#,
        Some(result_refs),
        "completed",
    ));

    assert!(conflict.is_err());
}

#[test]
fn start_worker_action_update_persists_run_id_and_orphan_blocker_refs() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );
    let target_refs = r#"{"executorWidgetId":"exec-1","settingsHash":"hash-a","taskId":"task-1","workflowActionId":"action-start","workflowRunId":"workflow-run-1"}"#;
    store
        .insert_agent_queue_workflow_action(start_worker_action_input(
            "action-start",
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:start_worker:task-1:exec-1:hash-a",
            target_refs,
            None,
            "running",
        ))
        .expect("insert running start worker action");

    let result_refs = r#"{"currentRunState":"running","runId":"run-1"}"#;
    let completed = store
        .update_agent_queue_workflow_action(
            "workspace-1",
            "workflow-run-1",
            "workflow-run-1:start_worker:task-1:exec-1:hash-a",
            AgentQueueWorkflowActionUpdate {
                status: "completed",
                result_refs_json: Some(result_refs),
                blocker_code: None,
                blocker_message: None,
                attempt_count: Some(1),
                started_at: None,
                completed_at: Some("3"),
                updated_at: Some("3"),
            },
        )
        .expect("update start worker action")
        .expect("completed action");
    assert_eq!(completed.result_refs_json.as_deref(), Some(result_refs));

    let orphan = store
        .update_agent_queue_workflow_action(
            "workspace-1",
            "workflow-run-1",
            "workflow-run-1:start_worker:task-1:exec-1:hash-a",
            AgentQueueWorkflowActionUpdate {
                status: "blocked",
                result_refs_json: None,
                blocker_code: Some("orphaned_start"),
                blocker_message: Some("operator review required"),
                attempt_count: Some(1),
                started_at: None,
                completed_at: Some("4"),
                updated_at: Some("4"),
            },
        )
        .expect("update orphan blocker")
        .expect("blocked action");

    assert_eq!(orphan.status, "blocked");
    assert_eq!(orphan.result_refs_json.as_deref(), Some(result_refs));
    assert_eq!(orphan.blocker_code.as_deref(), Some("orphaned_start"));
}

#[test]
fn workflow_action_workspace_must_match_parent_run() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );

    let mismatch = store.insert_agent_queue_workflow_action(workflow_action_input(
        "workflow-run-1",
        "workspace-2",
        "workflow-run-1:review:create",
        Some(r#"{"taskId":"task-1"}"#),
    ));

    assert!(mismatch.is_err());
}

#[test]
fn workflow_action_update_and_list_round_trip() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workflow_run(
        &store,
        "workspace-1",
        "workflow-run-1",
        "request-1",
        "hash-1",
        "running",
    );
    store
        .insert_agent_queue_workflow_action(workflow_action_input(
            "workflow-run-1",
            "workspace-1",
            "workflow-run-1:review:create",
            Some(r#"{"taskId":"task-1"}"#),
        ))
        .expect("insert action");

    let updated = store
        .update_agent_queue_workflow_action(
            "workspace-1",
            "workflow-run-1",
            "workflow-run-1:review:create",
            AgentQueueWorkflowActionUpdate {
                status: "completed",
                result_refs_json: Some(r#"{"messageId":"message-1"}"#),
                blocker_code: None,
                blocker_message: None,
                attempt_count: Some(1),
                started_at: None,
                completed_at: Some("3"),
                updated_at: Some("3"),
            },
        )
        .expect("update action")
        .expect("updated action");
    let listed = store
        .list_agent_queue_workflow_actions("workspace-1", "workflow-run-1")
        .expect("list actions");

    assert_eq!(updated.status, "completed");
    assert_eq!(
        updated.result_refs_json.as_deref(),
        Some(r#"{"messageId":"message-1"}"#)
    );
    assert_eq!(listed, vec![updated]);
}
