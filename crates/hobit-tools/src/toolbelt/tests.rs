use super::*;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn missing_repo_root_is_rejected() {
    let output = run_toolbelt_validation(ToolbeltValidationRequest::new(
        missing_repo("missing-repo"),
        ToolbeltValidationProfile::Fast,
    ));

    assert_eq!(output.status, ToolbeltValidationStatus::FailedToStart);
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

    let output = run_toolbelt_validation(ToolbeltValidationRequest::new(
        repo_file,
        ToolbeltValidationProfile::Fast,
    ));

    assert_eq!(output.status, ToolbeltValidationStatus::FailedToStart);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("repo_root must be a directory"));
}

#[test]
fn missing_validate_script_returns_failed_to_start() {
    let repo = temp_repo("missing-script");
    let output = run_toolbelt_validation(ToolbeltValidationRequest::new(
        repo,
        ToolbeltValidationProfile::Fast,
    ));

    assert_eq!(output.status, ToolbeltValidationStatus::FailedToStart);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("Toolbelt validation script not found"));
    assert!(!output.command_summary.is_empty());
}

#[test]
fn fast_profile_maps_to_correct_args() {
    assert_profile_arg(ToolbeltValidationProfile::Fast, "fast");
}

#[test]
fn changed_profile_maps_to_correct_args() {
    assert_profile_arg(ToolbeltValidationProfile::Changed, "changed");
}

#[test]
fn full_profile_maps_to_correct_args() {
    assert_profile_arg(ToolbeltValidationProfile::Full, "full");
}

#[test]
fn windows_powershell_mapping_is_explicit() {
    let repo = temp_path("windows-command");
    let command = build_toolbelt_validation_command(
        &repo,
        ToolbeltValidationProfile::Changed,
        ToolbeltValidationShellKind::WindowsPowerShell,
        None,
    );
    let script_arg =
        validation_script_relative_path(ToolbeltValidationShellKind::WindowsPowerShell)
            .to_string_lossy()
            .into_owned();

    assert_eq!(command.program, "powershell");
    assert_eq!(
        command.args,
        vec![
            "-NoProfile".to_owned(),
            "-ExecutionPolicy".to_owned(),
            "Bypass".to_owned(),
            "-File".to_owned(),
            script_arg,
            "-Profile".to_owned(),
            "changed".to_owned(),
        ]
    );
}

#[test]
fn unix_bash_mapping_is_explicit() {
    let repo = temp_path("unix-command");
    let command = build_toolbelt_validation_command(
        &repo,
        ToolbeltValidationProfile::Full,
        ToolbeltValidationShellKind::UnixBash,
        None,
    );
    let script_arg = validation_script_relative_path(ToolbeltValidationShellKind::UnixBash)
        .to_string_lossy()
        .into_owned();

    assert_eq!(command.program, "bash");
    assert_eq!(
        command.args,
        vec![script_arg, "--profile".to_owned(), "full".to_owned()]
    );
}

#[test]
fn successful_helper_validation_returns_passed() {
    let repo = temp_repo_with_script("success", HelperScriptBehavior::Success);
    let output = run_toolbelt_validation(ToolbeltValidationRequest::new(
        repo,
        ToolbeltValidationProfile::Fast,
    ));

    assert_eq!(output.status, ToolbeltValidationStatus::Passed);
    assert_eq!(output.exit_code, Some(0));
    assert!(output.stdout.contains("profile:fast"));
    assert!(output.stderr.contains("helper stderr"));
    assert!(output.error_message.is_none());
}

#[test]
fn nonzero_helper_validation_returns_failed_and_preserves_stderr() {
    let repo = temp_repo_with_script("nonzero", HelperScriptBehavior::Nonzero);
    let output = run_toolbelt_validation(ToolbeltValidationRequest::new(
        repo,
        ToolbeltValidationProfile::Changed,
    ));

    assert_eq!(output.status, ToolbeltValidationStatus::Failed);
    assert_eq!(output.exit_code, Some(17));
    assert!(output.stderr.contains("helper stderr"));
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("code 17"));
}

#[test]
fn timeout_returns_timed_out() {
    let repo = temp_repo_with_script("timeout", HelperScriptBehavior::Sleep);
    let mut request = ToolbeltValidationRequest::new(repo, ToolbeltValidationProfile::Fast);
    request.timeout_ms = Some(20);

    let output = run_toolbelt_validation(request);

    assert_eq!(output.status, ToolbeltValidationStatus::TimedOut);
    assert_eq!(output.exit_code, None);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("timed out"));
}

#[test]
fn stdout_and_stderr_caps_apply() {
    let repo = temp_repo_with_script("caps", HelperScriptBehavior::Spam);
    let mut request = ToolbeltValidationRequest::new(repo, ToolbeltValidationProfile::Full);
    request.stdout_cap_bytes = Some(5);
    request.stderr_cap_bytes = Some(7);

    let output = run_toolbelt_validation(request);

    assert_eq!(output.status, ToolbeltValidationStatus::Passed);
    assert_eq!(output.stdout.len(), 5);
    assert_eq!(output.stderr.len(), 7);
    assert!(output.stdout_truncated);
    assert!(output.stderr_truncated);
}

#[test]
fn command_summary_keeps_program_and_args_separate() {
    let repo = temp_repo_with_script("summary", HelperScriptBehavior::Success);
    let output = run_toolbelt_validation(ToolbeltValidationRequest::new(
        repo,
        ToolbeltValidationProfile::Fast,
    ));

    assert!(output.command_summary.len() > 3);
    assert!(!output
        .command_summary
        .iter()
        .any(|part| part.contains(" -") || part.contains(" --profile ")));
    assert!(output
        .command_summary
        .iter()
        .any(|part| part == ToolbeltValidationProfile::Fast.as_cli_arg()));
}

#[test]
fn missing_runner_program_returns_failed_to_start() {
    let repo = temp_repo_with_script("missing-runner", HelperScriptBehavior::Success);
    let request = ToolbeltValidationRequest::new(repo, ToolbeltValidationProfile::Fast);
    let output = run_toolbelt_validation_inner(
        request,
        Some(format!("hobit-missing-runner-{}", unique_suffix())),
    );

    assert_eq!(output.status, ToolbeltValidationStatus::FailedToStart);
    assert!(output
        .error_message
        .as_deref()
        .unwrap_or_default()
        .contains("could not start process"));
}

fn assert_profile_arg(profile: ToolbeltValidationProfile, expected: &str) {
    for shell_kind in [
        ToolbeltValidationShellKind::WindowsPowerShell,
        ToolbeltValidationShellKind::UnixBash,
    ] {
        let command =
            build_toolbelt_validation_command(Path::new("repo"), profile, shell_kind, None);

        assert!(command.args.iter().any(|part| part == expected));
    }
}

#[derive(Clone, Copy)]
enum HelperScriptBehavior {
    Success,
    Nonzero,
    Sleep,
    Spam,
}

fn temp_repo_with_script(name: &str, behavior: HelperScriptBehavior) -> PathBuf {
    let repo = temp_repo(name);
    write_validation_script(&repo, default_shell_kind(), behavior);
    repo
}

fn write_validation_script(
    repo: &Path,
    shell_kind: ToolbeltValidationShellKind,
    behavior: HelperScriptBehavior,
) {
    let script_path = repo.join(validation_script_relative_path(shell_kind));
    fs::create_dir_all(script_path.parent().unwrap()).unwrap();
    fs::write(&script_path, validation_script_source(shell_kind, behavior)).unwrap();
}

fn validation_script_source(
    shell_kind: ToolbeltValidationShellKind,
    behavior: HelperScriptBehavior,
) -> &'static str {
    match (shell_kind, behavior) {
        (ToolbeltValidationShellKind::WindowsPowerShell, HelperScriptBehavior::Success) => {
            r#"param([string]$Profile)
Write-Output "profile:$Profile"
[Console]::Error.WriteLine("helper stderr")
exit 0
"#
        }
        (ToolbeltValidationShellKind::WindowsPowerShell, HelperScriptBehavior::Nonzero) => {
            r#"param([string]$Profile)
Write-Output "profile:$Profile"
[Console]::Error.WriteLine("helper stderr")
exit 17
"#
        }
        (ToolbeltValidationShellKind::WindowsPowerShell, HelperScriptBehavior::Sleep) => {
            r#"param([string]$Profile)
Write-Output "profile:$Profile"
Start-Sleep -Seconds 5
exit 0
"#
        }
        (ToolbeltValidationShellKind::WindowsPowerShell, HelperScriptBehavior::Spam) => {
            r#"param([string]$Profile)
Write-Output ("o" * 100)
[Console]::Error.WriteLine(("e" * 100))
exit 0
"#
        }
        (ToolbeltValidationShellKind::UnixBash, HelperScriptBehavior::Success) => {
            r#"#!/usr/bin/env bash
profile=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) shift; profile="$1" ;;
  esac
  shift || true
done
echo "profile:$profile"
echo "helper stderr" >&2
exit 0
"#
        }
        (ToolbeltValidationShellKind::UnixBash, HelperScriptBehavior::Nonzero) => {
            r#"#!/usr/bin/env bash
profile=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) shift; profile="$1" ;;
  esac
  shift || true
done
echo "profile:$profile"
echo "helper stderr" >&2
exit 17
"#
        }
        (ToolbeltValidationShellKind::UnixBash, HelperScriptBehavior::Sleep) => {
            r#"#!/usr/bin/env bash
profile=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) shift; profile="$1" ;;
  esac
  shift || true
done
echo "profile:$profile"
sleep 5
exit 0
"#
        }
        (ToolbeltValidationShellKind::UnixBash, HelperScriptBehavior::Spam) => {
            r#"#!/usr/bin/env bash
printf '%*s' 100 '' | tr ' ' 'o'
printf '%*s' 100 '' | tr ' ' 'e' >&2
exit 0
"#
        }
    }
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
    std::env::temp_dir().join(format!(
        "hobit-toolbelt-validation-{name}-{}",
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
