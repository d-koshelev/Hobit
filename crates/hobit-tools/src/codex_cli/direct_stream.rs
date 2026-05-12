//! Streaming Codex CLI Direct Work runner foundation.
//!
//! This module runs `codex exec --json` with explicit argv, an explicit
//! repository root, an explicit sandbox, and an explicit approval policy while
//! streaming stdout/stderr lines to a caller-provided callback. It remains a
//! tooling-layer foundation only: no UI, Tauri commands, storage persistence,
//! Git inspection or mutation, queue execution, stdin, PTY, or interactive
//! Codex session is added here.

use std::ffi::OsStr;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::codex_cli::{resolve_codex_executable, DEFAULT_CODEX_CLI_PROGRAM};

use super::direct_run::{
    CodexApprovalPolicy, CodexSandboxMode, DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES,
    DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES, DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS,
};
use command::{build_codex_exec_json_args, safe_command_summary, validate_repo_root};
use json::parse_lightweight_json_line;
use status::{direct_stream_error_message, direct_stream_status};
use stream_io::{
    join_line_reader, spawn_line_reader, stream_event_line, CappedOutput, ReaderMessage, StreamKind,
};

const PROCESS_POLL_INTERVAL: Duration = Duration::from_millis(10);

mod command;
mod json;
mod status;
mod stream_io;

/// Direct Work request for streaming a one-shot `codex exec --json` invocation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectStreamRequest {
    pub program: Option<String>,
    pub repo_root: PathBuf,
    pub prompt: String,
    pub sandbox: CodexSandboxMode,
    pub approval_policy: CodexApprovalPolicy,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
    pub output_last_message_path: Option<PathBuf>,
}

impl CodexDirectStreamRequest {
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
            timeout_ms: None,
            stdout_cap_bytes: None,
            stderr_cap_bytes: None,
            output_last_message_path: None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectStreamOutput {
    pub status: CodexDirectStreamStatus,
    pub exit_code: Option<i32>,
    pub final_message: Option<String>,
    pub stdout_collected: String,
    pub stderr_collected: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub event_count: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodexDirectStreamStatus {
    Completed,
    FailedToStart,
    TimedOut,
    Failed,
}

impl CodexDirectStreamStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Completed => "completed",
            Self::FailedToStart => "failed_to_start",
            Self::TimedOut => "timed_out",
            Self::Failed => "failed",
        }
    }
}

impl fmt::Display for CodexDirectStreamStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectStreamEvent {
    pub kind: CodexDirectStreamEventKind,
    pub elapsed_ms: u128,
    pub line: Option<String>,
    pub text: Option<String>,
    pub parsed_json: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodexDirectStreamEventKind {
    Started,
    StdoutLine,
    StderrLine,
    CodexJsonEvent,
    FinalMessage,
    Completed,
    Failed,
    TimedOut,
}

impl CodexDirectStreamEventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Started => "started",
            Self::StdoutLine => "stdout_line",
            Self::StderrLine => "stderr_line",
            Self::CodexJsonEvent => "codex_json_event",
            Self::FinalMessage => "final_message",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::TimedOut => "timed_out",
        }
    }
}

impl fmt::Display for CodexDirectStreamEventKind {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// Run one bounded `codex exec --json` Direct Work process and stream line
/// events to `on_event`.
///
/// Non-zero Codex exits are returned as `CodexDirectStreamStatus::Failed`,
/// while a zero exit is `Completed`. Process spawn failures and timeouts are
/// separate infrastructure statuses. The prompt is passed as one argv item and
/// is intentionally not copied into `command_summary`.
pub fn run_codex_direct_work_streaming<F>(
    request: CodexDirectStreamRequest,
    on_event: F,
) -> CodexDirectStreamOutput
where
    F: FnMut(CodexDirectStreamEvent),
{
    run_codex_direct_work_streaming_inner(request, on_event, None)
}

fn run_codex_direct_work_streaming_inner<F>(
    request: CodexDirectStreamRequest,
    mut on_event: F,
    path_env_override: Option<&OsStr>,
) -> CodexDirectStreamOutput
where
    F: FnMut(CodexDirectStreamEvent),
{
    let started_at = Instant::now();
    let program = request
        .program
        .as_deref()
        .unwrap_or(DEFAULT_CODEX_CLI_PROGRAM)
        .trim()
        .to_owned();

    if program.is_empty() {
        return rejected_request(
            started_at,
            request,
            Vec::new(),
            "program must not be empty",
            &mut on_event,
        );
    }

    if let Some(message) = validate_repo_root(&request.repo_root) {
        return rejected_request(started_at, request, Vec::new(), message, &mut on_event);
    }

    if request.prompt.trim().is_empty() {
        return rejected_request(
            started_at,
            request,
            Vec::new(),
            "prompt must not be empty",
            &mut on_event,
        );
    }

    if request.timeout_ms == Some(0) {
        return rejected_request(
            started_at,
            request,
            Vec::new(),
            "timeout_ms must be greater than zero",
            &mut on_event,
        );
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
            return rejected_request(
                started_at,
                request,
                Vec::new(),
                error.message,
                &mut on_event,
            );
        }
    };

    let output_last_message_path = request
        .output_last_message_path
        .clone()
        .unwrap_or_else(unique_output_last_message_path);
    let cleanup_output_file = request.output_last_message_path.is_none();
    let args = build_codex_exec_json_args(
        &request.repo_root,
        request.sandbox,
        request.approval_policy,
        &output_last_message_path,
        &request.prompt,
    );
    let command_summary = safe_command_summary(
        &resolution.program,
        &request.repo_root,
        request.sandbox,
        request.approval_policy,
        &output_last_message_path,
    );
    let timeout = Duration::from_millis(
        request
            .timeout_ms
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS),
    );
    let stdout_cap_bytes = request
        .stdout_cap_bytes
        .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES);
    let stderr_cap_bytes = request
        .stderr_cap_bytes
        .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES);

    let mut child = match Command::new(&resolution.program)
        .args(&args)
        .current_dir(&request.repo_root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return rejected_request(
                started_at,
                request,
                command_summary,
                format!("could not start codex exec: {error}"),
                &mut on_event,
            )
        }
    };

    let stdout = match child.stdout.take() {
        Some(stdout) => stdout,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            return rejected_request(
                started_at,
                request,
                command_summary,
                "could not capture process stdout",
                &mut on_event,
            );
        }
    };
    let stderr = match child.stderr.take() {
        Some(stderr) => stderr,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            return rejected_request(
                started_at,
                request,
                command_summary,
                "could not capture process stderr",
                &mut on_event,
            );
        }
    };

    let (sender, receiver) = mpsc::channel();
    let stdout_reader = spawn_line_reader(StreamKind::Stdout, stdout, sender.clone());
    let stderr_reader = spawn_line_reader(StreamKind::Stderr, stderr, sender.clone());
    drop(sender);

    let mut event_count = 0;
    emit_event(
        &mut on_event,
        &mut event_count,
        CodexDirectStreamEvent {
            kind: CodexDirectStreamEventKind::Started,
            elapsed_ms: started_at.elapsed().as_millis(),
            line: None,
            text: None,
            parsed_json: None,
            error_message: None,
        },
    );

    let mut stdout_collected = CappedOutput::default();
    let mut stderr_collected = CappedOutput::default();
    let mut stdout_done = false;
    let mut stderr_done = false;
    let mut stdout_reader_error = None;
    let mut stderr_reader_error = None;
    let mut child_finished = false;
    let mut timed_out = false;
    let mut wait_error = None;
    let mut exit_code = None;

    loop {
        match receiver.recv_timeout(PROCESS_POLL_INTERVAL) {
            Ok(message) => handle_reader_message(
                message,
                &mut stdout_collected,
                &mut stderr_collected,
                stdout_cap_bytes,
                stderr_cap_bytes,
                &mut stdout_done,
                &mut stderr_done,
                &mut stdout_reader_error,
                &mut stderr_reader_error,
                started_at,
                &mut on_event,
                &mut event_count,
            ),
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => {
                stdout_done = true;
                stderr_done = true;
            }
        }

        if !child_finished {
            match child.try_wait() {
                Ok(Some(status)) => {
                    exit_code = status.code();
                    child_finished = true;
                }
                Ok(None) => {
                    if started_at.elapsed() >= timeout {
                        let _ = child.kill();
                        let _ = child.wait();
                        timed_out = true;
                        child_finished = true;
                    }
                }
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    wait_error = Some(format!("could not wait for codex exec: {error}"));
                    child_finished = true;
                }
            }
        }

        if child_finished && stdout_done && stderr_done {
            break;
        }
    }

    join_line_reader(stdout_reader, StreamKind::Stdout, &mut stdout_reader_error);
    join_line_reader(stderr_reader, StreamKind::Stderr, &mut stderr_reader_error);

    let (stdout_collected, stdout_truncated) = stdout_collected.into_parts();
    let (stderr_collected, stderr_truncated) = stderr_collected.into_parts();
    let (final_message, final_message_error) = read_final_message(&output_last_message_path);

    if cleanup_output_file {
        let _ = fs::remove_file(&output_last_message_path);
    }

    if let Some(message) = final_message.as_deref() {
        emit_event(
            &mut on_event,
            &mut event_count,
            CodexDirectStreamEvent {
                kind: CodexDirectStreamEventKind::FinalMessage,
                elapsed_ms: started_at.elapsed().as_millis(),
                line: None,
                text: Some(message.to_owned()),
                parsed_json: None,
                error_message: None,
            },
        );
    }

    let status = direct_stream_status(timed_out, wait_error.as_deref(), exit_code);
    let error_message = combine_optional_messages([
        direct_stream_error_message(status, exit_code, &stderr_collected, &stdout_collected),
        wait_error,
        stdout_reader_error,
        stderr_reader_error,
        final_message_error,
    ]);

    emit_final_status_event(
        status,
        error_message.as_deref(),
        started_at,
        &mut on_event,
        &mut event_count,
    );

    CodexDirectStreamOutput {
        status,
        exit_code,
        final_message,
        stdout_collected,
        stderr_collected,
        stdout_truncated,
        stderr_truncated,
        duration_ms: started_at.elapsed().as_millis(),
        error_message,
        command_summary,
        event_count,
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_reader_message<F>(
    message: ReaderMessage,
    stdout_collected: &mut CappedOutput,
    stderr_collected: &mut CappedOutput,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
    stdout_done: &mut bool,
    stderr_done: &mut bool,
    stdout_reader_error: &mut Option<String>,
    stderr_reader_error: &mut Option<String>,
    started_at: Instant,
    on_event: &mut F,
    event_count: &mut usize,
) where
    F: FnMut(CodexDirectStreamEvent),
{
    match message {
        ReaderMessage::Line { stream, line } => match stream {
            StreamKind::Stdout => {
                stdout_collected.append(&line, stdout_cap_bytes);
                let event_line = stream_event_line(&line);
                if let Some(parsed_json) = parse_lightweight_json_line(&event_line) {
                    emit_event(
                        on_event,
                        event_count,
                        CodexDirectStreamEvent {
                            kind: CodexDirectStreamEventKind::CodexJsonEvent,
                            elapsed_ms: started_at.elapsed().as_millis(),
                            line: Some(event_line),
                            text: None,
                            parsed_json: Some(parsed_json),
                            error_message: None,
                        },
                    );
                } else {
                    emit_event(
                        on_event,
                        event_count,
                        CodexDirectStreamEvent {
                            kind: CodexDirectStreamEventKind::StdoutLine,
                            elapsed_ms: started_at.elapsed().as_millis(),
                            line: Some(event_line),
                            text: None,
                            parsed_json: None,
                            error_message: None,
                        },
                    );
                }
            }
            StreamKind::Stderr => {
                stderr_collected.append(&line, stderr_cap_bytes);
                emit_event(
                    on_event,
                    event_count,
                    CodexDirectStreamEvent {
                        kind: CodexDirectStreamEventKind::StderrLine,
                        elapsed_ms: started_at.elapsed().as_millis(),
                        line: Some(stream_event_line(&line)),
                        text: None,
                        parsed_json: None,
                        error_message: None,
                    },
                );
            }
        },
        ReaderMessage::Error { stream, message } => match stream {
            StreamKind::Stdout => *stdout_reader_error = Some(message),
            StreamKind::Stderr => *stderr_reader_error = Some(message),
        },
        ReaderMessage::Done(stream) => match stream {
            StreamKind::Stdout => *stdout_done = true,
            StreamKind::Stderr => *stderr_done = true,
        },
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
        "hobit-codex-direct-stream-last-message-{}-{nanos}.txt",
        std::process::id()
    ))
}

fn rejected_request<F>(
    started_at: Instant,
    _request: CodexDirectStreamRequest,
    command_summary: Vec<String>,
    message: impl Into<String>,
    on_event: &mut F,
) -> CodexDirectStreamOutput
where
    F: FnMut(CodexDirectStreamEvent),
{
    let message = message.into();
    let mut event_count = 0;
    emit_event(
        on_event,
        &mut event_count,
        CodexDirectStreamEvent {
            kind: CodexDirectStreamEventKind::Failed,
            elapsed_ms: started_at.elapsed().as_millis(),
            line: None,
            text: None,
            parsed_json: None,
            error_message: Some(message.clone()),
        },
    );

    CodexDirectStreamOutput {
        status: CodexDirectStreamStatus::FailedToStart,
        exit_code: None,
        final_message: None,
        stdout_collected: String::new(),
        stderr_collected: String::new(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: started_at.elapsed().as_millis(),
        error_message: Some(message),
        command_summary,
        event_count,
    }
}

fn emit_final_status_event<F>(
    status: CodexDirectStreamStatus,
    error_message: Option<&str>,
    started_at: Instant,
    on_event: &mut F,
    event_count: &mut usize,
) where
    F: FnMut(CodexDirectStreamEvent),
{
    let kind = match status {
        CodexDirectStreamStatus::Completed => CodexDirectStreamEventKind::Completed,
        CodexDirectStreamStatus::FailedToStart | CodexDirectStreamStatus::Failed => {
            CodexDirectStreamEventKind::Failed
        }
        CodexDirectStreamStatus::TimedOut => CodexDirectStreamEventKind::TimedOut,
    };

    emit_event(
        on_event,
        event_count,
        CodexDirectStreamEvent {
            kind,
            elapsed_ms: started_at.elapsed().as_millis(),
            line: None,
            text: None,
            parsed_json: None,
            error_message: error_message.map(ToOwned::to_owned),
        },
    );
}

fn emit_event<F>(on_event: &mut F, event_count: &mut usize, event: CodexDirectStreamEvent)
where
    F: FnMut(CodexDirectStreamEvent),
{
    *event_count += 1;
    on_event(event);
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
