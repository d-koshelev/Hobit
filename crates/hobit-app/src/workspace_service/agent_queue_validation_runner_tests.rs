use super::*;

use std::cell::RefCell;
use std::env;

use hobit_storage_sqlite::SqliteStore;
use hobit_tools::process::{ProcessRunOutput, ProcessRunStatus};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn queue_validation_runner_calls_injected_executor_only_when_run_is_explicit() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Validation", None)
        .expect("create workspace");
    let task = create_task_with_workspace(&service, &workspace.id);
    let calls = RefCell::new(0);

    assert_eq!(*calls.borrow(), 0);

    let summary = service
        .run_agent_queue_validation_suite_with_runner(
            validation_input(&workspace.id, &task.queue_item_id),
            |request| {
                *calls.borrow_mut() += 1;
                assert_eq!(request.program, "cargo");
                assert_eq!(request.args, vec!["check"]);
                process_output(ProcessRunStatus::Completed, Some(0), "ok", "", false, false)
            },
        )
        .expect("run validation");

    assert_eq!(*calls.borrow(), 1);
    assert_eq!(summary.status, "passed");
    assert_eq!(summary.evidence.len(), 1);
    assert_eq!(summary.evidence[0].status, "passed");
    assert!(summary.no_git_mutations);
    assert!(summary.no_commit_push);
}

#[test]
fn queue_validation_runner_caps_output_and_maps_exit_code_to_failed() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Validation", None)
        .expect("create workspace");
    let task = create_task_with_workspace(&service, &workspace.id);

    let summary = service
        .run_agent_queue_validation_suite_with_runner(
            validation_input(&workspace.id, &task.queue_item_id),
            |_| {
                process_output(
                    ProcessRunStatus::Completed,
                    Some(2),
                    "abcdef",
                    "uvwxyz",
                    true,
                    true,
                )
            },
        )
        .expect("run validation");

    assert_eq!(summary.status, "failed");
    assert_eq!(summary.task_validation_status, "failed");
    assert_eq!(summary.command_results[0].status, "failed");
    assert_eq!(summary.command_results[0].exit_code, Some(2));
    assert_eq!(summary.command_results[0].stdout_preview, "abcdef");
    assert!(summary.command_results[0].stdout_truncated);
    assert!(summary.evidence[0].stderr_truncated);
}

#[test]
fn queue_validation_runner_maps_timeout_and_warns_cancel_is_unsupported() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Validation", None)
        .expect("create workspace");
    let task = create_task_with_workspace(&service, &workspace.id);

    let summary = service
        .run_agent_queue_validation_suite_with_runner(
            validation_input(&workspace.id, &task.queue_item_id),
            |_| {
                process_output(
                    ProcessRunStatus::TimedOut,
                    None,
                    "",
                    "timeout",
                    false,
                    false,
                )
            },
        )
        .expect("run validation");

    assert_eq!(summary.status, "failed");
    assert_eq!(summary.command_results[0].status, "timed_out");
    assert!(summary
        .warnings
        .iter()
        .any(|warning| warning.contains("cancellation is unsupported")));
}

#[test]
fn queue_validation_runner_blocks_unsafe_command_without_executor_call() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Validation", None)
        .expect("create workspace");
    let task = create_task_with_workspace(&service, &workspace.id);
    let calls = RefCell::new(0);
    let mut input = validation_input(&workspace.id, &task.queue_item_id);
    input.commands[0].program = "git".to_owned();
    input.commands[0].args = vec!["reset".to_owned(), "--hard".to_owned()];
    input.commands[0].safety_category = "mutates_git".to_owned();

    let summary = service
        .run_agent_queue_validation_suite_with_runner(input, |_| {
            *calls.borrow_mut() += 1;
            process_output(ProcessRunStatus::Completed, Some(0), "", "", false, false)
        })
        .expect("run validation");

    assert_eq!(*calls.borrow(), 0);
    assert_eq!(summary.status, "failed");
    assert_eq!(summary.command_results[0].status, "failed_to_start");
    assert!(summary.command_results[0]
        .errors
        .iter()
        .any(|error| error.contains("safety category")));
}

#[test]
fn queue_validation_runner_requires_cwd_inside_task_execution_workspace() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Validation", None)
        .expect("create workspace");
    let task = create_task_with_workspace(&service, &workspace.id);
    let mut input = validation_input(&workspace.id, &task.queue_item_id);
    input.cwd = env::temp_dir();
    input.commands[0].cwd = input.cwd.clone();

    let error = service
        .run_agent_queue_validation_suite_with_runner(input, |_| {
            panic!("executor should not run for invalid cwd")
        })
        .expect_err("invalid cwd");

    assert!(error
        .to_string()
        .contains("validation suite cwd must be inside"));
}

fn create_task_with_workspace(
    service: &WorkspaceService,
    workspace_id: &str,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Run validation".to_owned(),
            description: String::new(),
            prompt: "Validate the work".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: None,
            execution_workspace: Some(current_dir()),
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create task")
}

fn validation_input(workspace_id: &str, queue_item_id: &str) -> RunAgentQueueValidationSuiteInput {
    let cwd = current_dir();
    RunAgentQueueValidationSuiteInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        requested_by_surface: "queue".to_owned(),
        cwd: cwd.clone().into(),
        commands: vec![AgentQueueValidationCommandSpecInput {
            command_id: "cargo-check".to_owned(),
            title: "Cargo check".to_owned(),
            program: "cargo".to_owned(),
            args: vec!["check".to_owned()],
            cwd: cwd.into(),
            timeout_ms: Some(1_000),
            stdout_cap_bytes: Some(12),
            stderr_cap_bytes: Some(12),
            allowed_exit_codes: vec![0],
            safety_category: "build_or_test".to_owned(),
            source: "manual".to_owned(),
        }],
        stop_on_first_failure: true,
    }
}

fn process_output(
    status: ProcessRunStatus,
    exit_code: Option<i32>,
    stdout: &str,
    stderr: &str,
    stdout_truncated: bool,
    stderr_truncated: bool,
) -> ProcessRunOutput {
    ProcessRunOutput {
        status,
        exit_code,
        stdout: stdout.to_owned(),
        stderr: stderr.to_owned(),
        stdout_truncated,
        stderr_truncated,
        duration_ms: 42,
        error_message: match status {
            ProcessRunStatus::Completed => None,
            ProcessRunStatus::FailedToStart => Some("failed to start".to_owned()),
            ProcessRunStatus::TimedOut => Some("process timed out".to_owned()),
        },
    }
}

fn current_dir() -> String {
    env::current_dir()
        .expect("current dir")
        .display()
        .to_string()
}
