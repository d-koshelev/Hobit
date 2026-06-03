use super::*;

use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn clean_repo_returns_clean_summary() {
    let repo = TempGitRepo::new();

    let summary = read_git_diff_summary(request(repo.path())).expect("diff summary");

    assert_eq!(summary.status, GitDiffSummaryStatus::Clean);
    assert_eq!(summary.summary.total_files, 0);
    assert!(summary.files.is_empty());
}

#[test]
fn modified_tracked_file_appears_as_unstaged_with_line_counts() {
    let repo = TempGitRepo::new();
    fs::write(repo.path().join("tracked.txt"), "one\nthree\nfour\n").expect("modify tracked file");

    let summary = read_git_diff_summary(request(repo.path())).expect("diff summary");
    let file = summary
        .files
        .iter()
        .find(|file| file.path == "tracked.txt")
        .expect("tracked file");

    assert_eq!(summary.status, GitDiffSummaryStatus::Dirty);
    assert!(file.unstaged);
    assert!(!file.staged);
    assert_eq!(file.status, GitDiffFileStatus::Modified);
    assert_eq!(file.additions, Some(2));
    assert_eq!(file.deletions, Some(1));
    assert!(file
        .patch_preview
        .as_deref()
        .is_some_and(|patch| patch.contains("unstaged diff") && patch.contains("+three")));
}

#[test]
fn staged_file_appears_as_staged() {
    let repo = TempGitRepo::new();
    fs::write(repo.path().join("tracked.txt"), "one\nstaged\n").expect("modify tracked file");
    repo.git(["add", "tracked.txt"]);

    let summary = read_git_diff_summary(request(repo.path())).expect("diff summary");
    let file = &summary.files[0];

    assert!(file.staged);
    assert!(!file.unstaged);
    assert_eq!(summary.summary.staged_count, 1);
    assert!(file
        .patch_preview
        .as_deref()
        .is_some_and(|patch| patch.contains("staged diff") && patch.contains("+staged")));
}

#[test]
fn untracked_file_has_no_patch_preview() {
    let repo = TempGitRepo::new();
    fs::write(repo.path().join("scratch.txt"), "scratch\n").expect("write untracked");

    let summary = read_git_diff_summary(request(repo.path())).expect("diff summary");
    let file = summary
        .files
        .iter()
        .find(|file| file.path == "scratch.txt")
        .expect("untracked file");

    assert!(file.untracked);
    assert_eq!(file.status, GitDiffFileStatus::Untracked);
    assert_eq!(file.patch_preview, None);
    assert!(!file.patch_truncated);
}

#[test]
fn patch_preview_is_capped_and_marked_truncated() {
    let repo = TempGitRepo::new();
    fs::write(
        repo.path().join("tracked.txt"),
        "one\nvery long replacement line\nanother long replacement line\n",
    )
    .expect("modify tracked file");

    let summary = read_git_diff_summary(GitDiffSummaryRequest {
        max_patch_bytes_per_file: Some(30),
        ..request(repo.path())
    })
    .expect("diff summary");
    let file = &summary.files[0];

    assert!(file.patch_truncated);
    assert!(file
        .patch_preview
        .as_deref()
        .is_some_and(|patch| patch.len() <= 30));
}

#[test]
fn non_git_directory_is_rejected() {
    let dir = TempDir::new("hobit-git-diff-nongit");

    let error = read_git_diff_summary(request(dir.path())).expect_err("reject non-git root");

    assert_eq!(error, GitDiffError::NotGitRepository);
}

#[test]
fn missing_repo_root_is_rejected() {
    let dir = TempDir::new("hobit-git-diff-missing");
    let missing = dir.path().join("missing");

    let error = read_git_diff_summary(request(&missing)).expect_err("reject missing root");

    assert_eq!(error, GitDiffError::PathNotFound);
}

#[test]
fn command_summary_uses_safe_program_and_args_without_mutating_commands() {
    let repo = TempGitRepo::new();
    fs::write(repo.path().join("tracked.txt"), "one\nchanged\n").expect("modify tracked");

    let summary = read_git_diff_summary(request(repo.path())).expect("diff summary");
    let forbidden = [
        "add", "commit", "push", "reset", "clean", "stash", "checkout", "restore",
    ];

    assert!(!summary.command_summary.is_empty());
    for command in &summary.command_summary {
        assert_eq!(command.program, "git");
        assert_eq!(command.args.first().map(String::as_str), Some("-C"));
        assert!(command
            .args
            .iter()
            .all(|arg| !forbidden.contains(&arg.as_str())));
    }
}

#[test]
fn selected_file_diff_returns_read_only_patch() {
    let repo = TempGitRepo::new();
    fs::write(repo.path().join("tracked.txt"), "one\nchanged\n").expect("modify tracked");

    let diff = read_git_file_diff(GitFileDiffRequest {
        repo_root: repo.path().to_path_buf(),
        path: "tracked.txt".to_owned(),
        max_patch_bytes: None,
    })
    .expect("file diff");

    assert_eq!(diff.status, GitFileDiffStatus::Available);
    assert!(diff
        .patch
        .as_deref()
        .is_some_and(|patch| patch.contains("unstaged diff") && patch.contains("+changed")));
    for command in &diff.command_summary {
        assert_eq!(command.program, "git");
        assert!(!command.args.iter().any(|arg| {
            matches!(
                arg.as_str(),
                "add" | "commit" | "push" | "reset" | "clean" | "stash" | "checkout" | "restore"
            )
        }));
    }
}

#[test]
fn selected_untracked_file_returns_graceful_untracked_status() {
    let repo = TempGitRepo::new();
    fs::write(repo.path().join("scratch.txt"), "scratch\n").expect("write untracked");

    let diff = read_git_file_diff(GitFileDiffRequest {
        repo_root: repo.path().to_path_buf(),
        path: "scratch.txt".to_owned(),
        max_patch_bytes: None,
    })
    .expect("file diff");

    assert_eq!(diff.status, GitFileDiffStatus::Untracked);
    assert_eq!(diff.patch, None);
    assert!(diff.error_message.is_some());
}

#[test]
fn selected_file_diff_caps_large_output() {
    let repo = TempGitRepo::new();
    fs::write(
        repo.path().join("tracked.txt"),
        "one\nvery long replacement line\nanother long replacement line\n",
    )
    .expect("modify tracked");

    let diff = read_git_file_diff(GitFileDiffRequest {
        repo_root: repo.path().to_path_buf(),
        path: "tracked.txt".to_owned(),
        max_patch_bytes: Some(32),
    })
    .expect("file diff");

    assert_eq!(diff.status, GitFileDiffStatus::TooLarge);
    assert!(diff.patch_truncated);
    assert!(diff.patch.as_deref().is_some_and(|patch| patch.len() <= 32));
}

#[test]
fn selected_file_diff_rejects_absolute_or_parent_paths() {
    let repo = TempGitRepo::new();

    let parent_error = read_git_file_diff(GitFileDiffRequest {
        repo_root: repo.path().to_path_buf(),
        path: "../outside.txt".to_owned(),
        max_patch_bytes: None,
    })
    .expect_err("reject parent path");

    assert!(matches!(parent_error, GitDiffError::Unknown(_)));
}

#[test]
fn recent_log_returns_structured_entries_without_mutating_commands() {
    let repo = TempGitRepo::new();

    let log = read_git_log(GitLogRequest {
        repo_root: repo.path().to_path_buf(),
        limit: Some(10),
    })
    .expect("git log");

    assert_eq!(log.entries.len(), 1);
    assert_eq!(log.entries[0].subject, "initial");
    assert!(!log.entries[0].hash.is_empty());
    assert_eq!(log.command_summary[0].program, "git");
    assert!(log.command_summary[0].args.iter().any(|arg| arg == "log"));
    assert!(!log.command_summary[0].args.iter().any(|arg| {
        matches!(
            arg.as_str(),
            "add" | "commit" | "push" | "reset" | "clean" | "stash" | "checkout" | "restore"
        )
    }));
}

fn request(repo_root: &Path) -> GitDiffSummaryRequest {
    GitDiffSummaryRequest {
        repo_root: repo_root.to_path_buf(),
        max_files: None,
        max_patch_bytes_per_file: None,
        include_patch_preview: true,
    }
}

struct TempGitRepo {
    dir: TempDir,
}

impl TempGitRepo {
    fn new() -> Self {
        let dir = TempDir::new("hobit-git-diff-repo");
        run_git(["init"], dir.path());
        run_git(
            ["config", "user.email", "hobit@example.invalid"],
            dir.path(),
        );
        run_git(["config", "user.name", "Hobit Test"], dir.path());
        fs::write(dir.path().join("tracked.txt"), "one\ntwo\n").expect("write tracked file");
        run_git(["add", "tracked.txt"], dir.path());
        run_git(["commit", "-m", "initial"], dir.path());

        Self { dir }
    }

    fn path(&self) -> &Path {
        self.dir.path()
    }

    fn git<I, S>(&self, args: I)
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        run_git(args, self.path());
    }
}

struct TempDir {
    path: PathBuf,
}

impl TempDir {
    fn new(prefix: &str) -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&path).expect("create temp dir");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn run_git<I, S>(args: I, current_dir: &Path)
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("git")
        .args(args)
        .current_dir(current_dir)
        .output()
        .expect("run git");

    assert!(
        output.status.success(),
        "git command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
