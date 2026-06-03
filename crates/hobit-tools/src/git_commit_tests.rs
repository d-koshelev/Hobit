use crate::git_commit::{create_git_commit, GitCommitError, GitCommitRequest, GitCommitStatus};

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn empty_commit_message_is_rejected() {
    let repo = TestRepo::new();

    let error = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "   ".to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
    })
    .expect_err("empty commit message should be rejected");

    assert_eq!(error, GitCommitError::EmptyCommitMessage);
}

#[test]
fn empty_included_files_are_rejected() {
    let repo = TestRepo::new();

    let error = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Commit".to_owned(),
        included_files: Vec::new(),
    })
    .expect_err("empty included files should be rejected");

    assert_eq!(error, GitCommitError::EmptyIncludedFiles);
}

#[test]
fn absolute_included_file_path_is_rejected() {
    let repo = TestRepo::new();
    let absolute_path = std::env::current_dir()
        .expect("current dir")
        .join("src")
        .join("lib.rs")
        .display()
        .to_string();

    let error = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Commit".to_owned(),
        included_files: vec![absolute_path],
    })
    .expect_err("absolute included file should be rejected");

    assert!(matches!(
        error,
        GitCommitError::InvalidIncludedFile { reason, .. }
            if reason.contains("absolute") || reason.contains("repo-relative")
    ));
}

#[test]
fn path_escaping_repo_root_is_rejected() {
    let repo = TestRepo::new();

    let error = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Commit".to_owned(),
        included_files: vec!["../outside.txt".to_owned()],
    })
    .expect_err("escaping path should be rejected");

    assert!(matches!(
        error,
        GitCommitError::InvalidIncludedFile { reason, .. }
            if reason.contains("escape")
    ));
}

#[test]
fn non_git_repo_returns_clear_failure() {
    let repo = TestRepo::new_without_git();

    let error = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Commit".to_owned(),
        included_files: vec!["file.txt".to_owned()],
    })
    .expect_err("non-Git directory should be rejected");

    assert_eq!(error, GitCommitError::NotGitRepository);
}

#[test]
fn commit_selected_tracked_file_succeeds_and_returns_hash() {
    let repo = TestRepo::new();
    repo.write_file("tracked.txt", "one\n");
    repo.git(["add", "--", "tracked.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    repo.write_file("tracked.txt", "two\n");
    let result = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Update tracked".to_owned(),
        included_files: vec!["tracked.txt".to_owned()],
    })
    .expect("tracked commit should succeed");

    assert_eq!(result.status, GitCommitStatus::Committed);
    assert!(result
        .commit_hash
        .as_deref()
        .is_some_and(|hash| !hash.is_empty()));
    assert_eq!(result.included_files, vec!["tracked.txt"]);
    assert!(!result.push_performed);
    assert!(!result.reset_performed);
    assert!(!result.clean_performed);
    assert!(!result.auto_commit);
    assert!(result.operator_confirmed_required);
}

#[test]
fn commit_selected_untracked_file_succeeds_and_returns_hash() {
    let repo = TestRepo::new();
    repo.write_file("tracked.txt", "one\n");
    repo.git(["add", "--", "tracked.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    repo.write_file("new.txt", "new\n");
    let result = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Add new".to_owned(),
        included_files: vec!["new.txt".to_owned()],
    })
    .expect("untracked commit should succeed");

    assert_eq!(result.status, GitCommitStatus::Committed);
    assert!(result
        .commit_hash
        .as_deref()
        .is_some_and(|hash| !hash.is_empty()));
}

#[test]
fn pre_existing_staged_file_outside_included_files_is_rejected() {
    let repo = TestRepo::new();
    repo.write_file("a.txt", "one\n");
    repo.write_file("b.txt", "one\n");
    repo.git(["add", "--", "a.txt", "b.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    repo.write_file("a.txt", "two\n");
    repo.write_file("b.txt", "two\n");
    repo.git(["add", "--", "b.txt"]);

    let error = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Update a".to_owned(),
        included_files: vec!["a.txt".to_owned()],
    })
    .expect_err("outside staged file should be rejected");

    assert!(matches!(
        error,
        GitCommitError::StagedFilesOutsideSelection { files } if files == vec!["b.txt"]
    ));
}

#[test]
fn staged_file_inside_included_files_can_be_committed() {
    let repo = TestRepo::new();
    repo.write_file("a.txt", "one\n");
    repo.git(["add", "--", "a.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    repo.write_file("a.txt", "two\n");
    repo.git(["add", "--", "a.txt"]);

    let result = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Update a".to_owned(),
        included_files: vec!["a.txt".to_owned()],
    })
    .expect("included staged file should commit");

    assert_eq!(result.status, GitCommitStatus::Committed);
    assert!(result.commit_hash.is_some());
}

#[test]
fn git_push_reset_clean_and_stash_commands_are_not_used() {
    let repo = TestRepo::new();
    repo.write_file("tracked.txt", "one\n");
    repo.git(["add", "--", "tracked.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    repo.write_file("tracked.txt", "two\n");
    let result = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Update tracked".to_owned(),
        included_files: vec!["tracked.txt".to_owned()],
    })
    .expect("commit should succeed");

    let forbidden = ["push", "reset", "clean", "stash"];
    assert!(result.command_summary.iter().all(|command| {
        command.program == "git"
            && command
                .args
                .iter()
                .all(|arg| !forbidden.contains(&arg.as_str()))
    }));
}

#[test]
fn command_summary_uses_program_plus_args_without_shell_string() {
    let repo = TestRepo::new();
    repo.write_file("tracked.txt", "one\n");
    repo.git(["add", "--", "tracked.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    repo.write_file("tracked.txt", "two\n");
    let result = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "Update tracked".to_owned(),
        included_files: vec!["tracked.txt".to_owned()],
    })
    .expect("commit should succeed");

    assert!(!result.command_summary.is_empty());
    for command in result.command_summary {
        assert_eq!(command.program, "git");
        assert_eq!(command.args.first().map(String::as_str), Some("-C"));
        assert!(!command.args.iter().any(|arg| {
            matches!(
                arg.as_str(),
                "cmd" | "cmd.exe" | "sh" | "bash" | "powershell" | "&&" | "|"
            )
        }));
    }
}

#[test]
fn commit_failure_preserves_stdout_stderr_and_error() {
    let repo = TestRepo::new();
    repo.write_file("tracked.txt", "one\n");
    repo.git(["add", "--", "tracked.txt"]);
    repo.git(["commit", "-m", "Initial"]);

    let result = create_git_commit(GitCommitRequest {
        repo_root: repo.path.clone(),
        commit_message: "No changes".to_owned(),
        included_files: vec!["tracked.txt".to_owned()],
    })
    .expect("commit command failure should return a structured result");

    assert_eq!(result.status, GitCommitStatus::Failed);
    assert_ne!(result.exit_code, Some(0));
    assert!(result.commit_hash.is_none());
    assert!(result
        .error_message
        .as_deref()
        .is_some_and(|message| { message.contains("Git commit failed") }));
    assert!(!result.stdout.is_empty() || !result.stderr.is_empty());
}

struct TestRepo {
    path: PathBuf,
}

impl TestRepo {
    fn new() -> Self {
        let repo = Self::new_without_git();
        repo.git(["init"]);
        repo.git(["config", "user.name", "Hobit Test"]);
        repo.git(["config", "user.email", "hobit@example.invalid"]);
        repo
    }

    fn new_without_git() -> Self {
        let path = std::env::temp_dir().join(format!(
            "hobit-git-commit-test-{}-{}",
            std::process::id(),
            unique_nanos()
        ));
        fs::create_dir_all(&path).expect("create temp repo directory");
        Self { path }
    }

    fn write_file(&self, relative_path: &str, content: &str) {
        let path = self.path.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent directory");
        }
        fs::write(path, content).expect("write test file");
    }

    fn git<const N: usize>(&self, args: [&str; N]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(&self.path)
            .args(args)
            .output()
            .expect("run git test command");

        assert!(
            output.status.success(),
            "git test command failed: stdout={} stderr={}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

impl Drop for TestRepo {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn unique_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos()
}
