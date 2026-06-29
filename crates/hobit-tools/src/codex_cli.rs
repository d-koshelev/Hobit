//! Safe Codex CLI tool foundations.
//!
//! The probe checks whether a local Codex CLI-like executable responds to
//! `--version`. The Direct Work runners build bounded `codex exec` process
//! requests for an explicit repository root and operator prompt. Neither path
//! exposes frontend UI, Tauri commands, storage persistence, Git mutation,
//! queue execution, an embedded PTY, or an interactive Codex session.

use std::time::Instant;

use crate::process::{run_process_once, ProcessRunRequest, ProcessRunStatus};

pub mod direct_run;
pub mod direct_stream;
mod executable;

pub use direct_run::{
    run_codex_direct_work, CodexApprovalPolicy, CodexDirectRunOutput, CodexDirectRunRequest,
    CodexDirectRunStatus, CodexSandboxMode, DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES,
    DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES, DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS,
};
pub use direct_stream::{
    run_codex_direct_work_streaming, run_codex_direct_work_streaming_with_cancellation,
    CodexDirectStreamCancellationToken, CodexDirectStreamEvent, CodexDirectStreamEventKind,
    CodexDirectStreamOutput, CodexDirectStreamRequest, CodexDirectStreamStatus,
};
pub(crate) use executable::resolve_codex_executable;

pub const DEFAULT_CODEX_CLI_PROGRAM: &str = "codex";
pub const DEFAULT_CODEX_CLI_PROBE_TIMEOUT_MS: u64 = 2_000;
pub const DEFAULT_CODEX_CLI_DOCTOR_TIMEOUT_MS: u64 = 15_000;

const CODEX_CLI_PROBE_OUTPUT_CAP_BYTES: usize = 16 * 1024;
const CODEX_CLI_DOCTOR_OUTPUT_CAP_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CodexCliProbeRequest {
    pub program: Option<String>,
    pub timeout_ms: Option<u64>,
}

impl CodexCliProbeRequest {
    pub fn with_program(program: impl Into<String>) -> Self {
        Self {
            program: Some(program.into()),
            timeout_ms: None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexCliProbeOutput {
    pub available: bool,
    pub program: String,
    pub version: Option<String>,
    pub stdout: String,
    pub stderr: String,
    pub error_message: Option<String>,
    pub duration_ms: u128,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct CodexCliDoctorRequest {
    pub program: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexCliDoctorOutput {
    pub started: bool,
    pub program: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub error_message: Option<String>,
    pub duration_ms: u128,
}

/// Probe local Codex CLI availability using only `<program> --version`.
///
/// The probe uses an OS temp directory as the process working directory so it
/// does not target the Hobit repository or any operator-selected repo root.
pub fn probe_codex_cli(request: CodexCliProbeRequest) -> CodexCliProbeOutput {
    let started_at = Instant::now();
    let program = request
        .program
        .unwrap_or_else(|| DEFAULT_CODEX_CLI_PROGRAM.to_owned())
        .trim()
        .to_owned();

    if program.is_empty() {
        return CodexCliProbeOutput {
            available: false,
            program,
            version: None,
            stdout: String::new(),
            stderr: String::new(),
            error_message: Some("program must not be empty".to_owned()),
            duration_ms: started_at.elapsed().as_millis(),
        };
    }

    let resolution = match resolve_codex_executable(&program) {
        Ok(resolution) => resolution,
        Err(error) => {
            return CodexCliProbeOutput {
                available: false,
                program,
                version: None,
                stdout: String::new(),
                stderr: String::new(),
                error_message: Some(error.message),
                duration_ms: started_at.elapsed().as_millis(),
            };
        }
    };

    let launch =
        executable::codex_launch_command(&resolution.program, vec!["--version".to_owned()]);
    let output = run_process_once(ProcessRunRequest {
        program: launch.program,
        args: launch.args,
        stdin: None,
        working_directory: std::env::temp_dir(),
        timeout_ms: request
            .timeout_ms
            .unwrap_or(DEFAULT_CODEX_CLI_PROBE_TIMEOUT_MS),
        stdout_cap_bytes: CODEX_CLI_PROBE_OUTPUT_CAP_BYTES,
        stderr_cap_bytes: CODEX_CLI_PROBE_OUTPUT_CAP_BYTES,
    });

    let available = output.status == ProcessRunStatus::Completed
        && output.exit_code == Some(0)
        && output.error_message.is_none();
    let version = if available {
        extract_version(&output.stdout).or_else(|| extract_version(&output.stderr))
    } else {
        None
    };
    let error_message = if available {
        None
    } else {
        Some(probe_error_message(&program, &output))
    };

    CodexCliProbeOutput {
        available,
        program: resolution.program,
        version,
        stdout: output.stdout,
        stderr: output.stderr,
        error_message,
        duration_ms: output.duration_ms,
    }
}

/// Run the redacted Codex CLI diagnostic report.
///
/// This helper only invokes `codex doctor --json`. It does not run a prompt,
/// launch Direct Work, or target the Hobit repository as the working directory.
pub fn run_codex_cli_doctor_json(request: CodexCliDoctorRequest) -> CodexCliDoctorOutput {
    let started_at = Instant::now();
    let program = request
        .program
        .unwrap_or_else(|| DEFAULT_CODEX_CLI_PROGRAM.to_owned())
        .trim()
        .to_owned();

    if program.is_empty() {
        return CodexCliDoctorOutput {
            started: false,
            program,
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
            error_message: Some("program must not be empty".to_owned()),
            duration_ms: started_at.elapsed().as_millis(),
        };
    }

    let resolution = match resolve_codex_executable(&program) {
        Ok(resolution) => resolution,
        Err(error) => {
            return CodexCliDoctorOutput {
                started: false,
                program,
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                error_message: Some(error.message),
                duration_ms: started_at.elapsed().as_millis(),
            };
        }
    };

    let launch = executable::codex_launch_command(
        &resolution.program,
        vec!["doctor".to_owned(), "--json".to_owned()],
    );
    let output = run_process_once(ProcessRunRequest {
        program: launch.program,
        args: launch.args,
        stdin: None,
        working_directory: std::env::temp_dir(),
        timeout_ms: request
            .timeout_ms
            .unwrap_or(DEFAULT_CODEX_CLI_DOCTOR_TIMEOUT_MS),
        stdout_cap_bytes: CODEX_CLI_DOCTOR_OUTPUT_CAP_BYTES,
        stderr_cap_bytes: CODEX_CLI_DOCTOR_OUTPUT_CAP_BYTES,
    });

    CodexCliDoctorOutput {
        started: output.status == ProcessRunStatus::Completed,
        program: resolution.program,
        exit_code: output.exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
        error_message: output
            .error_message
            .map(|message| executable::actionable_codex_launch_error(&message)),
        duration_ms: output.duration_ms,
    }
}

fn extract_version(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}

fn probe_error_message(program: &str, output: &crate::process::ProcessRunOutput) -> String {
    if let Some(message) = output.error_message.as_deref() {
        return executable::actionable_codex_launch_error(message);
    }

    match output.status {
        ProcessRunStatus::Completed => {
            let mut message = match output.exit_code {
                Some(exit_code) => {
                    format!("`{program} --version` exited with code {exit_code}")
                }
                None => format!("`{program} --version` exited without an exit code"),
            };

            if let Some(detail) = compact_output_detail(&output.stderr)
                .or_else(|| compact_output_detail(&output.stdout))
            {
                message.push_str(": ");
                message.push_str(&detail);
            }

            message
        }
        ProcessRunStatus::FailedToStart => format!("could not start `{program} --version`"),
        ProcessRunStatus::TimedOut => format!("`{program} --version` timed out"),
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    const PROBE_HELPER_TIMEOUT_MS: u64 = 10_000;

    #[test]
    fn missing_binary_returns_unavailable_with_clear_error() {
        let output = probe_codex_cli(CodexCliProbeRequest {
            program: Some(format!("hobit-missing-codex-{}", unique_test_suffix())),
            timeout_ms: Some(500),
        });

        assert!(!output.available);
        assert!(output.version.is_none());
        assert!(output
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("could not resolve Codex executable"));
    }

    #[test]
    fn empty_program_is_rejected_clearly() {
        let output = probe_codex_cli(CodexCliProbeRequest {
            program: Some("  ".to_owned()),
            timeout_ms: Some(500),
        });

        assert!(!output.available);
        assert_eq!(output.program, "");
        assert!(output.stdout.is_empty());
        assert!(output.stderr.is_empty());
        assert_eq!(
            output.error_message.as_deref(),
            Some("program must not be empty")
        );
    }

    #[test]
    fn successful_probe_captures_version_stdout() {
        let helper = compile_probe_helper(
            "success",
            r#"
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args != ["--version"] {
        eprintln!("unexpected args: {:?}", args);
        std::process::exit(64);
    }
    println!("codex-cli 1.2.3");
}
"#,
        );

        let output = probe_codex_cli(CodexCliProbeRequest {
            program: Some(helper.clone()),
            timeout_ms: Some(PROBE_HELPER_TIMEOUT_MS),
        });

        assert!(output.available, "{output:#?}");
        assert_eq!(output.program, helper);
        assert_eq!(output.version.as_deref(), Some("codex-cli 1.2.3"));
        assert!(output.stdout.contains("codex-cli 1.2.3"));
        assert!(output.error_message.is_none());
    }

    #[test]
    fn nonzero_version_command_returns_unavailable_with_status() {
        let helper = compile_probe_helper(
            "nonzero",
            r#"
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args != ["--version"] {
        eprintln!("unexpected args: {:?}", args);
        std::process::exit(64);
    }
    eprintln!("version probe failed");
    std::process::exit(17);
}
"#,
        );

        let output = probe_codex_cli(CodexCliProbeRequest {
            program: Some(helper),
            timeout_ms: Some(PROBE_HELPER_TIMEOUT_MS),
        });

        assert!(!output.available);
        assert!(output.version.is_none());
        let error_message = output.error_message.as_deref().unwrap_or_default();
        assert!(error_message.contains("code 17"), "{output:#?}");
        assert!(
            error_message.contains("version probe failed"),
            "{output:#?}"
        );
    }

    #[test]
    fn timeout_is_handled_safely() {
        let helper = compile_probe_helper(
            "timeout",
            r#"
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args != ["--version"] {
        eprintln!("unexpected args: {:?}", args);
        std::process::exit(64);
    }
    std::thread::sleep(std::time::Duration::from_secs(5));
    println!("codex-cli late");
}
"#,
        );

        let output = probe_codex_cli(CodexCliProbeRequest {
            program: Some(helper),
            timeout_ms: Some(20),
        });

        assert!(!output.available);
        assert!(output.version.is_none());
        assert!(output
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("timed out"));
    }

    fn compile_probe_helper(name: &str, source: &str) -> String {
        let directory = helper_directory(name);
        fs::create_dir_all(&directory).unwrap();

        let source_path = directory.join("main.rs");
        let executable_path = directory.join(format!("{name}-helper{}", env::consts::EXE_SUFFIX));

        fs::write(&source_path, source).unwrap();

        let rustc = std::env::var("RUSTC").unwrap_or_else(|_| "rustc".to_owned());
        let output = Command::new(rustc)
            .arg(&source_path)
            .arg("-o")
            .arg(&executable_path)
            .output()
            .unwrap();

        assert!(
            output.status.success(),
            "helper compile failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );

        executable_path.to_string_lossy().into_owned()
    }

    fn helper_directory(name: &str) -> PathBuf {
        env::temp_dir().join(format!(
            "hobit-codex-cli-probe-{name}-{}",
            unique_test_suffix()
        ))
    }

    fn unique_test_suffix() -> String {
        static COUNTER: AtomicU64 = AtomicU64::new(0);

        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let counter = COUNTER.fetch_add(1, Ordering::Relaxed);

        format!("{}-{nanos}-{counter}", std::process::id())
    }
}
