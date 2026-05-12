use std::fmt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::super::direct_run::{CodexApprovalPolicy, CodexSandboxMode};

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
    Cancelled,
}

impl CodexDirectStreamStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Completed => "completed",
            Self::FailedToStart => "failed_to_start",
            Self::TimedOut => "timed_out",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
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
    pub stderr_preview: Option<String>,
    pub exit_code: Option<i32>,
    pub final_status: Option<String>,
    pub failed_stage: Option<String>,
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
    Cancelled,
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
            Self::Cancelled => "cancelled",
        }
    }
}

impl fmt::Display for CodexDirectStreamEventKind {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Clone, Debug, Default)]
pub struct CodexDirectStreamCancellationToken {
    requested: Arc<AtomicBool>,
}

impl CodexDirectStreamCancellationToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn request_cancellation(&self) {
        self.requested.store(true, Ordering::SeqCst);
    }

    pub fn is_cancellation_requested(&self) -> bool {
        self.requested.load(Ordering::SeqCst)
    }
}
