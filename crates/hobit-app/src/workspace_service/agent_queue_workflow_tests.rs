use hobit_storage_sqlite::{
    AgentQueueTaskUpdate, NewAgentQueueCompletionDecision, NewAgentQueueFailureDecision,
    NewAgentQueueReviewMessage, NewAgentQueueTask, NewAgentQueueTaskRunLink,
    NewAgentQueueWorkerEvidenceBundle, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun,
    NewWidgetInstance, NewWidgetRun, SqliteStore,
};
use serde_json::{json, Value};

use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(service: &WorkspaceService, workspace_id: &str) {
    service
        .store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_workspace_in_store(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn start_request(workspace_id: &str, request_id: &str) -> QueueWorkflowStartRequest {
    QueueWorkflowStartRequest {
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
            "consumedActionCount": 0,
            "ignoredUnsafeField": "not persisted"
        })),
        variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
        slot_bindings: Some(json!({"upstream": {"taskId": "task-upstream"}})),
        mutation_refs: Some(json!({})),
        idempotency_keys: Some(json!({})),
        action_log_summary: Some(json!([])),
    }
}

#[test]
fn start_queue_workflow_creates_persisted_workflow_run() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");

    let result = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow");
    let workflow_run = result.workflow_run.expect("workflow run");

    assert_eq!(result.status, QueueWorkflowStartStatus::Succeeded);
    assert_eq!(workflow_run.workspace_id, "workspace-1");
    assert_eq!(workflow_run.workflow_id, "dependency_acceptance_smoke");
    assert_eq!(workflow_run.status, "created");
    assert_eq!(workflow_run.phase, "intake");
    assert_eq!(workflow_run.current_step.as_deref(), Some("created"));
    assert_eq!(workflow_run.version, 1);
    assert_eq!(workflow_run.schema_version, 1);
    assert!(workflow_run.request_hash.starts_with("fnv1a64:"));
    assert!(workflow_run
        .grant_summary_json
        .as_deref()
        .expect("grant summary")
        .contains("queue_acceptance_smoke"));
    assert!(!workflow_run
        .grant_summary_json
        .as_deref()
        .expect("grant summary")
        .contains("ignoredUnsafeField"));
}

#[test]
fn start_queue_workflow_is_idempotent_for_same_request_hash() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");

    let first = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("first workflow run");
    let second = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start duplicate workflow");

    assert_eq!(second.status, QueueWorkflowStartStatus::AlreadyExists);
    assert_eq!(
        second
            .workflow_run
            .expect("existing workflow")
            .workflow_run_id,
        first.workflow_run_id
    );
}

#[test]
fn start_queue_workflow_same_request_id_different_hash_conflicts() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow");

    let mut request = start_request("workspace-1", "request-1");
    request.inputs_snapshot = Some(json!({"taskIdsBySlot": {"upstream": "changed"}}));
    let conflict = service
        .start_queue_workflow(request)
        .expect("start conflicting workflow");

    assert_eq!(conflict.status, QueueWorkflowStartStatus::Conflict);
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "request_id_hash_conflict"
    );
}

#[test]
fn same_request_id_is_allowed_in_different_workspaces() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    create_workspace(&service, "workspace-2");

    let first = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start first workflow");
    let second = service
        .start_queue_workflow(start_request("workspace-2", "request-1"))
        .expect("start second workflow");

    assert_eq!(first.status, QueueWorkflowStartStatus::Succeeded);
    assert_eq!(second.status, QueueWorkflowStartStatus::Succeeded);
}

#[test]
fn request_hash_is_stable_across_json_key_ordering() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let mut first = start_request("workspace-1", "request-1");
    first.inputs_snapshot = Some(serde_json::from_str(r#"{"b":2,"a":1}"#).expect("json"));
    let mut second = start_request("workspace-1", "request-1");
    second.inputs_snapshot = Some(serde_json::from_str(r#"{"a":1,"b":2}"#).expect("json"));

    let first = service
        .start_queue_workflow(first)
        .expect("start first")
        .workflow_run
        .expect("first run");
    let second = service.start_queue_workflow(second).expect("start second");

    assert_eq!(second.status, QueueWorkflowStartStatus::AlreadyExists);
    assert_eq!(
        second.workflow_run.expect("existing run").request_hash,
        first.request_hash
    );
}

#[test]
fn start_queue_workflow_rejects_confirmation_token_in_grant_summary() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let mut request = start_request("workspace-1", "request-1");
    request.grant_summary = Some(json!({
        "mode": "queue_acceptance_smoke",
        "confirmationToken": "operator-confirmed"
    }));

    let result = service
        .start_queue_workflow(request)
        .expect("start workflow");

    assert_eq!(result.status, QueueWorkflowStartStatus::InvalidInput);
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "confirmation_token_not_persistable"
    );
}

#[test]
fn start_queue_workflow_rejects_oversized_json_fields() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let oversized = Value::String("x".repeat(MAX_WORKFLOW_INPUTS_JSON_BYTES + 1));

    for (field, request) in [
        {
            let mut request = start_request("workspace-1", "inputs-too-large");
            request.inputs_snapshot = Some(oversized.clone());
            ("inputsSnapshot", request)
        },
        {
            let mut request = start_request("workspace-1", "grant-too-large");
            request.grant_summary =
                Some(json!({"mode": "x".repeat(MAX_WORKFLOW_GRANT_SUMMARY_JSON_BYTES + 1)}));
            ("grantSummary", request)
        },
        {
            let mut request = start_request("workspace-1", "variables-too-large");
            request.variables = Some(oversized.clone());
            ("variables", request)
        },
        {
            let mut request = start_request("workspace-1", "slots-too-large");
            request.slot_bindings = Some(oversized.clone());
            ("slotBindings", request)
        },
        {
            let mut request = start_request("workspace-1", "mutations-too-large");
            request.mutation_refs = Some(oversized.clone());
            ("mutationRefs", request)
        },
        {
            let mut request = start_request("workspace-1", "idempotency-too-large");
            request.idempotency_keys = Some(oversized.clone());
            ("idempotencyKeys", request)
        },
        {
            let mut request = start_request("workspace-1", "actions-too-large");
            request.action_log_summary = Some(oversized.clone());
            ("actionLogSummary", request)
        },
    ] {
        let result = service
            .start_queue_workflow(request)
            .expect("start workflow");
        assert_eq!(result.status, QueueWorkflowStartStatus::InvalidInput);
        assert_eq!(
            result
                .blocker
                .expect("blocker")
                .missing_required_field
                .as_deref(),
            Some(field)
        );
    }
}

#[test]
fn get_and_list_queue_workflow_runs_are_workspace_scoped() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    create_workspace(&service, "workspace-2");
    let run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("run");
    service
        .start_queue_workflow(start_request("workspace-2", "request-1"))
        .expect("start other workflow");

    let fetched = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: run.workflow_run_id.clone(),
        })
        .expect("get run")
        .expect("run");
    let cross_workspace = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-2".to_owned(),
            workflow_run_id: run.workflow_run_id,
        })
        .expect("get cross-workspace run");
    let listed = service
        .list_queue_workflow_runs(QueueWorkflowListRequest {
            workspace_id: "workspace-1".to_owned(),
            status: Some("created".to_owned()),
            workflow_id: Some("dependency_acceptance_smoke".to_owned()),
        })
        .expect("list workflow runs");

    assert_eq!(fetched.workspace_id, "workspace-1");
    assert!(cross_workspace.is_none());
    assert_eq!(listed.len(), 1);
}

#[test]
fn cancel_queue_workflow_run_is_non_destructive_and_idempotent() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("run");

    let cancelled = service
        .cancel_queue_workflow_run(QueueWorkflowCancelRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: run.workflow_run_id.clone(),
            actor_id: Some("operator".to_owned()),
            reason: Some("operator stopped workflow".to_owned()),
        })
        .expect("cancel workflow");
    let cancelled_again = service
        .cancel_queue_workflow_run(QueueWorkflowCancelRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: run.workflow_run_id,
            actor_id: Some("operator".to_owned()),
            reason: None,
        })
        .expect("cancel workflow again");

    assert_eq!(cancelled.status, QueueWorkflowCancelStatus::Cancelled);
    assert_eq!(
        cancelled.workflow_run.expect("cancelled run").status,
        "cancelled"
    );
    assert_eq!(
        cancelled_again.status,
        QueueWorkflowCancelStatus::AlreadyCancelled
    );
    assert!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list queue tasks")
            .is_empty(),
        "workflow cancel must not create or mutate Queue tasks"
    );
}

#[test]
fn cancel_queue_workflow_run_rejects_completed_and_failed_runs() {
    for (status, expected) in [
        ("completed", QueueWorkflowCancelStatus::AlreadyTerminal),
        ("failed", QueueWorkflowCancelStatus::AlreadyTerminal),
    ] {
        let store = initialized_store();
        create_workspace_in_store(&store, "workspace-1");
        store
            .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
                workflow_run_id: "workflow-run-1",
                workspace_id: "workspace-1",
                workflow_id: "dependency_acceptance_smoke",
                request_id: "request-1",
                request_hash: "hash-1",
                status,
                phase: "closed",
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
                completed_at: Some("1"),
            })
            .expect("insert terminal workflow run");
        let service = WorkspaceService::new(store);

        let result = service
            .cancel_queue_workflow_run(QueueWorkflowCancelRequest {
                workspace_id: "workspace-1".to_owned(),
                workflow_run_id: "workflow-run-1".to_owned(),
                actor_id: None,
                reason: None,
            })
            .expect("cancel terminal workflow");

        assert_eq!(result.status, expected);
    }
}

#[test]
fn workflow_failed_status_is_workflow_execution_failure_not_queue_task_failure() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Task",
            description: "",
            prompt: "Prompt",
            status: "queued",
            priority: 1,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id: "workflow-run-failed",
            workspace_id: "workspace-1",
            workflow_id: "dependency_acceptance_smoke",
            request_id: "request-1",
            request_hash: "hash-1",
            status: QueueWorkflowRunStatus::Failed.as_str(),
            phase: "closed",
            current_step: None,
            pause_reason: None,
            blocker_reason: Some("workflow crashed"),
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
            completed_at: Some("1"),
        })
        .expect("insert failed workflow");
    let service = WorkspaceService::new(store);

    let workflow = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-failed".to_owned(),
        })
        .expect("get workflow")
        .expect("workflow");
    let aggregate = service
        .get_queue_item_aggregate("workspace-1", "task-1")
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(workflow.status, "failed");
    assert_ne!(aggregate.ticket_state.as_str(), "failure");
    assert!(!aggregate.durable_flags.failure_state);
}

#[test]
fn queue_workflow_report_returns_persisted_actions_and_no_resume_execution() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id: "workflow-run-1",
            workspace_id: "workspace-1",
            workflow_id: "dependency_acceptance_smoke",
            request_id: "request-1",
            request_hash: "hash-1",
            status: "created",
            phase: "intake",
            current_step: Some("created"),
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
        })
        .expect("insert workflow");
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-1",
            workflow_run_id: "workflow-run-1",
            workspace_id: "workspace-1",
            step_id: "read.aggregate",
            action_type: "queue.lifecycle.get",
            idempotency_key: "workflow-run-1:read:task-1",
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(r#"{"taskId":"task-1"}"#),
            result_refs_json: Some(r#"{"snapshot":"bounded"}"#),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("2"),
            completed_at: Some("2"),
            created_at: Some("2"),
            updated_at: Some("2"),
        })
        .expect("insert action");
    let service = WorkspaceService::new(store);

    let report = service
        .get_queue_workflow_report(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-1".to_owned(),
        })
        .expect("get report")
        .expect("report");

    assert!(report.resume_available);
    assert_eq!(report.resume_status, "plan_required");
    assert_eq!(report.actions.len(), 1);
    assert_eq!(report.actions[0].action_type, "queue.lifecycle.get");
    assert!(report
        .report_summary
        .contains("Persisted workflow actions: 1"));
}

#[test]
fn record_runner_report_updates_only_workflow_run_and_action_ledger() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review_create_ready"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_runner_report(runner_report_request("workspace-1", "workflow-run-1"))
        .expect("record runner report");
    let workflow_run = result.workflow_run.expect("workflow run");

    assert_eq!(
        result.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "review");
    assert_eq!(workflow_run.current_step.as_deref(), Some("review_ack"));
    assert!(workflow_run
        .action_log_summary_json
        .as_deref()
        .expect("action summary")
        .contains("review_ack"));
    assert_eq!(result.actions.len(), 1);
    assert_eq!(result.actions[0].action_type, "queue.review.createMessage");
    assert_eq!(
        service
            .store
            .list_agent_queue_review_messages("workspace-1", "task-1")
            .expect("list review messages")
            .len(),
        0,
        "report persistence must not create review messages"
    );
    assert!(service
        .store
        .get_latest_agent_queue_completion_decision("workspace-1", "task-1")
        .expect("latest completion")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_failure_decision("workspace-1", "task-1")
        .expect("latest failure")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_worker_evidence_bundle("workspace-1", "task-1")
        .expect("latest evidence")
        .is_none());
}

#[test]
fn record_runner_report_action_ledger_is_idempotent_and_conflicts_on_changed_refs() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");
    let request = runner_report_request("workspace-1", &workflow_run.workflow_run_id);

    let first = service
        .record_queue_workflow_runner_report(request.clone())
        .expect("record first");
    let duplicate = service
        .record_queue_workflow_runner_report(request.clone())
        .expect("record duplicate");
    let mut changed = request;
    changed.actions[0].target_refs = Some(json!({"taskId": "changed"}));
    let conflict = service
        .record_queue_workflow_runner_report(changed)
        .expect("record conflict");

    assert_eq!(
        first.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(
        duplicate.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(duplicate.actions.len(), 1);
    assert_eq!(
        conflict.status,
        QueueWorkflowRecordRunnerReportStatus::Conflict
    );
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "workflow_action_idempotency_conflict"
    );
}

#[test]
fn record_runner_report_rejects_confirmation_token_and_oversized_json() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");
    let mut token_request = runner_report_request("workspace-1", &workflow_run.workflow_run_id);
    token_request.action_log_summary = Some(json!({"confirmationToken": "operator-confirmed"}));
    let mut oversized_request = runner_report_request("workspace-1", &workflow_run.workflow_run_id);
    oversized_request.action_log_summary = Some(Value::String(
        "x".repeat(MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES + 1),
    ));

    let token_result = service
        .record_queue_workflow_runner_report(token_request)
        .expect("record token");
    let oversized_result = service
        .record_queue_workflow_runner_report(oversized_request)
        .expect("record oversized");

    assert_eq!(
        token_result.status,
        QueueWorkflowRecordRunnerReportStatus::InvalidInput
    );
    assert_eq!(
        token_result.blocker.expect("token blocker").blocker_code,
        "confirmation_token_not_persistable"
    );
    assert_eq!(
        oversized_result.status,
        QueueWorkflowRecordRunnerReportStatus::InvalidInput
    );
    assert_eq!(
        oversized_result
            .blocker
            .expect("oversized blocker")
            .blocker_code,
        "workflow_json_too_large"
    );
}

#[test]
fn record_runner_report_is_workspace_scoped() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    create_workspace(&service, "workspace-2");
    let workflow_run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");

    let result = service
        .record_queue_workflow_runner_report(runner_report_request(
            "workspace-2",
            &workflow_run.workflow_run_id,
        ))
        .expect("record cross workspace");

    assert_eq!(
        result.status,
        QueueWorkflowRecordRunnerReportStatus::NotFound
    );
}

#[test]
fn plan_resume_reports_terminal_workflow_run_statuses() {
    for (status, expected) in [
        (
            "completed",
            QueueWorkflowResumePlanStatus::TerminalCompleted,
        ),
        ("failed", QueueWorkflowResumePlanStatus::TerminalFailed),
        (
            "cancelled",
            QueueWorkflowResumePlanStatus::TerminalCancelled,
        ),
    ] {
        let store = initialized_store();
        create_workspace_in_store(&store, "workspace-1");
        insert_resume_workflow(
            &store,
            "workflow-run-1",
            "dependency_acceptance_smoke",
            status,
            "closed",
            None,
            None,
            None,
            None,
            Some("1"),
        );
        let service = WorkspaceService::new(store);

        let plan = service
            .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
            .expect("plan resume")
            .expect("plan");

        assert_eq!(plan.status, expected);
        assert!(!plan.resume_available);
        assert_eq!(plan.terminal_status.as_deref(), Some(status));
    }
}

#[test]
fn plan_resume_created_workflow_without_slots_waits_for_explicit_task_creation() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "created",
        "intake",
        Some("created"),
        Some(r#"{"operatorText":"task-1 is mentioned only as prose"}"#),
        None,
        None,
        Some("1"),
    );
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
    );
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_task_creation_phase")
    );
    assert!(
        plan.slot_reconciliations.is_empty(),
        "planner must not infer task ids from prose-only inputs"
    );
    assert_eq!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list tasks")
            .len(),
        1,
        "planning must not create or mutate Queue tasks"
    );
}

#[test]
fn materialize_workflow_task_slot_creates_draft_task_binding_and_action() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");

    let result = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let task = result.task.expect("task");
    let action = result.action.expect("action");
    let binding = result.binding.expect("binding");

    assert_eq!(
        result.status,
        QueueWorkflowMaterializeTaskSlotStatus::Created
    );
    assert_eq!(task.status, "draft");
    assert_eq!(task.execution_policy, "manual");
    assert_eq!(task.execution_workspace, None);
    assert_eq!(task.codex_executable, None);
    assert_eq!(task.sandbox, None);
    assert_eq!(task.approval_policy, None);
    assert_eq!(task.depends_on, Vec::<String>::new());
    assert_eq!(binding.slot, "upstream");
    assert_eq!(binding.task_id, task.queue_item_id);
    assert!(binding
        .task_spec_hash
        .starts_with("queue-task-spec-fnv1a64:"));
    assert!(binding
        .dependency_spec_hash
        .starts_with("queue-dependency-spec-fnv1a64:"));
    assert!(binding
        .dependency_edge_hash
        .starts_with("queue-dependency-edge-fnv1a64:"));
    assert_eq!(action.action_type, "create_task");
    assert_eq!(action.status, "completed");

    let updated_run = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: workflow_run.workflow_run_id.clone(),
        })
        .expect("get workflow")
        .expect("workflow");
    let slot_bindings: Value = serde_json::from_str(
        updated_run
            .slot_bindings_json
            .as_deref()
            .expect("slot bindings"),
    )
    .expect("slot bindings json");
    assert_eq!(
        slot_bindings["upstream"]["taskId"].as_str(),
        Some(task.queue_item_id.as_str())
    );
    assert_eq!(
        slot_bindings["upstream"]["taskSpecHash"].as_str(),
        Some(binding.task_spec_hash.as_str())
    );
    assert!(
        slot_bindings["upstream"]["runId"].is_null(),
        "task materialization must not bind worker runs"
    );
    assert_no_queue_workflow_side_effects(&service, "workspace-1", &task.queue_item_id);
}

#[test]
fn materialize_downstream_slot_creates_dependency_edge_by_depends_on_slots() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let upstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream")
        .task
        .expect("upstream task");

    let first = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream");
    let duplicate = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream duplicate");
    let downstream = first.task.expect("downstream task");

    assert_eq!(
        first.status,
        QueueWorkflowMaterializeTaskSlotStatus::Created
    );
    assert_eq!(
        duplicate.status,
        QueueWorkflowMaterializeTaskSlotStatus::Reused
    );
    assert_eq!(
        duplicate.task.expect("duplicate task").queue_item_id,
        downstream.queue_item_id
    );
    assert_eq!(downstream.depends_on, vec![upstream.queue_item_id.clone()]);
    assert_eq!(
        first.binding.expect("binding").dependency_task_ids,
        vec![upstream.queue_item_id]
    );

    let actions = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", &workflow_run.workflow_run_id)
        .expect("workflow actions");
    assert_eq!(actions.len(), 2);
    assert!(actions
        .iter()
        .all(|action| action.action_type == "create_task"));
}

#[test]
fn materialize_same_workflow_slot_different_spec_hash_conflicts() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");

    service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let conflict = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect changed contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("conflict");

    assert_eq!(
        conflict.status,
        QueueWorkflowMaterializeTaskSlotStatus::Conflict
    );
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "slot_task_spec_hash_conflict"
    );
}

#[test]
fn materialize_same_slot_spec_in_different_workflows_is_not_global_dedupe() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let first_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let second_run = start_materialization_workflow(&service, "workspace-1", "request-2");

    let first = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &first_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("first materialization")
        .task
        .expect("first task");
    let second = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &second_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("second materialization")
        .task
        .expect("second task");

    assert_ne!(first.queue_item_id, second.queue_item_id);
}

#[test]
fn materialize_downstream_missing_upstream_binding_blocks_without_task_creation() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");

    let result = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("blocked downstream");

    assert_eq!(
        result.status,
        QueueWorkflowMaterializeTaskSlotStatus::Blocked
    );
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "missing_upstream_slot_binding"
    );
    assert!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list tasks")
            .is_empty(),
        "blocked dependency materialization must not create a Queue task"
    );
}

#[test]
fn materialize_create_task_action_conflicting_refs_rejected_without_task_creation() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let (_, _, task_spec_hash, _) =
        super::agent_queue_workflow_materialization::normalize_queue_workflow_task_spec_for_hash(
            QueueWorkflowTaskSpec {
                title: "Inspect contract".to_owned(),
                prompt: "Read the visible contract and summarize blockers.".to_owned(),
                description: None,
                status: None,
                priority: None,
            },
            vec![],
        )
        .expect("hash task spec");
    let idempotency_key = format!(
        "{}:create_task:upstream:{}",
        workflow_run.workflow_run_id, task_spec_hash
    );
    service
        .store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "conflicting-action",
            workflow_run_id: &workflow_run.workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "create_task",
            action_type: "create_task",
            idempotency_key: &idempotency_key,
            status: "completed",
            target_refs_json: Some(r#"{"slot":"upstream","taskSpecHash":"different"}"#),
            result_refs_json: Some(r#"{"taskId":"other"}"#),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("1"),
            completed_at: Some("1"),
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("insert conflicting action");

    let result = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("conflict");

    assert_eq!(
        result.status,
        QueueWorkflowMaterializeTaskSlotStatus::Conflict
    );
    assert_eq!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list tasks")
            .len(),
        0,
        "conflicting ledger refs must block before task creation"
    );
}

#[test]
fn plan_resume_blocks_when_materialized_dependency_edge_is_missing() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let upstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream")
        .task
        .expect("upstream task");
    let downstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream")
        .task
        .expect("downstream task");
    service
        .store
        .update_agent_queue_task(
            "workspace-1",
            &downstream.queue_item_id,
            AgentQueueTaskUpdate {
                title: &downstream.title,
                description: &downstream.description,
                prompt: &downstream.prompt,
                status: &downstream.status,
                priority: downstream.priority,
                depends_on: Some("[]"),
                execution_policy: Some(downstream.execution_policy.as_str()),
                execution_workspace: None,
                codex_executable: None,
                sandbox: None,
                approval_policy: None,
                context_json: None,
                updated_at: Some("edge-removed"),
            },
        )
        .expect("remove dependency edge")
        .expect("updated task");

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedDependencyEdgeMissing
    );
    assert!(plan
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "dependency_edge_missing"));
    assert_eq!(
        service
            .get_agent_queue_task("workspace-1", &downstream.queue_item_id)
            .expect("get downstream")
            .expect("downstream")
            .depends_on,
        Vec::<String>::new(),
        "resume planning must not repair dependency edges"
    );
    assert_eq!(upstream.status, "draft");
}

#[test]
fn plan_resume_blocks_missing_and_cross_workspace_tasks() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    create_workspace_in_store(&store, "workspace-2");
    create_task_row(
        &store,
        "workspace-2",
        "task-other-workspace",
        "queued",
        true,
        None,
    );
    insert_resume_workflow(
        &store,
        "workflow-run-missing",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-missing"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-mismatch",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-other-workspace"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let missing = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-missing", None))
        .expect("plan missing task")
        .expect("plan");
    let mismatch = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-mismatch", None))
        .expect("plan task mismatch")
        .expect("plan");

    assert_eq!(
        missing.status,
        QueueWorkflowResumePlanStatus::BlockedMissingTask
    );
    assert_eq!(
        missing.blockers[0].missing_required_field.as_deref(),
        Some("taskId")
    );
    assert_eq!(
        mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedStateMismatch
    );
    assert_eq!(mismatch.blockers[0].blocker_code, "task_workspace_mismatch");
}

#[test]
fn plan_resume_reconciles_run_and_evidence_binding_mismatches() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-2", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "completed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "completed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "bundle-2",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-run-mismatch",
        "dependency_acceptance_smoke",
        "running",
        "worker_evidence",
        Some("worker_evidence"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-2"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence-mismatch",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-2"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let run_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-run-mismatch",
            None,
        ))
        .expect("plan run mismatch")
        .expect("plan");
    let evidence_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-evidence-mismatch",
            None,
        ))
        .expect("plan evidence mismatch")
        .expect("plan");

    assert_eq!(
        run_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedStateMismatch
    );
    assert_eq!(run_mismatch.blockers[0].blocker_code, "run_task_mismatch");
    assert_eq!(
        evidence_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedStateMismatch
    );
    assert!(evidence_mismatch
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "evidence_task_mismatch"));
}

#[test]
fn plan_resume_blocks_missing_evidence_for_finished_run() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingEvidence
    );
    assert_eq!(plan.next_step.as_deref(), Some("worker_evidence_required"));
}

#[test]
fn plan_resume_moves_from_evidence_to_review_create_or_ack() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-2", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
        "completed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "bundle-2",
        "completed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "message-2",
        "created",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-review-create",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-review-ack",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-2","runId":"run-2","evidenceBundleId":"bundle-2","messageId":"message-2"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let create_plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-review-create",
            None,
        ))
        .expect("plan review create")
        .expect("plan");
    let ack_plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-review-ack", None))
        .expect("plan review ack")
        .expect("plan");

    assert_eq!(
        create_plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(
        create_plan.next_step.as_deref(),
        Some("review_create_ready")
    );
    assert!(create_plan.required_fresh_grant);
    assert!(create_plan.required_confirmation);
    assert_eq!(
        ack_plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingReviewAck
    );
    assert_eq!(ack_plan.next_step.as_deref(), Some("review_ack_ready"));
}

#[test]
fn plan_resume_after_ack_requires_fresh_confirmation_for_finalization() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
        "completed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "message-1",
        "acknowledged",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "decision",
        Some("decision"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1","messageId":"message-1"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(plan.next_step.as_deref(), Some("mark_done_ready"));
    assert!(plan.required_fresh_grant);
    assert!(plan.required_confirmation);
    assert!(plan
        .report_summary
        .contains("No workflow steps were executed"));
}

#[test]
fn plan_resume_recognizes_idempotent_completion_and_failure_decisions() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-done", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-failed", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "review_needed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "bundle-done",
        "completed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "bundle-failed",
        "failed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "message-done",
        "acknowledged",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "message-failed",
        "acknowledged",
    );
    create_completion_decision(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "message-done",
        "completion-1",
    );
    create_failure_decision(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "bundle-failed",
        "message-failed",
        "failure-1",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-done",
        "dependency_acceptance_smoke",
        "running",
        "decision",
        Some("decision"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-done","runId":"run-done","evidenceBundleId":"bundle-done","messageId":"message-done","completionDecisionId":"completion-1"}}"#,
        ),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-failed",
        "dependency_failure_smoke",
        "running",
        "decision",
        Some("decision"),
        Some(r#"{"failureReason":"Rejected by operator"}"#),
        Some(
            r#"{"upstream":{"taskId":"task-failed","runId":"run-failed","evidenceBundleId":"bundle-failed","messageId":"message-failed","failureDecisionId":"failure-1"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let done = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-done", None))
        .expect("plan done")
        .expect("plan");
    let failed = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-failed", None))
        .expect("plan failed")
        .expect("plan");

    assert_eq!(
        done.status,
        QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
    );
    assert_eq!(
        done.next_step.as_deref(),
        Some("completed_idempotent_acceptance")
    );
    assert_eq!(
        failed.status,
        QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
    );
    assert_eq!(
        failed.next_step.as_deref(),
        Some("completed_idempotent_failure")
    );
}

#[test]
fn plan_resume_blocks_stale_grant_and_expected_version_conflict() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
        "completed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "message-1",
        "acknowledged",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "decision",
        Some("decision"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1","messageId":"message-1"}}"#,
        ),
        Some(
            r#"{"expiresAt":"expired","scope":{"taskIds":["task-1"],"runIds":["run-1"],"evidenceBundleIds":["bundle-1"],"messageIds":["message-1"]}}"#,
        ),
        Some("3"),
    );
    let service = WorkspaceService::new(store);

    let stale = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan stale")
        .expect("plan");
    let version_conflict = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", Some(2)))
        .expect("plan version")
        .expect("plan");

    assert_eq!(
        stale.status,
        QueueWorkflowResumePlanStatus::BlockedStaleGrant
    );
    assert!(stale
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "grant_expired"));
    assert_eq!(
        version_conflict.status,
        QueueWorkflowResumePlanStatus::VersionConflict
    );
}

#[test]
fn plan_resume_does_not_mutate_workflow_or_queue_facts() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);
    let before_workflow = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-1".to_owned(),
        })
        .expect("get before")
        .expect("workflow");
    let before_task_count = service
        .list_agent_queue_tasks("workspace-1")
        .expect("list before")
        .len();

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan")
        .expect("plan");
    let after_workflow = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-1".to_owned(),
        })
        .expect("get after")
        .expect("workflow");
    let review_messages = service
        .store
        .list_agent_queue_review_messages("workspace-1", "task-1")
        .expect("list review messages");

    assert_eq!(plan.next_step.as_deref(), Some("review_create_ready"));
    assert_eq!(before_workflow.version, after_workflow.version);
    assert_eq!(
        before_task_count,
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list after")
            .len()
    );
    assert!(
        review_messages.is_empty(),
        "planning must not create review messages"
    );
}

fn plan_request(
    workspace_id: &str,
    workflow_run_id: &str,
    expected_version: Option<i64>,
) -> QueueWorkflowPlanResumeRequest {
    QueueWorkflowPlanResumeRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        expected_version,
    }
}

fn start_materialization_workflow(
    service: &WorkspaceService,
    workspace_id: &str,
    request_id: &str,
) -> QueueWorkflowRun {
    service
        .start_queue_workflow(QueueWorkflowStartRequest {
            workspace_id: workspace_id.to_owned(),
            workflow_id: "dependency_acceptance_smoke".to_owned(),
            request_id: request_id.to_owned(),
            phase: None,
            current_step: None,
            actor_id: Some("workspace-agent".to_owned()),
            inputs_snapshot: Some(json!({
                "tasks": [
                    {
                        "slot": "upstream",
                        "title": "Inspect contract",
                        "prompt": "Read the visible contract and summarize blockers.",
                        "dependsOnSlots": []
                    },
                    {
                        "slot": "downstream",
                        "title": "Implement follow-up",
                        "prompt": "Use the upstream result to implement the follow-up.",
                        "dependsOnSlots": ["upstream"]
                    }
                ]
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
                    "workflowRunId": request_id
                },
                "issuedAt": "1",
                "expiresAt": "9999999999",
                "restartPolicy": "regrant_mutations",
                "maxActions": 16,
                "consumedActionCount": 0
            })),
            variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
            slot_bindings: Some(json!({})),
            mutation_refs: Some(json!({})),
            idempotency_keys: Some(json!({})),
            action_log_summary: Some(json!([])),
        })
        .expect("start workflow")
        .workflow_run
        .expect("workflow run")
}

fn materialize_request(
    workspace_id: &str,
    workflow_run_id: &str,
    slot: &str,
    title: &str,
    prompt: &str,
    depends_on_slots: Vec<&str>,
) -> QueueWorkflowMaterializeTaskSlotRequest {
    QueueWorkflowMaterializeTaskSlotRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: slot.to_owned(),
        task_spec: QueueWorkflowTaskSpec {
            title: title.to_owned(),
            prompt: prompt.to_owned(),
            description: None,
            status: None,
            priority: None,
        },
        task_spec_hash: None,
        depends_on_slots: depends_on_slots.into_iter().map(str::to_owned).collect(),
        actor_id: Some("workspace-agent".to_owned()),
        action_idempotency_key: None,
    }
}

fn assert_no_queue_workflow_side_effects(
    service: &WorkspaceService,
    workspace_id: &str,
    task_id: &str,
) {
    assert!(
        service
            .store
            .list_agent_queue_task_run_links(workspace_id, task_id)
            .expect("list run links")
            .is_empty(),
        "task materialization must not start workers"
    );
    assert!(
        service
            .store
            .list_agent_queue_review_messages(workspace_id, task_id)
            .expect("list review messages")
            .is_empty(),
        "task materialization must not create reviews"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_worker_evidence_bundle(workspace_id, task_id)
            .expect("latest evidence")
            .is_none(),
        "task materialization must not record evidence"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_completion_decision(workspace_id, task_id)
            .expect("latest completion decision")
            .is_none(),
        "task materialization must not finalize completion"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_failure_decision(workspace_id, task_id)
            .expect("latest failure decision")
            .is_none(),
        "task materialization must not finalize failure"
    );
}

fn runner_report_request(
    workspace_id: &str,
    workflow_run_id: &str,
) -> QueueWorkflowRecordRunnerReportRequest {
    QueueWorkflowRecordRunnerReportRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        status: "paused".to_owned(),
        phase: Some("review".to_owned()),
        current_step: Some("review_ack".to_owned()),
        pause_reason: Some("waiting_for_review_ack".to_owned()),
        blocker_reason: None,
        variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
        slot_bindings: Some(json!({"upstream": {"taskId": "task-1"}})),
        mutation_refs: Some(json!({"reviewMessageId": "message-1"})),
        idempotency_keys: Some(json!([format!(
            "{workflow_run_id}:queue.review.createMessage:task-1:run-1"
        )])),
        action_log_summary: Some(json!({
            "runnerStatus": "completed",
            "currentStep": "review_ack",
            "actions": 1
        })),
        actions: vec![QueueWorkflowRecordRunnerAction {
            step_id: "review.create".to_owned(),
            action_type: "queue.review.createMessage".to_owned(),
            idempotency_key: format!("{workflow_run_id}:queue.review.createMessage:task-1:run-1"),
            status: QueueWorkflowActionStatus::Completed.as_str().to_owned(),
            target_refs: Some(json!({"taskId": "task-1", "runId": "run-1"})),
            result_refs: Some(json!({"messageId": "message-1", "status": "created"})),
            blocker_code: None,
            blocker_message: None,
        }],
    }
}

fn insert_resume_workflow(
    store: &SqliteStore,
    workflow_run_id: &str,
    workflow_id: &str,
    status: &str,
    phase: &str,
    current_step: Option<&str>,
    inputs_snapshot_json: Option<&str>,
    slot_bindings_json: Option<&str>,
    grant_summary_json: Option<&str>,
    version: Option<&str>,
) {
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id,
            workspace_id: "workspace-1",
            workflow_id,
            request_id: workflow_run_id,
            request_hash: "hash-1",
            status,
            phase,
            current_step,
            pause_reason: None,
            blocker_reason: None,
            actor_id: Some("workspace-agent"),
            inputs_snapshot_json,
            grant_summary_json,
            variables_json: Some("{}"),
            slot_bindings_json,
            mutation_refs_json: Some("{}"),
            idempotency_keys_json: Some("{}"),
            action_log_summary_json: Some("[]"),
            version: version
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(1),
            schema_version: 1,
            created_at: Some("1"),
            updated_at: Some("1"),
            completed_at: matches!(status, "completed" | "failed" | "cancelled").then_some("2"),
        })
        .expect("insert workflow run");
}

fn create_workspace_with_executor(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    executor_id: &str,
) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench(workbench_id, workspace_id, None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: executor_id,
            workspace_id,
            workbench_id,
            definition_id: "agent-run",
            title: "Agent Executor",
            category: "agent",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert executor");
}

fn create_task_row(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    status: &str,
    with_run_settings: bool,
    depends_on_json: Option<&str>,
) {
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: task_id,
            workspace_id,
            title: "Task",
            description: "",
            prompt: "Prompt",
            status,
            priority: 1,
            depends_on: depends_on_json,
            execution_policy: None,
            execution_workspace: with_run_settings.then_some("C:/workspace/project"),
            codex_executable: with_run_settings.then_some("codex"),
            sandbox: with_run_settings.then_some("workspace_write"),
            approval_policy: with_run_settings.then_some("never"),
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
}

fn create_run_link(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    status: &str,
) {
    store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: "executor-1",
            status,
            command_kind: Some("codex_direct_work"),
            command_payload: Some("{}"),
            started_at: Some("2"),
            finished_at: (status != "running").then_some("3"),
            summary: Some("Worker summary"),
        })
        .expect("insert widget run");
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id,
            workspace_id,
            queue_task_id: task_id,
            executor_widget_id: "executor-1",
            direct_work_run_id: run_id,
            source: "manual",
            status,
            started_at: Some("2"),
            completed_at: (status != "running").then_some("3"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert run link");
}

fn create_evidence(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    bundle_id: &str,
    outcome: &str,
) {
    store
        .upsert_agent_queue_worker_evidence_bundle(NewAgentQueueWorkerEvidenceBundle {
            bundle_id,
            workspace_id,
            queue_task_id: task_id,
            run_id,
            run_link_id: Some(link_id),
            executor_widget_id: Some("executor-1"),
            worker_id: Some("workspace-agent"),
            source: "workspace_agent",
            outcome,
            summary: "Worker evidence is durable.",
            changed_files_json: "[]",
            changed_files_count: 0,
            changed_files_summary: None,
            validation_summary: None,
            error_summary: None,
            metadata_json: None,
            created_at: Some("4"),
            updated_at: Some("4"),
        })
        .expect("insert evidence");
}

fn create_review_message(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    message_id: &str,
    status: &str,
) {
    store
        .insert_agent_queue_review_message(NewAgentQueueReviewMessage {
            message_id,
            workspace_id,
            queue_task_id: task_id,
            run_id: Some(run_id),
            run_link_id: Some(link_id),
            actor_id: "workspace-agent",
            message_body: "Review worker evidence.",
            status,
            created_at: Some("5"),
            acked_at: (status == "acknowledged").then_some("6"),
            ack_actor_id: (status == "acknowledged").then_some("workspace-agent"),
            metadata_json: None,
            updated_at: Some("6"),
        })
        .expect("insert review message");
}

fn create_completion_decision(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    message_id: &str,
    decision_id: &str,
) {
    store
        .insert_agent_queue_completion_decision(NewAgentQueueCompletionDecision {
            decision_id,
            workspace_id,
            queue_task_id: task_id,
            run_id: Some(run_id),
            run_link_id: Some(link_id),
            review_message_id: Some(message_id),
            actor_id: "workspace-agent",
            decision: "accepted",
            reason: Some("Accepted."),
            metadata_json: None,
            created_at: Some("7"),
        })
        .expect("insert completion decision");
}

fn create_failure_decision(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    bundle_id: &str,
    message_id: &str,
    decision_id: &str,
) {
    store
        .insert_agent_queue_failure_decision(NewAgentQueueFailureDecision {
            decision_id,
            workspace_id,
            queue_task_id: task_id,
            run_id: Some(run_id),
            run_link_id: Some(link_id),
            evidence_bundle_id: Some(bundle_id),
            review_message_id: Some(message_id),
            actor_id: "workspace-agent",
            decision: "failed",
            reason: "Rejected.",
            metadata_json: None,
            created_at: Some("7"),
        })
        .expect("insert failure decision");
}
