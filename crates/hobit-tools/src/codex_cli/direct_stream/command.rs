use std::path::Path;

use super::super::direct_run::{CodexApprovalPolicy, CodexSandboxMode};

pub(super) fn validate_repo_root(repo_root: &Path) -> Option<String> {
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

pub(super) fn build_codex_exec_json_args(
    repo_root: &Path,
    resume_thread_id: Option<&str>,
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

    args.push("exec".to_owned());
    if let Some(thread_id) = normalized_resume_thread_id(resume_thread_id) {
        args.push("resume".to_owned());
        args.push(thread_id.to_owned());
    }

    if skip_git_repo_check {
        args.push("--skip-git-repo-check".to_owned());
    }

    args.extend([
        "--json".to_owned(),
        "--output-last-message".to_owned(),
        output_last_message_path.to_string_lossy().into_owned(),
    ]);

    args
}

pub(super) fn safe_command_summary(
    launch_program: &str,
    launch_args: &[String],
    repo_root: &Path,
    resume_thread_id: Option<&str>,
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

    expected_codex_args.push("exec".to_owned());
    if let Some(thread_id) = normalized_resume_thread_id(resume_thread_id) {
        expected_codex_args.push("resume".to_owned());
        expected_codex_args.push(thread_id.to_owned());
    }

    if skip_git_repo_check {
        expected_codex_args.push("--skip-git-repo-check".to_owned());
    }

    expected_codex_args.extend([
        "--json".to_owned(),
        "--output-last-message".to_owned(),
        output_last_message_path.to_string_lossy().into_owned(),
    ]);
    debug_assert!(launch_args.ends_with(&expected_codex_args));

    let mut summary = Vec::with_capacity(2 + launch_args.len());
    summary.push(launch_program.to_owned());
    summary.extend(launch_args.iter().cloned());
    summary.push("<operator-prompt-stdin>".to_owned());
    summary
}

fn normalized_resume_thread_id(thread_id: Option<&str>) -> Option<&str> {
    thread_id
        .map(str::trim)
        .filter(|thread_id| !thread_id.is_empty())
}
