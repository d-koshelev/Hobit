//! Bounded one-shot local process adapter foundation.
//!
//! This module intentionally provides only a low-level backend foundation. It
//! does not expose a shell mode, streaming, PTY, cancellation registry, Tauri
//! command, WorkspaceService wiring, widget runtime behavior, or agent runtime.

use std::fmt;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

pub const DEFAULT_PROCESS_TIMEOUT_MS: u64 = 30_000;
pub const DEFAULT_STDOUT_CAP_BYTES: usize = 64 * 1024;
pub const DEFAULT_STDERR_CAP_BYTES: usize = 64 * 1024;

const PROCESS_POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProcessRunRequest {
    pub program: String,
    pub args: Vec<String>,
    pub stdin: Option<String>,
    pub working_directory: PathBuf,
    pub timeout_ms: u64,
    pub stdout_cap_bytes: usize,
    pub stderr_cap_bytes: usize,
}

impl ProcessRunRequest {
    pub fn new(program: impl Into<String>, working_directory: impl Into<PathBuf>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            stdin: None,
            working_directory: working_directory.into(),
            timeout_ms: DEFAULT_PROCESS_TIMEOUT_MS,
            stdout_cap_bytes: DEFAULT_STDOUT_CAP_BYTES,
            stderr_cap_bytes: DEFAULT_STDERR_CAP_BYTES,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProcessRunOutput {
    pub status: ProcessRunStatus,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProcessRunStatus {
    Completed,
    FailedToStart,
    TimedOut,
}

impl ProcessRunStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Completed => "completed",
            Self::FailedToStart => "failed_to_start",
            Self::TimedOut => "timed_out",
        }
    }
}

impl fmt::Display for ProcessRunStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Eq, PartialEq)]
struct CappedText {
    text: String,
    truncated: bool,
    error_message: Option<String>,
}

/// Run one local process with an explicit program, argv, working directory,
/// timeout, and separate stdout/stderr caps.
///
/// The adapter uses `std::process::Command` directly. It never invokes a shell,
/// never concatenates command strings, and returns non-zero process exits as a
/// completed process result rather than an infrastructure failure.
pub fn run_process_once(request: ProcessRunRequest) -> ProcessRunOutput {
    let started_at = Instant::now();

    if request.program.trim().is_empty() {
        return failed_to_start(started_at, "program must not be empty");
    }

    if request.timeout_ms == 0 {
        return failed_to_start(started_at, "timeout_ms must be greater than zero");
    }

    if !request.working_directory.is_dir() {
        return failed_to_start(
            started_at,
            format!(
                "working_directory must be an existing directory: {}",
                request.working_directory.display()
            ),
        );
    }

    let mut child = match Command::new(&request.program)
        .args(&request.args)
        .current_dir(&request.working_directory)
        .stdin(if request.stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return failed_to_start(
                started_at,
                format!("could not start process `{}`: {error}", request.program),
            )
        }
    };

    let stdout = match child.stdout.take() {
        Some(stdout) => stdout,
        None => return failed_to_start(started_at, "could not capture process stdout"),
    };
    let stderr = match child.stderr.take() {
        Some(stderr) => stderr,
        None => return failed_to_start(started_at, "could not capture process stderr"),
    };

    let stdout_reader = spawn_capped_reader(stdout, request.stdout_cap_bytes);
    let stderr_reader = spawn_capped_reader(stderr, request.stderr_cap_bytes);
    let timeout = Duration::from_millis(request.timeout_ms);

    if let Some(stdin) = request.stdin.as_deref() {
        if let Err(message) = write_child_stdin(&mut child, stdin) {
            let _ = child.kill();
            let _ = child.wait();

            let stdout = join_capped_reader(stdout_reader);
            let stderr = join_capped_reader(stderr_reader);

            return ProcessRunOutput {
                status: ProcessRunStatus::FailedToStart,
                exit_code: None,
                stdout: stdout.text,
                stderr: stderr.text,
                stdout_truncated: stdout.truncated,
                stderr_truncated: stderr.truncated,
                duration_ms: started_at.elapsed().as_millis(),
                error_message: Some(format!("could not write process stdin: {message}")),
            };
        }
    }

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = join_capped_reader(stdout_reader);
                let stderr = join_capped_reader(stderr_reader);
                let error_message = combine_reader_errors(&stdout, &stderr);

                return ProcessRunOutput {
                    status: ProcessRunStatus::Completed,
                    exit_code: status.code(),
                    stdout: stdout.text,
                    stderr: stderr.text,
                    stdout_truncated: stdout.truncated,
                    stderr_truncated: stderr.truncated,
                    duration_ms: started_at.elapsed().as_millis(),
                    error_message,
                };
            }
            Ok(None) => {
                if started_at.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();

                    let stdout = join_capped_reader(stdout_reader);
                    let stderr = join_capped_reader(stderr_reader);
                    let error_message = combine_timeout_errors(&stdout, &stderr);

                    return ProcessRunOutput {
                        status: ProcessRunStatus::TimedOut,
                        exit_code: None,
                        stdout: stdout.text,
                        stderr: stderr.text,
                        stdout_truncated: stdout.truncated,
                        stderr_truncated: stderr.truncated,
                        duration_ms: started_at.elapsed().as_millis(),
                        error_message,
                    };
                }

                thread::sleep(PROCESS_POLL_INTERVAL);
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();

                let stdout = join_capped_reader(stdout_reader);
                let stderr = join_capped_reader(stderr_reader);
                let error_message = Some(format!("could not wait for process: {error}"));

                return ProcessRunOutput {
                    status: ProcessRunStatus::FailedToStart,
                    exit_code: None,
                    stdout: stdout.text,
                    stderr: stderr.text,
                    stdout_truncated: stdout.truncated,
                    stderr_truncated: stderr.truncated,
                    duration_ms: started_at.elapsed().as_millis(),
                    error_message,
                };
            }
        }
    }
}

fn write_child_stdin(child: &mut std::process::Child, input: &str) -> Result<(), String> {
    let Some(mut stdin) = child.stdin.take() else {
        return Err("could not capture process stdin".to_owned());
    };

    stdin
        .write_all(input.as_bytes())
        .map_err(|error| error.to_string())
}

fn failed_to_start(started_at: Instant, message: impl Into<String>) -> ProcessRunOutput {
    ProcessRunOutput {
        status: ProcessRunStatus::FailedToStart,
        exit_code: None,
        stdout: String::new(),
        stderr: String::new(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: started_at.elapsed().as_millis(),
        error_message: Some(message.into()),
    }
}

fn spawn_capped_reader<R>(reader: R, cap_bytes: usize) -> thread::JoinHandle<CappedText>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || read_capped_text(reader, cap_bytes))
}

fn read_capped_text(mut reader: impl Read, cap_bytes: usize) -> CappedText {
    let mut bytes = Vec::new();
    let mut truncated = false;
    let mut buffer = [0_u8; 8192];

    loop {
        let read_count = match reader.read(&mut buffer) {
            Ok(read_count) => read_count,
            Err(error) => {
                return CappedText {
                    text: String::from_utf8_lossy(&bytes).into_owned(),
                    truncated,
                    error_message: Some(format!("could not read process output: {error}")),
                }
            }
        };

        if read_count == 0 {
            break;
        }

        let remaining = cap_bytes.saturating_sub(bytes.len());

        if remaining > 0 {
            let stored_count = remaining.min(read_count);
            bytes.extend_from_slice(&buffer[..stored_count]);
        }

        if read_count > remaining {
            truncated = true;
        }
    }

    CappedText {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        truncated,
        error_message: None,
    }
}

fn join_capped_reader(reader: thread::JoinHandle<CappedText>) -> CappedText {
    reader.join().unwrap_or_else(|_| CappedText {
        text: String::new(),
        truncated: false,
        error_message: Some("process output reader failed".to_owned()),
    })
}

fn combine_reader_errors(stdout: &CappedText, stderr: &CappedText) -> Option<String> {
    combine_error_messages([
        stdout.error_message.as_deref(),
        stderr.error_message.as_deref(),
    ])
}

fn combine_timeout_errors(stdout: &CappedText, stderr: &CappedText) -> Option<String> {
    combine_error_messages([
        Some("process timed out and was killed"),
        stdout.error_message.as_deref(),
        stderr.error_message.as_deref(),
    ])
}

fn combine_error_messages<'a>(
    messages: impl IntoIterator<Item = Option<&'a str>>,
) -> Option<String> {
    let messages = messages.into_iter().flatten().collect::<Vec<_>>();

    if messages.is_empty() {
        None
    } else {
        Some(messages.join("; "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn rejects_empty_program() {
        let output = run_process_once(ProcessRunRequest {
            program: String::new(),
            args: Vec::new(),
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 1_000,
            stdout_cap_bytes: 1024,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::FailedToStart);
        assert!(output.error_message.unwrap().contains("program"));
    }

    #[test]
    fn rejects_missing_working_directory() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec!["--help".to_owned()],
            stdin: None,
            working_directory: missing_test_directory(),
            timeout_ms: 1_000,
            stdout_cap_bytes: 1024,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::FailedToStart);
        assert!(output.error_message.unwrap().contains("working_directory"));
    }

    #[test]
    fn successful_command_returns_completed_status_exit_code_and_stdout() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec!["--help".to_owned()],
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 2_000,
            stdout_cap_bytes: 16 * 1024,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::Completed);
        assert_eq!(output.exit_code, Some(0));
        assert!(output.stdout.contains("Usage") || output.stdout.contains("USAGE"));
        assert!(output.error_message.is_none());
    }

    #[test]
    fn non_zero_exit_returns_completed_status() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec!["--bad-hobit-test-flag".to_owned()],
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 2_000,
            stdout_cap_bytes: 1024,
            stderr_cap_bytes: 16 * 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::Completed);
        assert_ne!(output.exit_code, Some(0));
        assert!(output.error_message.is_none());
    }

    #[test]
    fn missing_program_returns_failed_to_start() {
        let output = run_process_once(ProcessRunRequest {
            program: format!("hobit-missing-process-{}", unique_test_suffix()),
            args: Vec::new(),
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 1_000,
            stdout_cap_bytes: 1024,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::FailedToStart);
        assert!(output.error_message.unwrap().contains("could not start"));
    }

    #[test]
    fn timeout_returns_timed_out_and_kills_process() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec![
                "--exact".to_owned(),
                "process::tests::timeout_helper_sleeps".to_owned(),
                "--nocapture".to_owned(),
            ],
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 20,
            stdout_cap_bytes: 1024,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::TimedOut);
        assert_eq!(output.exit_code, None);
        assert!(output.error_message.unwrap().contains("process timed out"));
    }

    #[test]
    fn stdout_cap_truncates_output() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec!["--help".to_owned()],
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 2_000,
            stdout_cap_bytes: 8,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::Completed);
        assert_eq!(output.stdout.len(), 8);
        assert!(output.stdout_truncated);
    }

    #[test]
    fn stderr_cap_truncates_output() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec!["--bad-hobit-test-flag".to_owned()],
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 2_000,
            stdout_cap_bytes: 1024,
            stderr_cap_bytes: 8,
        });

        assert_eq!(output.status, ProcessRunStatus::Completed);
        assert_eq!(output.stderr.len(), 8);
        assert!(output.stderr_truncated);
    }

    #[test]
    fn args_are_passed_without_shell_interpretation() {
        let output = run_process_once(ProcessRunRequest {
            program: current_test_exe(),
            args: vec![
                "--help".to_owned(),
                "&&".to_owned(),
                format!("hobit-missing-process-{}", unique_test_suffix()),
            ],
            stdin: None,
            working_directory: env::current_dir().unwrap(),
            timeout_ms: 2_000,
            stdout_cap_bytes: 16 * 1024,
            stderr_cap_bytes: 1024,
        });

        assert_eq!(output.status, ProcessRunStatus::Completed);
        assert_eq!(output.exit_code, Some(0));
        assert!(output.stdout.contains("Usage") || output.stdout.contains("USAGE"));
    }

    #[test]
    fn timeout_helper_sleeps() {
        thread::sleep(Duration::from_millis(250));
    }

    fn current_test_exe() -> String {
        env::current_exe().unwrap().to_string_lossy().into_owned()
    }

    fn missing_test_directory() -> PathBuf {
        env::temp_dir().join(format!("hobit-missing-directory-{}", unique_test_suffix()))
    }

    fn unique_test_suffix() -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();

        format!("{}-{nanos}", std::process::id())
    }
}
