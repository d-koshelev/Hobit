use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    SetAgentQueueControlStateInput, WorkspaceService, AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED,
    QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
};
use hobit_storage_sqlite::SqliteStore;
use serde_json::{json, Value};

use crate::agent_queue_direct_work_launcher::{
    finish_queue_direct_work_launch_for_test, QueueDirectWorkLaunch, QueueDirectWorkLaunchStatus,
};
use crate::agent_queue_workflow_dto::{
    PlanAgentQueueWorkflowResumeRequest, RecordAgentQueueWorkflowWorkerEvidenceRequest,
};
use crate::agent_queue_workflow_finalization_step_dto::ExecuteAgentQueueWorkflowFinalizationStepRequest;
use crate::agent_queue_workflow_review_step_dto::ExecuteAgentQueueWorkflowReviewStepRequest;
use crate::agent_queue_workflow_start_step_dto::ExecuteAgentQueueWorkflowCreateSetupStartStepRequest;
use crate::app_state::DirectWorkActiveRunRegistry;

#[test]
fn queue_workflow_headless_acceptance_smoke_completes() {
    let db_path = unique_test_db_path("acceptance");
    let workspace_id = create_workspace_with_queue_control(&db_path);
    let mut launcher = TestQueueLocalLauncher::terminal("completed");

    let start = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(
            &workspace_id,
            "dependency_acceptance_smoke",
            "request-acceptance-smoke",
        ),
        db_path.clone(),
        |intent, launch_db_path| launcher.launch(intent, launch_db_path),
    )
    .expect("execute acceptance create/setup/start");
    let refs = assert_create_setup_start_executed(&db_path, &workspace_id, &start, &launcher);
    assert_no_review_evidence_or_decision_refs(&db_path, &workspace_id, &refs.upstream_task_id);
    assert_no_downstream_run(&db_path, &workspace_id, &refs.downstream_task_id);
    assert_no_forbidden_step_dto_keys(&start);

    let duplicate_start = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(
            &workspace_id,
            "dependency_acceptance_smoke",
            "request-acceptance-smoke",
        ),
        db_path.clone(),
        |intent, launch_db_path| launcher.launch(intent, launch_db_path),
    )
    .expect("repeat acceptance create/setup/start");
    assert_eq!(duplicate_start.status, "already_applied");
    assert_eq!(launcher.launches.len(), 1);
    assert_durable_counts(&db_path, &workspace_id, &refs, 2, 1, 0, 5);

    let evidence = execute_agent_queue_workflow_worker_evidence_step_blocking(
        worker_evidence_request(&workspace_id, &refs, "completed"),
        db_path.clone(),
    )
    .expect("record acceptance worker evidence");
    assert_eq!(evidence.status, "executed");
    let evidence_binding = evidence.binding.as_ref().expect("evidence binding");
    assert_eq!(evidence_binding.worker_final_status, "completed");
    assert_eq!(evidence_binding.worker_outcome, "completed");
    let evidence_bundle_id = evidence_binding.evidence_bundle_id.clone();
    assert_eq!(evidence.next_phase.as_deref(), Some("review"));
    assert_eq!(evidence.next_step.as_deref(), Some("awaiting_review"));
    assert_no_downstream_run(&db_path, &workspace_id, &refs.downstream_task_id);

    let duplicate_evidence = execute_agent_queue_workflow_worker_evidence_step_blocking(
        worker_evidence_request(&workspace_id, &refs, "completed"),
        db_path.clone(),
    )
    .expect("repeat worker evidence");
    assert_eq!(duplicate_evidence.status, "already_applied");
    assert_eq!(
        duplicate_evidence
            .binding
            .expect("duplicate evidence binding")
            .evidence_bundle_id,
        evidence_bundle_id
    );
    assert_durable_counts(&db_path, &workspace_id, &refs, 2, 1, 0, 6);

    let review = execute_agent_queue_workflow_review_step_blocking(
        review_request(&workspace_id, &refs.workflow_run_id, "review-acceptance"),
        db_path.clone(),
    )
    .expect("execute acceptance review");
    assert_eq!(review.status, "executed");
    assert_eq!(review.ack_status.as_deref(), Some("acknowledged"));
    let message_id = review.message_id.clone().expect("review message id");
    assert_eq!(review.next_phase.as_deref(), Some("finalization"));
    assert_eq!(review.next_step.as_deref(), Some("awaiting_finalization"));

    let duplicate_review = execute_agent_queue_workflow_review_step_blocking(
        review_request(
            &workspace_id,
            &refs.workflow_run_id,
            "review-acceptance-repeat",
        ),
        db_path.clone(),
    )
    .expect("repeat review");
    assert!(matches!(
        duplicate_review.status.as_str(),
        "executed" | "already_applied"
    ));
    assert_eq!(
        duplicate_review.message_id.as_deref(),
        Some(message_id.as_str())
    );
    assert_review_message_count(&db_path, &workspace_id, &refs.upstream_task_id, 1);
    assert_no_downstream_run(&db_path, &workspace_id, &refs.downstream_task_id);

    let finalization = execute_agent_queue_workflow_finalization_step_blocking(
        finalization_request(&workspace_id, &refs.workflow_run_id, None),
        db_path.clone(),
    )
    .expect("execute acceptance finalization");
    assert_eq!(finalization.status, "executed");
    let completion_decision_id = finalization
        .completion_decision_id
        .clone()
        .expect("completion decision id");
    assert!(finalization.failure_decision_id.is_none());
    assert_eq!(
        finalization
            .workflow_run
            .as_ref()
            .expect("completed workflow")
            .status,
        "completed"
    );
    let downstream = finalization
        .downstream_verification
        .as_ref()
        .expect("downstream verification");
    assert_eq!(downstream.dependency_state.as_deref(), Some("ready"));
    assert!(downstream.dependency_verified);
    assert!(downstream.not_auto_started_verified);
    assert_acceptance_final_state(
        &db_path,
        &workspace_id,
        &refs,
        &completion_decision_id,
        &message_id,
    );
    assert_no_forbidden_step_dto_keys(&finalization);
    assert_no_raw_confirmation_token(&finalization);

    let duplicate_finalization = execute_agent_queue_workflow_finalization_step_blocking(
        finalization_request(&workspace_id, &refs.workflow_run_id, None),
        db_path.clone(),
    )
    .expect("repeat acceptance finalization");
    assert_eq!(duplicate_finalization.status, "already_applied");
    assert_eq!(
        duplicate_finalization.completion_decision_id.as_deref(),
        Some(completion_decision_id.as_str())
    );
    assert_acceptance_final_state(
        &db_path,
        &workspace_id,
        &refs,
        &completion_decision_id,
        &message_id,
    );
    assert_durable_counts(&db_path, &workspace_id, &refs, 2, 1, 0, 9);

    remove_test_db_files(&db_path);
}

#[test]
fn queue_workflow_headless_failure_smoke_completes() {
    let db_path = unique_test_db_path("failure");
    let workspace_id = create_workspace_with_queue_control(&db_path);
    let mut launcher = TestQueueLocalLauncher::terminal("completed");

    let start = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(
            &workspace_id,
            "dependency_failure_smoke",
            "request-failure-smoke",
        ),
        db_path.clone(),
        |intent, launch_db_path| launcher.launch(intent, launch_db_path),
    )
    .expect("execute failure create/setup/start");
    let refs = assert_create_setup_start_executed(&db_path, &workspace_id, &start, &launcher);
    assert_eq!(start.workflow_id, "dependency_failure_smoke");

    let evidence = execute_agent_queue_workflow_worker_evidence_step_blocking(
        worker_evidence_request(&workspace_id, &refs, "completed"),
        db_path.clone(),
    )
    .expect("record failure worker evidence");
    assert_eq!(evidence.status, "executed");
    let evidence_binding = evidence.binding.as_ref().expect("evidence binding");
    assert_eq!(evidence_binding.worker_final_status, "completed");
    assert_eq!(evidence_binding.worker_outcome, "completed");
    assert_no_downstream_run(&db_path, &workspace_id, &refs.downstream_task_id);

    let review = execute_agent_queue_workflow_review_step_blocking(
        review_request(&workspace_id, &refs.workflow_run_id, "review-failure"),
        db_path.clone(),
    )
    .expect("execute failure review");
    assert_eq!(review.status, "executed");
    assert_eq!(review.ack_status.as_deref(), Some("acknowledged"));
    let message_id = review.message_id.clone().expect("review message id");

    let failure_reason = "typed failure reason for headless smoke";
    let finalization = execute_agent_queue_workflow_finalization_step_blocking(
        finalization_request(&workspace_id, &refs.workflow_run_id, Some(failure_reason)),
        db_path.clone(),
    )
    .expect("execute failure finalization");
    assert_eq!(finalization.status, "executed");
    assert!(finalization.completion_decision_id.is_none());
    let failure_decision_id = finalization
        .failure_decision_id
        .clone()
        .expect("failure decision id");
    assert_eq!(
        finalization
            .workflow_run
            .as_ref()
            .expect("completed workflow")
            .status,
        "completed"
    );
    let downstream = finalization
        .downstream_verification
        .as_ref()
        .expect("downstream verification");
    assert_eq!(
        downstream.dependency_state.as_deref(),
        Some("failed_upstream")
    );
    assert!(downstream.dependency_verified);
    assert!(downstream.not_auto_started_verified);
    assert_failure_final_state(
        &db_path,
        &workspace_id,
        &refs,
        &failure_decision_id,
        &message_id,
        failure_reason,
    );

    let duplicate_finalization = execute_agent_queue_workflow_finalization_step_blocking(
        finalization_request(&workspace_id, &refs.workflow_run_id, Some(failure_reason)),
        db_path.clone(),
    )
    .expect("repeat failure finalization");
    assert_eq!(duplicate_finalization.status, "already_applied");
    assert_eq!(
        duplicate_finalization.failure_decision_id.as_deref(),
        Some(failure_decision_id.as_str())
    );
    assert_failure_final_state(
        &db_path,
        &workspace_id,
        &refs,
        &failure_decision_id,
        &message_id,
        failure_reason,
    );
    assert_durable_counts(&db_path, &workspace_id, &refs, 2, 1, 0, 9);

    remove_test_db_files(&db_path);
}

#[test]
fn queue_workflow_headless_smoke_blocks_evidence_while_worker_running() {
    let db_path = unique_test_db_path("running");
    let workspace_id = create_workspace_with_queue_control(&db_path);
    let mut launcher = TestQueueLocalLauncher::running();

    let start = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(
            &workspace_id,
            "dependency_acceptance_smoke",
            "request-running-smoke",
        ),
        db_path.clone(),
        |intent, launch_db_path| launcher.launch(intent, launch_db_path),
    )
    .expect("execute running create/setup/start");
    let refs = refs_from_start(&start);
    assert_eq!(launcher.launches.len(), 1);

    let plan = plan_agent_queue_workflow_resume_blocking(
        PlanAgentQueueWorkflowResumeRequest {
            workspace_id: workspace_id.clone(),
            workflow_run_id: refs.workflow_run_id.clone(),
            expected_version: None,
        },
        db_path.clone(),
    )
    .expect("plan running workflow")
    .expect("resume plan");
    assert_eq!(plan.status, "resume_read_only_ready");
    assert_eq!(plan.next_phase.as_deref(), Some("worker_evidence"));
    assert_eq!(
        plan.next_step.as_deref(),
        Some("awaiting_worker_completion")
    );

    let evidence_request = worker_evidence_request(&workspace_id, &refs, "completed");
    let evidence_plan = initialized_service(&db_path)
        .plan_queue_workflow_worker_evidence_step(evidence_request.clone().into())
        .expect("plan worker evidence");
    assert!(!evidence_plan.safe_to_record_worker_evidence);
    assert_eq!(
        evidence_plan.blockers[0].blocker_code,
        "worker_run_not_complete"
    );

    let blocked = execute_agent_queue_workflow_worker_evidence_step_blocking(
        evidence_request,
        db_path.clone(),
    )
    .expect("blocked worker evidence");
    assert_eq!(blocked.status, "blocked_precondition");
    assert_eq!(blocked.blockers[0].blocker_code, "worker_run_not_complete");

    let store = initialized_store(&db_path);
    assert!(store
        .get_latest_agent_queue_worker_evidence_bundle(&workspace_id, &refs.upstream_task_id)
        .expect("evidence lookup")
        .is_none());
    assert_no_downstream_run(&db_path, &workspace_id, &refs.downstream_task_id);

    remove_test_db_files(&db_path);
}

#[derive(Clone, Debug)]
struct SmokeRefs {
    workflow_run_id: String,
    upstream_task_id: String,
    downstream_task_id: String,
    run_id: String,
}

#[derive(Debug)]
struct TestLaunchRecord {
    intent: hobit_app::QueueWorkflowWorkerLaunchIntent,
    status_before_completion: String,
    completion_status: Option<QueueDirectWorkLaunchStatus>,
}

#[derive(Debug)]
struct TestQueueLocalLauncher {
    terminal_status: Option<&'static str>,
    launches: Vec<TestLaunchRecord>,
}

impl TestQueueLocalLauncher {
    fn terminal(status: &'static str) -> Self {
        Self {
            terminal_status: Some(status),
            launches: Vec::new(),
        }
    }

    fn running() -> Self {
        Self {
            terminal_status: None,
            launches: Vec::new(),
        }
    }

    fn launch(
        &mut self,
        intent: hobit_app::QueueWorkflowWorkerLaunchIntent,
        db_path: PathBuf,
    ) -> Result<(), String> {
        let service = initialized_service(&db_path);
        let link = service
            .get_latest_agent_queue_task_run_link(&intent.workspace_id, &intent.queue_task_id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "missing run link before fake launch completion".to_owned())?;
        assert_eq!(link.direct_work_run_id, intent.run_id);
        let status_before_completion = link.status.as_str().to_owned();

        let completion_status = match self.terminal_status {
            Some(status) => Some(finish_queue_direct_work_launch_for_test(
                QueueDirectWorkLaunch {
                    workspace_id: intent.workspace_id.clone(),
                    queue_item_id: intent.queue_task_id.clone(),
                    run_id: intent.run_id.clone(),
                    run_link_id: Some(link.link_id.as_str().to_owned()),
                    direct_work_input: intent.direct_work_input.clone(),
                },
                db_path,
                DirectWorkActiveRunRegistry::default(),
                status,
            )?),
            None => None,
        };
        self.launches.push(TestLaunchRecord {
            intent,
            status_before_completion,
            completion_status,
        });
        Ok(())
    }
}

fn assert_create_setup_start_executed(
    db_path: &Path,
    workspace_id: &str,
    start: &AgentQueueWorkflowCreateSetupStartStepResultDto,
    launcher: &TestQueueLocalLauncher,
) -> SmokeRefs {
    assert_eq!(start.status, "executed");
    assert_eq!(start.next_phase.as_deref(), Some("run_start"));
    assert_eq!(
        start.next_step.as_deref(),
        Some("awaiting_worker_completion")
    );
    assert_eq!(
        start
            .actions
            .create_task_upstream
            .as_ref()
            .expect("upstream create action")
            .status,
        "completed"
    );
    assert_eq!(
        start
            .actions
            .create_task_downstream
            .as_ref()
            .expect("downstream create action")
            .status,
        "completed"
    );
    assert_eq!(
        start
            .actions
            .update_run_settings
            .as_ref()
            .expect("settings action")
            .status,
        "completed"
    );
    assert_eq!(
        start
            .actions
            .promote_task
            .as_ref()
            .expect("promote action")
            .status,
        "completed"
    );
    assert_eq!(
        start
            .actions
            .start_worker
            .as_ref()
            .expect("start worker action")
            .status,
        "completed"
    );
    assert_eq!(launcher.launches.len(), 1);
    let launch = &launcher.launches[0];
    assert_eq!(launch.status_before_completion, "running");
    assert_eq!(
        launch.completion_status,
        Some(QueueDirectWorkLaunchStatus::Spawned)
    );
    assert_eq!(launch.intent.executor_target_kind, "queue_local");
    assert_eq!(launch.intent.provider_id, "codex");
    assert_eq!(
        launch.intent.direct_work_input.widget_instance_id.as_str(),
        QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    );

    let refs = refs_from_start(start);
    let service = initialized_service(db_path);
    let upstream = service
        .get_agent_queue_task(workspace_id, &refs.upstream_task_id)
        .expect("get upstream")
        .expect("upstream task");
    assert_eq!(upstream.execution_policy, "manual");
    assert_eq!(
        upstream.execution_workspace.as_deref(),
        Some(test_workspace_root().as_str())
    );
    assert_eq!(upstream.codex_executable.as_deref(), Some("codex"));
    assert_eq!(upstream.sandbox.as_deref(), Some("read_only"));
    assert_eq!(upstream.approval_policy.as_deref(), Some("never"));
    assert!(upstream.assigned_executor_widget_id.is_none());

    let downstream = service
        .get_agent_queue_task(workspace_id, &refs.downstream_task_id)
        .expect("get downstream")
        .expect("downstream task");
    assert_eq!(downstream.status, "draft");
    assert_eq!(downstream.depends_on, vec![refs.upstream_task_id.clone()]);
    let downstream_verification = start
        .downstream_verification
        .as_ref()
        .expect("downstream verification");
    assert!(downstream_verification.dependency_edge_exists);
    assert!(downstream_verification.downstream_not_started);
    assert!(downstream_verification.downstream_run_id_absent);

    let link = service
        .get_latest_agent_queue_task_run_link(workspace_id, &refs.upstream_task_id)
        .expect("latest upstream run link")
        .expect("upstream run link");
    assert_eq!(link.direct_work_run_id, refs.run_id);
    assert_eq!(link.status.as_str(), "completed");
    assert_eq!(
        link.executor_widget_id,
        QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    );
    assert!(initialized_store(db_path)
        .get_widget_run(&refs.run_id)
        .expect("widget run read")
        .is_none());

    refs
}

fn refs_from_start(start: &AgentQueueWorkflowCreateSetupStartStepResultDto) -> SmokeRefs {
    SmokeRefs {
        workflow_run_id: start.workflow_run_id.clone().expect("workflow run id"),
        upstream_task_id: start.task_ids_by_slot["upstream"].clone(),
        downstream_task_id: start.task_ids_by_slot["downstream"].clone(),
        run_id: start.run_ids_by_slot["upstream"].clone(),
    }
}

fn assert_no_review_evidence_or_decision_refs(
    db_path: &Path,
    workspace_id: &str,
    upstream_task_id: &str,
) {
    let store = initialized_store(db_path);
    assert!(store
        .get_latest_agent_queue_worker_evidence_bundle(workspace_id, upstream_task_id)
        .expect("evidence lookup")
        .is_none());
    assert!(store
        .get_latest_agent_queue_review_message(workspace_id, upstream_task_id)
        .expect("review lookup")
        .is_none());
    assert!(store
        .get_latest_agent_queue_completion_decision(workspace_id, upstream_task_id)
        .expect("completion lookup")
        .is_none());
    assert!(store
        .get_latest_agent_queue_failure_decision(workspace_id, upstream_task_id)
        .expect("failure lookup")
        .is_none());
}

fn assert_acceptance_final_state(
    db_path: &Path,
    workspace_id: &str,
    refs: &SmokeRefs,
    completion_decision_id: &str,
    message_id: &str,
) {
    let service = initialized_service(db_path);
    let upstream = service
        .get_agent_queue_task(workspace_id, &refs.upstream_task_id)
        .expect("get upstream")
        .expect("upstream task");
    assert_eq!(upstream.status, "completed");
    let upstream_aggregate = service
        .get_queue_item_aggregate(workspace_id, &refs.upstream_task_id)
        .expect("upstream aggregate")
        .expect("upstream aggregate");
    assert_eq!(upstream_aggregate.ticket_state.as_str(), "done");
    assert_eq!(upstream_aggregate.worker_run_state.as_str(), "completed");
    assert_eq!(upstream_aggregate.review_state.as_str(), "done");
    assert_eq!(upstream_aggregate.evidence_state.as_str(), "available");
    assert!(upstream_aggregate.durable_flags.completion_state);
    assert!(!upstream_aggregate.durable_flags.failure_state);

    let downstream_aggregate = service
        .get_queue_item_aggregate(workspace_id, &refs.downstream_task_id)
        .expect("downstream aggregate")
        .expect("downstream aggregate");
    assert_eq!(downstream_aggregate.dependency_state.as_str(), "ready");
    assert_eq!(
        downstream_aggregate.worker_run_state.as_str(),
        "not_started"
    );
    assert!(downstream_aggregate.latest_run.is_none());
    assert_no_downstream_run(db_path, workspace_id, &refs.downstream_task_id);

    let store = initialized_store(db_path);
    let decision = store
        .get_latest_agent_queue_completion_decision(workspace_id, &refs.upstream_task_id)
        .expect("completion decision lookup")
        .expect("completion decision");
    assert_eq!(decision.decision_id, completion_decision_id);
    assert_eq!(decision.run_id.as_deref(), Some(refs.run_id.as_str()));
    assert_eq!(decision.review_message_id.as_deref(), Some(message_id));
    let link = store
        .get_agent_queue_task_run_link_by_run_id(workspace_id, &refs.run_id)
        .expect("run link lookup")
        .expect("run link");
    assert_eq!(decision.run_link_id.as_deref(), Some(link.link_id.as_str()));
    assert!(store
        .get_widget_run(&refs.run_id)
        .expect("widget run lookup")
        .is_none());
}

fn assert_failure_final_state(
    db_path: &Path,
    workspace_id: &str,
    refs: &SmokeRefs,
    failure_decision_id: &str,
    message_id: &str,
    failure_reason: &str,
) {
    let service = initialized_service(db_path);
    let upstream = service
        .get_agent_queue_task(workspace_id, &refs.upstream_task_id)
        .expect("get upstream")
        .expect("upstream task");
    assert_eq!(upstream.status, "failed");
    let upstream_aggregate = service
        .get_queue_item_aggregate(workspace_id, &refs.upstream_task_id)
        .expect("upstream aggregate")
        .expect("upstream aggregate");
    assert_eq!(upstream_aggregate.ticket_state.as_str(), "failure");
    assert_eq!(upstream_aggregate.worker_run_state.as_str(), "completed");
    assert_eq!(upstream_aggregate.review_state.as_str(), "failed");
    assert_eq!(upstream_aggregate.evidence_state.as_str(), "available");
    assert!(!upstream_aggregate.durable_flags.completion_state);
    assert!(upstream_aggregate.durable_flags.failure_state);

    let downstream_aggregate = service
        .get_queue_item_aggregate(workspace_id, &refs.downstream_task_id)
        .expect("downstream aggregate")
        .expect("downstream aggregate");
    assert_eq!(
        downstream_aggregate.dependency_state.as_str(),
        "failed_upstream"
    );
    assert_eq!(
        downstream_aggregate.worker_run_state.as_str(),
        "not_started"
    );
    assert!(downstream_aggregate.latest_run.is_none());
    assert_no_downstream_run(db_path, workspace_id, &refs.downstream_task_id);

    let store = initialized_store(db_path);
    let decision = store
        .get_latest_agent_queue_failure_decision(workspace_id, &refs.upstream_task_id)
        .expect("failure decision lookup")
        .expect("failure decision");
    assert_eq!(decision.decision_id, failure_decision_id);
    assert_eq!(decision.run_id.as_deref(), Some(refs.run_id.as_str()));
    assert_eq!(decision.review_message_id.as_deref(), Some(message_id));
    assert_eq!(decision.reason, failure_reason);
    let link = store
        .get_agent_queue_task_run_link_by_run_id(workspace_id, &refs.run_id)
        .expect("run link lookup")
        .expect("run link");
    assert_eq!(decision.run_link_id.as_deref(), Some(link.link_id.as_str()));
    assert!(store
        .get_widget_run(&refs.run_id)
        .expect("widget run lookup")
        .is_none());
}

fn assert_no_downstream_run(db_path: &Path, workspace_id: &str, downstream_task_id: &str) {
    let service = initialized_service(db_path);
    assert!(service
        .get_latest_agent_queue_task_run_link(workspace_id, downstream_task_id)
        .expect("downstream latest run")
        .is_none());
}

fn assert_review_message_count(db_path: &Path, workspace_id: &str, task_id: &str, expected: usize) {
    let messages = initialized_store(db_path)
        .list_agent_queue_review_messages(workspace_id, task_id)
        .expect("list review messages");
    assert_eq!(messages.len(), expected);
    if expected > 0 {
        assert_eq!(messages[0].status, "acknowledged");
    }
}

fn assert_durable_counts(
    db_path: &Path,
    workspace_id: &str,
    refs: &SmokeRefs,
    task_count: usize,
    upstream_run_count: usize,
    downstream_run_count: usize,
    action_count: usize,
) {
    let service = initialized_service(db_path);
    assert_eq!(
        service
            .list_agent_queue_tasks(workspace_id)
            .expect("list tasks")
            .len(),
        task_count
    );
    assert_eq!(
        service
            .list_agent_queue_task_run_links(workspace_id, &refs.upstream_task_id)
            .expect("list upstream run links")
            .len(),
        upstream_run_count
    );
    assert_eq!(
        service
            .list_agent_queue_task_run_links(workspace_id, &refs.downstream_task_id)
            .expect("list downstream run links")
            .len(),
        downstream_run_count
    );
    assert_eq!(
        initialized_store(db_path)
            .list_agent_queue_workflow_actions(workspace_id, &refs.workflow_run_id)
            .expect("list workflow actions")
            .len(),
        action_count
    );
}

fn create_workspace_with_queue_control(db_path: &Path) -> String {
    let service = initialized_service(db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow headless smoke", None)
        .expect("create workspace");
    service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: workspace.id.clone(),
            status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned(),
            actor_id: Some("test".to_owned()),
            reason: Some("enable headless smoke".to_owned()),
            expected_version: None,
        })
        .expect("enable queue control");
    workspace.id
}

fn create_setup_start_request(
    workspace_id: &str,
    workflow_id: &str,
    request_id: &str,
) -> ExecuteAgentQueueWorkflowCreateSetupStartStepRequest {
    ExecuteAgentQueueWorkflowCreateSetupStartStepRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: None,
        workflow_id: workflow_id.to_owned(),
        request_id: request_id.to_owned(),
        actor_id: Some("workspace-agent".to_owned()),
        inputs: Some(create_setup_start_inputs()),
        grant_summary: Some(grant_summary(match workflow_id {
            "dependency_failure_smoke" => "queue_failure_smoke",
            _ => "queue_acceptance_smoke",
        })),
        confirmation_token: Some("operator-confirmed".to_owned()),
        expected_version: None,
    }
}

fn create_setup_start_inputs() -> Value {
    json!({
        "runSettings": {
            "approvalPolicy": "never",
            "codexExecutable": "codex",
            "executionPolicy": "manual",
            "executionTarget": {
                "kind": "queue_local",
                "providerId": "codex"
            },
            "sandbox": "read_only",
            "workspaceRoot": test_workspace_root()
        },
        "tasks": [
            {
                "slot": "upstream",
                "title": "Headless smoke upstream",
                "prompt": "Run deterministic upstream smoke work.",
                "dependsOnSlots": []
            },
            {
                "slot": "downstream",
                "title": "Headless smoke downstream",
                "prompt": "Wait for the upstream smoke result.",
                "dependsOnSlots": ["upstream"]
            }
        ]
    })
}

fn worker_evidence_request(
    workspace_id: &str,
    refs: &SmokeRefs,
    outcome: &str,
) -> RecordAgentQueueWorkflowWorkerEvidenceRequest {
    RecordAgentQueueWorkflowWorkerEvidenceRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: refs.workflow_run_id.clone(),
        slot: "upstream".to_owned(),
        task_id: refs.upstream_task_id.clone(),
        run_id: refs.run_id.clone(),
        outcome: outcome.to_owned(),
        summary: Some(
            "Deterministic fake worker completed through the Queue run-link bridge.".to_owned(),
        ),
        changed_files: Vec::new(),
        changed_files_summary: None,
        validation_summary: None,
        error_summary: None,
        worker_id: Some("headless-fake-worker".to_owned()),
        source: Some("headless_smoke_fake_launcher".to_owned()),
        metadata_json: None,
        finished_at: None,
        actor_id: Some("workspace-agent".to_owned()),
        action_idempotency_key: None,
    }
}

fn review_request(
    workspace_id: &str,
    workflow_run_id: &str,
    request_id: &str,
) -> ExecuteAgentQueueWorkflowReviewStepRequest {
    ExecuteAgentQueueWorkflowReviewStepRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: Some("upstream".to_owned()),
        actor_id: Some("workspace-agent".to_owned()),
        request_id: Some(request_id.to_owned()),
        grant_summary: Some(grant_summary("queue_acceptance_smoke")),
    }
}

fn finalization_request(
    workspace_id: &str,
    workflow_run_id: &str,
    failure_reason: Option<&str>,
) -> ExecuteAgentQueueWorkflowFinalizationStepRequest {
    ExecuteAgentQueueWorkflowFinalizationStepRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: Some("upstream".to_owned()),
        actor_id: Some("workspace-agent".to_owned()),
        request_id: Some("finalization-headless-smoke".to_owned()),
        grant_summary: Some(grant_summary(if failure_reason.is_some() {
            "queue_failure_smoke"
        } else {
            "queue_acceptance_smoke"
        })),
        confirmation_token: Some("operator-confirmed".to_owned()),
        failure_reason: failure_reason.map(str::to_owned),
        expected_version: None,
    }
}

fn grant_summary(mode: &str) -> Value {
    json!({
        "actorId": "workspace-agent",
        "mode": mode,
        "constraints": {
            "noDelete": true,
            "noDownstreamAutoStart": true,
            "noGit": true,
            "noRollback": true,
            "noTerminal": true,
            "noValidationExecution": true
        },
        "maxActions": 16
    })
}

fn test_workspace_root() -> String {
    std::env::current_dir()
        .expect("current dir")
        .to_string_lossy()
        .into_owned()
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    WorkspaceService::new(initialized_store(db_path))
}

fn initialized_store(db_path: &Path) -> SqliteStore {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    store
}

fn assert_no_forbidden_step_dto_keys<T: serde::Serialize>(value: &T) {
    let value = serde_json::to_value(value).expect("serialize step dto");
    for forbidden in [
        "direct_work_input",
        "directWorkInput",
        "operator_prompt",
        "operatorPrompt",
        "stdout",
        "stderr",
    ] {
        assert!(
            !json_object_contains_key(&value, forbidden),
            "workflow step DTO must not expose {forbidden}"
        );
    }
}

fn assert_no_raw_confirmation_token<T: serde::Serialize>(value: &T) {
    let value = serde_json::to_value(value).expect("serialize step dto");
    assert!(
        !json_contains_string(&value, "operator-confirmed"),
        "workflow step DTO must not expose raw confirmation tokens"
    );
}

fn json_object_contains_key(value: &Value, key: &str) -> bool {
    match value {
        Value::Object(object) => object
            .iter()
            .any(|(object_key, value)| object_key == key || json_object_contains_key(value, key)),
        Value::Array(values) => values
            .iter()
            .any(|value| json_object_contains_key(value, key)),
        _ => false,
    }
}

fn json_contains_string(value: &Value, needle: &str) -> bool {
    match value {
        Value::String(text) => text.contains(needle),
        Value::Object(object) => object
            .values()
            .any(|value| json_contains_string(value, needle)),
        Value::Array(values) => values
            .iter()
            .any(|value| json_contains_string(value, needle)),
        _ => false,
    }
}

fn unique_test_db_path(label: &str) -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-workflow-headless-smoke-{label}-{}-{nanos}.sqlite",
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
