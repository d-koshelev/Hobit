use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::agent_queue_workflow_dto::{
    AgentQueueWorkflowRunSettingsRequest, AgentQueueWorkflowTaskSpecRequest,
    RecordAgentQueueWorkflowRunnerAction,
};
use hobit_app::WorkspaceService;
use hobit_storage_sqlite::{
    NewAgentQueueTask, NewAgentQueueTaskRunLink, NewAgentQueueWorkflowAction, NewWidgetRun,
    SqliteStore,
};
use serde_json::json;

#[test]
fn workflow_commands_start_get_list_cancel_and_report() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);

    let start = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow");
    let run = start.workflow_run.expect("workflow run");

    assert_eq!(start.status, "succeeded");
    assert_eq!(run.workspace_id, workspace.id);
    assert_eq!(run.status, "created");
    assert!(run.request_hash.starts_with("fnv1a64:"));

    let get = get_agent_queue_workflow_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get workflow")
    .expect("workflow run");
    let list = list_agent_queue_workflows_blocking(
        ListAgentQueueWorkflowsRequest {
            workspace_id: workspace.id.clone(),
            status: Some("created".to_owned()),
            workflow_id: Some("dependency_acceptance_smoke".to_owned()),
        },
        db_path.clone(),
    )
    .expect("list workflows");

    assert_eq!(get.workflow_run_id, run.workflow_run_id);
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].workflow_run_id, run.workflow_run_id);

    let plan = plan_agent_queue_workflow_resume_blocking(
        PlanAgentQueueWorkflowResumeRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            expected_version: Some(run.version),
        },
        db_path.clone(),
    )
    .expect("plan resume")
    .expect("resume plan");

    assert_eq!(plan.workflow_run.workflow_run_id, run.workflow_run_id);
    assert_eq!(plan.status, "blocked_missing_task");
    assert!(plan.resume_available);
    assert_eq!(plan.blockers.len(), 1);
    assert_eq!(plan.blockers[0].blocker_code, "task_missing");

    let cancel = cancel_agent_queue_workflow_blocking(
        CancelAgentQueueWorkflowRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            actor_id: Some("operator".to_owned()),
            reason: Some("operator cancelled".to_owned()),
        },
        db_path.clone(),
    )
    .expect("cancel workflow");

    assert_eq!(cancel.status, "cancelled");
    assert_eq!(
        cancel.workflow_run.expect("cancelled run").status,
        "cancelled"
    );

    let report = get_agent_queue_workflow_report_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace.id,
            workflow_run_id: run.workflow_run_id,
        },
        db_path.clone(),
    )
    .expect("get report")
    .expect("report");

    assert!(!report.resume_available);
    assert_eq!(report.resume_status, "terminal");
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_start_command_is_idempotent_and_conflicts_on_different_hash() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);

    let first = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");
    let duplicate = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start duplicate");
    let mut changed = start_request(&workspace.id, "request-1");
    changed.inputs_snapshot = Some(json!({"taskIdsBySlot": {"upstream": "changed"}}));
    let conflict = start_agent_queue_workflow_blocking(changed, db_path.clone())
        .expect("start conflicting workflow");

    assert_eq!(duplicate.status, "already_exists");
    assert_eq!(
        duplicate
            .workflow_run
            .expect("existing workflow")
            .workflow_run_id,
        first.workflow_run_id
    );
    assert_eq!(conflict.status, "conflict");
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "request_id_hash_conflict"
    );
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_commands_enforce_workspace_isolation() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace_one = service
        .create_empty_workspace("Workspace one", None)
        .expect("create workspace one");
    let workspace_two = service
        .create_empty_workspace("Workspace two", None)
        .expect("create workspace two");
    drop(service);

    let run = start_agent_queue_workflow_blocking(
        start_request(&workspace_one.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");

    let cross_workspace_get = get_agent_queue_workflow_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace_two.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
        },
        db_path.clone(),
    )
    .expect("cross workspace get");

    assert!(cross_workspace_get.is_none());

    let cross_workspace_plan = plan_agent_queue_workflow_resume_blocking(
        PlanAgentQueueWorkflowResumeRequest {
            workspace_id: workspace_two.id,
            workflow_run_id: run.workflow_run_id,
            expected_version: None,
        },
        db_path.clone(),
    )
    .expect("cross workspace plan");

    assert!(cross_workspace_plan.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_report_command_serializes_action_ledger_without_resume_execution() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);
    let run = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");
    let store = SqliteStore::open(&db_path).expect("open store");
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-1",
            workflow_run_id: &run.workflow_run_id,
            workspace_id: &workspace.id,
            step_id: "read.aggregate",
            action_type: "queue.lifecycle.get",
            idempotency_key: "workflow-run-1:read:task-1",
            status: "completed",
            target_refs_json: Some(r#"{"taskId":"task-1"}"#),
            result_refs_json: Some(r#"{"snapshot":"bounded"}"#),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("1"),
            completed_at: Some("1"),
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("insert action");

    let report = get_agent_queue_workflow_report_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace.id,
            workflow_run_id: run.workflow_run_id,
        },
        db_path.clone(),
    )
    .expect("get report")
    .expect("report");

    assert_eq!(report.actions.len(), 1);
    assert_eq!(report.actions[0].action_type, "queue.lifecycle.get");
    assert!(report.resume_available);
    assert_eq!(report.resume_status, "plan_required");
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_record_runner_report_command_updates_only_workflow_tables() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);
    let run = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");

    let result = record_agent_queue_workflow_runner_report_blocking(
        RecordAgentQueueWorkflowRunnerReportRequest {
            workspace_id: workspace.id,
            workflow_run_id: run.workflow_run_id.clone(),
            status: "paused".to_owned(),
            phase: Some("review".to_owned()),
            current_step: Some("review_ack".to_owned()),
            pause_reason: Some("waiting_for_review_ack".to_owned()),
            blocker_reason: None,
            variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
            slot_bindings: Some(json!({"upstream": {"taskId": "task-1"}})),
            mutation_refs: Some(json!({"messageId": "message-1"})),
            idempotency_keys: Some(json!([format!(
                "{}:queue.review.createMessage:task-1:run-1",
                run.workflow_run_id
            )])),
            action_log_summary: Some(json!({"runnerStatus": "completed", "actions": 1})),
            actions: vec![RecordAgentQueueWorkflowRunnerAction {
                step_id: "review.create".to_owned(),
                action_type: "queue.review.createMessage".to_owned(),
                idempotency_key: format!(
                    "{}:queue.review.createMessage:task-1:run-1",
                    run.workflow_run_id
                ),
                status: "completed".to_owned(),
                target_refs: Some(json!({"taskId": "task-1", "runId": "run-1"})),
                result_refs: Some(json!({"messageId": "message-1", "status": "created"})),
                blocker_code: None,
                blocker_message: None,
            }],
        },
        db_path.clone(),
    )
    .expect("record runner report");

    assert_eq!(result.status, "recorded");
    assert_eq!(result.workflow_run.expect("recorded run").status, "paused");
    assert_eq!(result.actions.len(), 1);
    assert_eq!(result.actions[0].action_type, "queue.review.createMessage");
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_worker_evidence_command_records_upstream_and_serializes_result() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command evidence test", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_ref()
        .expect("workspace workbench")
        .clone();
    let executor_widget_id = add_agent_executor_widget(&service, &workspace.id, &workbench_id);
    drop(service);

    seed_completed_queue_run(
        &db_path,
        &workspace.id,
        "task-1",
        "run-1",
        "link-1",
        &executor_widget_id,
    );

    let mut request = start_request(&workspace.id, "request-evidence");
    request.phase = Some("worker_evidence".to_owned());
    request.current_step = Some("awaiting_worker_completion".to_owned());
    request.slot_bindings = Some(json!({
        "upstream": {
            "taskId": "task-1",
            "runId": "run-1",
            "executorWidgetId": executor_widget_id
        }
    }));
    let run = start_agent_queue_workflow_blocking(request, db_path.clone())
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");

    let result = record_agent_queue_workflow_worker_evidence_blocking(
        RecordAgentQueueWorkflowWorkerEvidenceRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            slot: "upstream".to_owned(),
            task_id: "task-1".to_owned(),
            run_id: "run-1".to_owned(),
            outcome: "completed".to_owned(),
            summary: Some("Worker evidence is durable.".to_owned()),
            changed_files: vec!["crates/hobit-app/src/workspace_service.rs".to_owned()],
            changed_files_summary: Some("1 file changed".to_owned()),
            validation_summary: None,
            error_summary: None,
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("4".to_owned()),
            actor_id: Some("workspace-agent".to_owned()),
            action_idempotency_key: None,
        },
        db_path.clone(),
    )
    .expect("record workflow worker evidence");

    assert_eq!(result.status, "recorded");
    let binding = result.binding.expect("binding");
    assert_eq!(binding.slot, "upstream");
    assert_eq!(binding.task_id, "task-1");
    assert_eq!(binding.run_id, "run-1");
    assert_eq!(
        binding.evidence_action_idempotency_key,
        format!(
            "{}:record_worker_evidence:upstream:task-1:run-1",
            run.workflow_run_id
        )
    );
    let evidence = result.evidence_bundle.expect("evidence bundle");
    assert_eq!(evidence.task_id, "task-1");
    assert_eq!(evidence.run_id, "run-1");
    assert_eq!(binding.evidence_bundle_id, evidence.bundle_id);
    let aggregate = result.aggregate.expect("aggregate");
    assert_eq!(aggregate.task_id, "task-1");
    assert_eq!(aggregate.evidence_state, "available");
    assert_eq!(aggregate.review_state, "awaiting_review");
    let workflow_run = result.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.phase, "worker_evidence");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
    assert!(workflow_run
        .slot_bindings_json
        .as_deref()
        .expect("slot bindings")
        .contains(&binding.evidence_bundle_id));

    remove_test_db_files(&db_path);
}

#[test]
fn workflow_setup_commands_materialize_apply_and_promote_without_ui_imports() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    let other_workspace = service
        .create_empty_workspace("Other workspace", None)
        .expect("create other workspace");
    let workbench_id = workspace
        .workbench_id
        .as_ref()
        .expect("workspace workbench")
        .clone();
    let executor_widget_id = add_agent_executor_widget(&service, &workspace.id, &workbench_id);
    drop(service);
    let run = start_agent_queue_workflow_blocking(
        materialization_start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");

    let upstream = materialize_agent_queue_workflow_task_slot_blocking(
        MaterializeAgentQueueWorkflowTaskSlotRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            slot: "upstream".to_owned(),
            task_spec: AgentQueueWorkflowTaskSpecRequest {
                title: "Upstream".to_owned(),
                prompt: "Run upstream worker.".to_owned(),
                description: None,
                status: None,
                priority: None,
            },
            task_spec_hash: None,
            depends_on_slots: vec![],
            actor_id: Some("workspace-agent".to_owned()),
            action_idempotency_key: None,
        },
        db_path.clone(),
    )
    .expect("materialize upstream");
    let upstream_binding = upstream
        .binding
        .clone()
        .unwrap_or_else(|| panic!("upstream binding missing: {upstream:?}"));
    assert_eq!(upstream.status, "created");
    assert_eq!(upstream_binding.slot, "upstream");

    let downstream = materialize_agent_queue_workflow_task_slot_blocking(
        MaterializeAgentQueueWorkflowTaskSlotRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            slot: "downstream".to_owned(),
            task_spec: AgentQueueWorkflowTaskSpecRequest {
                title: "Downstream".to_owned(),
                prompt: "Wait for upstream.".to_owned(),
                description: None,
                status: None,
                priority: None,
            },
            task_spec_hash: None,
            depends_on_slots: vec!["upstream".to_owned()],
            actor_id: Some("workspace-agent".to_owned()),
            action_idempotency_key: None,
        },
        db_path.clone(),
    )
    .expect("materialize downstream");
    let downstream_binding = downstream.binding.expect("downstream binding");
    assert_eq!(downstream.status, "created");
    assert_eq!(
        downstream_binding.dependency_task_ids,
        vec![upstream_binding.task_id.clone()]
    );

    let cross_workspace = materialize_agent_queue_workflow_task_slot_blocking(
        MaterializeAgentQueueWorkflowTaskSlotRequest {
            workspace_id: other_workspace.id,
            workflow_run_id: run.workflow_run_id.clone(),
            slot: "upstream".to_owned(),
            task_spec: AgentQueueWorkflowTaskSpecRequest {
                title: "Cross workspace".to_owned(),
                prompt: "Must not materialize.".to_owned(),
                description: None,
                status: None,
                priority: None,
            },
            task_spec_hash: None,
            depends_on_slots: vec![],
            actor_id: Some("workspace-agent".to_owned()),
            action_idempotency_key: None,
        },
        db_path.clone(),
    )
    .expect("cross workspace materialize");
    assert_eq!(cross_workspace.status, "not_found");

    let settings = apply_agent_queue_workflow_run_settings_blocking(
        ApplyAgentQueueWorkflowRunSettingsRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            slot: "upstream".to_owned(),
            task_id: Some(upstream_binding.task_id.clone()),
            run_settings: AgentQueueWorkflowRunSettingsRequest {
                execution_workspace: "C:/repo".to_owned(),
                codex_executable: "codex.cmd".to_owned(),
                sandbox: "read_only".to_owned(),
                approval_policy: "never".to_owned(),
                execution_policy: "manual".to_owned(),
                executor_widget_id: executor_widget_id.clone(),
            },
            settings_hash: None,
            actor_id: Some("workspace-agent".to_owned()),
            action_idempotency_key: None,
        },
        db_path.clone(),
    )
    .expect("apply settings");
    let settings_binding = settings.binding.expect("settings binding");
    assert_eq!(settings.status, "applied");
    assert_eq!(settings_binding.executor_widget_id, executor_widget_id);

    let promote = promote_agent_queue_workflow_task_slot_blocking(
        PromoteAgentQueueWorkflowTaskSlotRequest {
            workspace_id: workspace.id,
            workflow_run_id: run.workflow_run_id,
            slot: "upstream".to_owned(),
            task_id: Some(upstream_binding.task_id),
            task_spec_hash: upstream_binding.task_spec_hash,
            settings_hash: settings_binding.settings_hash,
            actor_id: Some("workspace-agent".to_owned()),
            action_idempotency_key: None,
        },
        db_path.clone(),
    )
    .expect("promote task");
    let promote_binding = promote.binding.expect("promote binding");
    assert_eq!(promote.status, "promoted");
    assert!(promote_binding.promoted);
    assert_eq!(promote_binding.task_status, "queued");
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_command_source_has_no_execution_or_queue_lifecycle_calls() {
    let source = include_str!("../agent_queue_workflow_commands.rs");

    for forbidden in [
        "start_assigned_agent_queue_task",
        "record_agent_queue_worker_finished",
        "create_agent_queue_review_message",
        "ack_agent_queue_review_message",
        "mark_agent_queue_item_done",
        "fail_agent_queue_item",
        "run_queue_validation",
        "validation_runner",
        "get_git_",
        "create_git_",
        "terminal_",
        "rollback",
        "shell",
        "run_codex",
    ] {
        assert!(
            !source.contains(forbidden),
            "workflow commands must not call {forbidden}"
        );
    }
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn start_request(workspace_id: &str, request_id: &str) -> StartAgentQueueWorkflowRequest {
    StartAgentQueueWorkflowRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_id: "dependency_acceptance_smoke".to_owned(),
        request_id: request_id.to_owned(),
        phase: None,
        current_step: None,
        actor_id: Some("workspace-agent".to_owned()),
        inputs_snapshot: Some(json!({
            "taskIdsBySlot": {
                "upstream": "task-upstream",
                "downstream": "task-downstream"
            }
        })),
        grant_summary: Some(json!({
            "actorId": "workspace-agent",
            "mode": "queue_acceptance_smoke",
            "allowedRiskClasses": ["read", "review"],
            "constraints": {
                "noGit": true,
                "noValidationExecution": true,
                "noRollback": true,
                "noTerminal": true,
                "noDelete": true,
                "noDownstreamAutoStart": true
            },
            "scope": {
                "taskIds": ["task-upstream", "task-downstream"]
            },
            "issuedAt": "1",
            "expiresAt": "2",
            "restartPolicy": "regrant_mutations",
            "maxActions": 16,
            "consumedActionCount": 0
        })),
        variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
        slot_bindings: Some(json!({"upstream": {"taskId": "task-upstream"}})),
        mutation_refs: Some(json!({})),
        idempotency_keys: Some(json!({})),
        action_log_summary: Some(json!([])),
    }
}

fn materialization_start_request(
    workspace_id: &str,
    request_id: &str,
) -> StartAgentQueueWorkflowRequest {
    let mut request = start_request(workspace_id, request_id);
    request.inputs_snapshot = Some(json!({}));
    request.grant_summary = Some(json!({
        "actorId": "workspace-agent",
        "mode": "queue_acceptance_smoke",
        "allowedRiskClasses": ["setup", "run_start"],
        "constraints": {
            "noGit": true,
            "noValidationExecution": true,
            "noRollback": true,
            "noTerminal": true,
            "noDelete": true,
            "noDownstreamAutoStart": true
        },
        "issuedAt": "1",
        "expiresAt": "2",
        "restartPolicy": "regrant_mutations",
        "maxActions": 16,
        "consumedActionCount": 0
    }));
    request.slot_bindings = Some(json!({}));
    request
}

fn add_agent_executor_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
) -> String {
    service
        .add_widget_instance_to_workbench(
            workspace_id,
            workbench_id,
            "agent-run",
            "Agent Executor",
            "agent",
        )
        .expect("add executor widget")
        .expect("updated workbench")
        .widget_instances
        .into_iter()
        .find(|widget| widget.definition_id == "agent-run")
        .expect("executor widget")
        .id
}

fn seed_completed_queue_run(
    db_path: &Path,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    executor_widget_id: &str,
) {
    let store = SqliteStore::open(db_path).expect("open store");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: task_id,
            workspace_id,
            title: "Upstream",
            description: "",
            prompt: "Run upstream worker.",
            status: "queued",
            priority: 1,
            depends_on: None,
            execution_policy: Some("manual"),
            execution_workspace: Some("C:/repo"),
            codex_executable: Some("codex.cmd"),
            sandbox: Some("read_only"),
            approval_policy: Some("never"),
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
    store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: executor_widget_id,
            status: "completed",
            command_kind: Some("codex_direct_work"),
            command_payload: Some("{}"),
            started_at: Some("2"),
            finished_at: Some("3"),
            summary: Some("Worker summary"),
        })
        .expect("insert widget run");
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id,
            workspace_id,
            queue_task_id: task_id,
            executor_widget_id,
            direct_work_run_id: run_id,
            source: "manual",
            status: "completed",
            started_at: Some("2"),
            completed_at: Some("3"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert run link");
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-workflow-command-test-{}-{nanos}.sqlite",
        std::process::id()
    ));
    path
}

fn remove_test_db_files(path: &Path) {
    let _ = std::fs::remove_file(path);
    let wal = path.with_extension("sqlite-wal");
    let shm = path.with_extension("sqlite-shm");
    let _ = std::fs::remove_file(wal);
    let _ = std::fs::remove_file(shm);
}
