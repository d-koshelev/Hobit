use serde_json::{json, Value};

use super::super::*;
use super::support::*;

#[test]
fn create_setup_start_step_acceptance_creates_dependency_and_starts_only_upstream() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    enable_queue_control(&service);

    let result = service
        .execute_queue_workflow_create_setup_start_step(start_step_request(
            "dependency_acceptance_smoke",
            "request-1",
        ))
        .expect("execute start step");

    assert_eq!(
        result.status,
        QueueWorkflowCreateSetupStartStepResultStatus::Executed
    );
    assert_eq!(result.next_phase.as_deref(), Some("run_start"));
    assert_eq!(
        result.next_step.as_deref(),
        Some("awaiting_worker_completion")
    );
    assert_eq!(
        result.workflow_run.as_ref().expect("workflow").status,
        "paused"
    );
    assert_eq!(
        result
            .workflow_run
            .as_ref()
            .expect("workflow")
            .current_step
            .as_deref(),
        Some("awaiting_worker_completion")
    );
    assert_eq!(
        result
            .actions
            .create_task_upstream
            .as_ref()
            .expect("upstream action")
            .status,
        "completed"
    );
    assert_eq!(
        result
            .actions
            .create_task_downstream
            .as_ref()
            .expect("downstream action")
            .status,
        "completed"
    );
    assert_eq!(
        result
            .actions
            .update_run_settings
            .as_ref()
            .expect("settings action")
            .status,
        "completed"
    );
    assert_eq!(
        result
            .actions
            .promote_task
            .as_ref()
            .expect("promote action")
            .status,
        "completed"
    );
    assert_eq!(
        result
            .actions
            .start_worker
            .as_ref()
            .expect("start action")
            .status,
        "completed"
    );

    let upstream_id = result.task_ids_by_slot["upstream"].clone();
    let downstream_id = result.task_ids_by_slot["downstream"].clone();
    let upstream = service
        .get_agent_queue_task("workspace-1", &upstream_id)
        .expect("get upstream")
        .expect("upstream");
    let downstream = service
        .get_agent_queue_task("workspace-1", &downstream_id)
        .expect("get downstream")
        .expect("downstream");
    assert_eq!(upstream.status, "running");
    assert_eq!(downstream.status, "draft");
    assert_eq!(downstream.depends_on, vec![upstream_id.clone()]);

    let upstream_link = service
        .get_latest_agent_queue_task_run_link("workspace-1", &upstream_id)
        .expect("upstream run link")
        .expect("upstream run link");
    assert_eq!(upstream_link.status.as_str(), "running");
    assert_eq!(
        result.run_ids_by_slot.get("upstream").map(String::as_str),
        Some(upstream_link.direct_work_run_id.as_str())
    );
    let launch_intent = result
        .worker_launch_intent
        .as_ref()
        .expect("new queue-local start exposes internal launch intent");
    assert_eq!(
        launch_intent.launch_disposition,
        QueueWorkflowWorkerLaunchDisposition::NewlyStarted
    );
    assert_eq!(launch_intent.workspace_id.as_str(), "workspace-1");
    assert_eq!(launch_intent.queue_task_id.as_str(), upstream_id.as_str());
    assert_eq!(
        launch_intent.run_id.as_str(),
        upstream_link.direct_work_run_id.as_str()
    );
    assert_eq!(
        launch_intent.run_link_id.as_deref(),
        Some(upstream_link.link_id.as_str())
    );
    assert_eq!(launch_intent.executor_target_kind, "queue_local");
    assert_eq!(launch_intent.provider_id, "codex");
    assert_eq!(
        launch_intent.direct_work_input.widget_instance_id.as_str(),
        QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    );
    assert_eq!(
        launch_intent.started_by_workflow_run_id.as_str(),
        result.workflow_run_id.as_deref().expect("workflow run id")
    );
    assert!(
        service
            .get_latest_agent_queue_task_run_link("workspace-1", &downstream_id)
            .expect("downstream run link")
            .is_none(),
        "downstream must not be auto-started"
    );
    assert!(
        service
            .store
            .get_widget_run(&upstream_link.direct_work_run_id)
            .expect("widget run read")
            .is_none(),
        "backend-owned queue_local start must not create a widget_run"
    );
    assert_downstream_not_mutated(&service, &downstream_id);

    let workflow_run_id = result.workflow_run_id.as_deref().expect("workflow run id");
    let actions = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", workflow_run_id)
        .expect("actions");
    assert_eq!(actions.len(), 5);
    assert_eq!(
        actions
            .iter()
            .filter(|action| action.action_type == "start_worker")
            .count(),
        1
    );
}

#[test]
fn create_setup_start_step_failure_workflow_uses_same_backend_path() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    enable_queue_control(&service);

    let result = service
        .execute_queue_workflow_create_setup_start_step(start_step_request(
            "dependency_failure_smoke",
            "request-1",
        ))
        .expect("execute failure start step");

    assert_eq!(
        result.status,
        QueueWorkflowCreateSetupStartStepResultStatus::Executed
    );
    assert!(result.run_ids_by_slot.contains_key("upstream"));
    assert!(!result.run_ids_by_slot.contains_key("downstream"));
    assert_eq!(
        result
            .downstream_verification
            .expect("downstream verification")
            .downstream_not_started,
        true
    );
}

#[test]
fn create_setup_start_step_reuses_same_request_hash_and_conflicts_on_different_hash() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    enable_queue_control(&service);

    let first = service
        .execute_queue_workflow_create_setup_start_step(start_step_request(
            "dependency_acceptance_smoke",
            "request-1",
        ))
        .expect("first execute");
    let duplicate = service
        .execute_queue_workflow_create_setup_start_step(start_step_request(
            "dependency_acceptance_smoke",
            "request-1",
        ))
        .expect("duplicate execute");
    let conflict = service
        .execute_queue_workflow_create_setup_start_step(changed_prompt_request())
        .expect("conflict execute");

    assert_eq!(
        duplicate.status,
        QueueWorkflowCreateSetupStartStepResultStatus::AlreadyApplied,
        "duplicate blockers: {:?}",
        duplicate.blockers
    );
    assert_eq!(duplicate.workflow_run_id, first.workflow_run_id);
    assert!(duplicate.worker_launch_intent.is_none());
    assert_eq!(
        conflict.status,
        QueueWorkflowCreateSetupStartStepResultStatus::Conflict
    );
    assert!(conflict.worker_launch_intent.is_none());
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "request_id_hash_conflict"
    );
}

#[test]
fn create_setup_start_step_blocks_disabled_queue_control_before_worker_run() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");

    let result = service
        .execute_queue_workflow_create_setup_start_step(start_step_request(
            "dependency_acceptance_smoke",
            "request-1",
        ))
        .expect("execute blocked start step");

    assert_eq!(
        result.status,
        QueueWorkflowCreateSetupStartStepResultStatus::BlockedPrecondition
    );
    assert_eq!(result.blockers[0].blocker_code, "blocked_control_disabled");
    assert!(result.worker_launch_intent.is_none());
    assert_eq!(
        result
            .actions
            .start_worker
            .as_ref()
            .expect("start action")
            .status,
        "blocked"
    );
    assert!(result.run_ids_by_slot.is_empty());
    let upstream_id = result.task_ids_by_slot["upstream"].clone();
    let upstream = service
        .get_agent_queue_task("workspace-1", &upstream_id)
        .expect("get upstream")
        .expect("upstream");
    assert_eq!(upstream.status, "queued");
    assert!(
        service
            .get_latest_agent_queue_task_run_link("workspace-1", &upstream_id)
            .expect("run link")
            .is_none(),
        "disabled Queue control must block before worker start"
    );
}

fn start_step_request(
    workflow_id: &str,
    request_id: &str,
) -> QueueWorkflowCreateSetupStartStepRequest {
    QueueWorkflowCreateSetupStartStepRequest {
        workspace_id: "workspace-1".to_owned(),
        workflow_run_id: None,
        workflow_id: workflow_id.to_owned(),
        request_id: request_id.to_owned(),
        actor_id: Some("workspace-agent".to_owned()),
        inputs: Some(start_step_inputs("Read visible context.")),
        grant_summary: Some(json!({
            "actorId": "workspace-agent",
            "mode": "queue_acceptance_smoke",
            "constraints": {
                "noDownstreamAutoStart": true,
                "noGit": true,
                "noTerminal": true,
                "noValidationExecution": true
            },
            "scope": {"workflow": workflow_id},
            "maxActions": 16
        })),
        confirmation_token: Some("operator-confirmed".to_owned()),
        expected_version: None,
    }
}

fn changed_prompt_request() -> QueueWorkflowCreateSetupStartStepRequest {
    QueueWorkflowCreateSetupStartStepRequest {
        inputs: Some(start_step_inputs("Changed visible context.")),
        ..start_step_request("dependency_acceptance_smoke", "request-1")
    }
}

fn start_step_inputs(upstream_prompt: &str) -> Value {
    json!({
        "runSettings": {
            "approvalPolicy": "never",
            "codexExecutable": "codex",
            "executionPolicy": "manual",
            "executionTarget": {
                "kind": "queue_local",
                "providerId": "codex"
            },
            "sandbox": "workspace_write",
            "workspaceRoot": std::env::current_dir()
                .expect("current dir")
                .to_string_lossy()
                .into_owned()
        },
        "tasks": [
            {
                "slot": "upstream",
                "title": "Inspect contract",
                "prompt": upstream_prompt,
                "dependsOnSlots": []
            },
            {
                "slot": "downstream",
                "title": "Apply follow-up",
                "prompt": "Use the upstream result.",
                "dependsOnSlots": ["upstream"]
            }
        ]
    })
}

fn enable_queue_control(service: &WorkspaceService) {
    service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: "workspace-1".to_owned(),
            status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned(),
            actor_id: Some("test".to_owned()),
            reason: Some("test enable".to_owned()),
            expected_version: None,
        })
        .expect("enable queue control");
}

fn assert_downstream_not_mutated(service: &WorkspaceService, downstream_id: &str) {
    assert!(
        service
            .store
            .list_agent_queue_review_messages("workspace-1", downstream_id)
            .expect("review messages")
            .is_empty(),
        "downstream review must not be created"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_worker_evidence_bundle("workspace-1", downstream_id)
            .expect("evidence")
            .is_none(),
        "downstream evidence must not be recorded"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_completion_decision("workspace-1", downstream_id)
            .expect("completion decision")
            .is_none(),
        "downstream completion must not be recorded"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_failure_decision("workspace-1", downstream_id)
            .expect("failure decision")
            .is_none(),
        "downstream failure must not be recorded"
    );
}
