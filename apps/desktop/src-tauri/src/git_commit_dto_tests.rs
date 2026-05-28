use std::path::PathBuf;

use hobit_app::{CreateGitCommitInput, GitCommitCommandSummary, GitCommitRunSummary};
use serde_json::json;

use crate::git_commit_dto::{CreateGitCommitRequest, GitCommitResponseDto};

#[test]
fn maps_create_git_commit_request_to_app_input() {
    let request = CreateGitCommitRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        repo_root: "C:/repo".to_owned(),
        commit_message: "Commit message".to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
    };

    let input = CreateGitCommitInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.repo_root, PathBuf::from("C:/repo"));
    assert_eq!(input.commit_message, "Commit message");
    assert_eq!(input.included_files, vec!["src/lib.rs"]);
}

#[test]
fn maps_git_commit_summary_to_dto() {
    let dto = GitCommitResponseDto::from(GitCommitRunSummary {
        status: "committed".to_owned(),
        commit_hash: Some("abc123".to_owned()),
        branch: Some("main".to_owned()),
        repo_root: "C:/repo".to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
        commit_message: "Commit message".to_owned(),
        exit_code: Some(0),
        stdout: "out".to_owned(),
        stderr: "err".to_owned(),
        duration_ms: 42,
        error_message: None,
        command_summary: vec![GitCommitCommandSummary {
            program: "git".to_owned(),
            args: vec![
                "-C".to_owned(),
                "C:/repo".to_owned(),
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
    });

    assert_eq!(dto.status, "committed");
    assert_eq!(dto.commit_hash.as_deref(), Some("abc123"));
    assert_eq!(dto.branch.as_deref(), Some("main"));
    assert_eq!(dto.included_files, vec!["src/lib.rs"]);
    assert_eq!(dto.command_summary[0].program, "git");
    assert!(!dto.push_performed);
    assert!(!dto.force_push_performed);
    assert!(!dto.reset_performed);
    assert!(!dto.clean_performed);
    assert!(!dto.auto_commit);
    assert!(dto.operator_confirmed_required);
}

#[test]
fn serializes_git_commit_response_with_stable_snake_case_safety_flags() {
    let dto = GitCommitResponseDto::from(GitCommitRunSummary {
        status: "committed".to_owned(),
        commit_hash: Some("abc123".to_owned()),
        branch: Some("main".to_owned()),
        repo_root: "C:/repo".to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
        commit_message: "Commit message".to_owned(),
        exit_code: Some(0),
        stdout: "out".to_owned(),
        stderr: "err".to_owned(),
        duration_ms: 42,
        error_message: None,
        command_summary: vec![GitCommitCommandSummary {
            program: "git".to_owned(),
            args: vec!["commit".to_owned()],
        }],
        push_performed: false,
        force_push_performed: false,
        reset_performed: false,
        clean_performed: false,
        auto_commit: false,
        operator_confirmed_required: true,
    });

    assert_eq!(
        serde_json::to_value(dto).expect("serialize commit dto"),
        json!({
            "status": "committed",
            "commit_hash": "abc123",
            "branch": "main",
            "repo_root": "C:/repo",
            "included_files": ["src/lib.rs"],
            "commit_message": "Commit message",
            "exit_code": 0,
            "stdout": "out",
            "stderr": "err",
            "duration_ms": 42,
            "error_message": null,
            "command_summary": [{"program": "git", "args": ["commit"]}],
            "push_performed": false,
            "force_push_performed": false,
            "reset_performed": false,
            "clean_performed": false,
            "auto_commit": false,
            "operator_confirmed_required": true
        })
    );
}
