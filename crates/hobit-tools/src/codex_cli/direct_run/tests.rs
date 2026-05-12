use super::*;

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn empty_program_is_rejected() {
    let output = run_codex_direct_work(request_with_program(temp_repo("empty-program"), "x", " "));

    assert_eq!(output.status, CodexDirectRunStatus::FailedToStart);
    assert_eq!(
        output.error_message.as_deref(),
        Some("program must not be empty")
    );
    assert!(output.stdout.is_empty());
    assert!(output.stderr.is_empty());
}

#[test]
fn missing_repo_root_is_rejected() {
    let output = run_codex_direct_work(request_with_program(
        missing_repo("missing-repo"),
        "x",
        direct_run_helper(),
    ));

    assert_eq!(output.status, CodexDirectRunStatus::FailedToStart);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("repo_root must exist"));
}

#[test]
fn file_path_repo_root_is_rejected() {
    let repo_file = temp_path("repo-file").join("not-a-directory.txt");
    fs::create_dir_all(repo_file.parent().unwrap()).unwrap();
    fs::write(&repo_file, "not a directory").unwrap();

    let output = run_codex_direct_work(request_with_program(repo_file, "x", direct_run_helper()));

    assert_eq!(output.status, CodexDirectRunStatus::FailedToStart);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("repo_root must be a directory"));
}

#[test]
fn empty_prompt_is_rejected() {
    let output = run_codex_direct_work(request_with_program(
        temp_repo("empty-prompt"),
        " ",
        direct_run_helper(),
    ));

    assert_eq!(output.status, CodexDirectRunStatus::FailedToStart);
    assert_eq!(
        output.error_message.as_deref(),
        Some("prompt must not be empty")
    );
}

#[test]
fn args_are_passed_without_shell_concatenation() {
    let prompt = format!("safe prompt && hobit-missing-{}", unique_suffix());
    let output = run_codex_direct_work(request_with_program(
        temp_repo("safe-args"),
        &prompt,
        direct_run_helper(),
    ));

    assert_eq!(output.status, CodexDirectRunStatus::Completed);
    let final_message = output.final_message.unwrap();
    assert!(final_message.contains("exec\n--cd\n"));
    assert!(final_message.ends_with(&prompt));
    assert!(!output.command_summary.iter().any(|part| part == &prompt));
    assert!(output
        .command_summary
        .iter()
        .any(|part| part == "<operator-prompt>"));
}

#[cfg(windows)]
#[test]
fn direct_run_uses_resolved_codex_cmd_from_path() {
    let directory = temp_path("codex-cmd-path");
    fs::create_dir_all(&directory).unwrap();
    let helper = directory.join("codex.cmd");
    fs::write(
        &helper,
        r#"@echo off
set "last="
:loop
if "%~1"=="" goto done
if "%~1"=="--output-last-message" (
  shift
  set "last=%~1"
)
shift
goto loop
:done
echo helper stdout
echo helper stderr 1>&2
if not "%last%"=="" echo resolved codex.cmd>"%last%"
exit /b 0
"#,
    )
    .unwrap();
    let mut request = request_with_program(temp_repo("codex-cmd-run"), "success", "codex");
    let final_message_directory = temp_path("codex-cmd-final");
    fs::create_dir_all(&final_message_directory).unwrap();
    request.output_last_message_path = Some(final_message_directory.join("last.txt"));

    let output = run_codex_direct_work_inner(request, Some(directory.as_os_str()));

    assert_eq!(output.status, CodexDirectRunStatus::Completed);
    assert_eq!(
        output.command_summary[0],
        helper.to_string_lossy().into_owned()
    );
    assert!(output.stdout.contains("helper stdout"));
    assert!(output.stderr.contains("helper stderr"));
}

#[test]
fn successful_helper_run_returns_completed_and_final_message() {
    let output = run_codex_direct_work(request_with_program(
        temp_repo("success"),
        "success",
        direct_run_helper(),
    ));

    assert_eq!(output.status, CodexDirectRunStatus::Completed);
    assert_eq!(output.exit_code, Some(0));
    assert!(output.stdout.contains("helper stdout"));
    assert!(output.stderr.contains("helper stderr"));
    assert!(output
        .final_message
        .as_deref()
        .unwrap_or_default()
        .contains("success"));
    assert!(output.error_message.is_none());
}

#[test]
fn nonzero_helper_run_returns_failed_status() {
    let output = run_codex_direct_work(request_with_program(
        temp_repo("nonzero"),
        "nonzero",
        direct_run_helper(),
    ));

    assert_eq!(output.status, CodexDirectRunStatus::Failed);
    assert_eq!(output.exit_code, Some(17));
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("code 17"));
}

#[test]
fn timeout_returns_timed_out_status() {
    let mut request = request_with_program(temp_repo("timeout"), "sleep", direct_run_helper());
    request.timeout_ms = Some(20);

    let output = run_codex_direct_work(request);

    assert_eq!(output.status, CodexDirectRunStatus::TimedOut);
    assert_eq!(output.exit_code, None);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("timed out"));
}

#[test]
fn stdout_and_stderr_caps_are_applied() {
    let mut request = request_with_program(temp_repo("caps"), "spam", direct_run_helper());
    request.stdout_cap_bytes = Some(5);
    request.stderr_cap_bytes = Some(7);

    let output = run_codex_direct_work(request);

    assert_eq!(output.status, CodexDirectRunStatus::Completed);
    assert_eq!(output.stdout.len(), 5);
    assert_eq!(output.stderr.len(), 7);
    assert!(output.stdout_truncated);
    assert!(output.stderr_truncated);
}

#[test]
fn workspace_write_sandbox_maps_to_cli_arg() {
    let output = run_codex_direct_work(request_with_program(
        temp_repo("workspace-write"),
        "success",
        direct_run_helper(),
    ));

    assert!(output
        .final_message
        .as_deref()
        .unwrap_or_default()
        .contains("--sandbox\nworkspace-write\n"));
}

#[test]
fn read_only_sandbox_maps_to_cli_arg() {
    let mut request = request_with_program(temp_repo("read-only"), "success", direct_run_helper());
    request.sandbox = CodexSandboxMode::ReadOnly;

    let output = run_codex_direct_work(request);

    assert!(output
        .final_message
        .as_deref()
        .unwrap_or_default()
        .contains("--sandbox\nread-only\n"));
}

#[test]
fn approval_policies_map_to_cli_args() {
    assert_approval_policy_arg(CodexApprovalPolicy::Never, "never");
    assert_approval_policy_arg(CodexApprovalPolicy::OnRequest, "on-request");
    assert_approval_policy_arg(CodexApprovalPolicy::Untrusted, "untrusted");
}

#[test]
fn supported_sandbox_modes_do_not_emit_danger_full_access() {
    for sandbox in [CodexSandboxMode::ReadOnly, CodexSandboxMode::WorkspaceWrite] {
        assert_ne!(sandbox.as_cli_arg(), "danger-full-access");
    }
}

#[test]
fn missing_output_last_message_file_is_reported_without_panicking() {
    let output = run_codex_direct_work(request_with_program(
        temp_repo("no-final"),
        "no-final",
        direct_run_helper(),
    ));

    assert_eq!(output.status, CodexDirectRunStatus::Completed);
    assert!(output.final_message.is_none());
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("could not read final message file"));
    assert!(output.stdout.contains("helper stdout"));
}

fn assert_approval_policy_arg(policy: CodexApprovalPolicy, expected: &str) {
    let mut request = request_with_program(temp_repo(expected), "success", direct_run_helper());
    request.approval_policy = policy;

    let output = run_codex_direct_work(request);

    assert!(output
        .final_message
        .as_deref()
        .unwrap_or_default()
        .contains(&format!("--ask-for-approval\n{expected}\n")));
}

fn request_with_program(
    repo_root: PathBuf,
    prompt: impl Into<String>,
    program: impl Into<String>,
) -> CodexDirectRunRequest {
    let mut request = CodexDirectRunRequest::new(
        repo_root,
        prompt,
        CodexSandboxMode::WorkspaceWrite,
        CodexApprovalPolicy::OnRequest,
    );
    request.program = Some(program.into());
    request.timeout_ms = Some(2_000);
    request
}

fn direct_run_helper() -> String {
    static HELPER: OnceLock<String> = OnceLock::new();
    HELPER.get_or_init(compile_direct_run_helper).clone()
}

fn compile_direct_run_helper() -> String {
    let directory = temp_path("helper");
    fs::create_dir_all(&directory).unwrap();

    let source_path = directory.join("main.rs");
    let executable_path = directory.join(format!("helper{}", std::env::consts::EXE_SUFFIX));
    fs::write(&source_path, DIRECT_RUN_HELPER_SOURCE).unwrap();

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

fn temp_repo(name: &str) -> PathBuf {
    let repo = temp_path(name);
    fs::create_dir_all(&repo).unwrap();
    repo
}

fn missing_repo(name: &str) -> PathBuf {
    temp_path(name)
}

fn temp_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("hobit-codex-direct-{name}-{}", unique_suffix()))
}

fn unique_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    format!("{}-{nanos}", std::process::id())
}

const DIRECT_RUN_HELPER_SOURCE: &str = r#"
fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let output_path = args
        .windows(2)
        .find(|window| window[0] == "--output-last-message")
        .map(|window| window[1].clone())
        .expect("missing --output-last-message");
    let prompt = args.last().cloned().unwrap_or_default();

    if prompt == "sleep" {
        std::thread::sleep(std::time::Duration::from_secs(5));
        return;
    }

    if prompt == "spam" {
        print!("{}", "o".repeat(100));
        eprint!("{}", "e".repeat(100));
        std::fs::write(output_path, args.join("\n")).unwrap();
        return;
    }

    println!("helper stdout");
    eprintln!("helper stderr");

    if prompt != "no-final" {
        std::fs::write(output_path, args.join("\n")).unwrap();
    }

    if prompt == "nonzero" {
        std::process::exit(17);
    }
}
"#;
