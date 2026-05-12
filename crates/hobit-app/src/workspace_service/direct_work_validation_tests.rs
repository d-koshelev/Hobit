use super::*;

use std::cell::RefCell;
use std::env;
use std::path::PathBuf;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use hobit_tools::toolbelt::{
    ToolbeltValidationOutput, ToolbeltValidationProfile, ToolbeltValidationRequest,
    ToolbeltValidationStatus,
};
use serde_json::Value;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn direct_work_validation_for_valid_widget_creates_run_logs_result_and_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "fast",
            ),
            |request| {
                assert_eq!(request.profile, ToolbeltValidationProfile::Fast);
                assert_eq!(request.timeout_ms, Some(2_000));
                assert_eq!(request.stdout_cap_bytes, Some(16 * 1024));
                assert_eq!(request.stderr_cap_bytes, Some(8 * 1024));
                validation_output(&request, ToolbeltValidationStatus::Passed)
            },
        )
        .expect("run validation")
        .expect("validation summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let result_payload = validation_result_payload(&service, &summary.run_id);
    let command_payload: Value =
        serde_json::from_str(run.command_payload.as_deref().expect("command payload"))
            .expect("command payload json");

    assert_eq!(summary.result_type, "direct_work_validation_result");
    assert_eq!(summary.profile, "fast");
    assert_eq!(summary.status, "passed");
    assert_eq!(summary.run_status, "completed");
    assert_eq!(summary.exit_code, Some(0));
    assert_eq!(summary.stdout, "validation stdout");
    assert_eq!(summary.stderr, "validation stderr");
    assert_eq!(summary.command_summary, vec!["toolbelt", "fast"]);
    assert!(summary.no_git_mutations);
    assert!(summary.no_commit_push);
    assert!(!summary.git_mutations_performed_by_hobit);
    assert_eq!(run.status, "completed");
    assert_eq!(run.command_kind.as_deref(), Some("direct_work_validation"));
    assert_eq!(command_payload["mode"], "direct_work_validation");
    assert_eq!(command_payload["profile"], "fast");
    assert_eq!(command_payload["automatically_triggered"], false);
    assert_eq!(
        result_payload["result_type"],
        "direct_work_validation_result"
    );
    assert_eq!(result_payload["status"], "passed");
    assert_eq!(result_payload["run_status"], "completed");
    assert_eq!(result_payload["stdout"], "validation stdout");
    assert_eq!(result_payload["stderr"], "validation stderr");
    assert_eq!(result_payload["no_git_mutations"], true);
    assert_eq!(result_payload["no_commit_push"], true);
    assert_eq!(result_payload["git_mutations_performed_by_hobit"], false);
    assert_eq!(
        widget_log_messages(&logs),
        vec![
            "Widget added",
            "Direct Work validation requested",
            "Toolbelt validation started",
            "Toolbelt validation passed",
        ]
    );
    assert!(logs
        .iter()
        .skip(1)
        .all(|log| log.run_id.as_deref() == Some(summary.run_id.as_str())));
}

#[test]
fn direct_work_validation_rejects_non_allowed_widget_without_run_log_or_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    let summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace.id,
                workbench_id,
                &widget_id,
                current_repo_root(),
                "changed",
            ),
            |_| panic!("validation runner should not be called for non-allowed widgets"),
        )
        .expect("reject non-allowed widget");
    let runs = service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("list runs");
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");

    assert!(summary.is_none());
    assert!(runs.is_empty());
    assert_eq!(widget_log_messages(&logs), vec!["Widget added"]);
}

#[test]
fn direct_work_validation_rejects_cross_workspace_and_cross_workbench_without_leaks() {
    let service = initialized_service();
    let (workspace_id, workbench_id, _widget_id) = add_direct_work_widget(&service);
    let (other_workspace_id, _other_workbench_id, other_widget_id) =
        add_direct_work_widget(&service);

    let cross_workspace_summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                &other_widget_id,
                current_repo_root(),
                "fast",
            ),
            |_| panic!("validation runner should not be called for cross-workspace widgets"),
        )
        .expect("reject cross-workspace widget");
    let cross_workspace_runs = service
        .store
        .list_widget_runs_for_widget(&other_widget_id)
        .expect("list cross-workspace widget runs");

    assert_ne!(workspace_id, other_workspace_id);
    assert!(cross_workspace_summary.is_none());
    assert!(cross_workspace_runs.is_empty());

    service
        .store
        .create_workspace_workbench("other-workbench", &workspace_id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-agent-run-validation",
            workspace_id: &workspace_id,
            workbench_id: "other-workbench",
            definition_id: AGENT_RUN_WIDGET_DEFINITION_ID,
            title: "Other Agent Monitoring",
            category: "core",
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
        .expect("insert other workbench widget");

    let cross_workbench_summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                "other-agent-run-validation",
                current_repo_root(),
                "fast",
            ),
            |_| panic!("validation runner should not be called for cross-workbench widgets"),
        )
        .expect("reject cross-workbench widget");
    let cross_workbench_runs = service
        .store
        .list_widget_runs_for_widget("other-agent-run-validation")
        .expect("list cross-workbench runs");
    let cross_workbench_logs = service
        .store
        .list_widget_logs_for_widget("other-agent-run-validation", 20)
        .expect("list cross-workbench logs");

    assert!(cross_workbench_summary.is_none());
    assert!(cross_workbench_runs.is_empty());
    assert!(cross_workbench_logs.is_empty());
}

#[test]
fn direct_work_validation_failed_profile_maps_to_completed_failed_result() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "changed",
            ),
            |request| validation_output(&request, ToolbeltValidationStatus::Failed),
        )
        .expect("run validation")
        .expect("validation summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = validation_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "failed");
    assert_eq!(summary.run_status, "completed");
    assert_eq!(summary.exit_code, Some(17));
    assert_eq!(run.status, "completed");
    assert_eq!(payload["status"], "failed");
    assert_eq!(payload["run_status"], "completed");
    assert_eq!(
        last_widget_log(&service, &widget_id).as_deref(),
        Some("Toolbelt validation failed")
    );
}

#[test]
fn direct_work_validation_timeout_maps_to_timed_out_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "full",
            ),
            |request| validation_output(&request, ToolbeltValidationStatus::TimedOut),
        )
        .expect("run validation")
        .expect("validation summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = validation_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "timed_out");
    assert_eq!(summary.run_status, "timed_out");
    assert_eq!(run.status, "timed_out");
    assert_eq!(payload["status"], "timed_out");
    assert_eq!(payload["run_status"], "timed_out");
}

#[test]
fn direct_work_validation_failed_to_start_maps_to_failed_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "fast",
            ),
            |request| validation_output(&request, ToolbeltValidationStatus::FailedToStart),
        )
        .expect("run validation")
        .expect("validation summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = validation_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "failed_to_start");
    assert_eq!(summary.run_status, "failed");
    assert_eq!(
        summary.error_message.as_deref(),
        Some("validation failed_to_start")
    );
    assert_eq!(run.status, "failed");
    assert_eq!(payload["status"], "failed_to_start");
    assert_eq!(payload["error_message"], "validation failed_to_start");
}

#[test]
fn direct_work_validation_runner_is_called_after_pre_run_transaction_is_committed() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let observed_pre_run_records = RefCell::new(false);

    let summary = service
        .run_direct_work_validation_with_runner(
            validation_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "fast",
            ),
            |request| {
                service
                    .store
                    .with_immediate_transaction(|store| {
                        let runs = store.list_widget_runs_for_widget(&widget_id)?;
                        let logs = store.list_widget_logs_for_widget(&widget_id, 20)?;

                        assert_eq!(runs.len(), 1);
                        assert_eq!(runs[0].status, "running");
                        assert!(logs
                            .iter()
                            .map(|log| log.message.as_str())
                            .any(|message| message == "Toolbelt validation started"));
                        Ok(())
                    })
                    .expect("runner can start its own transaction");

                *observed_pre_run_records.borrow_mut() = true;
                validation_output(&request, ToolbeltValidationStatus::Passed)
            },
        )
        .expect("run validation")
        .expect("validation summary");

    assert!(*observed_pre_run_records.borrow());
    assert_eq!(summary.status, "passed");
}

fn add_direct_work_widget(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id")
        .to_owned();
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            AGENT_RUN_WIDGET_DEFINITION_ID,
            "Agent Monitoring",
            "core",
        )
        .expect("add agent monitoring widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn validation_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
    repo_root: PathBuf,
    validation_profile: &str,
) -> RunDirectWorkValidationInput {
    RunDirectWorkValidationInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        repo_root,
        validation_profile: validation_profile.to_owned(),
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn validation_output(
    request: &ToolbeltValidationRequest,
    status: ToolbeltValidationStatus,
) -> ToolbeltValidationOutput {
    ToolbeltValidationOutput {
        status,
        profile: request.profile,
        exit_code: match status {
            ToolbeltValidationStatus::Passed => Some(0),
            ToolbeltValidationStatus::Failed => Some(17),
            ToolbeltValidationStatus::FailedToStart | ToolbeltValidationStatus::TimedOut => None,
        },
        stdout: "validation stdout".to_owned(),
        stderr: "validation stderr".to_owned(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 42,
        error_message: match status {
            ToolbeltValidationStatus::Passed => None,
            ToolbeltValidationStatus::Failed => Some("validation failed".to_owned()),
            ToolbeltValidationStatus::FailedToStart => {
                Some("validation failed_to_start".to_owned())
            }
            ToolbeltValidationStatus::TimedOut => Some("validation timed out".to_owned()),
        },
        command_summary: vec![
            "toolbelt".to_owned(),
            request.profile.as_cli_arg().to_owned(),
        ],
        repo_root: request.repo_root.clone(),
    }
}

fn validation_result_payload(service: &WorkspaceService, run_id: &str) -> Value {
    let results = service
        .store
        .list_widget_results(run_id)
        .expect("list widget results");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].result_type, "direct_work_validation_result");

    serde_json::from_str(results[0].payload.as_deref().expect("result payload"))
        .expect("result payload json")
}

fn last_widget_log(service: &WorkspaceService, widget_id: &str) -> Option<String> {
    service
        .store
        .list_widget_logs_for_widget(widget_id, 20)
        .expect("list logs")
        .last()
        .map(|log| log.message.clone())
}

fn current_repo_root() -> PathBuf {
    env::current_dir().expect("current dir")
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}
