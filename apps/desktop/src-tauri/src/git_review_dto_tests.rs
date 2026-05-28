use hobit_app::{GitDiffCommandSummary, GitFileDiffSummary, GitLogEntrySummary, GitLogSummary};
use serde_json::json;

use crate::git_review_dto::{GetGitFileDiffRequest, GetGitLogRequest, GitFileDiffDto, GitLogDto};

#[test]
fn maps_git_file_diff_to_dto() {
    let dto = GitFileDiffDto::from(GitFileDiffSummary {
        repo_root: "repo-root".to_owned(),
        path: "src/lib.rs".to_owned(),
        status: "available".to_owned(),
        patch: Some("diff --git a/src/lib.rs b/src/lib.rs".to_owned()),
        patch_truncated: false,
        error_message: None,
        command_summary: vec![GitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec!["-C".to_owned(), "repo-root".to_owned(), "diff".to_owned()],
        }],
    });

    assert_eq!(dto.repo_root, "repo-root");
    assert_eq!(dto.path, "src/lib.rs");
    assert_eq!(dto.status, "available");
    assert_eq!(dto.command_summary[0].program, "git");
}

#[test]
fn maps_git_log_to_dto() {
    let dto = GitLogDto::from(GitLogSummary {
        repo_root: "repo-root".to_owned(),
        entries: vec![GitLogEntrySummary {
            hash: "abcdef123456".to_owned(),
            short_hash: "abcdef1".to_owned(),
            subject: "initial".to_owned(),
            author: "Hobit".to_owned(),
            date: "2026-05-27T10:00:00Z".to_owned(),
        }],
        command_summary: vec![GitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec!["-C".to_owned(), "repo-root".to_owned(), "log".to_owned()],
        }],
    });

    assert_eq!(dto.repo_root, "repo-root");
    assert_eq!(dto.entries[0].short_hash, "abcdef1");
    assert_eq!(dto.entries[0].subject, "initial");
    assert_eq!(dto.command_summary[0].args[2], "log");
}

#[test]
fn deserializes_git_review_requests_with_current_command_payload_names() {
    let diff_request: GetGitFileDiffRequest = serde_json::from_value(json!({
        "workspace_id": "ws_1",
        "workbench_id": "wb_1",
        "widget_instance_id": "git_1",
        "repository_root": "C:/repo",
        "path": "src/lib.rs",
        "max_patch_bytes": 4096
    }))
    .expect("deserialize diff request");
    let log_request: GetGitLogRequest = serde_json::from_value(json!({
        "workspace_id": "ws_1",
        "workbench_id": "wb_1",
        "widget_instance_id": "git_1",
        "repository_root": "C:/repo",
        "limit": 25
    }))
    .expect("deserialize log request");

    assert_eq!(diff_request.repository_root, "C:/repo");
    assert_eq!(diff_request.path, "src/lib.rs");
    assert_eq!(diff_request.max_patch_bytes, Some(4096));
    assert_eq!(log_request.repository_root, "C:/repo");
    assert_eq!(log_request.limit, Some(25));
}

#[test]
fn serializes_git_review_dtos_with_stable_snake_case_fields() {
    let diff = GitFileDiffDto::from(GitFileDiffSummary {
        repo_root: "repo-root".to_owned(),
        path: "src/lib.rs".to_owned(),
        status: "available".to_owned(),
        patch: Some("diff".to_owned()),
        patch_truncated: true,
        error_message: None,
        command_summary: vec![GitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec!["diff".to_owned()],
        }],
    });
    let log = GitLogDto::from(GitLogSummary {
        repo_root: "repo-root".to_owned(),
        entries: vec![GitLogEntrySummary {
            hash: "abcdef123456".to_owned(),
            short_hash: "abcdef1".to_owned(),
            subject: "initial".to_owned(),
            author: "Hobit".to_owned(),
            date: "2026-05-27T10:00:00Z".to_owned(),
        }],
        command_summary: vec![GitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec!["log".to_owned()],
        }],
    });

    assert_eq!(
        serde_json::to_value(diff).expect("serialize diff"),
        json!({
            "repo_root": "repo-root",
            "path": "src/lib.rs",
            "status": "available",
            "patch": "diff",
            "patch_truncated": true,
            "error_message": null,
            "command_summary": [{"program": "git", "args": ["diff"]}]
        })
    );
    assert_eq!(
        serde_json::to_value(log).expect("serialize log"),
        json!({
            "repo_root": "repo-root",
            "entries": [{
                "hash": "abcdef123456",
                "short_hash": "abcdef1",
                "subject": "initial",
                "author": "Hobit",
                "date": "2026-05-27T10:00:00Z"
            }],
            "command_summary": [{"program": "git", "args": ["log"]}]
        })
    );
}
