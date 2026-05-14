use super::*;

use std::cell::RefCell;
use std::path::PathBuf;

use hobit_storage_sqlite::SqliteStore;
use hobit_tools::git_diff::{
    GitDiffCommandSummary as ToolsGitDiffCommandSummary, GitDiffError, GitDiffFileStatus,
    GitDiffFileSummary as ToolsGitDiffFileSummary, GitDiffSummary as ToolsGitDiffSummary,
    GitDiffSummaryStatus, GitDiffTotals,
};

use crate::WorkspaceServiceError;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn get_agent_executor_diff_summary_for_valid_widget_succeeds_without_writes() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let event_count = service
        .store
        .list_workbench_events(&workspace_id)
        .expect("list events")
        .len();
    let log_count = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("logs")
        .len();
    let request_seen = RefCell::new(None);

    let summary = service
        .get_agent_executor_diff_summary_with_reader(
            &workspace_id,
            &workbench_id,
            &widget_id,
            "repo-root",
            Some(10),
            Some(1024),
            Some(false),
            |request| {
                *request_seen.borrow_mut() = Some(request);
                Ok(diff_summary_fixture("repo-root"))
            },
        )
        .expect("read diff summary")
        .expect("diff summary");
    let events_after_read = service
        .store
        .list_workbench_events(&workspace_id)
        .expect("list events")
        .len();
    let logs_after_read = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("logs")
        .len();

    assert_eq!(summary.status, "dirty");
    assert_eq!(summary.repo_root, "repo-root");
    assert_eq!(summary.summary.total_files, 1);
    assert_eq!(summary.files[0].path, "src/lib.rs");
    assert_eq!(summary.files[0].status, "modified");
    assert_eq!(summary.files[0].additions, Some(2));
    assert_eq!(summary.files[0].deletions, Some(1));
    assert_eq!(summary.command_summary[0].program, "git");
    let request = request_seen.into_inner().expect("request seen");
    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.max_files, Some(10));
    assert_eq!(request.max_patch_bytes_per_file, Some(1024));
    assert!(!request.include_patch_preview);
    assert_eq!(events_after_read, event_count);
    assert_eq!(logs_after_read, log_count);
}

#[test]
fn get_agent_executor_diff_summary_rejects_non_agent_executor_widget() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes")
        .expect("state");
    let widget_id = state.widget_instances[0].id.clone();

    let error = service
        .get_agent_executor_diff_summary_with_reader(
            &workspace.id,
            workbench_id,
            &widget_id,
            "repo-root",
            None,
            None,
            None,
            |_| panic!("diff reader should not be called"),
        )
        .expect_err("reject non-Agent Executor");

    assert!(
        matches!(error, WorkspaceServiceError::InvalidInput(message) if message.contains("Agent Executor"))
    );
}

#[test]
fn get_agent_executor_diff_summary_is_scoped_to_workspace_and_workbench() {
    let service = initialized_service();
    let (workspace_id, workbench_id, _widget_id) = add_agent_executor_widget(&service);
    let (_other_workspace_id, _other_workbench_id, other_widget_id) =
        add_agent_executor_widget(&service);

    let summary = service
        .get_agent_executor_diff_summary_with_reader(
            &workspace_id,
            &workbench_id,
            &other_widget_id,
            "repo-root",
            None,
            None,
            None,
            |_| panic!("diff reader should not be called for cross-workspace widget"),
        )
        .expect("cross workspace should not error");

    assert!(summary.is_none());
}

#[test]
fn get_agent_executor_diff_summary_surfaces_git_helper_errors() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);

    let error = service
        .get_agent_executor_diff_summary_with_reader(
            &workspace_id,
            &workbench_id,
            &widget_id,
            "repo-root",
            None,
            None,
            None,
            |_| Err(GitDiffError::TimedOut),
        )
        .expect_err("surface helper error");

    assert!(matches!(
        error,
        WorkspaceServiceError::GitDiff(GitDiffError::TimedOut)
    ));
}

#[test]
fn get_agent_executor_diff_summary_rejects_empty_repository_root() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);

    let error = service
        .get_agent_executor_diff_summary(
            &workspace_id,
            &workbench_id,
            &widget_id,
            "  ",
            None,
            None,
            None,
        )
        .expect_err("reject empty repository root");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
}

fn add_agent_executor_widget(service: &WorkspaceService) -> (String, String, String) {
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
            "Agent Executor",
            "agent",
        )
        .expect("add agent executor")
        .expect("state after add");

    (
        workspace.id,
        workbench_id,
        state.widget_instances[0].id.clone(),
    )
}

fn diff_summary_fixture(repo_root: &str) -> ToolsGitDiffSummary {
    ToolsGitDiffSummary {
        repo_root: repo_root.to_owned(),
        status: GitDiffSummaryStatus::Dirty,
        files: vec![ToolsGitDiffFileSummary {
            path: "src/lib.rs".to_owned(),
            status: GitDiffFileStatus::Modified,
            staged: false,
            unstaged: true,
            untracked: false,
            conflicted: false,
            additions: Some(2),
            deletions: Some(1),
            patch_preview: Some("diff --git a/src/lib.rs b/src/lib.rs".to_owned()),
            patch_truncated: false,
        }],
        summary: GitDiffTotals {
            total_files: 1,
            staged_count: 0,
            unstaged_count: 1,
            untracked_count: 0,
            conflicted_count: 0,
            total_additions: Some(2),
            total_deletions: Some(1),
        },
        error_message: None,
        command_summary: vec![ToolsGitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec!["-C".to_owned(), repo_root.to_owned(), "status".to_owned()],
        }],
    }
}
