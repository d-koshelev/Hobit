use hobit_storage_sqlite::{
    NewAgentQueueTask, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun, SqliteStore,
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

    assert!(!report.resume_available);
    assert_eq!(report.resume_status, "not_implemented");
    assert_eq!(report.actions.len(), 1);
    assert_eq!(report.actions[0].action_type, "queue.lifecycle.get");
}
