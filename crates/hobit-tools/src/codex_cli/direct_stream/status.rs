use super::CodexDirectStreamStatus;

pub(super) fn direct_stream_status(
    timed_out: bool,
    wait_error: Option<&str>,
    exit_code: Option<i32>,
) -> CodexDirectStreamStatus {
    if timed_out {
        return CodexDirectStreamStatus::TimedOut;
    }

    if wait_error.is_some() {
        return CodexDirectStreamStatus::FailedToStart;
    }

    if exit_code == Some(0) {
        CodexDirectStreamStatus::Completed
    } else {
        CodexDirectStreamStatus::Failed
    }
}

pub(super) fn direct_stream_error_message(
    status: CodexDirectStreamStatus,
    exit_code: Option<i32>,
    stderr: &str,
    stdout: &str,
) -> Option<String> {
    match status {
        CodexDirectStreamStatus::Completed => None,
        CodexDirectStreamStatus::Failed => {
            let mut message = match exit_code {
                Some(exit_code) => format!("codex exec --json exited with code {exit_code}"),
                None => "codex exec --json exited without an exit code".to_owned(),
            };

            if let Some(detail) = compact_output_detail(stderr) {
                message.push_str(": stderr: ");
                message.push_str(&detail);
            } else if let Some(detail) = compact_output_detail(stdout) {
                message.push_str(": stdout: ");
                message.push_str(&detail);
            }

            Some(message)
        }
        CodexDirectStreamStatus::FailedToStart => {
            Some("could not start codex exec --json".to_owned())
        }
        CodexDirectStreamStatus::TimedOut => {
            Some("codex exec --json timed out and was killed".to_owned())
        }
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
