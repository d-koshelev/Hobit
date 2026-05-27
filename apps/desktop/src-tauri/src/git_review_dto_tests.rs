use hobit_app::{GitDiffCommandSummary, GitFileDiffSummary, GitLogEntrySummary, GitLogSummary};

use crate::git_review_dto::{GitFileDiffDto, GitLogDto};

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
