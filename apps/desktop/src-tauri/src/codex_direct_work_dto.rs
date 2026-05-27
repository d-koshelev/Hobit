use std::path::{Path, PathBuf};

use hobit_app::{
    CancelCodexDirectWorkRunInput, CodexDirectWorkCancellationSummary,
    CodexDirectWorkForceKillSummary, CodexDirectWorkRunSummary, CodexDirectWorkStreamEventSummary,
    CodexDirectWorkStreamStartSummary, DirectWorkValidationRunSummary,
    ForceKillCodexDirectWorkRunInput, RunCodexDirectWorkInput, RunDirectWorkValidationInput,
};
use serde::{Deserialize, Serialize};

pub(crate) const DIRECT_WORK_STREAM_EVENT_NAME: &str = "direct-work://event";

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RunCodexDirectWorkRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub codex_executable: String,
    pub repo_root: String,
    pub operator_prompt: String,
    pub codex_thread_id: Option<String>,
    pub sandbox: String,
    pub approval_policy: String,
    #[serde(default)]
    pub skip_git_repo_check: bool,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct StartCodexDirectWorkStreamRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub codex_executable: String,
    pub repo_root: String,
    pub operator_prompt: String,
    pub codex_thread_id: Option<String>,
    pub sandbox: String,
    pub approval_policy: String,
    #[serde(default)]
    pub skip_git_repo_check: bool,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RunDirectWorkValidationRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub repo_root: String,
    pub validation_profile: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CancelCodexDirectWorkRunRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub run_id: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ForceKillCodexDirectWorkRunRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub run_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct RunCodexDirectWorkResponseDto {
    pub run_id: String,
    pub result_id: String,
    pub result_type: String,
    pub executor_kind: String,
    pub mode: String,
    pub repo_root: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub command_summary: Vec<String>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub final_message: Option<String>,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub no_auto_commit: bool,
    pub no_auto_push: bool,
    pub git_mutations_performed_by_hobit: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct StartCodexDirectWorkStreamResponseDto {
    pub run_id: String,
    pub status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct DirectWorkStreamEventDto {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub run_id: String,
    pub event_kind: String,
    pub line: Option<String>,
    pub text: Option<String>,
    pub parsed_codex_event_type: Option<String>,
    pub codex_thread_id: Option<String>,
    pub status: Option<String>,
    pub elapsed_ms: u128,
    pub is_final: bool,
    pub error_message: Option<String>,
    pub stderr_preview: Option<String>,
    pub exit_code: Option<i32>,
    pub final_status: Option<String>,
    pub failed_stage: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct RunDirectWorkValidationResponseDto {
    pub run_id: String,
    pub result_id: String,
    pub result_type: String,
    pub profile: String,
    pub status: String,
    pub run_status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub repo_root: String,
    pub no_git_mutations: bool,
    pub no_commit_push: bool,
    pub git_mutations_performed_by_hobit: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct CancelCodexDirectWorkRunResponseDto {
    pub run_id: String,
    pub status: String,
    pub message: String,
    pub cancellation_requested: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct ForceKillCodexDirectWorkRunResponseDto {
    pub run_id: String,
    pub status: String,
    pub message: String,
    pub force_kill_requested: bool,
}

impl From<RunCodexDirectWorkRequest> for RunCodexDirectWorkInput {
    fn from(request: RunCodexDirectWorkRequest) -> Self {
        run_codex_direct_work_input_from_parts(
            request.workspace_id,
            request.workbench_id,
            request.widget_instance_id,
            request.codex_executable,
            resolve_direct_work_path(&request.repo_root),
            request.operator_prompt,
            request.codex_thread_id,
            request.sandbox,
            request.approval_policy,
            request.skip_git_repo_check,
            request.timeout_ms,
            request.stdout_cap_bytes,
            request.stderr_cap_bytes,
        )
    }
}

impl From<StartCodexDirectWorkStreamRequest> for RunCodexDirectWorkInput {
    fn from(request: StartCodexDirectWorkStreamRequest) -> Self {
        run_codex_direct_work_input_from_parts(
            request.workspace_id,
            request.workbench_id,
            request.widget_instance_id,
            request.codex_executable,
            resolve_direct_work_path(&request.repo_root),
            request.operator_prompt,
            request.codex_thread_id,
            request.sandbox,
            request.approval_policy,
            request.skip_git_repo_check,
            request.timeout_ms,
            request.stdout_cap_bytes,
            request.stderr_cap_bytes,
        )
    }
}

pub(crate) fn try_run_codex_direct_work_input_from_request(
    request: RunCodexDirectWorkRequest,
) -> Result<RunCodexDirectWorkInput, String> {
    let repo_root = try_resolve_direct_work_path(&request.repo_root)?;
    Ok(run_codex_direct_work_input_from_parts(
        request.workspace_id,
        request.workbench_id,
        request.widget_instance_id,
        request.codex_executable,
        repo_root,
        request.operator_prompt,
        request.codex_thread_id,
        request.sandbox,
        request.approval_policy,
        request.skip_git_repo_check,
        request.timeout_ms,
        request.stdout_cap_bytes,
        request.stderr_cap_bytes,
    ))
}

pub(crate) fn try_run_codex_direct_work_input_from_stream_request(
    request: StartCodexDirectWorkStreamRequest,
) -> Result<RunCodexDirectWorkInput, String> {
    let repo_root = try_resolve_direct_work_path(&request.repo_root)?;
    Ok(run_codex_direct_work_input_from_parts(
        request.workspace_id,
        request.workbench_id,
        request.widget_instance_id,
        request.codex_executable,
        repo_root,
        request.operator_prompt,
        request.codex_thread_id,
        request.sandbox,
        request.approval_policy,
        request.skip_git_repo_check,
        request.timeout_ms,
        request.stdout_cap_bytes,
        request.stderr_cap_bytes,
    ))
}

#[allow(clippy::too_many_arguments)]
fn run_codex_direct_work_input_from_parts(
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    codex_executable: String,
    repo_root: PathBuf,
    operator_prompt: String,
    codex_thread_id: Option<String>,
    sandbox: String,
    approval_policy: String,
    skip_git_repo_check: bool,
    timeout_ms: Option<u64>,
    stdout_cap_bytes: Option<usize>,
    stderr_cap_bytes: Option<usize>,
) -> RunCodexDirectWorkInput {
    RunCodexDirectWorkInput {
        workspace_id,
        workbench_id,
        widget_instance_id,
        codex_executable,
        repo_root,
        operator_prompt,
        codex_thread_id,
        sandbox,
        approval_policy,
        skip_git_repo_check,
        timeout_ms,
        stdout_cap_bytes,
        stderr_cap_bytes,
    }
}

pub(crate) fn resolve_direct_work_path(path: &str) -> PathBuf {
    try_resolve_direct_work_path(path).unwrap_or_else(|_| PathBuf::from(path))
}

pub(crate) fn try_resolve_direct_work_path(path: &str) -> Result<PathBuf, String> {
    resolve_direct_work_path_with_home_result(path, current_user_home_dir())
}

#[cfg(test)]
pub(crate) fn resolve_direct_work_path_with_home(path: &str, home_dir: Option<PathBuf>) -> PathBuf {
    resolve_direct_work_path_with_home_result(path, home_dir)
        .unwrap_or_else(|_| PathBuf::from(path))
}

pub(crate) fn resolve_direct_work_path_with_home_result(
    path: &str,
    home_dir: Option<PathBuf>,
) -> Result<PathBuf, String> {
    if path == "~" {
        return home_dir.ok_or_else(missing_home_directory_message);
    }

    let Some(rest) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) else {
        return Ok(PathBuf::from(path));
    };

    match home_dir {
        Some(home_dir) => Ok(home_dir.join(Path::new(rest))),
        None => Err(missing_home_directory_message()),
    }
}

fn current_user_home_dir() -> Option<PathBuf> {
    current_user_home_dir_from_env(
        current_home_platform(),
        std::env::var_os("USERPROFILE"),
        std::env::var_os("HOMEDRIVE"),
        std::env::var_os("HOMEPATH"),
        std::env::var_os("HOME"),
    )
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HomeDirectoryPlatform {
    Windows,
    Unix,
}

pub(crate) fn current_user_home_dir_from_env(
    platform: HomeDirectoryPlatform,
    userprofile: Option<std::ffi::OsString>,
    homedrive: Option<std::ffi::OsString>,
    homepath: Option<std::ffi::OsString>,
    home: Option<std::ffi::OsString>,
) -> Option<PathBuf> {
    match platform {
        HomeDirectoryPlatform::Windows => userprofile
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .or_else(|| windows_home_from_drive_path(homedrive, homepath))
            .or_else(|| home.filter(|value| !value.is_empty()).map(PathBuf::from)),
        HomeDirectoryPlatform::Unix => home
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                userprofile
                    .filter(|value| !value.is_empty())
                    .map(PathBuf::from)
            }),
    }
}

fn windows_home_from_drive_path(
    homedrive: Option<std::ffi::OsString>,
    homepath: Option<std::ffi::OsString>,
) -> Option<PathBuf> {
    let drive = homedrive?;
    let path = homepath?;
    if drive.is_empty() || path.is_empty() {
        return None;
    }
    Some(PathBuf::from(format!(
        "{}{}",
        drive.to_string_lossy(),
        path.to_string_lossy()
    )))
}

fn missing_home_directory_message() -> String {
    "Could not resolve `~` because the current user's home directory is unavailable.".to_owned()
}

fn current_home_platform() -> HomeDirectoryPlatform {
    if cfg!(windows) {
        HomeDirectoryPlatform::Windows
    } else {
        HomeDirectoryPlatform::Unix
    }
}

impl From<RunDirectWorkValidationRequest> for RunDirectWorkValidationInput {
    fn from(request: RunDirectWorkValidationRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            repo_root: PathBuf::from(request.repo_root),
            validation_profile: request.validation_profile,
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
        }
    }
}

impl From<CancelCodexDirectWorkRunRequest> for CancelCodexDirectWorkRunInput {
    fn from(request: CancelCodexDirectWorkRunRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            run_id: request.run_id,
        }
    }
}

impl From<ForceKillCodexDirectWorkRunRequest> for ForceKillCodexDirectWorkRunInput {
    fn from(request: ForceKillCodexDirectWorkRunRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            run_id: request.run_id,
        }
    }
}

impl From<CodexDirectWorkRunSummary> for RunCodexDirectWorkResponseDto {
    fn from(summary: CodexDirectWorkRunSummary) -> Self {
        Self {
            run_id: summary.run_id,
            result_id: summary.result_id,
            result_type: summary.result_type,
            executor_kind: summary.executor_kind,
            mode: summary.mode,
            repo_root: summary.repo_root,
            sandbox: summary.sandbox,
            approval_policy: summary.approval_policy,
            command_summary: summary.command_summary,
            status: summary.status,
            exit_code: summary.exit_code,
            stdout: summary.stdout,
            stderr: summary.stderr,
            stdout_truncated: summary.stdout_truncated,
            stderr_truncated: summary.stderr_truncated,
            final_message: summary.final_message,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
            no_auto_commit: summary.no_auto_commit,
            no_auto_push: summary.no_auto_push,
            git_mutations_performed_by_hobit: summary.git_mutations_performed_by_hobit,
        }
    }
}

impl From<DirectWorkValidationRunSummary> for RunDirectWorkValidationResponseDto {
    fn from(summary: DirectWorkValidationRunSummary) -> Self {
        Self {
            run_id: summary.run_id,
            result_id: summary.result_id,
            result_type: summary.result_type,
            profile: summary.profile,
            status: summary.status,
            run_status: summary.run_status,
            exit_code: summary.exit_code,
            stdout: summary.stdout,
            stderr: summary.stderr,
            stdout_truncated: summary.stdout_truncated,
            stderr_truncated: summary.stderr_truncated,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
            command_summary: summary.command_summary,
            repo_root: summary.repo_root,
            no_git_mutations: summary.no_git_mutations,
            no_commit_push: summary.no_commit_push,
            git_mutations_performed_by_hobit: summary.git_mutations_performed_by_hobit,
        }
    }
}

impl From<CodexDirectWorkCancellationSummary> for CancelCodexDirectWorkRunResponseDto {
    fn from(summary: CodexDirectWorkCancellationSummary) -> Self {
        Self {
            run_id: summary.run_id,
            status: summary.status,
            message: summary.message,
            cancellation_requested: summary.cancellation_requested,
        }
    }
}

impl From<CodexDirectWorkForceKillSummary> for ForceKillCodexDirectWorkRunResponseDto {
    fn from(summary: CodexDirectWorkForceKillSummary) -> Self {
        Self {
            run_id: summary.run_id,
            status: summary.status,
            message: summary.message,
            force_kill_requested: summary.force_kill_requested,
        }
    }
}

impl From<CodexDirectWorkStreamStartSummary> for StartCodexDirectWorkStreamResponseDto {
    fn from(summary: CodexDirectWorkStreamStartSummary) -> Self {
        Self {
            run_id: summary.run_id,
            status: summary.status,
        }
    }
}

impl From<CodexDirectWorkStreamEventSummary> for DirectWorkStreamEventDto {
    fn from(event: CodexDirectWorkStreamEventSummary) -> Self {
        Self {
            workspace_id: event.workspace_id,
            workbench_id: event.workbench_id,
            widget_instance_id: event.widget_instance_id,
            run_id: event.run_id,
            event_kind: event.event_kind,
            line: event.line,
            text: event.text,
            parsed_codex_event_type: event.parsed_codex_event_type,
            codex_thread_id: event.codex_thread_id,
            status: event.status,
            elapsed_ms: event.elapsed_ms,
            is_final: event.is_final,
            error_message: event.error_message,
            stderr_preview: event.stderr_preview,
            exit_code: event.exit_code,
            final_status: event.final_status,
            failed_stage: event.failed_stage,
        }
    }
}
