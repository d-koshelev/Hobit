use serde_json::json;

use super::super::*;
use super::support::*;

const WORKSPACE_ID: &str = "workspace-1";
const UPSTREAM_TASK_ID: &str = "task-upstream";
const DOWNSTREAM_TASK_ID: &str = "task-downstream";
const RUN_ID: &str = "queue-local-run-1";
const LINK_ID: &str = "queue-local-link-1";
const BUNDLE_ID: &str = "bundle-1";
const MESSAGE_ID: &str = "message-1";

fn finalization_request(
    workflow_run_id: &str,
    workflow_id: &str,
) -> QueueWorkflowFinalizationStepRequest {
    QueueWorkflowFinalizationStepRequest {
        workspace_id: WORKSPACE_ID.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: Some("upstream".to_owned()),
        actor_id: Some("workspace-agent".to_owned()),
        request_id: Some("request-1".to_owned()),
        grant_summary: Some(json!({
            "constraints": {
                "noDownstreamAutoStart": true
            }
        })),
        confirmation_token: Some("operator-confirmed".to_owned()),
        failure_reason: (workflow_id == "dependency_failure_smoke")
            .then_some("typed failure reason".to_owned()),
        expected_version: None,
    }
}

fn setup_finalization_workflow(workflow_run_id: &str, workflow_id: &str) -> WorkspaceService {
    let store = initialized_store();
    create_workspace_with_executor(&store, WORKSPACE_ID, "workbench-1", "executor-1");
    create_task_row(
        &store,
        WORKSPACE_ID,
        UPSTREAM_TASK_ID,
        "review_needed",
        true,
        None,
    );
    create_task_row(
        &store,
        WORKSPACE_ID,
        DOWNSTREAM_TASK_ID,
        "queued",
        false,
        Some(&format!(r#"["{UPSTREAM_TASK_ID}"]"#)),
    );
    create_queue_local_run_link_without_widget_run(
        &store,
        WORKSPACE_ID,
        UPSTREAM_TASK_ID,
        RUN_ID,
        LINK_ID,
        "review_needed",
    );
    create_evidence(
        &store,
        WORKSPACE_ID,
        UPSTREAM_TASK_ID,
        RUN_ID,
        LINK_ID,
        BUNDLE_ID,
        "completed",
    );
    create_review_message(
        &store,
        WORKSPACE_ID,
        UPSTREAM_TASK_ID,
        RUN_ID,
        LINK_ID,
        MESSAGE_ID,
        "acknowledged",
    );
    insert_resume_workflow(
        &store,
        workflow_run_id,
        workflow_id,
        "paused",
        "review",
        Some("awaiting_finalization"),
        (workflow_id == "dependency_failure_smoke")
            .then_some(r#"{"failureReason":"typed failure reason"}"#),
        Some(
            &json!({
                "downstream": {
                    "dependsOnSlots": ["upstream"],
                    "dependencyTaskIds": [UPSTREAM_TASK_ID],
                    "taskId": DOWNSTREAM_TASK_ID
                },
                "upstream": {
                    "evidenceBundleId": BUNDLE_ID,
                    "messageId": MESSAGE_ID,
                    "runId": RUN_ID,
                    "taskId": UPSTREAM_TASK_ID
                }
            })
            .to_string(),
        ),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    WorkspaceService::new(store)
}

#[test]
fn acceptance_finalization_executes_idempotently_without_widget_run() {
    let service = setup_finalization_workflow("workflow-accept", "dependency_acceptance_smoke");

    let plan = service
        .plan_queue_workflow_finalization_step(finalization_request(
            "workflow-accept",
            "dependency_acceptance_smoke",
        ))
        .expect("plan finalization");
    assert!(plan.executable);
    assert_eq!(
        plan.transition,
        QueueWorkflowFinalizationStepTransition::FinalizeDone
    );

    let result = service
        .execute_queue_workflow_finalization_step(finalization_request(
            "workflow-accept",
            "dependency_acceptance_smoke",
        ))
        .expect("execute finalization");

    assert_eq!(
        result.status,
        QueueWorkflowFinalizationStepResultStatus::Executed
    );
    assert!(result.completion_decision_id.is_some());
    assert_eq!(result.failure_decision_id, None);
    assert_eq!(
        result.workflow_run.as_ref().expect("run").status,
        "completed"
    );
    let downstream = result.downstream_verification.expect("downstream");
    assert_eq!(downstream.dependency_state.as_deref(), Some("ready"));
    assert!(downstream.dependency_verified);
    assert!(downstream.not_auto_started_verified);
    assert!(service
        .store
        .get_widget_run(RUN_ID)
        .expect("widget run lookup")
        .is_none());

    let repeated = service
        .execute_queue_workflow_finalization_step(finalization_request(
            "workflow-accept",
            "dependency_acceptance_smoke",
        ))
        .expect("repeat finalization");
    assert_eq!(
        repeated.status,
        QueueWorkflowFinalizationStepResultStatus::AlreadyApplied
    );
}

#[test]
fn failure_finalization_requires_reason_and_executes_idempotently() {
    let service = setup_finalization_workflow("workflow-fail", "dependency_failure_smoke");

    let mut missing_reason = finalization_request("workflow-fail", "dependency_failure_smoke");
    missing_reason.failure_reason = None;
    let blocked = service
        .execute_queue_workflow_finalization_step(missing_reason)
        .expect("missing reason result");
    assert_eq!(
        blocked.status,
        QueueWorkflowFinalizationStepResultStatus::InvalidInput
    );
    assert_eq!(blocked.blockers[0].blocker_code, "failure_reason_missing");

    let result = service
        .execute_queue_workflow_finalization_step(finalization_request(
            "workflow-fail",
            "dependency_failure_smoke",
        ))
        .expect("execute failure finalization");

    assert_eq!(
        result.status,
        QueueWorkflowFinalizationStepResultStatus::Executed
    );
    assert_eq!(result.completion_decision_id, None);
    assert!(result.failure_decision_id.is_some());
    assert_eq!(
        result.workflow_run.as_ref().expect("run").status,
        "completed"
    );
    let downstream = result.downstream_verification.expect("downstream");
    assert_eq!(
        downstream.dependency_state.as_deref(),
        Some("failed_upstream")
    );
    assert!(downstream.dependency_verified);
    assert!(downstream.not_auto_started_verified);

    let repeated = service
        .execute_queue_workflow_finalization_step(finalization_request(
            "workflow-fail",
            "dependency_failure_smoke",
        ))
        .expect("repeat failure finalization");
    assert_eq!(
        repeated.status,
        QueueWorkflowFinalizationStepResultStatus::AlreadyApplied
    );
}

#[test]
fn finalization_blocks_missing_or_invalid_confirmation_and_opposite_decision() {
    let service = setup_finalization_workflow("workflow-safety", "dependency_acceptance_smoke");

    let mut missing = finalization_request("workflow-safety", "dependency_acceptance_smoke");
    missing.confirmation_token = None;
    let missing_result = service
        .execute_queue_workflow_finalization_step(missing)
        .expect("missing confirmation");
    assert_eq!(
        missing_result.status,
        QueueWorkflowFinalizationStepResultStatus::InvalidInput
    );
    assert_eq!(
        missing_result.blockers[0].blocker_code,
        "fresh_confirmation_required"
    );

    create_failure_decision(
        &service.store,
        WORKSPACE_ID,
        UPSTREAM_TASK_ID,
        RUN_ID,
        LINK_ID,
        BUNDLE_ID,
        MESSAGE_ID,
        "failure-existing",
    );
    let conflict = service
        .execute_queue_workflow_finalization_step(finalization_request(
            "workflow-safety",
            "dependency_acceptance_smoke",
        ))
        .expect("opposite decision");
    assert_eq!(
        conflict.status,
        QueueWorkflowFinalizationStepResultStatus::Conflict
    );
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "opposite_terminal_decision_exists"
    );
}
