use std::error::Error;
use std::fmt;
use std::path::PathBuf;

use crate::git::{read_git_repository_status, GitBranchSummary, GitStatusError};
use crate::process::{run_process_once, ProcessRunRequest, ProcessRunStatus};

const GIT_PUSH_TIMEOUT_MS: u64 = 30_000;
const GIT_PUSH_STDOUT_CAP_BYTES: usize = 64 * 1024;
const GIT_PUSH_STDERR_CAP_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitPushRequest {
    pub repo_root: PathBuf,
    pub expected_branch: String,
    pub expected_upstream: String,
    pub expected_ahead: Option<u32>,
    pub expected_behind: Option<u32>,
    pub operator_confirmed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitPushResult {
    pub status: GitPushStatus,
    pub branch: String,
    pub upstream: String,
    pub remote: String,
    pub remote_branch: String,
    pub repo_root: String,
    pub ahead: u32,
    pub behind: u32,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
    pub command_summary: Vec<GitPushCommandSummary>,
    pub force_push_performed: bool,
    pub operator_confirmed_required: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitPushStatus {
    Pushed,
}

impl GitPushStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pushed => "pushed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitPushCommandSummary {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GitPushError {
    OperatorConfirmationRequired,
    BranchStateUnavailable,
    DetachedHead,
    UpstreamUnknown,
    SnapshotMismatch(String),
    NoLocalCommitsToPush,
    BranchBehind {
        behind: u32,
    },
    UnsafeUpstream(String),
    GitStatus(GitStatusError),
    GitUnavailable(String),
    TimedOut,
    OutputTooLarge,
    CommandFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
}

impl fmt::Display for GitPushError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OperatorConfirmationRequired => {
                write!(formatter, "operator confirmation is required before push")
            }
            Self::BranchStateUnavailable => write!(formatter, "Git branch state is unavailable"),
            Self::DetachedHead => write!(formatter, "cannot push from detached HEAD"),
            Self::UpstreamUnknown => write!(formatter, "cannot push because upstream is unknown"),
            Self::SnapshotMismatch(message) => {
                write!(formatter, "Git push snapshot mismatch: {message}")
            }
            Self::NoLocalCommitsToPush => {
                write!(formatter, "no local commits are ahead of upstream")
            }
            Self::BranchBehind { behind } => {
                write!(
                    formatter,
                    "cannot push because branch is behind upstream by {behind}"
                )
            }
            Self::UnsafeUpstream(message) => write!(formatter, "unsafe upstream: {message}"),
            Self::GitStatus(error) => {
                write!(formatter, "could not read Git status before push: {error}")
            }
            Self::GitUnavailable(message) => {
                write!(formatter, "Git push failed to start: {message}")
            }
            Self::TimedOut => write!(formatter, "Git push timed out"),
            Self::OutputTooLarge => {
                write!(formatter, "Git push output exceeded the configured cap")
            }
            Self::CommandFailed { exit_code, stderr } => {
                write!(formatter, "Git push command failed")?;
                if let Some(exit_code) = exit_code {
                    write!(formatter, " with exit code {exit_code}")?;
                }
                if !stderr.is_empty() {
                    write!(formatter, ": {stderr}")?;
                }
                Ok(())
            }
        }
    }
}

impl Error for GitPushError {}

/// Push the current HEAD to its visible upstream after status precondition checks.
///
/// This adapter does not infer repositories, fetch, force push, reset, clean,
/// stash, manage branches, or invoke a shell. It accepts only the current
/// branch's parsed upstream and runs `git push <remote> HEAD:<remote-branch>`.
pub fn push_git_upstream(request: GitPushRequest) -> Result<GitPushResult, GitPushError> {
    if !request.operator_confirmed {
        return Err(GitPushError::OperatorConfirmationRequired);
    }

    let status = read_git_repository_status(&request.repo_root).map_err(GitPushError::GitStatus)?;
    let branch = status.branch.ok_or(GitPushError::BranchStateUnavailable)?;
    let push_plan = validate_push_plan(&request, &branch)?;
    let args = vec![
        "push".to_owned(),
        push_plan.remote.clone(),
        format!("HEAD:{}", push_plan.remote_branch),
    ];

    let output = run_process_once(ProcessRunRequest {
        program: "git".to_owned(),
        args: args.clone(),
        stdin: None,
        working_directory: request.repo_root.clone(),
        timeout_ms: GIT_PUSH_TIMEOUT_MS,
        stdout_cap_bytes: GIT_PUSH_STDOUT_CAP_BYTES,
        stderr_cap_bytes: GIT_PUSH_STDERR_CAP_BYTES,
    });

    match output.status {
        ProcessRunStatus::FailedToStart => {
            return Err(GitPushError::GitUnavailable(
                output
                    .error_message
                    .unwrap_or_else(|| "unknown start failure".to_owned()),
            ))
        }
        ProcessRunStatus::TimedOut => return Err(GitPushError::TimedOut),
        ProcessRunStatus::Completed => {}
    }

    if output.stdout_truncated || output.stderr_truncated {
        return Err(GitPushError::OutputTooLarge);
    }

    if output.exit_code != Some(0) {
        return Err(GitPushError::CommandFailed {
            exit_code: output.exit_code,
            stderr: compact_error_message(&output.stderr),
        });
    }

    Ok(GitPushResult {
        status: GitPushStatus::Pushed,
        branch: push_plan.branch,
        upstream: push_plan.upstream,
        remote: push_plan.remote,
        remote_branch: push_plan.remote_branch,
        repo_root: request.repo_root.display().to_string(),
        ahead: push_plan.ahead,
        behind: push_plan.behind,
        exit_code: output.exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
        duration_ms: output.duration_ms,
        command_summary: vec![GitPushCommandSummary {
            program: "git".to_owned(),
            args,
        }],
        force_push_performed: false,
        operator_confirmed_required: true,
    })
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct GitPushPlan {
    branch: String,
    upstream: String,
    remote: String,
    remote_branch: String,
    ahead: u32,
    behind: u32,
}

fn validate_push_plan(
    request: &GitPushRequest,
    branch: &GitBranchSummary,
) -> Result<GitPushPlan, GitPushError> {
    if branch.is_detached {
        return Err(GitPushError::DetachedHead);
    }

    let branch_name = branch
        .name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or(GitPushError::BranchStateUnavailable)?;
    let upstream = branch
        .upstream
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or(GitPushError::UpstreamUnknown)?;

    if branch_name != request.expected_branch {
        return Err(GitPushError::SnapshotMismatch(format!(
            "visible branch `{}` no longer matches current branch `{branch_name}`",
            request.expected_branch
        )));
    }

    if upstream != request.expected_upstream {
        return Err(GitPushError::SnapshotMismatch(format!(
            "visible upstream `{}` no longer matches current upstream `{upstream}`",
            request.expected_upstream
        )));
    }

    if branch.ahead != request.expected_ahead {
        return Err(GitPushError::SnapshotMismatch(
            "ahead count changed before push".to_owned(),
        ));
    }

    if branch.behind != request.expected_behind {
        return Err(GitPushError::SnapshotMismatch(
            "behind count changed before push".to_owned(),
        ));
    }

    let ahead = branch.ahead.unwrap_or(0);
    let behind = branch.behind.unwrap_or(0);

    if behind > 0 {
        return Err(GitPushError::BranchBehind { behind });
    }

    if ahead == 0 {
        return Err(GitPushError::NoLocalCommitsToPush);
    }

    let (remote, remote_branch) = split_upstream(upstream)?;

    Ok(GitPushPlan {
        branch: branch_name.to_owned(),
        upstream: upstream.to_owned(),
        remote,
        remote_branch,
        ahead,
        behind,
    })
}

fn split_upstream(upstream: &str) -> Result<(String, String), GitPushError> {
    let (remote, remote_branch) = upstream.split_once('/').ok_or_else(|| {
        GitPushError::UnsafeUpstream("upstream must include remote and branch".to_owned())
    })?;

    validate_git_arg_component("remote", remote)?;
    validate_git_arg_component("remote branch", remote_branch)?;

    Ok((remote.to_owned(), remote_branch.to_owned()))
}

fn validate_git_arg_component(label: &str, value: &str) -> Result<(), GitPushError> {
    if value.trim().is_empty() {
        return Err(GitPushError::UnsafeUpstream(format!("{label} is empty")));
    }

    if value.starts_with('-') || value.contains('\0') {
        return Err(GitPushError::UnsafeUpstream(format!(
            "{label} is not a safe Git argument"
        )));
    }

    Ok(())
}

fn compact_error_message(message: &str) -> String {
    message
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_plan_requires_known_upstream() {
        let request = request("main", "", Some(1), Some(0));
        let branch = branch("main", None, Some(1), Some(0));

        assert_eq!(
            validate_push_plan(&request, &branch),
            Err(GitPushError::UpstreamUnknown)
        );
    }

    #[test]
    fn push_plan_rejects_detached_head() {
        let request = request("main", "origin/main", Some(1), Some(0));
        let mut branch = branch("main", Some("origin/main"), Some(1), Some(0));
        branch.is_detached = true;

        assert_eq!(
            validate_push_plan(&request, &branch),
            Err(GitPushError::DetachedHead)
        );
    }

    #[test]
    fn push_plan_rejects_behind_branch() {
        let request = request("main", "origin/main", Some(1), Some(2));
        let branch = branch("main", Some("origin/main"), Some(1), Some(2));

        assert_eq!(
            validate_push_plan(&request, &branch),
            Err(GitPushError::BranchBehind { behind: 2 })
        );
    }

    #[test]
    fn push_plan_rejects_zero_ahead() {
        let request = request("main", "origin/main", None, None);
        let branch = branch("main", Some("origin/main"), None, None);

        assert_eq!(
            validate_push_plan(&request, &branch),
            Err(GitPushError::NoLocalCommitsToPush)
        );
    }

    #[test]
    fn push_plan_uses_current_upstream_without_force_args() {
        let request = request("feature/demo", "origin/feature/demo", Some(2), Some(0));
        let branch = branch(
            "feature/demo",
            Some("origin/feature/demo"),
            Some(2),
            Some(0),
        );

        let plan = validate_push_plan(&request, &branch).unwrap();

        assert_eq!(plan.remote, "origin");
        assert_eq!(plan.remote_branch, "feature/demo");
        assert!(!["--force", "--force-with-lease"].contains(&plan.remote.as_str()));
        assert!(!plan.remote_branch.starts_with('-'));
    }

    #[test]
    fn push_plan_rejects_stale_visible_snapshot() {
        let request = request("main", "origin/main", Some(1), Some(0));
        let branch = branch("main", Some("origin/main"), Some(2), Some(0));

        assert!(matches!(
            validate_push_plan(&request, &branch),
            Err(GitPushError::SnapshotMismatch(_))
        ));
    }

    fn request(
        branch: &str,
        upstream: &str,
        ahead: Option<u32>,
        behind: Option<u32>,
    ) -> GitPushRequest {
        GitPushRequest {
            repo_root: PathBuf::from("."),
            expected_branch: branch.to_owned(),
            expected_upstream: upstream.to_owned(),
            expected_ahead: ahead,
            expected_behind: behind,
            operator_confirmed: true,
        }
    }

    fn branch(
        name: &str,
        upstream: Option<&str>,
        ahead: Option<u32>,
        behind: Option<u32>,
    ) -> GitBranchSummary {
        GitBranchSummary {
            name: Some(name.to_owned()),
            upstream: upstream.map(ToOwned::to_owned),
            ahead,
            behind,
            is_detached: false,
        }
    }
}
