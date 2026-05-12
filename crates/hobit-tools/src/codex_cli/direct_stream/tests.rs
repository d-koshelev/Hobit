use super::*;

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn streaming_stdout_emits_stdout_line_before_completion() {
    let mut events = Vec::new();
    let output = run_codex_direct_work_streaming(
        request_with_program(
            temp_repo("stdout-stream"),
            "stdout-stream",
            direct_stream_helper(),
        ),
        |event| events.push(event),
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    let stdout_index = event_index(&events, CodexDirectStreamEventKind::StdoutLine);
    let completed_index = event_index(&events, CodexDirectStreamEventKind::Completed);
    assert!(stdout_index < completed_index);
    assert!(events.iter().any(|event| {
        event.kind == CodexDirectStreamEventKind::StdoutLine
            && event.line.as_deref() == Some("helper stdout stream")
    }));
}

#[test]
fn streaming_stderr_emits_stderr_line() {
    let mut events = Vec::new();
    let output = run_codex_direct_work_streaming(
        request_with_program(
            temp_repo("stderr-stream"),
            "stderr-stream",
            direct_stream_helper(),
        ),
        |event| events.push(event),
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    assert!(events.iter().any(|event| {
        event.kind == CodexDirectStreamEventKind::StderrLine
            && event.line.as_deref() == Some("helper stderr stream")
    }));
    assert!(output.stderr_collected.contains("helper stderr stream"));
}

#[test]
fn json_stdout_line_emits_codex_json_event() {
    let mut events = Vec::new();
    let output = run_codex_direct_work_streaming(
        request_with_program(temp_repo("json"), "json", direct_stream_helper()),
        |event| events.push(event),
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    assert!(events.iter().any(|event| {
        event.kind == CodexDirectStreamEventKind::CodexJsonEvent
            && event.line.as_deref() == Some(r#"{"type":"message","text":"hello"}"#)
            && event.parsed_json.as_deref() == Some(r#"{"type":"message","text":"hello"}"#)
    }));
}

#[test]
fn invalid_json_stdout_line_does_not_fail_run() {
    let mut events = Vec::new();
    let output = run_codex_direct_work_streaming(
        request_with_program(
            temp_repo("invalid-json"),
            "invalid-json",
            direct_stream_helper(),
        ),
        |event| events.push(event),
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    assert!(output.error_message.is_none());
    assert!(events
        .iter()
        .any(|event| event.kind == CodexDirectStreamEventKind::StdoutLine
            && event.line.as_deref() == Some("{not json}")));
    assert!(!events
        .iter()
        .any(|event| event.kind == CodexDirectStreamEventKind::CodexJsonEvent));
}

#[test]
fn final_message_file_is_read_and_emitted() {
    let mut events = Vec::new();
    let output = run_codex_direct_work_streaming(
        request_with_program(temp_repo("final"), "final", direct_stream_helper()),
        |event| events.push(event),
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    assert_eq!(
        output.final_message.as_deref(),
        Some("final response from helper")
    );
    assert!(events.iter().any(|event| {
        event.kind == CodexDirectStreamEventKind::FinalMessage
            && event.text.as_deref() == Some("final response from helper")
    }));
}

#[test]
fn timeout_emits_timed_out_status_and_kills_process() {
    let mut request = request_with_program(temp_repo("timeout"), "sleep", direct_stream_helper());
    request.timeout_ms = Some(20);
    let mut events = Vec::new();

    let output = run_codex_direct_work_streaming(request, |event| events.push(event));

    assert_eq!(output.status, CodexDirectStreamStatus::TimedOut);
    assert_eq!(output.exit_code, None);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("timed out"));
    assert!(events
        .iter()
        .any(|event| event.kind == CodexDirectStreamEventKind::TimedOut));
}

#[test]
fn stdout_and_stderr_caps_are_applied() {
    let mut request = request_with_program(temp_repo("caps"), "spam", direct_stream_helper());
    request.stdout_cap_bytes = Some(5);
    request.stderr_cap_bytes = Some(7);

    let output = run_codex_direct_work_streaming(request, |_| {});

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    assert_eq!(output.stdout_collected.len(), 5);
    assert_eq!(output.stderr_collected.len(), 7);
    assert!(output.stdout_truncated);
    assert!(output.stderr_truncated);
}

#[test]
fn nonzero_exit_returns_failed_with_stderr_preserved() {
    let output = run_codex_direct_work_streaming(
        request_with_program(temp_repo("nonzero"), "nonzero", direct_stream_helper()),
        |_| {},
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Failed);
    assert_eq!(output.exit_code, Some(17));
    assert!(output.stderr_collected.contains("helper stderr failure"));
    let error_message = output.error_message.as_deref().unwrap_or_default();
    assert!(error_message.contains("code 17"));
    assert!(error_message.contains("helper stderr failure"));
}

#[test]
fn built_args_put_global_options_before_exec_and_json_exec_options_after() {
    let repo_root = temp_path("argv-order");
    let output_last_message_path = temp_path("argv-order-last").join("last.txt");
    let prompt = "do the focused task";
    let repo_root_arg = repo_root.to_string_lossy().into_owned();
    let output_last_message_arg = output_last_message_path.to_string_lossy().into_owned();

    let args = build_codex_exec_json_args(
        &repo_root,
        CodexSandboxMode::ReadOnly,
        CodexApprovalPolicy::Never,
        &output_last_message_path,
        prompt,
    );

    assert_eq!(
        args,
        vec![
            "--cd".to_owned(),
            repo_root_arg,
            "--sandbox".to_owned(),
            "read-only".to_owned(),
            "--ask-for-approval".to_owned(),
            "never".to_owned(),
            "exec".to_owned(),
            "--json".to_owned(),
            "--output-last-message".to_owned(),
            output_last_message_arg,
            prompt.to_owned(),
        ]
    );
    assert!(arg_index(&args, "--ask-for-approval") < arg_index(&args, "exec"));
    assert!(arg_index(&args, "--sandbox") < arg_index(&args, "exec"));
    assert!(arg_index(&args, "--cd") < arg_index(&args, "exec"));
    assert!(arg_index(&args, "--json") > arg_index(&args, "exec"));
    assert!(arg_index(&args, "--output-last-message") > arg_index(&args, "exec"));
    assert!(arg_index(&args, "--json") < arg_index(&args, "--output-last-message"));
    assert_eq!(args.last().map(String::as_str), Some(prompt));
}

#[test]
fn command_summary_matches_argv_order_and_redacts_prompt() {
    let repo_root = temp_path("summary-order");
    let output_last_message_path = temp_path("summary-order-last").join("last.txt");
    let prompt = "secret operator prompt";
    let repo_root_arg = repo_root.to_string_lossy().into_owned();
    let output_last_message_arg = output_last_message_path.to_string_lossy().into_owned();

    let summary = safe_command_summary(
        "codex",
        &repo_root,
        CodexSandboxMode::WorkspaceWrite,
        CodexApprovalPolicy::OnRequest,
        &output_last_message_path,
    );

    assert_eq!(
        summary,
        vec![
            "codex".to_owned(),
            "--cd".to_owned(),
            repo_root_arg,
            "--sandbox".to_owned(),
            "workspace-write".to_owned(),
            "--ask-for-approval".to_owned(),
            "on-request".to_owned(),
            "exec".to_owned(),
            "--json".to_owned(),
            "--output-last-message".to_owned(),
            output_last_message_arg,
            "<operator-prompt>".to_owned(),
        ]
    );
    assert!(arg_index(&summary, "--ask-for-approval") < arg_index(&summary, "exec"));
    assert!(arg_index(&summary, "--sandbox") < arg_index(&summary, "exec"));
    assert!(arg_index(&summary, "--cd") < arg_index(&summary, "exec"));
    assert!(arg_index(&summary, "--json") > arg_index(&summary, "exec"));
    assert!(arg_index(&summary, "--output-last-message") > arg_index(&summary, "exec"));
    assert!(!summary.iter().any(|part| part == prompt));
    assert_eq!(
        summary.last().map(String::as_str),
        Some("<operator-prompt>")
    );
}

#[test]
fn args_are_passed_without_shell_concatenation() {
    let prompt = format!("safe prompt && hobit-missing-{}", unique_suffix());
    let output = run_codex_direct_work_streaming(
        request_with_program(temp_repo("safe-args"), &prompt, direct_stream_helper()),
        |_| {},
    );

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    let final_message = output.final_message.unwrap();
    assert!(final_message.contains("--ask-for-approval\non-request\nexec\n--json\n"));
    assert!(final_message.contains("exec\n--json\n--output-last-message\n"));
    assert!(final_message.ends_with(&prompt));
    assert!(!output.command_summary.iter().any(|part| part == &prompt));
    assert!(output
        .command_summary
        .iter()
        .any(|part| part == "<operator-prompt>"));
}

#[cfg(windows)]
#[test]
fn direct_stream_uses_resolved_codex_cmd_from_path() {
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

    let output =
        run_codex_direct_work_streaming_inner(request, |_| {}, Some(directory.as_os_str()));

    assert_eq!(output.status, CodexDirectStreamStatus::Completed);
    assert_eq!(
        output.command_summary[0],
        helper.to_string_lossy().into_owned()
    );
    assert!(output.stdout_collected.contains("helper stdout"));
    assert!(output.stderr_collected.contains("helper stderr"));
}

fn event_index(events: &[CodexDirectStreamEvent], kind: CodexDirectStreamEventKind) -> usize {
    events
        .iter()
        .position(|event| event.kind == kind)
        .unwrap_or_else(|| panic!("missing event kind: {kind}"))
}

fn arg_index(args: &[String], arg: &str) -> usize {
    args.iter()
        .position(|item| item == arg)
        .unwrap_or_else(|| panic!("missing arg: {arg}"))
}

fn request_with_program(
    repo_root: PathBuf,
    prompt: impl Into<String>,
    program: impl Into<String>,
) -> CodexDirectStreamRequest {
    let mut request = CodexDirectStreamRequest::new(
        repo_root,
        prompt,
        CodexSandboxMode::WorkspaceWrite,
        CodexApprovalPolicy::OnRequest,
    );
    request.program = Some(program.into());
    request.timeout_ms = Some(2_000);
    request
}

fn direct_stream_helper() -> String {
    static HELPER: OnceLock<String> = OnceLock::new();
    HELPER.get_or_init(compile_direct_stream_helper).clone()
}

fn compile_direct_stream_helper() -> String {
    let directory = temp_path("helper");
    fs::create_dir_all(&directory).unwrap();

    let source_path = directory.join("main.rs");
    let executable_path = directory.join(format!("helper{}", std::env::consts::EXE_SUFFIX));
    fs::write(&source_path, DIRECT_STREAM_HELPER_SOURCE).unwrap();

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

fn temp_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "hobit-codex-direct-stream-{name}-{}",
        unique_suffix()
    ))
}

fn unique_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    format!("{}-{nanos}", std::process::id())
}

const DIRECT_STREAM_HELPER_SOURCE: &str = r##"
use std::io::Write;

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

    if prompt == "stdout-stream" {
        println!("helper stdout stream");
        std::io::stdout().flush().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
        std::fs::write(output_path, "stdout final").unwrap();
        return;
    }

    if prompt == "stderr-stream" {
        eprintln!("helper stderr stream");
        std::io::stderr().flush().unwrap();
        std::fs::write(output_path, "stderr final").unwrap();
        return;
    }

    if prompt == "json" {
        println!("{}", r#"{"type":"message","text":"hello"}"#);
        std::fs::write(output_path, "json final").unwrap();
        return;
    }

    if prompt == "invalid-json" {
        println!("{{not json}}");
        std::fs::write(output_path, "invalid json final").unwrap();
        return;
    }

    if prompt == "final" {
        std::fs::write(output_path, "final response from helper").unwrap();
        return;
    }

    if prompt == "spam" {
        print!("{}", "o".repeat(100));
        eprint!("{}", "e".repeat(100));
        std::fs::write(output_path, "spam final").unwrap();
        return;
    }

    if prompt == "nonzero" {
        eprintln!("helper stderr failure");
        std::fs::write(output_path, "failed final").unwrap();
        std::process::exit(17);
    }

    println!("helper stdout");
    eprintln!("helper stderr");
    std::fs::write(output_path, args.join("\n")).unwrap();
}
"##;
