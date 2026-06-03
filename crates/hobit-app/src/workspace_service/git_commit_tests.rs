use super::*;

use std::cell::RefCell;
use std::path::PathBuf;

use hobit_storage_sqlite::SqliteStore;
use hobit_tools::git_commit::{
    GitCommitCommandSummary as ToolsGitCommitCommandSummary, GitCommitError, GitCommitRequest,
    GitCommitResult as ToolsGitCommitResult, GitCommitStatus,
};

use crate::WorkspaceServiceError;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn valid_git_widget_commit_succeeds() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_widget(&service, GIT_WIDGET_DEFINITION_ID);
    let request_seen = RefCell::new(None);

    let summary = service
        .create_git_commit_with_runner(
            CreateGitCommitInput {
                workspace_id: workspace_id.clone(),
                workbench_id: workbench_id.clone(),
                widget_instance_id: widget_id.clone(),
                repo_root: PathBuf::from("repo-root"),
                commit_message: "Commit message".to_owned(),
                included_files: vec!["src/lib.rs".to_owned()],
            },
            |request| {
                *request_seen.borrow_mut() = Some(request);
                Ok(commit_result_fixture("repo-root"))
            },
        )
        .expect("create commit")
        .expect("commit summary");

    assert_eq!(summary.status, "committed");
    assert_eq!(summary.commit_hash.as_deref(), Some("abc123"));
    assert_eq!(summary.branch.as_deref(), Some("main"));
    assert_eq!(summary.included_files, vec!["src/lib.rs"]);
    assert_eq!(summary.command_summary[0].program, "git");

    let request: GitCommitRequest = request_seen.into_inner().expect("request seen");
    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.commit_message, "Commit message");
    assert_eq!(request.included_files, vec!["src/lib.rs"]);
}

#[test]
fn workspace_git_commit_succeeds_without_git_widget_instance() {
    let service = initialized_service();
    let request_seen = RefCell::new(None);

    let summary = service
        .create_workspace_git_commit_with_runner(
            CreateWorkspaceGitCommitInput {
                repo_root: PathBuf::from("repo-root"),
                commit_message: "Commit message".to_owned(),
                included_files: vec!["src/lib.rs".to_owned()],
            },
            |request| {
                *request_seen.borrow_mut() = Some(request);
                Ok(commit_result_fixture("repo-root"))
            },
        )
        .expect("create workspace Git commit");

    assert_eq!(summary.status, "committed");
    assert_eq!(summary.commit_hash.as_deref(), Some("abc123"));
    assert_eq!(summary.included_files, vec!["src/lib.rs"]);
    assert!(!summary.push_performed);
    assert!(!summary.reset_performed);
    assert!(!summary.clean_performed);
    assert!(!summary.auto_commit);

    let request: GitCommitRequest = request_seen.into_inner().expect("request seen");
    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.commit_message, "Commit message");
    assert_eq!(request.included_files, vec!["src/lib.rs"]);
}

#[test]
fn workspace_git_commit_surfaces_empty_message_and_files_before_mutation() {
    let service = initialized_service();

    let empty_message = service
        .create_workspace_git_commit_with_runner(
            CreateWorkspaceGitCommitInput {
                repo_root: PathBuf::from("repo-root"),
                commit_message: " ".to_owned(),
                included_files: vec!["src/lib.rs".to_owned()],
            },
            |_| Err(GitCommitError::EmptyCommitMessage),
        )
        .expect_err("empty commit message should be rejected");

    assert!(matches!(
        empty_message,
        WorkspaceServiceError::GitCommit(GitCommitError::EmptyCommitMessage)
    ));

    let empty_files = service
        .create_workspace_git_commit_with_runner(
            CreateWorkspaceGitCommitInput {
                repo_root: PathBuf::from("repo-root"),
                commit_message: "Commit".to_owned(),
                included_files: Vec::new(),
            },
            |_| Err(GitCommitError::EmptyIncludedFiles),
        )
        .expect_err("empty included files should be rejected");

    assert!(matches!(
        empty_files,
        WorkspaceServiceError::GitCommit(GitCommitError::EmptyIncludedFiles)
    ));
}

#[test]
fn workspace_git_commit_rejects_files_outside_repo_root() {
    let service = initialized_service();

    let error = service
        .create_workspace_git_commit_with_runner(
            CreateWorkspaceGitCommitInput {
                repo_root: PathBuf::from("repo-root"),
                commit_message: "Commit".to_owned(),
                included_files: vec!["../outside.txt".to_owned()],
            },
            |_| {
                Err(GitCommitError::InvalidIncludedFile {
                    path: "../outside.txt".to_owned(),
                    reason: "path must not escape repo root".to_owned(),
                })
            },
        )
        .expect_err("outside file should be rejected");

    assert!(matches!(
        error,
        WorkspaceServiceError::GitCommit(GitCommitError::InvalidIncludedFile { .. })
    ));
}

#[test]
fn non_git_widget_is_rejected() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_widget(&service, "notes");

    let error = service
        .create_git_commit_with_runner(
            commit_input(&workspace_id, &workbench_id, &widget_id),
            |_| panic!("Git helper must not run for non-Git widget"),
        )
        .expect_err("non-Git widget should be rejected");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
}

#[test]
fn cross_workspace_or_workbench_widget_is_rejected() {
    let service = initialized_service();
    let (_workspace_id, _workbench_id, widget_id) = add_widget(&service, GIT_WIDGET_DEFINITION_ID);
    let (other_workspace_id, other_workbench_id, _other_widget_id) =
        add_widget(&service, GIT_WIDGET_DEFINITION_ID);

    let summary = service
        .create_git_commit_with_runner(
            commit_input(&other_workspace_id, &other_workbench_id, &widget_id),
            |_| panic!("Git helper must not run for cross-workspace widget"),
        )
        .expect("cross-workspace widget should return none");

    assert!(summary.is_none());
}

#[test]
fn result_contains_git_mutation_safety_flags() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_widget(&service, GIT_WIDGET_DEFINITION_ID);

    let summary = service
        .create_git_commit_with_runner(
            commit_input(&workspace_id, &workbench_id, &widget_id),
            |_| Ok(commit_result_fixture("repo-root")),
        )
        .expect("create commit")
        .expect("commit summary");

    assert!(!summary.push_performed);
    assert!(!summary.force_push_performed);
    assert!(!summary.reset_performed);
    assert!(!summary.clean_performed);
    assert!(!summary.auto_commit);
    assert!(summary.operator_confirmed_required);
}

#[test]
fn git_helper_error_is_surfaced_clearly() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_widget(&service, GIT_WIDGET_DEFINITION_ID);

    let error = service
        .create_git_commit_with_runner(
            commit_input(&workspace_id, &workbench_id, &widget_id),
            |_| Err(GitCommitError::NotGitRepository),
        )
        .expect_err("Git helper error should surface");

    assert!(matches!(error, WorkspaceServiceError::GitCommit(_)));
    assert!(error.to_string().contains("not a Git repository"));
}

fn add_widget(service: &WorkspaceService, definition_id: &str) -> (String, String, String) {
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
            definition_id,
            "Widget",
            "workflow",
        )
        .expect("add widget")
        .expect("state after add");

    (
        workspace.id,
        workbench_id,
        state.widget_instances[0].id.clone(),
    )
}

fn commit_input(workspace_id: &str, workbench_id: &str, widget_id: &str) -> CreateGitCommitInput {
    CreateGitCommitInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        repo_root: PathBuf::from("repo-root"),
        commit_message: "Commit message".to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
    }
}

fn commit_result_fixture(repo_root: &str) -> ToolsGitCommitResult {
    ToolsGitCommitResult {
        status: GitCommitStatus::Committed,
        commit_hash: Some("abc123".to_owned()),
        branch: Some("main".to_owned()),
        repo_root: repo_root.to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
        commit_message: "Commit message".to_owned(),
        exit_code: Some(0),
        stdout: "[main abc123] Commit message".to_owned(),
        stderr: String::new(),
        duration_ms: 12,
        error_message: None,
        command_summary: vec![ToolsGitCommitCommandSummary {
            program: "git".to_owned(),
            args: vec![
                "-C".to_owned(),
                repo_root.to_owned(),
                "commit".to_owned(),
                "-m".to_owned(),
                "Commit message".to_owned(),
            ],
        }],
        push_performed: false,
        force_push_performed: false,
        reset_performed: false,
        clean_performed: false,
        auto_commit: false,
        operator_confirmed_required: true,
    }
}
