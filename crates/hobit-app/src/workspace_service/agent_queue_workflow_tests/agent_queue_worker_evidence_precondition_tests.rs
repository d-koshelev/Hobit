use hobit_storage_sqlite::{
    AgentQueueTaskUpdate, NewAgentQueueCompletionDecision, NewAgentQueueFailureDecision,
    NewAgentQueueReviewMessage, NewAgentQueueTask, NewAgentQueueTaskRunLink,
    NewAgentQueueWorkerEvidenceBundle, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun,
    NewWidgetInstance, NewWidgetRun, SqliteStore,
};
use serde_json::{json, Value};

use super::super::agent_queue_workflow::canonical_json_string;
use super::super::*;
use super::support::*;

#[test]
fn worker_evidence_step_blocks_expected_precondition_with_canonical_action() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_queue_local_run_link_without_widget_run(
        &store,
        "workspace-1",
        "task-1",
        "queue-local-run-mismatch",
        "queue-local-link-mismatch",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence-blocked-step",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(
            r#"{"upstream":{"executionTargetHash":"execution-target-hash-1","executionTargetKind":"queue_local","providerId":"codex","runId":"queue-local-run-mismatch","settingsHash":"settings-hash-1","taskId":"task-1"}}"#,
        ),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-evidence-blocked-step",
        "start-worker-evidence-blocked-step",
        "task-1",
        Some("upstream"),
        "queue-local-run-mismatch",
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_worker_evidence_step(workflow_evidence_request(
            "workflow-run-evidence-blocked-step",
            "upstream",
            "task-1",
            "queue-local-run-mismatch",
            "failed",
        ))
        .expect("plan mismatch");
    assert!(!plan.executable);
    assert_eq!(plan.blockers[0].blocker_code, "worker_outcome_mismatch");

    let result = service
        .execute_queue_workflow_worker_evidence_step(workflow_evidence_request(
            "workflow-run-evidence-blocked-step",
            "upstream",
            "task-1",
            "queue-local-run-mismatch",
            "failed",
        ))
        .expect("execute mismatch");

    assert_eq!(
        result.status,
        QueueWorkflowWorkerEvidenceStepResultStatus::BlockedPrecondition
    );
    assert_eq!(result.blockers[0].blocker_code, "worker_outcome_mismatch");
    let action = result.action.expect("blocked action");
    assert_eq!(action.action_type, "record_worker_evidence");
    assert_eq!(action.status, QueueWorkflowActionStatus::Blocked.as_str());
    assert_eq!(
        action.blocker_code.as_deref(),
        Some("worker_outcome_mismatch")
    );
    assert!(service
        .store
        .get_agent_queue_worker_evidence_bundle("workspace-1", "task-1", "queue-local-run-mismatch")
        .expect("evidence lookup")
        .is_none());
}

#[test]
fn record_workflow_worker_evidence_blocks_missing_bindings_and_running_worker() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "running",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-ambiguous",
        "link-ambiguous",
        "queued",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-missing-run",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-running",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-ambiguous",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-ambiguous"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let missing_run = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-missing-run",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("missing run binding");
    let running = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-running",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("running worker");
    let ambiguous = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-ambiguous",
            "upstream",
            "task-1",
            "run-ambiguous",
            "completed",
        ))
        .expect("ambiguous worker");

    assert_eq!(
        missing_run.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        missing_run.blocker.unwrap().blocker_code,
        "missing_run_binding"
    );
    assert_eq!(
        running.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        running.blocker.unwrap().blocker_code,
        "worker_run_not_complete"
    );
    assert_eq!(
        ambiguous.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        ambiguous.blocker.unwrap().blocker_code,
        "worker_run_state_mismatch"
    );
}

#[test]
fn record_workflow_worker_evidence_blocks_unsafe_recovered_run_refs() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-bound",
        "link-bound",
        "completed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-recovered",
        "link-recovered",
        "completed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-requested",
        "link-requested",
        "completed",
    );
    let binding_without_run = json!({
        "upstream": {
            "executionTargetHash": "execution-target-hash-1",
            "executionTargetKind": "queue_local",
            "providerId": "codex",
            "settingsHash": "settings-hash-1",
            "taskId": "task-1"
        }
    })
    .to_string();
    let binding_with_run = json!({
        "upstream": {
            "executionTargetHash": "execution-target-hash-1",
            "executionTargetKind": "queue_local",
            "providerId": "codex",
            "runId": "run-bound",
            "settingsHash": "settings-hash-1",
            "taskId": "task-1"
        }
    })
    .to_string();
    let ambiguous_binding = json!({
        "downstream": {
            "executionTargetHash": "execution-target-hash-1",
            "settingsHash": "settings-hash-1",
            "taskId": "task-1"
        },
        "upstream": {
            "executionTargetHash": "execution-target-hash-1",
            "settingsHash": "settings-hash-1",
            "taskId": "task-1"
        }
    })
    .to_string();

    insert_resume_workflow(
        &store,
        "workflow-run-recovered-mismatch",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(&binding_without_run),
        None,
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-recovered-mismatch",
        "start-recovered-mismatch",
        "task-1",
        Some("upstream"),
        "run-recovered",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-start-mismatch",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(&binding_with_run),
        None,
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-start-mismatch",
        "start-binding-mismatch",
        "task-1",
        Some("upstream"),
        "run-recovered",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-ambiguous-start",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(&ambiguous_binding),
        None,
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-ambiguous-start",
        "start-ambiguous",
        "task-1",
        None,
        "run-recovered",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-orphan-recovered",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(&binding_without_run),
        None,
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-orphan-recovered",
        "start-orphan",
        "task-1",
        Some("upstream"),
        "run-orphan",
    );
    let service = WorkspaceService::new(store);

    let explicit_mismatch = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-recovered-mismatch",
            "upstream",
            "task-1",
            "run-requested",
            "completed",
        ))
        .expect("explicit mismatch");
    let start_mismatch = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-start-mismatch",
            "upstream",
            "task-1",
            "run-bound",
            "completed",
        ))
        .expect("start mismatch");
    let ambiguous_slot = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-ambiguous-start",
            "upstream",
            "task-1",
            "run-recovered",
            "completed",
        ))
        .expect("ambiguous slot");
    let orphan_run = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-orphan-recovered",
            "upstream",
            "task-1",
            "run-orphan",
            "completed",
        ))
        .expect("orphan run");

    assert_eq!(
        explicit_mismatch.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        explicit_mismatch.conflict.unwrap().conflict_code,
        "run_id_mismatch"
    );
    assert_eq!(
        start_mismatch.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        start_mismatch.conflict.unwrap().conflict_code,
        "run_id_mismatch"
    );
    assert_eq!(
        ambiguous_slot.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        ambiguous_slot.blocker.unwrap().blocker_code,
        "ambiguous_task_slot_binding"
    );
    assert_eq!(
        orphan_run.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(orphan_run.blocker.unwrap().blocker_code, "run_missing");
}

#[test]
fn record_workflow_worker_evidence_rejects_task_run_and_metadata_conflicts() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-2", "queued", true, None);
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
        "bundle-existing",
        "failed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-task-mismatch",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-2"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence-conflict",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-2","runId":"run-2"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let task_mismatch = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-task-mismatch",
            "upstream",
            "task-1",
            "run-2",
            "completed",
        ))
        .expect("task mismatch");
    let metadata_conflict = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence-conflict",
            "upstream",
            "task-2",
            "run-2",
            "completed",
        ))
        .expect("metadata conflict");

    assert_eq!(
        task_mismatch.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        task_mismatch.conflict.unwrap().conflict_code,
        "run_task_mismatch"
    );
    assert_eq!(
        metadata_conflict.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        metadata_conflict.conflict.unwrap().conflict_code,
        "evidence_metadata_conflict"
    );
}
