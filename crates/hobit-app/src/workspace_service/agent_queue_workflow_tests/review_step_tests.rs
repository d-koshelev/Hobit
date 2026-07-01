use hobit_storage_sqlite::{
    NewAgentQueueCompletionDecision, NewAgentQueueWorkerEvidenceBundle, NewAgentQueueWorkflowAction,
};
use serde_json::json;

use super::super::agent_queue_workflow::canonical_json_string;
use super::super::*;
use super::support::*;

const WORKFLOW_RUN_ID: &str = "queue-workflow-run-1782356549015517300_110";
const UPSTREAM_TASK_ID: &str = "queue_task_wf_8834784c4eb5ed02";
const DOWNSTREAM_TASK_ID: &str = "queue_task_wf_9f85d8606f271528";
const UPSTREAM_RUN_ID: &str = "queue-run_1782356549060510300_116";
const UPSTREAM_LINK_ID: &str = "queue-run-link-upstream";
const EVIDENCE_BUNDLE_ID: &str = "queue_worker_evidence_1782409866183479600_87";

fn review_step_request(workflow_run_id: &str) -> QueueWorkflowReviewStepRequest {
    QueueWorkflowReviewStepRequest {
        workspace_id: "workspace-1".to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: Some("upstream".to_owned()),
        actor_id: Some("workspace-agent".to_owned()),
        request_id: Some("live-failure-smoke-backend-step-clean-001".to_owned()),
        grant_summary: Some(json!({
            "constraints": {
                "noDownstreamAutoStart": true
            }
        })),
    }
}

fn setup_live_failed_review_before_mutation_shape() -> SqliteStore {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    create_task_row(
        &store,
        "workspace-1",
        UPSTREAM_TASK_ID,
        "queued",
        true,
        None,
    );
    create_task_row(
        &store,
        "workspace-1",
        DOWNSTREAM_TASK_ID,
        "queued",
        false,
        Some(&format!(r#"["{UPSTREAM_TASK_ID}"]"#)),
    );
    create_queue_local_run_link_without_widget_run(
        &store,
        "workspace-1",
        UPSTREAM_TASK_ID,
        UPSTREAM_RUN_ID,
        UPSTREAM_LINK_ID,
        "completed",
    );
    store
        .upsert_agent_queue_worker_evidence_bundle(NewAgentQueueWorkerEvidenceBundle {
            bundle_id: EVIDENCE_BUNDLE_ID,
            workspace_id: "workspace-1",
            queue_task_id: UPSTREAM_TASK_ID,
            run_id: UPSTREAM_RUN_ID,
            run_link_id: Some(UPSTREAM_LINK_ID),
            executor_widget_id: None,
            worker_id: Some("workspace-agent"),
            source: "workspace_agent",
            outcome: "completed",
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
        .expect("insert queue-local evidence");
    let slot_bindings = json!({
        "upstream": {
            "evidenceBundleId": EVIDENCE_BUNDLE_ID,
            "runId": UPSTREAM_RUN_ID,
            "taskId": UPSTREAM_TASK_ID
        },
        "downstream": {
            "dependsOnSlots": ["upstream"],
            "dependencyTaskIds": [UPSTREAM_TASK_ID],
            "taskId": DOWNSTREAM_TASK_ID
        }
    })
    .to_string();
    insert_resume_workflow(
        &store,
        WORKFLOW_RUN_ID,
        "dependency_failure_smoke",
        "failed",
        "review",
        Some("review_failed_unexpected"),
        Some(&format!(
            r#"{{"tasks":[{{"slot":"upstream","title":"Task","prompt":"Prompt"}},{{"slot":"downstream","title":"Downstream","prompt":"Prompt","dependsOnSlots":["upstream"]}}],"failureReason":"typed failure reason"}}"#
        )),
        Some(&slot_bindings),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    store
        .update_agent_queue_workflow_run_report(
            "workspace-1",
            WORKFLOW_RUN_ID,
            hobit_storage_sqlite::AgentQueueWorkflowRunReportUpdate {
                status: "failed",
                phase: Some("review"),
                current_step: Some("review_failed_unexpected"),
                pause_reason: None,
                blocker_reason: Some("Queue review workflow failed unexpectedly"),
                variables_json: Some(r#"{"messageIdsBySlot":{}}"#),
                slot_bindings_json: None,
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: Some(
                    r#"{"blockerCode":"workflow_blocker","message":"Queue review workflow failed unexpectedly"}"#,
                ),
                updated_at: Some("7"),
                completed_at: Some("7"),
            },
        )
        .expect("update failed review workflow")
        .expect("workflow updated");
    insert_completed_worker_evidence_action(&store, WORKFLOW_RUN_ID);
    insert_stale_read_action(
        &store,
        "read-lifecycle",
        "queue.lifecycle.get",
        json!({"taskId": UPSTREAM_TASK_ID}),
        json!({"status": "completed"}),
    );
    insert_stale_read_action(
        &store,
        "read-evidence",
        "queue.evidence.lookup",
        json!({"taskId": UPSTREAM_TASK_ID}),
        json!({"evidenceBundleId": EVIDENCE_BUNDLE_ID}),
    );
    store
}

fn insert_completed_worker_evidence_action(store: &SqliteStore, workflow_run_id: &str) {
    let target_refs = canonical_json_string(&json!({
        "runId": UPSTREAM_RUN_ID,
        "slot": "upstream",
        "taskId": UPSTREAM_TASK_ID,
        "workflowRunId": workflow_run_id
    }));
    let result_refs = canonical_json_string(&json!({
        "evidenceBundleId": EVIDENCE_BUNDLE_ID,
        "outcome": "completed",
        "status": "recorded"
    }));
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-record-worker-evidence",
            workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "record_worker_evidence",
            action_type: "record_worker_evidence",
            idempotency_key: &format!(
                "{workflow_run_id}:record_worker_evidence:upstream:{UPSTREAM_TASK_ID}:{UPSTREAM_RUN_ID}"
            ),
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: Some(&result_refs),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("5"),
            completed_at: Some("5"),
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert record_worker_evidence action");
}

fn insert_stale_read_action(
    store: &SqliteStore,
    action_id: &str,
    action_type: &str,
    target_refs: serde_json::Value,
    result_refs: serde_json::Value,
) {
    let target_refs = canonical_json_string(&target_refs);
    let result_refs = canonical_json_string(&result_refs);
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id,
            workflow_run_id: WORKFLOW_RUN_ID,
            workspace_id: "workspace-1",
            step_id: action_type,
            action_type,
            idempotency_key: &format!("{WORKFLOW_RUN_ID}:{action_type}:{action_id}"),
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: Some(&result_refs),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("6"),
            completed_at: Some("6"),
            created_at: Some("6"),
            updated_at: Some("6"),
        })
        .expect("insert stale read action");
}

#[test]
fn review_step_recovers_live_failed_before_mutation_shape() {
    let store = setup_live_failed_review_before_mutation_shape();
    let service = WorkspaceService::new(store);

    let resume_plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", WORKFLOW_RUN_ID, None))
        .expect("plan resume")
        .expect("resume plan");
    assert_eq!(
        resume_plan.status,
        QueueWorkflowResumePlanStatus::RetryableReviewFailureBeforeMutation
    );
    assert_eq!(resume_plan.next_phase.as_deref(), Some("review"));
    assert_eq!(
        resume_plan.next_step.as_deref(),
        Some("review_create_ready")
    );

    let result = service
        .execute_queue_workflow_review_step(review_step_request(WORKFLOW_RUN_ID))
        .expect("execute review step");
    assert_eq!(result.status, QueueWorkflowReviewStepResultStatus::Executed);
    assert_eq!(result.next_phase.as_deref(), Some("finalization"));
    assert_eq!(result.next_step.as_deref(), Some("awaiting_finalization"));
    let binding = result.binding.expect("review binding");
    assert_eq!(binding.task_id, UPSTREAM_TASK_ID);
    assert_eq!(binding.run_id, UPSTREAM_RUN_ID);
    assert_eq!(binding.evidence_bundle_id, EVIDENCE_BUNDLE_ID);
    assert_eq!(binding.ack_status, "acknowledged");

    let workflow_run = service
        .store
        .get_agent_queue_workflow_run("workspace-1", WORKFLOW_RUN_ID)
        .expect("read workflow")
        .expect("workflow");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "review");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_finalization")
    );
    assert!(workflow_run
        .slot_bindings_json
        .as_deref()
        .expect("slot bindings")
        .contains(&binding.message_id));

    let messages = service
        .store
        .list_agent_queue_review_messages("workspace-1", UPSTREAM_TASK_ID)
        .expect("list review messages");
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].run_id.as_deref(), Some(UPSTREAM_RUN_ID));
    assert_eq!(messages[0].status, "acknowledged");
    assert!(service
        .store
        .get_widget_run(UPSTREAM_RUN_ID)
        .expect("widget run lookup")
        .is_none());
    assert!(service
        .store
        .list_agent_queue_task_run_links("workspace-1", DOWNSTREAM_TASK_ID)
        .expect("downstream run links")
        .is_empty());
    assert!(service
        .store
        .get_latest_agent_queue_completion_decision("workspace-1", UPSTREAM_TASK_ID)
        .expect("completion decision")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_failure_decision("workspace-1", UPSTREAM_TASK_ID)
        .expect("failure decision")
        .is_none());

    let post_plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", WORKFLOW_RUN_ID, None))
        .expect("post review resume")
        .expect("resume plan");
    assert_eq!(
        post_plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(post_plan.next_phase.as_deref(), Some("finalization"));
    assert_eq!(
        post_plan.next_step.as_deref(),
        Some("awaiting_finalization")
    );
}

#[test]
fn review_step_blocks_missing_evidence() {
    let store = setup_live_failed_review_before_mutation_shape();
    let slot_bindings = json!({
        "upstream": {
            "evidenceBundleId": "missing-evidence-bundle",
            "runId": UPSTREAM_RUN_ID,
            "taskId": UPSTREAM_TASK_ID
        },
        "downstream": {
            "dependsOnSlots": ["upstream"],
            "dependencyTaskIds": [UPSTREAM_TASK_ID],
            "taskId": DOWNSTREAM_TASK_ID
        }
    })
    .to_string();
    store
        .update_agent_queue_workflow_run_report(
            "workspace-1",
            WORKFLOW_RUN_ID,
            hobit_storage_sqlite::AgentQueueWorkflowRunReportUpdate {
                status: "failed",
                phase: Some("review"),
                current_step: Some("review_failed_unexpected"),
                pause_reason: None,
                blocker_reason: Some("Queue review workflow failed unexpectedly"),
                variables_json: None,
                slot_bindings_json: Some(&slot_bindings),
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                updated_at: Some("8"),
                completed_at: Some("8"),
            },
        )
        .expect("update missing evidence binding")
        .expect("workflow updated");
    let service = WorkspaceService::new(store);

    let result = service
        .execute_queue_workflow_review_step(review_step_request(WORKFLOW_RUN_ID))
        .expect("execute review step");

    assert_eq!(
        result.status,
        QueueWorkflowReviewStepResultStatus::BlockedPrecondition
    );
    assert_eq!(result.blockers[0].blocker_code, "evidence_missing");
}

#[test]
fn review_step_blocks_terminal_decision_and_downstream_start() {
    for scenario in ["decision", "downstream"] {
        let store = setup_live_failed_review_before_mutation_shape();
        if scenario == "decision" {
            create_review_message(
                &store,
                "workspace-1",
                UPSTREAM_TASK_ID,
                UPSTREAM_RUN_ID,
                UPSTREAM_LINK_ID,
                "message-existing",
                "acknowledged",
            );
            store
                .insert_agent_queue_completion_decision(NewAgentQueueCompletionDecision {
                    decision_id: "completion-1",
                    workspace_id: "workspace-1",
                    queue_task_id: UPSTREAM_TASK_ID,
                    run_id: None,
                    run_link_id: Some(UPSTREAM_LINK_ID),
                    review_message_id: Some("message-existing"),
                    actor_id: "workspace-agent",
                    decision: "accepted",
                    reason: Some("Accepted."),
                    metadata_json: None,
                    created_at: Some("7"),
                })
                .expect("insert queue-local completion decision");
        } else {
            create_queue_local_run_link_without_widget_run(
                &store,
                "workspace-1",
                DOWNSTREAM_TASK_ID,
                "downstream-run-1",
                "downstream-link-1",
                "running",
            );
        }
        let service = WorkspaceService::new(store);

        let result = service
            .execute_queue_workflow_review_step(review_step_request(WORKFLOW_RUN_ID))
            .expect("execute review step");

        assert_eq!(
            result.status,
            QueueWorkflowReviewStepResultStatus::BlockedPrecondition
        );
        let expected = if scenario == "decision" {
            "terminal_decision_exists"
        } else {
            "downstream_already_started"
        };
        assert_eq!(result.blockers[0].blocker_code, expected);
    }
}

#[test]
fn review_step_blocks_conflicting_message_and_missing_grant() {
    for scenario in ["conflicting_message", "missing_grant"] {
        let store = setup_live_failed_review_before_mutation_shape();
        if scenario == "conflicting_message" {
            create_queue_local_run_link_without_widget_run(
                &store,
                "workspace-1",
                UPSTREAM_TASK_ID,
                "other-run",
                "other-link",
                "completed",
            );
            create_review_message(
                &store,
                "workspace-1",
                UPSTREAM_TASK_ID,
                "other-run",
                "other-link",
                "message-conflict",
                "created",
            );
        }
        let service = WorkspaceService::new(store);
        let mut request = review_step_request(WORKFLOW_RUN_ID);
        if scenario == "missing_grant" {
            request.grant_summary = None;
        }

        let result = service
            .execute_queue_workflow_review_step(request)
            .expect("execute review step");

        if scenario == "conflicting_message" {
            assert_eq!(result.status, QueueWorkflowReviewStepResultStatus::Conflict);
            assert_eq!(
                result.conflict.as_ref().expect("conflict").conflict_code,
                "review_message_run_mismatch"
            );
        } else {
            assert_eq!(
                result.status,
                QueueWorkflowReviewStepResultStatus::BlockedPrecondition
            );
            assert_eq!(result.blockers[0].blocker_code, "review_grant_required");
        }
    }
}

#[test]
fn arbitrary_failed_review_workflow_is_not_retryable() {
    let store = setup_live_failed_review_before_mutation_shape();
    insert_stale_read_action(
        &store,
        "unexpected-mutation",
        "queue.workflow.runner",
        json!({"phase": "review"}),
        json!({"status": "failed"}),
    );
    let service = WorkspaceService::new(store);

    let resume_plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", WORKFLOW_RUN_ID, None))
        .expect("plan resume")
        .expect("resume plan");

    assert_eq!(
        resume_plan.status,
        QueueWorkflowResumePlanStatus::TerminalFailed
    );
    assert!(!resume_plan.resume_available);
}
