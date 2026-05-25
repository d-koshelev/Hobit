//! One-shot Codex CLI Direct Work runner foundation.
//!
//! This module runs `codex exec` through the shared bounded process adapter with
//! explicit argv, an explicit repository root, an explicit sandbox, and an
//! explicit approval policy. It does not add UI, Tauri commands, persistence,
//! Git inspection or mutation, queue execution, background execution, an
//! embedded PTY, or an interactive Codex session.

use std::ffi::OsStr;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::codex_cli::{
    executable::{actionable_codex_launch_error, codex_launch_command},
    resolve_codex_executable, DEFAULT_CODEX_CLI_PROGRAM,
};
use crate::process::{run_process_once, ProcessRunRequest, ProcessRunStatus};

pub const DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS: u64 = 10 * 60 * 1_000;
pub const DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES: usize = 256 * 1024;
pub const DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES: usize = 128 * 1024;
const TRUSTED_DIRECTORY_ERROR: &str =
    "Not inside a trusted directory and --skip-git-repo-check was not specified";
const TRUSTED_DIRECTORY_ACTIONABLE_ERROR: &str = "Codex refused this directory. Coordinator Direct Mode should run with skip git repo check or choose a trusted Git project.";

/// Direct Work request for a one-shot `codex exec` invocation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectRunRequest {
    pub program: Option<String>,
    pub repo_root: PathBuf,
    pub prompt: String,
    pub sandbox: CodexSandboxMode,
    pub approval_policy: CodexApprovalPolicy,
    pub skip_git_repo_check: bool,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
    pub output_last_message_path: Option<PathBuf>,
}

impl CodexDirectRunRequest {
    pub fn new(
        repo_root: impl Into<PathBuf>,
        prompt: impl Into<String>,
        sandbox: CodexSandboxMode,
        approval_policy: CodexApprovalPolicy,
    ) -> Self {
        Self {
            program: None,
            repo_root: repo_root.into(),
            prompt: prompt.into(),
            sandbox,
            approval_policy,
            skip_git_repo_check: false,
            timeout_ms: None,
            stdout_cap_bytes: None,
            stderr_cap_bytes: None,
            output_last_message_path: None,
        }
    }
}

/// Supported Codex CLI sandbox modes for the Direct Work MVP.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodexSandboxMode {
    ReadOnly,
    WorkspaceWrite,
}

impl CodexSandboxMode {
    pub fn as_cli_arg(self) -> &'static str {
        match self {
            Self::ReadOnly => "read-only",
            Self::WorkspaceWrite => "workspace-write",
        }
    }
}

impl fmt::Display for CodexSandboxMode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_cli_arg())
    }
}

/// Supported Codex CLI approval policies for the Direct Work MVP.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodexApprovalPolicy {
    Never,
    OnRequest,
    Untrusted,
}

impl CodexApprovalPolicy {
    pub fn as_cli_arg(self) -> &'static str {
        match self {
            Self::Never => "never",
            Self::OnRequest => "on-request",
            Self::Untrusted => "untrusted",
        }
    }
}

impl fmt::Display for CodexApprovalPolicy {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_cli_arg())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectRunOutput {
    pub status: CodexDirectRunStatus,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub final_message: Option<String>,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub repo_root: PathBuf,
    pub sandbox: CodexSandboxMode,
    pub approval_policy: CodexApprovalPolicy,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodexDirectRunStatus {
    Completed,
    FailedToStart,
    TimedOut,
    Failed,
}

impl CodexDirectRunStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Completed => "completed",
            Self::FailedToStart => "failed_to_start",
            Self::TimedOut => "timed_out",
            Self::Failed => "failed",
        }
    }
}

impl fmt::Display for CodexDirectRunStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// Run one bounded `codex exec` Direct Work process.
///
/// Non-zero Codex exits are returned as `CodexDirectRunStatus::Failed`, while a
/// zero exit is `Completed`. Process spawn failures and timeouts are separate
/// infrastructure statuses. The prompt is passed to the process over stdin and
/// is intentionally not copied into `command_summary`.
pub fn run_codex_direct_work(request: CodexDirectRunRequest) -> CodexDirectRunOutput {
    run_codex_direct_work_inner(request, None)
}

fn run_codex_direct_work_inner(
    request: CodexDirectRunRequest,
    path_env_override: Option<&OsStr>,
) -> CodexDirectRunOutput {
    let started_at = Instant::now();
    let program = request
        .program
        .as_deref()
        .unwrap_or(DEFAULT_CODEX_CLI_PROGRAM)
        .trim()
        .to_owned();

    if program.is_empty() {
        return rejected_request(started_at, request, Vec::new(), "program must not be empty");
    }

    if let Some(message) = validate_repo_root(&request.repo_root) {
        return rejected_request(started_at, request, Vec::new(), message);
    }

    if request.prompt.trim().is_empty() {
        return rejected_request(started_at, request, Vec::new(), "prompt must not be empty");
    }

    let resolution = match path_env_override {
        Some(path_env) => {
            super::executable::resolve_codex_executable_with_path(&program, Some(path_env))
        }
        None => resolve_codex_executable(&program),
    };
    let resolution = match resolution {
        Ok(resolution) => resolution,
        Err(error) => {
            return rejected_request(started_at, request, Vec::new(), error.message);
        }
    };

    let output_last_message_path = request
        .output_last_message_path
        .clone()
        .unwrap_or_else(unique_output_last_message_path);
    let cleanup_output_file = request.output_last_message_path.is_none();
    let codex_args = build_codex_exec_args(
        &request.repo_root,
        request.sandbox,
        request.approval_policy,
        request.skip_git_repo_check,
        &output_last_message_path,
    );
    let launch = codex_launch_command(&resolution.program, codex_args);
    let command_summary = safe_command_summary(
        &launch.program,
        &launch.args,
        &request.repo_root,
        request.sandbox,
        request.approval_policy,
        request.skip_git_repo_check,
        &output_last_message_path,
    );

    let process_output = run_process_once(ProcessRunRequest {
        program: launch.program,
        args: launch.args,
        stdin: Some(request.prompt.clone()),
        working_directory: request.repo_root.clone(),
        timeout_ms: request
            .timeout_ms
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS),
        stdout_cap_bytes: request
            .stdout_cap_bytes
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES),
        stderr_cap_bytes: request
            .stderr_cap_bytes
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES),
    });

    let (final_message, final_message_error) =
        if process_output.status == ProcessRunStatus::FailedToStart {
            (None, None)
        } else {
            read_final_message(&output_last_message_path)
        };

    if cleanup_output_file {
        let _ = fs::remove_file(&output_last_message_path);
    }

    let status = direct_run_status(&process_output);
    let error_message = combine_optional_messages([
        direct_run_error_message(&process_output),
        final_message_error,
    ]);

    CodexDirectRunOutput {
        status,
        exit_code: process_output.exit_code,
        stdout: process_output.stdout,
        stderr: process_output.stderr,
        final_message,
        stdout_truncated: process_output.stdout_truncated,
        stderr_truncated: process_output.stderr_truncated,
        duration_ms: process_output.duration_ms,
        error_message,
        command_summary,
        repo_root: request.repo_root,
        sandbox: request.sandbox,
        approval_policy: request.approval_policy,
    }
}

fn validate_repo_root(repo_root: &Path) -> Option<String> {
    if repo_root.as_os_str().is_empty() {
        return Some("repo_root must be explicit".to_owned());
    }

    if !repo_root.exists() {
        return Some(format!(
            "repo_root must exist and be a directory: {}",
            repo_root.display()
        ));
    }

    if !repo_root.is_dir() {
        return Some(format!(
            "repo_root must be a directory: {}",
            repo_root.display()
        ));
    }

    None
}

fn build_codex_exec_args(
    repo_root: &Path,
    sandbox: CodexSandboxMode,
    approval_policy: CodexApprovalPolicy,
    skip_git_repo_check: bool,
    output_last_message_path: &Path,
) -> Vec<String> {
    let mut args = vec![
        "--cd".to_owned(),
        repo_root.to_string_lossy().into_owned(),
        "--sandbox".to_owned(),
        sandbox.as_cli_arg().to_owned(),
        "--ask-for-approval".to_owned(),
        approval_policy.as_cli_arg().to_owned(),
    ];

    if skip_git_repo_check {
        args.push("--skip-git-repo-check".to_owned());
    }

    args.extend([
        "exec".to_owned(),
        "--output-last-message".to_owned(),
        output_last_message_path.to_string_lossy().into_owned(),
        "-".to_owned(),
    ]);

    args
}

fn safe_command_summary(
    launch_program: &str,
    launch_args: &[String],
    repo_root: &Path,
    sandbox: CodexSandboxMode,
    approval_policy: CodexApprovalPolicy,
    skip_git_repo_check: bool,
    output_last_message_path: &Path,
) -> Vec<String> {
    let mut expected_codex_args = vec![
        "--cd".to_owned(),
        repo_root.to_string_lossy().into_owned(),
        "--sandbox".to_owned(),
        sandbox.as_cli_arg().to_owned(),
        "--ask-for-approval".to_owned(),
        approval_policy.as_cli_arg().to_owned(),
    ];

    if skip_git_repo_check {
        expected_codex_args.push("--skip-git-repo-check".to_owned());
    }

    expected_codex_args.extend([
        "exec".to_owned(),
        "--output-last-message".to_owned(),
        output_last_message_path.to_string_lossy().into_owned(),
        "-".to_owned(),
    ]);
    debug_assert!(launch_args.ends_with(&expected_codex_args));

    let mut summary = Vec::with_capacity(1 + launch_args.len());
    summary.push(launch_program.to_owned());
    summary.extend(launch_args.iter().cloned());
    if summary.last().map(String::as_str) == Some("-") {
        if let Some(last) = summary.last_mut() {
            *last = "<operator-prompt-stdin>".to_owned();
        }
    }
    summary
}

fn direct_run_status(output: &crate::process::ProcessRunOutput) -> CodexDirectRunStatus {
    match output.status {
        ProcessRunStatus::Completed if output.exit_code == Some(0) => {
            CodexDirectRunStatus::Completed
        }
        ProcessRunStatus::Completed => CodexDirectRunStatus::Failed,
        ProcessRunStatus::FailedToStart => CodexDirectRunStatus::FailedToStart,
        ProcessRunStatus::TimedOut => CodexDirectRunStatus::TimedOut,
    }
}

fn direct_run_error_message(output: &crate::process::ProcessRunOutput) -> Option<String> {
    if let Some(message) = output.error_message.as_deref() {
        return Some(actionable_codex_launch_error(message));
    }

    match output.status {
        ProcessRunStatus::Completed if output.exit_code == Some(0) => None,
        ProcessRunStatus::Completed => {
            let mut message = match output.exit_code {
                Some(exit_code) => format!("codex exec exited with code {exit_code}"),
                None => "codex exec exited without an exit code".to_owned(),
            };

            let stderr_detail = compact_output_detail(&output.stderr);
            let stdout_detail = compact_output_detail(&output.stdout);

            if let Some(detail) = stderr_detail.as_deref() {
                message.push_str(": stderr: ");
                if detail.contains(TRUSTED_DIRECTORY_ERROR) {
                    message.push_str(TRUSTED_DIRECTORY_ACTIONABLE_ERROR);
                    message.push_str(" stderr: ");
                }
                message.push_str(detail);
            } else if let Some(detail) = stdout_detail.as_deref() {
                message.push_str(": stdout: ");
                message.push_str(detail);
            }

            if is_codex_argument_mismatch(&output.stderr) {
                message.push_str(
                    ". Codex CLI argument mismatch/version suspected; verify the installed Codex CLI version and argv ordering.",
                );
            }

            Some(message)
        }
        ProcessRunStatus::FailedToStart => Some("could not start codex exec".to_owned()),
        ProcessRunStatus::TimedOut => Some("codex exec timed out".to_owned()),
    }
}

fn is_codex_argument_mismatch(stderr: &str) -> bool {
    stderr.contains("unexpected argument") || stderr.contains("Usage: codex exec")
}

fn compact_output_detail(output: &str) -> Option<String> {
    let detail = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ");

    if detail.is_empty() {
        None
    } else {
        Some(detail)
    }
}

fn read_final_message(path: &Path) -> (Option<String>, Option<String>) {
    match fs::read_to_string(path) {
        Ok(message) => (Some(message), None),
        Err(error) => (
            None,
            Some(format!(
                "could not read final message file `{}`: {error}",
                path.display()
            )),
        ),
    }
}

fn unique_output_last_message_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-codex-direct-last-message-{}-{nanos}.txt",
        std::process::id()
    ))
}

fn rejected_request(
    started_at: Instant,
    request: CodexDirectRunRequest,
    command_summary: Vec<String>,
    message: impl Into<String>,
) -> CodexDirectRunOutput {
    CodexDirectRunOutput {
        status: CodexDirectRunStatus::FailedToStart,
        exit_code: None,
        stdout: String::new(),
        stderr: String::new(),
        final_message: None,
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: started_at.elapsed().as_millis(),
        error_message: Some(message.into()),
        command_summary,
        repo_root: request.repo_root,
        sandbox: request.sandbox,
        approval_policy: request.approval_policy,
    }
}

fn combine_optional_messages(messages: impl IntoIterator<Item = Option<String>>) -> Option<String> {
    let messages = messages.into_iter().flatten().collect::<Vec<_>>();

    if messages.is_empty() {
        None
    } else {
        Some(messages.join("; "))
    }
}

#[cfg(test)]
mod tests;
