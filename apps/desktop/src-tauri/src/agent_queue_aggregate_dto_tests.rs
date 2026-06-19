use hobit_app::{
    QueueItemAggregate, QueueItemAggregateBlocker, QueueItemAggregateCommitState,
    QueueItemAggregateDependencyState, QueueItemAggregateDurableFlags,
    QueueItemAggregateEvidenceState, QueueItemAggregateEvidenceSummary,
    QueueItemAggregateLatestRun, QueueItemAggregateNextAction, QueueItemAggregateReviewState,
    QueueItemAggregateRunSettings, QueueItemAggregateTicketState,
    QueueItemAggregateValidationState, QueueItemAggregateWorkerRunState,
};

use crate::agent_queue_aggregate_dto::{
    GetQueueItemAggregateRequest, ListQueueItemAggregatesRequest, QueueItemAggregateDto,
};

#[test]
fn maps_queue_item_aggregate_to_stable_dto_strings() {
    let dto = QueueItemAggregateDto::from(QueueItemAggregate {
        task_id: "task_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        title: "Task".to_owned(),
        ticket_state: QueueItemAggregateTicketState::AwaitingReview,
        worker_run_state: QueueItemAggregateWorkerRunState::Completed,
        review_state: QueueItemAggregateReviewState::AwaitingReview,
        evidence_state: QueueItemAggregateEvidenceState::Available,
        validation_state: QueueItemAggregateValidationState::Passed,
        commit_state: QueueItemAggregateCommitState::None,
        dependency_state: QueueItemAggregateDependencyState::None,
        run_settings: QueueItemAggregateRunSettings {
            execution_policy: "manual".to_owned(),
            execution_workspace: Some("C:/repo".to_owned()),
            codex_executable: Some("codex".to_owned()),
            sandbox: Some("workspace_write".to_owned()),
            approval_policy: Some("never".to_owned()),
            assigned_executor_widget_id: Some("executor_1".to_owned()),
        },
        latest_run: Some(QueueItemAggregateLatestRun {
            run_link_id: "link_1".to_owned(),
            run_id: "run_1".to_owned(),
            executor_widget_id: "executor_1".to_owned(),
            status: "completed".to_owned(),
            source: "manual".to_owned(),
            started_at: "1".to_owned(),
            completed_at: Some("2".to_owned()),
            validation_status: Some("passed".to_owned()),
            review_status: Some("review_needed".to_owned()),
            final_detail_available: true,
        }),
        evidence_summary: Some(QueueItemAggregateEvidenceSummary {
            available: true,
            source: "durable_run_link".to_owned(),
            summary: Some("Final summary".to_owned()),
            not_durable_reason: None,
        }),
        blockers: vec![QueueItemAggregateBlocker {
            code: "awaiting_review".to_owned(),
            message: "Worker result is awaiting explicit review.".to_owned(),
        }],
        next_actions: vec![QueueItemAggregateNextAction {
            code: "create_review_message".to_owned(),
            label: "Create review message".to_owned(),
            available: false,
            unavailable_reason: Some("backend_review_command_not_implemented".to_owned()),
        }],
        durable_flags: QueueItemAggregateDurableFlags {
            task_row: true,
            latest_run_link: true,
            dependency_state: true,
            review_state: true,
            evidence_state: true,
            validation_state: true,
            commit_state: true,
            completion_state: false,
            frontend_overlay_used: false,
        },
        updated_at: "3".to_owned(),
    });

    assert_eq!(dto.ticket_state, "awaiting_review");
    assert_eq!(dto.worker_run_state, "completed");
    assert_eq!(dto.review_state, "awaiting_review");
    assert_eq!(dto.evidence_state, "available");
    assert_eq!(dto.validation_state, "passed");
    assert_eq!(dto.commit_state, "none");
    assert_eq!(dto.dependency_state, "none");
    assert_eq!(dto.latest_run.as_ref().expect("latest run").run_id, "run_1");
    assert!(!dto.next_actions[0].available);
    assert!(!dto.durable_flags.completion_state);
    assert!(!dto.durable_flags.frontend_overlay_used);

    let value = serde_json::to_value(dto).expect("serialize dto");
    let object = value.as_object().expect("dto object");
    for forbidden in [
        "prompt",
        "operator_prompt",
        "stdout",
        "stderr",
        "final_response",
        "diff",
        "logs",
        "command_payload",
        "payload_json",
        "repo_root",
        "secrets",
    ] {
        assert!(
            !object.contains_key(forbidden),
            "aggregate DTO must not expose {forbidden}"
        );
    }
}

#[test]
fn aggregate_requests_use_explicit_workspace_and_task_identity() {
    let list = ListQueueItemAggregatesRequest {
        workspace_id: "ws_1".to_owned(),
    };
    let get = GetQueueItemAggregateRequest {
        workspace_id: "ws_1".to_owned(),
        task_id: "task_1".to_owned(),
    };

    assert_eq!(list.workspace_id, "ws_1");
    assert_eq!(get.workspace_id, "ws_1");
    assert_eq!(get.task_id, "task_1");
}
