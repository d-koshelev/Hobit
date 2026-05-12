//! Hobit Toolbelt validation runner foundation.
//!
//! This module provides a small backend/tooling boundary for running the
//! repository-local Toolbelt validation profiles. It does not add frontend UI,
//! Tauri commands, Direct Work integration, persistence, Git mutations,
//! cancellation, queue execution, PTY, or automatic validation.

use std::fmt;
use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::process::{
    run_process_once, ProcessRunOutput, ProcessRunRequest, ProcessRunStatus,
    DEFAULT_PROCESS_TIMEOUT_MS, DEFAULT_STDERR_CAP_BYTES, DEFAULT_STDOUT_CAP_BYTES,
};

const WINDOWS_VALIDATION_PROGRAM: &str = "powershell";
const UNIX_VALIDATION_PROGRAM: &str = "bash";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ToolbeltValidationProfile {
    Fast,
    Changed,
    Full,
}

impl ToolbeltValidationProfile {
    pub fn as_cli_arg(self) -> &'static str {
        match self {
            Self::Fast => "fast",
            Self::Changed => "changed",
            Self::Full => "full",
        }
    }
}

impl fmt::Display for ToolbeltValidationProfile {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_cli_arg())
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ToolbeltValidationShellKind {
    WindowsPowerShell,
    UnixBash,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolbeltValidationRequest {
    pub repo_root: PathBuf,
    pub profile: ToolbeltValidationProfile,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
    pub shell_kind: Option<ToolbeltValidationShellKind>,
}

impl ToolbeltValidationRequest {
    pub fn new(repo_root: impl Into<PathBuf>, profile: ToolbeltValidationProfile) -> Self {
        Self {
            repo_root: repo_root.into(),
            profile,
            timeout_ms: None,
            stdout_cap_bytes: None,
            stderr_cap_bytes: None,
            shell_kind: None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolbeltValidationOutput {
    pub status: ToolbeltValidationStatus,
    pub profile: ToolbeltValidationProfile,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub repo_root: PathBuf,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ToolbeltValidationStatus {
    Passed,
    Failed,
    FailedToStart,
    TimedOut,
}

impl ToolbeltValidationStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Passed => "passed",
            Self::Failed => "failed",
            Self::FailedToStart => "failed_to_start",
            Self::TimedOut => "timed_out",
        }
    }
}

impl fmt::Display for ToolbeltValidationStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ToolbeltValidationCommand {
    program: String,
    args: Vec<String>,
    script_path: PathBuf,
}

pub fn run_toolbelt_validation(request: ToolbeltValidationRequest) -> ToolbeltValidationOutput {
    run_toolbelt_validation_inner(request, None)
}

fn run_toolbelt_validation_inner(
    request: ToolbeltValidationRequest,
    runner_program_override: Option<String>,
) -> ToolbeltValidationOutput {
    let started_at = Instant::now();

    if let Some(message) = validate_repo_root(&request.repo_root) {
        return rejected_request(started_at, request, Vec::new(), message);
    }

    let command = build_toolbelt_validation_command(
        &request.repo_root,
        request.profile,
        request.shell_kind.unwrap_or_else(default_shell_kind),
        runner_program_override,
    );

    if !command.script_path.is_file() {
        return rejected_request(
            started_at,
            request,
            command_summary(&command),
            format!(
                "Toolbelt validation script not found: {}",
                command.script_path.display()
            ),
        );
    }

    let command_summary = command_summary(&command);
    let process_output = run_process_once(ProcessRunRequest {
        program: command.program,
        args: command.args,
        stdin: None,
        working_directory: request.repo_root.clone(),
        timeout_ms: request.timeout_ms.unwrap_or(DEFAULT_PROCESS_TIMEOUT_MS),
        stdout_cap_bytes: request.stdout_cap_bytes.unwrap_or(DEFAULT_STDOUT_CAP_BYTES),
        stderr_cap_bytes: request.stderr_cap_bytes.unwrap_or(DEFAULT_STDERR_CAP_BYTES),
    });

    let status = validation_status(&process_output);
    let error_message = validation_error_message(&process_output);

    ToolbeltValidationOutput {
        status,
        profile: request.profile,
        exit_code: process_output.exit_code,
        stdout: process_output.stdout,
        stderr: process_output.stderr,
        stdout_truncated: process_output.stdout_truncated,
        stderr_truncated: process_output.stderr_truncated,
        duration_ms: process_output.duration_ms,
        error_message,
        command_summary,
        repo_root: request.repo_root,
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

fn build_toolbelt_validation_command(
    repo_root: &Path,
    profile: ToolbeltValidationProfile,
    shell_kind: ToolbeltValidationShellKind,
    runner_program_override: Option<String>,
) -> ToolbeltValidationCommand {
    let relative_script_path = validation_script_relative_path(shell_kind);
    let script_path = repo_root.join(&relative_script_path);
    let script_arg = relative_script_path.to_string_lossy().into_owned();

    match shell_kind {
        ToolbeltValidationShellKind::WindowsPowerShell => ToolbeltValidationCommand {
            program: runner_program_override
                .unwrap_or_else(|| WINDOWS_VALIDATION_PROGRAM.to_owned()),
            args: vec![
                "-NoProfile".to_owned(),
                "-ExecutionPolicy".to_owned(),
                "Bypass".to_owned(),
                "-File".to_owned(),
                script_arg,
                "-Profile".to_owned(),
                profile.as_cli_arg().to_owned(),
            ],
            script_path,
        },
        ToolbeltValidationShellKind::UnixBash => ToolbeltValidationCommand {
            program: runner_program_override.unwrap_or_else(|| UNIX_VALIDATION_PROGRAM.to_owned()),
            args: vec![
                script_arg,
                "--profile".to_owned(),
                profile.as_cli_arg().to_owned(),
            ],
            script_path,
        },
    }
}

fn validation_script_relative_path(shell_kind: ToolbeltValidationShellKind) -> PathBuf {
    match shell_kind {
        ToolbeltValidationShellKind::WindowsPowerShell => {
            Path::new("scripts").join("hobit").join("validate.ps1")
        }
        ToolbeltValidationShellKind::UnixBash => {
            Path::new("scripts").join("hobit").join("validate.sh")
        }
    }
}

fn default_shell_kind() -> ToolbeltValidationShellKind {
    if cfg!(windows) {
        ToolbeltValidationShellKind::WindowsPowerShell
    } else {
        ToolbeltValidationShellKind::UnixBash
    }
}

fn command_summary(command: &ToolbeltValidationCommand) -> Vec<String> {
    std::iter::once(command.program.clone())
        .chain(command.args.iter().cloned())
        .collect()
}

fn validation_status(output: &ProcessRunOutput) -> ToolbeltValidationStatus {
    match output.status {
        ProcessRunStatus::Completed if output.exit_code == Some(0) => {
            ToolbeltValidationStatus::Passed
        }
        ProcessRunStatus::Completed => ToolbeltValidationStatus::Failed,
        ProcessRunStatus::FailedToStart => ToolbeltValidationStatus::FailedToStart,
        ProcessRunStatus::TimedOut => ToolbeltValidationStatus::TimedOut,
    }
}

fn validation_error_message(output: &ProcessRunOutput) -> Option<String> {
    if let Some(message) = output.error_message.as_deref() {
        return Some(message.to_owned());
    }

    match output.status {
        ProcessRunStatus::Completed if output.exit_code == Some(0) => None,
        ProcessRunStatus::Completed => {
            let mut message = match output.exit_code {
                Some(exit_code) => format!("Toolbelt validation exited with code {exit_code}"),
                None => "Toolbelt validation exited without an exit code".to_owned(),
            };

            if let Some(detail) = compact_output_detail(&output.stderr) {
                message.push_str(": stderr: ");
                message.push_str(&detail);
            }

            Some(message)
        }
        ProcessRunStatus::FailedToStart => Some("could not start Toolbelt validation".to_owned()),
        ProcessRunStatus::TimedOut => Some("Toolbelt validation timed out".to_owned()),
    }
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

fn rejected_request(
    started_at: Instant,
    request: ToolbeltValidationRequest,
    command_summary: Vec<String>,
    message: impl Into<String>,
) -> ToolbeltValidationOutput {
    ToolbeltValidationOutput {
        status: ToolbeltValidationStatus::FailedToStart,
        profile: request.profile,
        exit_code: None,
        stdout: String::new(),
        stderr: String::new(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: started_at.elapsed().as_millis(),
        error_message: Some(message.into()),
        command_summary,
        repo_root: request.repo_root,
    }
}

#[cfg(test)]
mod tests;
