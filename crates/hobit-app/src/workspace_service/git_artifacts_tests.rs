use std::path::PathBuf;

use hobit_tools::{
    git::{
        GitBranchSummary, GitFileChange, GitFileChangeArea, GitFileChangeKind, GitRepositoryStatus,
        GitWorkingTreeSummary,
    },
    git_commit::{GitCommitCommandSummary, GitCommitError, GitCommitResult, GitCommitStatus},
    git_diff::{
        GitDiffCommandSummary, GitDiffFileStatus, GitDiffFileSummary, GitDiffSummary,
        GitDiffSummaryStatus, GitDiffTotals,
    },
};

use crate::{
    RuntimeArtifactClass, RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind,
    RuntimeRedactionStatus,
};

use super::git_artifacts::{
    command_payload_artifact, commit_message_artifact, file_paths_artifact, local_path_artifact,
    raw_diff_artifact, runtime_error_artifact, safe_status_metadata_artifact, stderr_artifact,
    stdout_artifact, GitCommitRuntimeArtifacts, GitDiffRuntimeArtifacts, GitRuntimeBoundarySummary,
    GitStatusRuntimeArtifacts,
};

#[test]
fn git_repo_root_is_local_path() {
    let artifact = local_path_artifact(&PathBuf::from("C:/Users/Private/repo"));

    assert_eq!(RuntimeArtifactClass::LocalPath, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn git_changed_and_selected_file_paths_are_local_paths() {
    let changed = GitStatusRuntimeArtifacts::from_status(
        &PathBuf::from("C:/Users/Private/repo"),
        &status_fixture(),
    );
    let selected = file_paths_artifact(["src/lib.rs", "docs/plan.md"]);

    assert_eq!(
        RuntimeArtifactClass::LocalPath,
        changed.changed_file_paths.artifact_class
    );
    assert_eq!(RuntimeArtifactClass::LocalPath, selected.artifact_class);
    assert_eq!(Some(2), selected.item_count);
}

#[test]
fn git_command_payload_is_command_payload() {
    let args = vec![
        "-C".to_owned(),
        "C:/Users/Private/repo".to_owned(),
        "commit".to_owned(),
        "-m".to_owned(),
        "operator message token=secret".to_owned(),
    ];
    let artifact = command_payload_artifact(std::iter::once(("git", args.as_slice())));

    assert_eq!(
        RuntimeArtifactClass::CommandPayload,
        artifact.artifact_class
    );
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
    assert_eq!(
        RuntimeRedactionStatus::ContainsSecretCandidate,
        artifact.redaction_status
    );
}

#[test]
fn git_commit_message_is_operator_text() {
    let artifact = commit_message_artifact("operator commit message token=secret");

    assert_eq!(RuntimeArtifactClass::OperatorText, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
    assert_eq!(
        RuntimeRedactionStatus::ContainsSecretCandidate,
        artifact.redaction_status
    );
}

#[test]
fn git_raw_diff_is_raw_tool_output() {
    let artifact = raw_diff_artifact("diff --git a/src/lib.rs b/src/lib.rs".len(), true);

    assert_eq!(RuntimeArtifactClass::RawToolOutput, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
    assert!(artifact.capped);
    assert_eq!(
        RuntimeRedactionStatus::NotRedacted,
        artifact.redaction_status
    );
}

#[test]
fn git_stdout_and_stderr_are_raw_tool_output() {
    let stdout = stdout_artifact("stdout password=secret", false);
    let stderr = stderr_artifact("stderr token=secret", true);

    assert_eq!(RuntimeArtifactClass::RawToolOutput, stdout.artifact_class);
    assert_eq!(RuntimeArtifactClass::RawToolOutput, stderr.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, stdout.artifact_class);
    assert!(stderr.capped);
}

#[test]
fn git_runtime_errors_are_runtime_error() {
    let artifact = runtime_error_artifact("git failed token=secret");
    let boundary =
        GitRuntimeBoundarySummary::from_git_commit_error(&GitCommitError::NotGitRepository);

    assert_eq!(RuntimeArtifactClass::RuntimeError, artifact.artifact_class);
    assert_eq!(RuntimeRedactionStatus::Redacted, artifact.redaction_status);
    assert_eq!(RuntimeKind::Git, boundary.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Failed, boundary.execution_status);
    assert_eq!(
        Some(RuntimeErrorKind::ValidationFailed),
        boundary.error_kind
    );
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        boundary.artifact.artifact_class
    );
}

#[test]
fn git_status_and_count_metadata_is_safe_only_when_normalized() {
    let safe = safe_status_metadata_artifact(&["dirty", "main", "3", "1"]);
    let path = safe_status_metadata_artifact(&["C:/Users/Private/repo"]);
    let diff = safe_status_metadata_artifact(&["diff --git a/src/lib.rs b/src/lib.rs"]);
    let command = safe_status_metadata_artifact(&["git status --porcelain=v1"]);
    let output = safe_status_metadata_artifact(&["stdout: changed files"]);
    let message = safe_status_metadata_artifact(&["commit message: Update code"]);
    let secret = safe_status_metadata_artifact(&["token=secret"]);

    assert_eq!(RuntimeArtifactClass::SafeMetadata, safe.artifact_class);
    assert_eq!(RuntimeArtifactClass::LocalPath, path.artifact_class);
    assert_eq!(RuntimeArtifactClass::RawToolOutput, diff.artifact_class);
    assert_eq!(RuntimeArtifactClass::CommandPayload, command.artifact_class);
    assert_eq!(RuntimeArtifactClass::RawToolOutput, output.artifact_class);
    assert_eq!(RuntimeArtifactClass::OperatorText, message.artifact_class);
    assert_eq!(RuntimeArtifactClass::SecretCandidate, secret.artifact_class);
}

#[test]
fn git_status_diff_and_commit_statuses_map_to_runtime_vocabulary() {
    let status = GitStatusRuntimeArtifacts::from_status(
        &PathBuf::from("C:/Users/Private/repo"),
        &status_fixture(),
    );
    let diff = GitDiffRuntimeArtifacts::from_summary(&diff_summary_fixture());
    let commit = GitCommitRuntimeArtifacts::from_result(&commit_result_fixture());
    let timeout = GitRuntimeBoundarySummary::from_git_commit_error(&GitCommitError::TimedOut);

    assert_eq!(
        RuntimeExecutionStatus::Succeeded,
        status.status.execution_status
    );
    assert_eq!(
        RuntimeExecutionStatus::Succeeded,
        diff.status.execution_status
    );
    assert_eq!(
        RuntimeExecutionStatus::Succeeded,
        commit.status.execution_status
    );
    assert_eq!(RuntimeExecutionStatus::TimedOut, timeout.execution_status);
    assert_eq!(Some(RuntimeErrorKind::TimedOut), timeout.error_kind);
}

#[test]
fn git_ai_context_and_evidence_eligibility_default_to_false() {
    let diff = GitDiffRuntimeArtifacts::from_summary(&diff_summary_fixture());
    let commit = GitCommitRuntimeArtifacts::from_result(&commit_result_fixture());

    assert!(!diff.repo_root.ai_context_eligible);
    assert!(!diff.repo_root.evidence_eligible);
    assert!(!diff.raw_diff.ai_context_eligible);
    assert!(!diff.raw_diff.evidence_eligible);
    assert!(!commit.commit_message.ai_context_eligible);
    assert!(!commit.commit_message.evidence_eligible);
    assert!(!commit.stdout.ai_context_eligible);
    assert!(!commit.stdout.evidence_eligible);
}

#[test]
fn git_artifact_debug_omits_paths_diff_commit_message_command_output_env_and_secret_values() {
    let status = GitStatusRuntimeArtifacts::from_status(
        &PathBuf::from("C:/Users/Private/repo"),
        &status_fixture(),
    );
    let diff = GitDiffRuntimeArtifacts::from_summary(&diff_summary_fixture());
    let commit = GitCommitRuntimeArtifacts::from_result(&commit_result_fixture());
    let error = GitRuntimeBoundarySummary::from_git_commit_error(&GitCommitError::Unknown(
        "env:GIT_TOKEN=secret token=secret".to_owned(),
    ));
    let debug = format!("{status:?} {diff:?} {commit:?} {error:?}");

    assert!(debug.contains("LocalPath"));
    assert!(debug.contains("CommandPayload"));
    assert!(debug.contains("OperatorText"));
    assert!(debug.contains("RawToolOutput"));
    assert!(debug.contains("RuntimeError"));
    assert!(!debug.contains("C:/Users/Private/repo"));
    assert!(!debug.contains("src/lib.rs"));
    assert!(!debug.contains("diff --git"));
    assert!(!debug.contains("operator commit message"));
    assert!(!debug.contains("-C"));
    assert!(!debug.contains("commit stdout"));
    assert!(!debug.contains("commit stderr"));
    assert!(!debug.contains("env:GIT_TOKEN"));
    assert!(!debug.contains("token=secret"));
}

fn status_fixture() -> GitRepositoryStatus {
    GitRepositoryStatus {
        branch: Some(GitBranchSummary {
            name: Some("main".to_owned()),
            upstream: Some("origin/main".to_owned()),
            ahead: Some(1),
            behind: Some(0),
            is_detached: false,
        }),
        working_tree: GitWorkingTreeSummary {
            is_clean: false,
            staged_count: 1,
            unstaged_count: 1,
            untracked_count: 0,
        },
        changed_files: vec![GitFileChange {
            area: GitFileChangeArea::Unstaged,
            kind: GitFileChangeKind::Modified,
            path: "src/lib.rs".to_owned(),
            original_path: None,
        }],
        last_commit: None,
        warnings: Vec::new(),
    }
}

fn diff_summary_fixture() -> GitDiffSummary {
    GitDiffSummary {
        repo_root: "C:/Users/Private/repo".to_owned(),
        status: GitDiffSummaryStatus::Dirty,
        files: vec![GitDiffFileSummary {
            path: "src/lib.rs".to_owned(),
            status: GitDiffFileStatus::Modified,
            staged: false,
            unstaged: true,
            untracked: false,
            conflicted: false,
            additions: Some(2),
            deletions: Some(1),
            patch_preview: Some(
                "diff --git a/src/lib.rs b/src/lib.rs\n@@\n-secret\n+token=secret".to_owned(),
            ),
            patch_truncated: true,
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
        command_summary: vec![GitDiffCommandSummary {
            program: "git".to_owned(),
            args: vec![
                "-C".to_owned(),
                "C:/Users/Private/repo".to_owned(),
                "diff".to_owned(),
                "--".to_owned(),
                "src/lib.rs".to_owned(),
            ],
        }],
    }
}

fn commit_result_fixture() -> GitCommitResult {
    GitCommitResult {
        status: GitCommitStatus::Committed,
        commit_hash: Some("abc123".to_owned()),
        branch: Some("main".to_owned()),
        repo_root: "C:/Users/Private/repo".to_owned(),
        included_files: vec!["src/lib.rs".to_owned()],
        commit_message: "operator commit message token=secret".to_owned(),
        exit_code: Some(0),
        stdout: "commit stdout password=secret".to_owned(),
        stderr: "commit stderr token=secret".to_owned(),
        duration_ms: 12,
        error_message: None,
        command_summary: vec![GitCommitCommandSummary {
            program: "git".to_owned(),
            args: vec![
                "-C".to_owned(),
                "C:/Users/Private/repo".to_owned(),
                "commit".to_owned(),
                "-m".to_owned(),
                "operator commit message token=secret".to_owned(),
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
